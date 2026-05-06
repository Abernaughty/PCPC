Getting Started

# API Credits

## Understanding API Credits

API credits are used to make requests to the Scrydex API. Each API request consumes a specific number of credits depending on the type of request. Generally, all requests cost 1 credit, except for the following:

- **Price history requests**: 3 credits per request.
- **Image analysis requests**: TBD

The table below outlines the credit costs for each type of API request:

| Request Type | Credits Consumed |
| --- | --- |
| General Request (/cards, /expansions, etc) | 1 |
| Price History (/cards/ID/price\_history) | 3 |
| Image Analysis (coming soon) | TBD |

### What Happens When You Run Out of Credits?

When you’ve consumed all of the credits included in your plan, you enter into **overage credits**:

1. **Uninterrupted Access**:




API access will remain active, and all additional requests will consume overage credits.

2. **Cost of Overage Credits**:




The cost per overage credit depends on your subscription plan.

3. **Billing for Overage Credits**:




Any overage credits used during the current billing cycle will be **charged at the start of the next billing cycle**.




This means at the beginning of a new month, you will:

   - Pay your plan’s monthly fee.
   - Pay for overage credits used in the previous month.

* * *

### Example:

- Your plan includes **5,000 credits per month**.
- After consuming all 5,000 credits:

  - 50 additional general requests (1 credit each) = **50 overage credits**.
  - 10 additional price history requests (3 credits each) = **30 overage credits**.

Your overage usage for the month totals **80 credits**, billed according to your plan’s overage rate.

At the start of the next billing cycle, you will be charged:

1. Your plan’s **monthly fee**.
2. **80 overage credits** at your plan’s overage rate.

Always keep an eye on your usage. You can check your usage by running the following command:

Example Requests

Lang:CURL

```
curl -X GET 'https://api.scrydex.com/account/v1/usage'
-H 'X-API-Key: YOUR_API_KEY'
-H 'X-Team-ID: YOUR_TEAM_ID'
```
