import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { ApiResponse, Card } from "@pcpc/shared";
import {
  cosmosDbService,
  monitoringService,
  redisCacheService,
  scrydexApiService,
} from "../../index";
import {
  formatCacheEntry,
  getCacheAge,
  getCardCacheKey,
  parseCacheEntry,
} from "../../utils/cacheUtils";
import {
  createBadRequestError,
  createNotFoundError,
  handleError,
} from "../../utils/errorUtils";
import {
  cardHasPricing,
  mapScrydexCardToCard,
} from "../../utils/scrydexToCosmos";
import {
  cardToApiResponse,
  type ApiResponseCard,
} from "../../utils/cardToApiResponse";

/**
 * GetCardInfo — Scrydex-powered card detail with cached pricing.
 *
 * Flow:
 * 1. Validate route params (setId, cardId)
 * 2. Check Redis (cache hit returns immediately)
 * 3. Check Cosmos
 * 4. If missing OR no pricing OR forceRefresh: fetch from Scrydex with prices
 * 5. Persist + cache; return canonical Card shape
 */
export async function getCardInfo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  monitoringService.trackEvent("function.invoked", {
    functionName: "GetCardInfo",
    cardId: request.params.cardId || "unknown",
    setId: request.params.setId || "unknown",
    correlationId,
  });

  try {
    const cardIdParam = request.params.cardId;
    const setIdParam = request.params.setId;

    if (!cardIdParam) {
      const errorResponse = createNotFoundError(
        "Card ID",
        "missing",
        "GetCardInfo"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }
    if (!setIdParam) {
      const errorResponse = createNotFoundError(
        "Set ID",
        "missing",
        "GetCardInfo"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    const cardId = cardIdParam.trim();
    const setId = setIdParam.trim();
    if (cardId.length === 0 || setId.length === 0) {
      const errorResponse = createBadRequestError(
        "Set ID and Card ID are required",
        "GetCardInfo"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    context.log(
      `${correlationId} Processing request for card ${cardId} in set ${setId}`
    );

    // SECURITY: see GetSetList for the rationale. `forceRefresh` is
    // intentionally ignored on anonymous-auth public endpoints to
    // prevent unbounded Scrydex API credit burn (this endpoint can also
    // re-fetch pricing on demand, which is a separate Scrydex cost vector).
    // Card data still re-fetches from Scrydex on legitimate cache misses
    // (bounded by card cardinality) and on stale-pricing detection via
    // `needsPricing` — only the forceRefresh override is removed.
    // Addresses Codex P1 review on PR #159.
    const forceRefresh = false;
    const cardsTtl = parseInt(process.env.CACHE_TTL_CARDS || "3600");

    monitoringService.trackEvent("request.parameters", {
      cardId,
      setId,
      forceRefresh,
      correlationId,
    });

    const cacheKey = `${getCardCacheKey(cardId)}-set-${setId}`;
    let card: Card | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheStartTime = Date.now();
      context.log(`${correlationId} Checking Redis cache: ${cacheKey}`);
      const cachedEntry = await redisCacheService.get<{
        data: Card;
        timestamp: number;
        ttl: number;
      }>(cacheKey);
      card = parseCacheEntry<Card>(cachedEntry);
      const cacheTime = Date.now() - cacheStartTime;

      if (card) {
        context.log(`${correlationId} Cache HIT (${cacheTime}ms)`);
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;
        monitoringService.trackEvent("cache.hit", { cardId, correlationId });

        // Cache hit short-circuits to return immediately.
        const response: ApiResponse<Card> = {
          status: 200,
          data: card,
          timestamp: new Date().toISOString(),
          cached: true,
          cacheAge,
        };

        const totalTime = Date.now() - startTime;
        monitoringService.trackEvent("function.success", {
          functionName: "GetCardInfo",
          cardId,
          cached: true,
          duration: totalTime,
          correlationId,
        });
        monitoringService.trackMetric("function.duration", totalTime);

        return {
          jsonBody: response,
          status: response.status,
          headers: { "Cache-Control": `public, max-age=${cardsTtl}` },
        };
      }
      context.log(`${correlationId} Cache MISS (${cacheTime}ms)`);
      monitoringService.trackEvent("cache.miss", { cardId, correlationId });
      monitoringService.trackMetric("cache.check.duration", cacheTime);
    }

    // Cosmos lookup.
    const dbStartTime = Date.now();
    context.log(`${correlationId} Checking Cosmos DB for card ${cardId}`);
    card = await cosmosDbService.getCard(cardId, setId);
    const dbTime = Date.now() - dbStartTime;

    if (card) {
      context.log(
        `${correlationId} Database HIT (${dbTime}ms) — hasPricing: ${cardHasPricing(card)}`
      );
      monitoringService.trackEvent("database.hit", {
        cardId,
        hasPricing: cardHasPricing(card),
        correlationId,
      });
    } else {
      context.log(`${correlationId} Database MISS (${dbTime}ms)`);
      monitoringService.trackEvent("database.miss", { cardId, correlationId });
    }
    monitoringService.trackMetric("cosmosdb.query.duration", dbTime);

    // Fetch from Scrydex if we don't have a card, the caller asked for a
    // forced refresh, or the existing card lacks pricing.
    const needsPricing = !cardHasPricing(card);
    if (!card || forceRefresh || needsPricing) {
      const reason = !card
        ? "missing card"
        : forceRefresh
        ? "forceRefresh"
        : "missing pricing";
      context.log(
        `${correlationId} Fetching card from Scrydex API (${reason})`
      );

      const apiStartTime = Date.now();
      try {
        const scrydexCard = await scrydexApiService.getCard(cardId, true);
        const apiTime = Date.now() - apiStartTime;

        monitoringService.trackDependency(
          "Scrydex API",
          "HTTP",
          `getCard(${cardId})`,
          apiTime,
          scrydexCard !== null
        );

        if (!scrydexCard) {
          if (!card) {
            context.log(`${correlationId} Card ${cardId} not found in Scrydex`);
            const errorResponse = createNotFoundError(
              "Card",
              cardId,
              "GetCardInfo"
            );
            return { jsonBody: errorResponse, status: errorResponse.status };
          }
          context.log(
            `${correlationId} Scrydex returned null for ${cardId}; falling back to existing data`
          );
        } else {
          monitoringService.trackMetric("api.scrydex.duration", apiTime);
          card = mapScrydexCardToCard(scrydexCard);

          const saveStartTime = Date.now();
          await cosmosDbService.saveCard(card);
          const saveTime = Date.now() - saveStartTime;
          context.log(
            `${correlationId} Card saved to Cosmos DB (${saveTime}ms)`
          );
          monitoringService.trackMetric("card.save.duration", saveTime);
        }
      } catch (error: any) {
        if (!card) {
          context.error(
            `${correlationId} Error fetching from Scrydex: ${error.message}`
          );
          monitoringService.trackException(error, {
            functionName: "GetCardInfo",
            cardId,
            setId,
            correlationId,
          });
          throw error;
        }
        context.log(
          `${correlationId} Scrydex refresh failed: ${error.message}; serving existing data`
        );
      }
    }

    if (!card) {
      const errorResponse = createNotFoundError("Card", cardId, "GetCardInfo");
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    if (process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheWriteStartTime = Date.now();
      await redisCacheService.set(
        cacheKey,
        formatCacheEntry(card, cardsTtl),
        cardsTtl
      );
      const cacheWriteTime = Date.now() - cacheWriteStartTime;
      context.log(`${correlationId} Card cached (${cacheWriteTime}ms)`);
    }

    // Apply the same cardName→name rename as GetCardsBySet (and Path A's
    // SvelteKit BFF) so the on-wire shape matches the OpenAPI spec.
    const response: ApiResponse<ApiResponseCard> = {
      status: 200,
      data: cardToApiResponse(card),
      timestamp: new Date().toISOString(),
      cached: false,
    };

    const totalTime = Date.now() - startTime;
    const hasPricing = cardHasPricing(card);
    context.log(
      `${correlationId} Request complete (${totalTime}ms) — hasPricing: ${hasPricing}, variants: ${card.variants?.length ?? 0}`
    );

    monitoringService.trackEvent("function.success", {
      functionName: "GetCardInfo",
      cardId,
      setId,
      hasPricing,
      cached: false,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    return {
      jsonBody: response,
      status: response.status,
      headers: { "Cache-Control": `public, max-age=${cardsTtl}` },
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    context.error(
      `${correlationId} ERROR after ${totalTime}ms: ${error.message}`
    );
    monitoringService.trackException(error, {
      functionName: "GetCardInfo",
      cardId: request.params.cardId || "unknown",
      setId: request.params.setId || "unknown",
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackEvent("function.error", {
      functionName: "GetCardInfo",
      error: error.message,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    const errorResponse = handleError(error, "GetCardInfo");
    return { jsonBody: errorResponse, status: errorResponse.status };
  }
}
