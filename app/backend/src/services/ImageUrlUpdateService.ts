import { CosmosDbService } from "./CosmosDbService";
import { Card } from "../models/Card";
import { PokeDataToTcgMappingService } from "./PokeDataToTcgMappingService";

export interface ImageUrlUpdateResult {
  totalCards: number;
  updatedCards: number;
  skippedCards: number;
  errors: number;
  setId: number;
  setName: string;
}

export class ImageUrlUpdateService {
  private cosmosDbService: CosmosDbService;
  private mappingService: PokeDataToTcgMappingService;

  constructor(
    cosmosDbService: CosmosDbService,
    mappingService: PokeDataToTcgMappingService
  ) {
    this.cosmosDbService = cosmosDbService;
    this.mappingService = mappingService;
  }

  private async getTcgSetId(
    pokeDataSetId: number
  ): Promise<string | null> {
    return this.mappingService.getTcgSetId(pokeDataSetId);
  }

  private constructImageUrls(
    tcgSetId: string,
    cardNumber: string
  ): { small: string; large: string } {
    const cleanCardNumber = cardNumber.replace(/^0+/, "") || "0";

    return {
      small: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}.png`,
      large: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}_hires.png`,
    };
  }

  async updateSetImageUrls(
    setId: number
  ): Promise<ImageUrlUpdateResult> {
    const result: ImageUrlUpdateResult = {
      totalCards: 0,
      updatedCards: 0,
      skippedCards: 0,
      errors: 0,
      setId,
      setName: "",
    };

    console.log(
      `[ImageUrlUpdateService] Starting image URL update for set ${setId}`
    );

    const tcgSetId = await this.getTcgSetId(setId);
    if (!tcgSetId) {
      console.error(
        `[ImageUrlUpdateService] No TCG mapping found for set ${setId}`
      );
      return result;
    }

    console.log(
      `[ImageUrlUpdateService] Found TCG set ID: ${tcgSetId} for PokeData set ${setId}`
    );

    const cards = await this.cosmosDbService.getCardsBySetId(
      setId.toString()
    );
    result.totalCards = cards.length;

    if (cards.length > 0) {
      result.setName = cards[0].setName || "";
    }

    console.log(
      `[ImageUrlUpdateService] Found ${cards.length} cards to process`
    );

    const BATCH_SIZE = 50;
    const updatedCards: Card[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      try {
        if (card.imageUrl && card.imageUrlHiRes) {
          result.skippedCards++;
          continue;
        }

        const imageUrls = this.constructImageUrls(
          tcgSetId,
          card.cardNumber
        );

        card.imageUrl = imageUrls.small;
        card.imageUrlHiRes = imageUrls.large;

        if (!card.images) {
          card.images = {
            small: imageUrls.small,
            large: imageUrls.large,
            original: imageUrls.large,
            variants: {},
          };
        } else {
          card.images.small = imageUrls.small;
          card.images.large = imageUrls.large;
          if (!card.images.original) {
            card.images.original = imageUrls.large;
          }
        }

        updatedCards.push(card);

        if (updatedCards.length >= BATCH_SIZE || i === cards.length - 1) {
          await this.cosmosDbService.saveCards(updatedCards);
          result.updatedCards += updatedCards.length;
          updatedCards.length = 0;
        }
      } catch (error) {
        console.error(
          `[ImageUrlUpdateService] Error processing card ${card.cardNumber}:`,
          error
        );
        result.errors++;
      }
    }

    console.log(
      `[ImageUrlUpdateService] Completed image URL update for set ${setId}`
    );
    console.log(
      `[ImageUrlUpdateService] Results: ${result.updatedCards} updated, ${result.skippedCards} skipped, ${result.errors} errors`
    );

    return result;
  }

  async updateAllSetsImageUrls(): Promise<ImageUrlUpdateResult[]> {
    const results: ImageUrlUpdateResult[] = [];
    console.log(
      "[ImageUrlUpdateService] Starting image URL update for all mapped sets"
    );

    const setIds = await this.mappingService.getMappedPokeDataSetIds();
    console.log(
      `[ImageUrlUpdateService] Found ${setIds.length} mapped sets to process`
    );

    for (const setId of setIds) {
      try {
        const result = await this.updateSetImageUrls(setId);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(
          `[ImageUrlUpdateService] Error processing set ${setId}:`,
          error
        );
      }
    }

    const totalCards = results.reduce(
      (sum, r) => sum + r.totalCards,
      0
    );
    const totalUpdated = results.reduce(
      (sum, r) => sum + r.updatedCards,
      0
    );
    const totalSkipped = results.reduce(
      (sum, r) => sum + r.skippedCards,
      0
    );
    const totalErrors = results.reduce(
      (sum, r) => sum + r.errors,
      0
    );

    console.log("[ImageUrlUpdateService] ========================================");
    console.log("[ImageUrlUpdateService] Image URL Update Complete");
    console.log(
      `[ImageUrlUpdateService] Total cards processed: ${totalCards}`
    );
    console.log(
      `[ImageUrlUpdateService] Total cards updated: ${totalUpdated}`
    );
    console.log(
      `[ImageUrlUpdateService] Total cards skipped: ${totalSkipped}`
    );
    console.log(
      `[ImageUrlUpdateService] Total errors: ${totalErrors}`
    );
    console.log("[ImageUrlUpdateService] ========================================");

    return results;
  }
    
    /**
     * Check if a card needs image URL update
     */
    async checkCardNeedsUpdate(cardId: string, setId: number): Promise<boolean> {
        try {
            const card = await this.cosmosDbService.getCard(cardId, setId);
            if (!card) {
                return false;
            }
            
            // Card needs update if it doesn't have image URLs
            return !card.imageUrl || !card.imageUrlHiRes;
        } catch (error) {
            console.error(`[ImageUrlUpdateService] Error checking card ${cardId}:`, error);
            return false;
        }
    }
}
