import type { Card, CardImage, CardVariant } from "@pcpc/shared";

/**
 * Wire shape returned to API clients. The OpenAPI spec
 * (apim/specs/pcpc-api-v1.yaml) defines the public field as `name`, but
 * the canonical Card type in @pcpc/shared uses `cardName` for Cosmos
 * persistence. Path A's SvelteKit BFF performs the same rename
 * (frontend/src/routes/api/sets/[set_id]/cards/+server.ts cardToFrontend);
 * mirroring it here keeps Paths B and C on the same on-wire contract.
 *
 * `number` is duplicated as `cardNumber` so frontend code that reads
 * either field works — same as the BFF's mapping.
 */
export interface ApiResponseCard {
  id: string;
  name: string;
  number: string;
  cardNumber: string;
  printedNumber?: string;
  rarity: string;
  rarityCode?: string;
  artist?: string;
  images?: CardImage[];
  variants?: CardVariant[];
  setCode: string;
  setId: string;
  setName: string;
  pricingLastUpdated?: string;
}

export function cardToApiResponse(card: Card): ApiResponseCard {
  return {
    id: card.id,
    name: card.cardName,
    number: card.cardNumber,
    cardNumber: card.cardNumber,
    printedNumber: card.printedNumber,
    rarity: card.rarity,
    rarityCode: card.rarityCode,
    artist: card.artist,
    images: card.images,
    variants: card.variants,
    setCode: card.setCode,
    setId: card.setId,
    setName: card.setName,
    pricingLastUpdated: card.pricingLastUpdated,
  };
}
