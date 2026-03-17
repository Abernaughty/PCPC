# Glossary

## Acronyms & Terms
| Term | Meaning | Context |
|------|---------|---------|
| PCPC | Pokemon Card Price Comparison | Main app in apps/pcpc |
| Scrydex | New TCG API (api.scrydex.com/pokemon/v1) | Successor to pokemontcg.io, replaces PokeData |
| PokeData | Old API (pokedata.io/v0) | Being replaced by Scrydex |
| PokemonTcgApi | Legacy API (api.pokemontcg.io/v2) | Unused service, to be deleted |
| Expansion | A Pokemon card set/series in Scrydex terminology | e.g., "Base", "Scarlet & Violet" |
| Variant | A specific version of a card | e.g., unlimitedHolofoil, firstEditionShadowlessHolofoil |
| NM/LP/MP/HP/DM | Card conditions: Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged | Used in raw pricing |
| PSA | Professional Sports Authenticator | Grading company |
| CGC | Certified Guaranty Company | Grading company |
| BGS | Beckett Grading Services | Grading company |

## API Concepts
| Concept | Meaning |
|---------|---------|
| X-Api-Key | Scrydex API key header |
| X-Team-ID | Scrydex team ID header |
| ?include=prices | Query param to include pricing data in Scrydex card responses |
| ?select=field1,field2 | Query param to limit returned fields |
| q=name:charizard | Lucene-like search syntax for Scrydex |

## Project Codenames
| Name | Project |
|------|---------|
| Scrydex Migration | Replace PokeData with Scrydex API |
