Pokemon

# Listings

## The listing object

Each field available on a Pokémon listing is described below with its field name and corresponding data type.

* * *

**id**`<string>`

The unique identifier for the listing.

* * *

**source**`<string>`

The source of the listing (e.g., "ebay").

* * *

**card\_id**`<string>`

The unique identifier of the card associated with this listing.

* * *

**title**`<string>`

The title of the listing as it appears on the source.

* * *

**variant**`<string>`

The variant of the card in the listing (e.g., "holofoil").

* * *

**company**`<string>`

The grading company (e.g., "PSA"), if applicable.

* * *

**grade**`<string>`

The grade assigned to the card, if applicable.

* * *

**is\_perfect**`<boolean>`

Indicates if the card is in flawless condition.

* * *

**is\_error**`<boolean>`

Indicates if the card contains a notable error.

* * *

**is\_signed**`<boolean>`

Indicates if the card is autographed.

* * *

**url**`<string>`

The URL to the original listing on the source website.

* * *

**price**`<number>`

The sold price of the listing.

* * *

**currency**`<string>`

The currency of the price (e.g., "USD").

* * *

**sold\_at**`<string>`

The date when the listing was sold, in the format YYYY/MM/DD.

Here is an example JSON representation of a Pokémon listing object:

```
{
  "id": "6d690f4c-e467-432a-9735-2ecc493ba012",
  "source": "ebay",
  "card_id": "zsv10pt5-105",
  "title": "2025 Pokemon Blk En-Black Bolt Illustration Rare Seismitoad #105 PSA 10",
  "variant": "holofoil",
  "company": "PSA",
  "grade": "10",
  "is_perfect": false,
  "is_error": false,
  "is_signed": false,
  "url": "https://www.ebay.com/itm/306453556017?nordt=true&rt=nc&orig_cvip=true",
  "price": 2399.0,
  "currency": "USD",
  "sold_at": "2025/08/19"
}
```

Example Requests

Lang:CURL

```
curl -X GET 'https://api.scrydex.com/pokemon/v1/listings/6d690f4c-e467-432a-9735-2ecc493ba012' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'X-Team-ID: YOUR_TEAM_ID'
```

## Get a listing

This endpoint retrieves a specific Pokémon listing by its unique identifier.

### URL

`GET https://api.scrydex.com/pokemon/v1/listings/<id>`

* * *

### URL Parameters

- **id**`<string>`


The unique identifier of the listing to retrieve. This is a required parameter.

* * *

### Query Parameters

- **select**`<comma-separated string>`


Specifies which fields to return in the response.

Example request to fetch a single listing:

Example Requests

Lang:CURL

```
curl -X GET 'https://api.scrydex.com/pokemon/v1/listings/6d690f4c-e467-432a-9735-2ecc493ba012' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'X-Team-ID: YOUR_TEAM_ID'
```

## Search listings

Retrieve all listings for a specific Pokémon card. This endpoint is useful for tracking historical sold prices and market trends.

### URL

`GET https://api.scrydex.com/pokemon/v1/cards/<id>/listings`

* * *

### URL Parameters

- **id**`<string>`


The unique identifier of the card to retrieve listings for (e.g., `zsv10pt5-105`).

* * *

### Query Parameters

The following query parameters are supported for filtering and customizing the response:

| Parameter | Description |
| --- | --- |
| **days** | Filter listings by the number of days since they were sold. |
| **source** | Filter by the source of the listing (e.g., `ebay`). |
| **variant** | Filter by card variant (e.g., `holofoil`). |
| **grade** | Filter by the assigned grade. |
| **company** | Filter by the grading company (e.g., `PSA`). |
| **condition** | Filter by the card condition. |
| **is\_perfect** | Filter for flawless cards (`true` or `false`). |
| **is\_error** | Filter for error cards (`true` or `false`). |
| **is\_signed** | Filter for autographed cards (`true` or `false`). |
| **page** | The page of data to access. |
| **page\_size** | The maximum number of listings to return per page. |
| **select** | A comma-delimited list of fields to return in the response. |
| **include** | Used to include additional data. |

Example request to fetch listings for a card:

Example Requests

Lang:CURL

```
curl -X GET 'https://api.scrydex.com/pokemon/v1/cards/zsv10pt5-105/listings?page=1&page_size=10' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'X-Team-ID: YOUR_TEAM_ID'
```
