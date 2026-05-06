Getting Started

# Rate Limits

## Understanding Rate Limits

Access to the **Scrydex API** is governed by rate limits tied to your **API credits**. Every API request deducts a specific number of credits from your current balance, with the credits available determined by your subscription plan.

### How Rate Limits Work

1. **Credit-Based Limits**:

   - Your rate limit is tied directly to the number of credits included in your subscription plan.
   - Each request consumes a certain number of credits, as defined in our API documentation.
2. **Rate Limits Per-Second**:

   - There is a rate limit of 100 requests per second applied per-second across all API requests. Currently this limit is the same for all plans.
   - If you exceed the limit, you will receive a `429 Too Many Requests` response.
3. **Overage Fees**:

   - If you exhaust your credits, **overage fees** will apply for additional requests.
   - Stay informed by using the `/account/v1/usage` endpoint to monitor your remaining credits and avoid unexpected fees. Usage info is updated every 20-30 minutes.
4. **Abuse Policy**:

   - Abuse of the API, such as excessive requests far exceeding reasonable usage without valid payments, may result in the suspension or termination of your subscription.

### How to Monitor Usage

Access your usage data via the **Scrydex Developer Dashboard** or by calling the `/account/v1/usage` endpoint.

### Monitoring and Staying Within Rate Limits

You can check your remaining credits and total usage by using the `/account/v1/usage` endpoint directly.

This response provides:

- `total_credits`: The total credits included in your plan.
- `remaining_credits`: Credits left in your account.
- `used_credits`: The credits used so far.
- `overage_credit_rate`: The cost per additional credit after exceeding the limit.

### Summary of Rate Limit Policy

- **Limits are credit-based**: Every plan includes a defined number of API credits, and overages incur additional fees.
- **Monitor actively**: Stay informed by using the `/account/v1/usage` endpoint.
- **Abusive activity**: Excessive use without payment may result in suspension or termination.

#### Find your current usage:

Example Requests

Lang:BASH

```
curl -X GET 'https://api.scrydex.com/account/v1/usage' \
-H 'X-Api-Key: YOUR_API_KEY'
-H 'X-Team-ID: YOUR_TEAM_ID'
```

## Abuse Policy

We reserve the right to suspend or terminate your subscription under the following circumstances:

- **Clear evidence of abuse**: High volumes of API requests consistently exceeding typical usage patterns without record of successful payments.
- **Overdue or failed payments**: Repeated attempts to use the service without paying for overages or the subscription fee.

Our goal is to maintain fair, stable service for all users. If you encounter issues or need help configuring your usage, please contact our support team at [support@scrydex.com](mailto:support@scrydex.com).

## Monitor Your Usage

### Best Practices to Avoid Issues

- **Monitor Your Usage**: Regularly call the `/account/v1/usage` endpoint or review your developer dashboard to ensure you’re within your credit limits.
- **Use Caching**: Cache your data to reduce the number of calls to the API. Caching is highly encouraged to make the most out of your API credits.
- **Optimize Your Requests**:


  - Reduce excessive calls by batching data retrieval wherever possible.
  - Use filtering and pagination to limit the data returned with each request.
