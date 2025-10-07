# APIM Variables Configuration Guide

This guide lists all the variables that need to be added to your Azure DevOps variable groups to enable APIM API and policy deployment.

## Overview

The APIM deployment requires configuration variables to be added to each environment's variable group. These variables control API behavior, security policies, and backend integration.

## Required Variables by Environment

Add these variables to each environment's **config** variable group:

- `vg-pcpc-dev-config`
- `vg-pcpc-staging-config`
- `vg-pcpc-prod-config`

### Core APIM Configuration

| Variable Name         | Description                    | Dev Value       | Staging Value       | Prod Value       |
| --------------------- | ------------------------------ | --------------- | ------------------- | ---------------- |
| `APIM_NAME`           | Name of the APIM instance      | `pcpc-apim-dev` | `pcpc-apim-staging` | `pcpc-apim-prod` |
| `APIM_RESOURCE_GROUP` | Resource group containing APIM | `pcpc-rg-dev`   | `pcpc-rg-staging`   | `pcpc-rg-prod`   |
| `APIM_API_VERSION`    | API version path segment       | `v1`            | `v1`                | `v1`             |

### CORS Configuration

| Variable Name       | Description                            | Dev Value                                                               | Staging Value                              | Prod Value                         |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| `APIM_CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000,https://delightful-forest-*.azurestaticapps.net` | `https://pcpc-staging.azurestaticapps.net` | `https://pcpc.azurestaticapps.net` |

### Rate Limiting Configuration

| Variable Name            | Description                        | Dev Value | Staging Value | Prod Value |
| ------------------------ | ---------------------------------- | --------- | ------------- | ---------- |
| `APIM_RATE_LIMIT_CALLS`  | Number of calls allowed per period | `100`     | `1000`        | `10000`    |
| `APIM_RATE_LIMIT_PERIOD` | Rate limit period in seconds       | `60`      | `60`          | `60`       |

### Caching Configuration

| Variable Name              | Description                                | Dev Value | Staging Value | Prod Value |
| -------------------------- | ------------------------------------------ | --------- | ------------- | ---------- |
| `APIM_CACHE_DURATION_SETS` | Cache duration for sets endpoint (seconds) | `300`     | `600`         | `3600`     |

### Backend Configuration

| Variable Name          | Description                | Dev Value | Staging Value | Prod Value |
| ---------------------- | -------------------------- | --------- | ------------- | ---------- |
| `APIM_BACKEND_TIMEOUT` | Backend timeout in seconds | `30`      | `30`          | `30`       |

## Variable Group Configuration Steps

### 1. Navigate to Variable Groups

1. Go to Azure DevOps → Your Project → Pipelines → Library
2. Select the appropriate variable group for each environment

### 2. Add Variables to Dev Environment

Select `vg-pcpc-dev-config` and add:

```
APIM_NAME = pcpc-apim-dev
APIM_RESOURCE_GROUP = pcpc-rg-dev
APIM_API_VERSION = v1
APIM_CORS_ORIGINS = http://localhost:3000,https://delightful-forest-*.azurestaticapps.net
APIM_RATE_LIMIT_CALLS = 100
APIM_RATE_LIMIT_PERIOD = 60
APIM_CACHE_DURATION_SETS = 300
APIM_BACKEND_TIMEOUT = 30
```

### 3. Add Variables to Staging Environment

Select `vg-pcpc-staging-config` and add:

```
APIM_NAME = pcpc-apim-staging
APIM_RESOURCE_GROUP = pcpc-rg-staging
APIM_API_VERSION = v1
APIM_CORS_ORIGINS = https://pcpc-staging.azurestaticapps.net
APIM_RATE_LIMIT_CALLS = 1000
APIM_RATE_LIMIT_PERIOD = 60
APIM_CACHE_DURATION_SETS = 600
APIM_BACKEND_TIMEOUT = 30
```

### 4. Add Variables to Production Environment

Select `vg-pcpc-prod-config` and add:

```
APIM_NAME = pcpc-apim-prod
APIM_RESOURCE_GROUP = pcpc-rg-prod
APIM_API_VERSION = v1
APIM_CORS_ORIGINS = https://pcpc.azurestaticapps.net
APIM_RATE_LIMIT_CALLS = 10000
APIM_RATE_LIMIT_PERIOD = 60
APIM_CACHE_DURATION_SETS = 3600
APIM_BACKEND_TIMEOUT = 30
```

## Variable Explanations

### APIM_NAME

The name of your API Management instance. Must match the APIM instance created by the infrastructure deployment.

### APIM_RESOURCE_GROUP

The Azure resource group containing your APIM instance. Should match your main resource group.

### APIM_API_VERSION

The version segment in your API path. APIs will be accessible at `/api/{version}/...`

### APIM_CORS_ORIGINS

Comma-separated list of allowed origins for CORS.

- **Dev**: Includes localhost for local development and wildcard for Azure Static Web Apps preview URLs
- **Staging/Prod**: Specific production URLs only

### APIM_RATE_LIMIT_CALLS

Maximum number of API calls allowed per subscription per period.

- **Dev**: 100 calls/minute (low for testing)
- **Staging**: 1,000 calls/minute (moderate for testing)
- **Prod**: 10,000 calls/minute (high for production traffic)

### APIM_RATE_LIMIT_PERIOD

Time period in seconds for rate limiting. Standard is 60 seconds (1 minute).

### APIM_CACHE_DURATION_SETS

How long to cache the sets list endpoint response in seconds.

- **Dev**: 5 minutes (short for testing)
- **Staging**: 10 minutes (moderate)
- **Prod**: 1 hour (long for production efficiency)

### APIM_BACKEND_TIMEOUT

Maximum time in seconds to wait for backend (Azure Functions) response before timing out.

## Verification

After adding all variables, verify:

1. ✅ All 8 variables added to each environment's config variable group
2. ✅ Variable names match exactly (case-sensitive)
3. ✅ Values are appropriate for each environment
4. ✅ No typos in APIM instance names or resource groups

## Notes

- **Function App Key**: The `FUNCTION_APP_KEY` is retrieved automatically at runtime by the pipeline from Azure, so you don't need to add it to variable groups
- **CORS Origins**: Update the Static Web App URLs after deployment to match your actual deployed URLs
- **Rate Limits**: Adjust based on your expected traffic patterns
- **Cache Duration**: Balance between freshness and performance based on how often your data changes

## Next Steps

After configuring these variables:

1. Ensure APIM instance exists (deployed by infrastructure stage)
2. Run the pipeline to deploy APIM APIs and policies
3. Test API endpoints through APIM gateway
4. Monitor APIM analytics for usage patterns
5. Adjust rate limits and cache durations as needed

## Troubleshooting

### Pipeline fails with "variable not found"

- Check variable name spelling (case-sensitive)
- Verify variable is in the correct variable group
- Ensure variable group is linked to the pipeline

### APIM deployment fails with "instance not found"

- Verify APIM_NAME matches the actual APIM instance name
- Check that infrastructure deployment completed successfully
- Confirm APIM instance exists in the specified resource group

### CORS errors in browser

- Update APIM_CORS_ORIGINS with your actual Static Web App URL
- Ensure URL includes https:// protocol
- For dev, include both localhost and Azure preview URLs

### Rate limiting too restrictive

- Increase APIM_RATE_LIMIT_CALLS value
- Monitor APIM analytics to determine appropriate limits
- Consider different limits for different subscription tiers
