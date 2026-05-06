Pokemon

# Expansions

## The expansion object

Each field available on a Pokémon expansion is described below with its field name and corresponding data type.

* * *

**id**`<string>`

The unique identifier for the expansion.

* * *

**name**`<string>`

The name of the Pokémon card.

* * *

**series**`<string>`

The series the expansion belongs to (Like Scarlet & Violet).

* * *

**code**`<string>`

The unique code for the expansion.

* * *

**total**`<integer>`

The total number of cards (including secret rares) in the expansion. Variants are not counted separately.

* * *

**printed\_total**`<integer>`

The number of cards printed on the expansion, such as 86 in Black Bolt (1/82, 2/86, etc.)

* * *

**language**`<string>`

The language of the expansion (e.g. English).

* * *

**language\_code**`<string>`

The language code (ISO 2) of the expansion (e.g. EN or JA).

* * *

**release\_date**`<string>`

The release date of the expansion in format YYYY/MM/DD (e.g. 2025/07/18).

* * *

**is\_online\_only**`<boolean>`

Whether the expansion is only available online, such as Pokemon Pocket expansions.

* * *

**logo**`<string>`

The logo url of the expansion.

* * *

**symbol**`<string>`

The symbol url of the expansion.

* * *

**translation**`<map>`

If the expansion is in a language other than English, this field will contain the translation of the expansion nested in a `en` field

- **name**`<string>`: The name of the expansion in English.

Here is an example JSON representation of the Pokémon expansion object:

```
{
  "id": "zsv10pt5",
  "name": "Black Bolt",
  "series": "Scarlet & Violet",
  "code": "BLK",
  "total": 172,
  "printed_total": 86,
  "language": "English",
  "language_code": "EN",
  "release_date": "2025/07/18",
  "is_online_only": false,
  "logo": "https://images.scrydex.com/pokemon/zsv10pt5-logo/logo",
  "symbol": "https://images.scrydex.com/pokemon/zsv10pt5-symbol/symbol"
}
```

Here is a sample in Japanese:

```
{
      "id": "m1s_ja",
      "name": "メガシンフォニア",
      "series": "Mega Evolution",
      "code": "M1S",
      "total": 92,
      "printed_total": 63,
      "language": "Japanese",
      "language_code": "JA",
      "release_date": "2025/08/01",
      "is_online_only": false,
      "logo": "https://images.scrydex.com/pokemon/m1s_ja-logo/logo",
      "symbol": "https://images.scrydex.com/pokemon/m1s_ja-symbol/symbol",
      "translation": {
        "en": {
          "name": "Mega Symphonia"
        }
      }
    },
```

Example Requests

Lang:CURL

```
curl --request GET \
  --url https://api.scrydex.com/pokemon/v1/expansions \
  --header 'X-Api-Key: <api_key_here>'
  --header 'X-Team-ID: <team_id_here>'

curl --request GET \
  --url https://api.scrydex.com/pokemon/v1/expansions/sv1 \
  --header 'X-Api-Key: <api_key_here>'
  --header 'X-Team-ID: <team_id_here>'
```

## Get an expansion

This endpoint retrieves a specific Pokémon expansion by its unique identifier.

### URL

`GET https://api.scrydex.com/pokemon/v1/expansions/<id>`

* * *

### URL Parameters

- **id**`<string>`


The unique identifier of the expansion to retrieve. This is a required parameter.

* * *

### Query Parameters

- **select**`<comma-separated string>`




Specifies which fields to return in the response (e.g., `"name,logo"`).

- **casing**`<string>`




Allows changing the output format of the response. Supported values are:

  - `camel`
  - `snake`

Here is how you can retrieve an expansion using various programming languages (SDKs coming soon):

Example Requests

Lang:CURL

```
curl --request GET \
  --url https://api.scrydex.com/pokemon/v1/expansions/sv1 \
  --header 'X-Api-Key: <api_key_here>'
  --header 'X-Team-ID: <team_id_here>'
```

## Search expansions

Fetching and searching for multiple expansions in the **Scrydex API** is simple yet powerful.

Use the various query parameters to customize your requests and retrieve the specific cards or data you need.

### Query Parameters

All query parameters are optional, but combining them allows for advanced and targeted searches.

Note that all query parameters can be used with snake case or camel case (so pageSize or page\_size are both acceptable).

| Parameter | Description | Default Value |
| --- | --- | --- |
| **q** | A search query for advanced filtering. Examples can be found below. | - |
| **page** | The page of data to access. | `1` |
| **page\_size** | The maximum number of cards to return per page. The highest allowable value is `100`. | `100` (max: `100`) |
| **select** | A comma-delimited list of fields to return in the response (e.g., `?select=id,name`). If omitted, all fields are returned. | - |

* * *

### Key Features of `q` (Search Queries)

Search queries use a Lucene-like syntax for filtering, making it easy to build powerful card searches.

Below are examples of supported query operations:

#### Keyword Matching

- Find expansions that contain "mega" in the name field:
`
name:mega
`
- Search for the phrase "mega brave" in the name field:
`
name:"mega brave"
`
- Combine multiple conditions:

  - Expansions with the series "XY" and language "Japanese"
    `
    series:XY language:japanese
    `
  - Expansions with the series "XY" and the language of "Japanse" OR "English"
    `
    series:XY (language:japanese OR language:english)
    `

#### Exclude Results

- Retrieve only expansions with `series:xy` while excluding english
`
series:xy -language:english
`

#### Wildcard Matching

- Expansions where the name starts with "twi":
`
name:twi*
`
- Expansions where the name starts with "twi" and ends with "ght":
`
name:twi*ght
`

#### Exact Matching

- Match expansions where the name is exactly "lost thunder" (no other characters appear in the name field):
`
!name:"lost thunder"
`

#### Range Searches

Fields containing numerical data (e.g., "total", "printed\_total") support range searches:

- Expansions with at least 200 cards:
`
total:[200 TO *]
`
- Expansions with at most 100 cards:
`
total:[* TO 100]
`
- Expansions with a printed total of 100 or more:
`
total:[100 TO *]
`

> **Pro Tip**: Use square brackets `[ ]` for **inclusive** ranges, and curly braces `{ }` for **exclusive** ranges.

### Example: Fetch & Search Expansions

Use the query parameters to retrieve and search expansions. Below are examples using **Scrydex API**:

* * *

### Ordering Data

The `orderBy` parameter allows for flexible sorting of results:

- Order expansions by name:
`
?orderBy=name
`
- Combine ascending (`ASC`) and descending (`DESC`) order:
`
?orderBy=name,-total
`

* * *

### Field Selection

Optimize and reduce response payload sizes using the `select` parameter to return only the fields you care about:

- Example: Request only `id` and `name` fields for all cards:
`
?select=id,name
`

### Response Example

Here’s a sample response for a search query:

```
{
  "data": [\
    {\
      "id": "sm11",\
      "name": "Unified Minds",\
      "series": "Sun & Moon",\
      "total": 260,\
      "printed_total": 236,\
      "language": "English",\
      "language_code": "EN",\
      "release_date": "2019/08/02",\
      "is_online_only": false,\
      "logo": "https://images.scrydex.com/pokemon/sm11-logo/logo",\
      "symbol": "https://images.scrydex.com/pokemon/sm11-symbol/symbol"\
    },\
    {\
      "id": "sm10",\
      "name": "Unbroken Bonds",\
      "series": "Sun & Moon",\
      "total": 234,\
      "printed_total": 214,\
      "language": "English",\
      "language_code": "EN",\
      "release_date": "2019/05/03",\
      "is_online_only": false,\
      "logo": "https://images.scrydex.com/pokemon/sm10-logo/logo",\
      "symbol": "https://images.scrydex.com/pokemon/sm10-symbol/symbol"\
    },\
    ...\
  ],
  "page": 1,
  "pageSize": 100,
  "totalCount": 200
}
```

* * *

### Best Practices for Fetching & Searching

- **Paginate Results**: Use the `page` and `pageSize` parameters to prevent overloading responses.
- **Limit Fields Returned**: Use the `select` parameter to only get the data you need.
- **Avoid Overhead**: Minimize wildcard or range queries for better performance.
