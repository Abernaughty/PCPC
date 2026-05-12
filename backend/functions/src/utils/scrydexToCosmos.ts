// Single boundary for Scrydex → canonical Cosmos document shape.
//
// Owns all snake_case→camelCase reshape. Handlers and services never
// touch raw ScrydexCard/ScrydexExpansion fields beyond this module.

import type {
  Card,
  CardImage,
  CardVariant,
  PokemonSet,
  PriceTrends,
  ScrydexCard,
  ScrydexExpansion,
  ScrydexPrice,
  ScrydexVariant,
  TrendData,
  VariantPrice,
} from "@pcpc/shared";

import { normalizeLanguageCode } from "../services/ScrydexApiService";

function mapTrendData(apiTrend?: {
  price_change: number;
  percent_change: number;
}): TrendData | undefined {
  if (!apiTrend) return undefined;
  return {
    priceChange: apiTrend.price_change,
    percentChange: apiTrend.percent_change,
  };
}

export function mapScrydexPriceToVariantPrice(
  price: ScrydexPrice
): VariantPrice {
  const trends: PriceTrends | undefined = price.trends
    ? {
        days1: mapTrendData(price.trends.days_1),
        days7: mapTrendData(price.trends.days_7),
        days14: mapTrendData(price.trends.days_14),
        days30: mapTrendData(price.trends.days_30),
        days90: mapTrendData(price.trends.days_90),
        days180: mapTrendData(price.trends.days_180),
      }
    : undefined;
  return {
    condition: price.condition,
    type: price.type,
    company: price.company,
    grade: price.grade,
    isPerfect: price.is_perfect,
    isError: price.is_error,
    isSigned: price.is_signed,
    low: price.low,
    mid: price.mid,
    high: price.high,
    market: price.market,
    currency: price.currency,
    trends,
  };
}

export function mapScrydexVariantToCardVariant(
  variant: ScrydexVariant
): CardVariant {
  return {
    name: variant.name,
    images: variant.images?.map(
      (img): CardImage => ({
        type: img.type,
        small: img.small,
        medium: img.medium,
        large: img.large,
      })
    ),
    prices: (variant.prices ?? []).map(mapScrydexPriceToVariantPrice),
  };
}

function mapScrydexImages(scrydexImages?: ScrydexCard["images"]): CardImage[] | undefined {
  if (!scrydexImages) return undefined;
  return scrydexImages.map((img) => ({
    type: img.type,
    small: img.small,
    medium: img.medium,
    large: img.large,
  }));
}

export function mapScrydexCardToCard(scrydexCard: ScrydexCard, now?: string): Card {
  const timestamp = now ?? new Date().toISOString();
  const variants = scrydexCard.variants?.map(mapScrydexVariantToCardVariant);
  const hasPricing =
    variants?.some((v) => v.prices && v.prices.length > 0) ?? false;

  return {
    id: scrydexCard.id,
    setCode: scrydexCard.expansion.code,
    setId: scrydexCard.expansion.id,
    setName: scrydexCard.expansion.name,
    cardId: scrydexCard.id,
    cardName: scrydexCard.name,
    cardNumber: scrydexCard.number,
    printedNumber: scrydexCard.printed_number,
    rarity: scrydexCard.rarity || "",
    rarityCode: scrydexCard.rarity_code,
    artist: scrydexCard.artist,
    images: mapScrydexImages(scrydexCard.images),
    variants,
    language: scrydexCard.language,
    languageCode: scrydexCard.language_code
      ? normalizeLanguageCode(scrydexCard.language_code)
      : undefined,
    lastUpdated: timestamp,
    pricingLastUpdated: hasPricing ? timestamp : undefined,
  };
}

export function mapScrydexExpansionToSet(
  expansion: ScrydexExpansion,
  now?: string
): PokemonSet {
  const timestamp = now ?? new Date().toISOString();
  const normalizedLangCode = normalizeLanguageCode(expansion.language_code);
  const isJP = normalizedLangCode === "JP";

  // JP sets: prefer English translation, fall back to native name.
  const translatedName = expansion.translation?.en?.name;
  const displayName =
    isJP && translatedName ? translatedName : expansion.name;

  return {
    id: expansion.id,
    code: expansion.code,
    name: displayName,
    series: expansion.series,
    releaseDate: expansion.release_date,
    total: expansion.total,
    printedTotal: expansion.printed_total,
    language: expansion.language,
    languageCode: normalizedLangCode,
    isOnlineOnly: expansion.is_online_only,
    logo: expansion.logo,
    symbol: expansion.symbol,
    cardCount: expansion.total,
    isCurrent: isSetCurrent(expansion.release_date),
    lastUpdated: timestamp,
  };
}

function isSetCurrent(releaseDate?: string): boolean {
  if (!releaseDate) return false;
  const released = new Date(releaseDate);
  if (Number.isNaN(released.getTime())) return false;
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return released >= twoYearsAgo;
}

export function cardHasPricing(card: Card | null | undefined): boolean {
  if (!card?.variants || card.variants.length === 0) return false;
  return card.variants.some((v) => v.prices && v.prices.length > 0);
}
