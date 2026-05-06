Getting Started

# Authentication

## How to authenticate

Authentication is required to access the **Scrydex API**. Follow these steps to get started:

### Step 1: Create an Account

Sign up for a **Scrydex Account** at the [https://scrydex.com/register](https://scrydex.com/register). Once registered, subscribe to one of the available plans.

### Step 2: Create a Team

A **Scrydex Team** is a collection of users who share access to the same API key. You can create a team from the **Scrydex Account Hub**.

Your team ID is necessary to include in your API requests. Even if you are a single individual, you still need to have a team. Team IDs are unique.

### Step 3: Generate an API Key

After subscribing to a plan, you’ll be able to generate an API key through the dashboard. Your **API key** grants you access to the API and determines:

- Your **API credit limit** based on the plan you subscribed to.
- **Overage fees** apply if API credits are exceeded.

### Step 4: Keep Your API Key Secure

Your API key is sensitive and powerful. Be sure to:

- **Do not expose your API key** in public forums like GitHub or client-side code.
- If you suspect your API key has been compromised, immediately rotate it in the **Scrydex Account Hub**.

Remember, these 3 things are necessary to access the API:

1. Scrydex Team ID
2. Scrydex API Key
3. Scrydex Plan

### Making Authenticated API Requests

You authenticate your requests by including the `X-Api-Key` header and the `X-Team-ID` header in every API call.

All API requests must be made over **HTTPS**. Calls over HTTP will fail or redirect to HTTPS automatically. Requests made without authentication headers will proceed, but with heavily reduced rate limits.

Here’s how to authenticate to the API:

Example Requests

Lang:CURLRUBYPYTHON

```
curl -X GET 'https://api.scrydex.com/pokemon/v1/cards' \
-H 'X-Api-Key: YOUR_API_KEY'
-H 'X-Team-ID: YOUR_TEAM_ID'
```

```
require 'httparty'

response = HTTParty.get(
  'https://api.scrydex.com/pokemon/v1/cards',
  headers: { 'X-Api-Key' => 'YOUR_API_KEY', 'X-Team-ID' => 'YOUR_TEAM_ID' }
)
puts response.body
```

```
import requests

headers = {
    'X-Api-Key': 'YOUR_API_KEY',
    'X-Team-ID': 'YOUR_TEAM_ID'
}
response = requests.get('https://api.scrydex.com/pokemon/v1/cards', headers=headers)
print(response.text)
```
