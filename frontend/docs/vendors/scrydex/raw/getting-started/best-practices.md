Getting Started

# Best Practices

## Images

When using the **Scrydex API**, you are free to include the provided card images in your applications. However, for optimal performance, we recommend following the best practices outlined below.

### 1\. **Cache Images Locally**

- **Why**: Caching image URLs or downloading and serving images locally significantly reduces dependency on API requests and external servers.
- **Benefits**:


  - Faster load times for your application.
  - Increased reliability in case of API downtime or network delays.
- **How**: Store image URLs in your database and cache responses on your server.

* * *

### 2\. **Store Images on Your Own Servers**

- Hosting the images yourself (e.g., on your own **Content Delivery Network (CDN)**) ensures better control and reliability, particularly for high-traffic applications.
- This minimizes:

  - Repeated requests to the Scrydex servers.
  - API credit usage on endpoints just to retrieve the same image repeatedly. (consuming images does not cost any credits)

* * *

### 3\. **Use Scrydex-Provided Image URLs**

- If caching or hosting locally is not an option, you can directly reference the Scrydex-provided image URLs.
- **Tip**: Ensure you build proper fallback logic in case the primary image URL becomes unavailable.


  - Example: Have an offline placeholder image or retry logic in your app.
- Never assume the urls -> they generally follow a specific pattern, but that is not guaranteed. Always reference the urls as returned by the API.

* * *

## Key Benefits of Following Image Best Practices

- **Improved Performance**:




Caching and self-hosting reduce image load times for end-users.

- **Reduced API Costs**:




Avoid unnecessary API calls for images, preserving your API credits for other important requests.

- **Enhanced User Experience**:




Locally cached or CDN-hosted images provide uninterrupted image availability, giving users a smoother experience even during API connectivity issues.


* * *

## Notes About Using Scrydex Images

- **Copyrights**: Scrydex does not claim ownership of the images provided by the API. All images belong to their respective copyright holders.

  - **Important**: By using these images, you acknowledge that you are responsible for compliance with applicable copyright laws and permissions.
- **Attribution Recommendations**: It is generally recommended to provide attribution to the respective copyright holders.


**Example**: Download an image using `curl` and store it locally or on your own CDN:

Example Requests

Lang:BASH

```
bash curl -o xy1-1.webp https://images.scrydex.com/cards/xy1-1/large
```

## Caching

Caching is a vital part of building high-performance, reliable applications that integrate with the **Scrydex API**. By caching data from the API, you can reduce dependency on real-time requests, lower API credit usage, and deliver a smoother user experience. Below are best practices and strategies for caching Scrydex API responses.

### 1\. **Cache API Responses**

- **Why**: Caching API responses locally allows you to reuse data without making repeated API calls for the same information.
- **Benefits**:


  - Faster response times for end-users.
  - Reduced API credit consumption – ideal for endpoints like `/cards`, `/expansions`, or `/price_history`.
  - Improved resilience: Your application continues serving cached data even if there are connectivity issues.
- **How**:


  - Use a caching layer such as **Valkey**, **Redis**, or **Memcached**
  - Expire or invalidate cache periodically based on how often the endpoint’s data changes. For example:

    - Cache pricing data for at least 24 hours. This data only changes at most once per day.
    - Card metadata and expansion data can also be cached for longer periods of time. They are unlikely to change frequently except for new expansions. (we are working on providing webhooks soon to alert users when specific data has changed)

* * *

### 2\. **Periodically Refresh Cached Data**

- Ensure your application refreshes cached data regularly to prevent serving outdated information.
- **Recommended Practices**:


  - Use background jobs to refresh cached API data periodically.
  - Monitor endpoints with predictable update intervals, such as price histories or listings, and set cache expiry accordingly.

* * *

### 3\. **Implement Local Database Storage**

- For applications with high traffic or heavy usage, storing critical data in a local database is recommended.
- **Example Use Cases**:


  - Historical price data for charts.
  - Lists of available cards or expansions.
  - Listings and recent sales data.
- **Tools**: Use a database like **PostgreSQL**, **MySQL**, or **MongoDB** to persist large datasets for faster querying.

* * *

## Key Benefits of Effective Caching

- **Reduced API Credit Costs**: Avoid unnecessarily querying the same data multiple times.
- **Faster Response Times**: Cached data can often be retrieved in milliseconds instead of waiting for a live API request.
- **Improved Application Resilience**: Continue serving users even during network downtimes or heavy API usage.

* * *

## Notes About Caching Scrydex Data

- **Expiration Policies**:


  - Data like card metadata and expansions can be cached for long intervals (several hours or days).
  - Dynamic data, like prices or sales listings, should use shorter refresh cycles based on user needs.
- **Data Accuracy**: Cached data might not always reflect the most current updates. Choose expiration times wisely depending on your application's requirements.
- **API Credits**: Cached data _significantly_ reduces API credit consumption, particularly for high-traffic applications.

There are dozens of ways to implement caching in your application.

Below is a sample in various languages in how you might integrate a caching layer with the Scrydex API.

### Sample Caching Implementation

Example Requests

Lang:RUBYPYTHON

```
require "httparty"
require "json"
require "redis"

# Initialize Redis
redis = Redis.new

# Fetch data from the Scrydex API with caching
def fetch_card_data_with_cache(card_id, redis_conn)
  cache_key = "scrydex:card:#{card_id}"

  # Check if data is cached in Redis
  if redis_conn.exists(cache_key)
    puts "Fetching data from Redis cache..."
    cached_data = redis_conn.get(cache_key)
    return JSON.parse(cached_data)
  end

  puts "Fetching data from Scrydex API..."
  response = HTTParty.get(
    "https://api.scrydex.com/pokemon/v1/cards/#{card_id}",
    headers: {
      "X-Api-Key" => "YOUR_API_KEY",
      "X-Team-ID" => "YOUR_TEAM_ID"
    }
  )

  if response.code == 200
    # Parse JSON and cache in Redis for 15 minutes
    redis_conn.setex(cache_key, 15 * 60, response.body)
    return JSON.parse(response.body)
  else
    puts "Error fetching data: #{response.code} #{response.message}"
    return nil
  end
end

# Example usage
card_id = "xy1-1" # Replace with a valid card ID
card_data = fetch_card_data_with_cache(card_id, redis)
puts card_data
```

```
import requests
import redis
import json

# Initialize Redis
redis_conn = redis.Redis()

def fetch_card_data_with_cache(card_id, redis_conn):
    cache_key = f"scrydex:card:{card_id}"

    # Check if data is cached in Redis
    if redis_conn.exists(cache_key):
        print("Fetching data from Redis cache...")
        cached_data = redis_conn.get(cache_key)
        return json.loads(cached_data)

    # If not cached, fetch data from the API
    print("Fetching data from Scrydex API...")
    url = f"https://api.scrydex.com/pokemon/v1/cards/{card_id}"
    headers = {
        "X-Api-Key": "YOUR_API_KEY",
        "X-Team-ID": "YOUR_TEAM_ID"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        # Parse JSON response and cache it in Redis for 15 minutes
        data = response.json()
        redis_conn.setex(cache_key, 15 * 60, json.dumps(data))
        return data
    else:
        print(f"Error fetching data: {response.status_code} - {response.reason}")
        return None

# Example usage
if __name__ == "__main__":
    card_id = "xy1-1"  # Replace this with a valid card ID
    card_data = fetch_card_data_with_cache(card_id, redis_conn)
    print(card_data)
```
