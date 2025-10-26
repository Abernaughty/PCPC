# SetMapping Pipeline Integration

## Overview

The PCPC deployment pipeline now automatically triggers the `synchronizeSetMappings` function immediately after deploying the Azure Functions backend. This ensures the SetMappings database is populated right after deployment, enabling image URL enhancement to work immediately.

## How It Works

### 1. Deployment Flow

```
Deploy Functions → Wait for Startup → Trigger SetMapping Sync → Continue Pipeline
                                              ↓
                                    (Runs Asynchronously)
                                              ↓
                                    Populates Database
                                              ↓
                                    Enhances Image URLs
```

### 2. Components

#### A. Trigger Script

**Location**: `pipelines/scripts/trigger-set-mapping-sync.sh`

- Invokes the `synchronizeSetMappings` timer function via Azure CLI
- Runs asynchronously (fire-and-forget)
- Includes retry logic (3 attempts with exponential backoff)
- Provides detailed logging and error handling
- Continues on error (won't fail the pipeline)

#### B. Modified Function

**Location**: `app/backend/src/functions/SynchronizeSetMappings/index.ts`

- Now always uses `force: true` when invoked
- Ensures synchronization runs regardless of set count changes
- Populates the database even if counts haven't changed since last run

#### C. Pipeline Integration

**Location**: `.ado/templates/deploy-functions.yml`

- New step added after "Wait for Function App Startup"
- Only runs when functions are actually deployed (`ShouldDeployFunctions == true`)
- Uses `continueOnError: true` to prevent pipeline failures

### 3. Execution Details

**When it runs**:

- After every successful Function App deployment
- In all environments (dev, staging, prod)
- Only when functions are actually deployed (not skipped due to hash match)

**What it does**:

1. Waits for Function App to be ready (30 second delay)
2. Invokes `synchronizeSetMappings` function via Azure CLI
3. Function runs asynchronously in the background
4. Pipeline continues without waiting for completion

**Duration**:

- Trigger time: < 10 seconds
- Sync completion: 5-15 minutes (asynchronous)
- Pipeline impact: Minimal (doesn't wait for sync to complete)

## Monitoring

### Pipeline Logs

Check the "Trigger Initial SetMapping Synchronization" step in the pipeline run:

```bash
==========================================
TRIGGERING SET MAPPING SYNCHRONIZATION
==========================================
Environment: dev
Function App: pcpc-func-dev
Resource Group: pcpc-rg-dev

Attempt 1 of 3...
Invoking synchronizeSetMappings function...

✓ SetMapping synchronization triggered successfully
```

### Application Insights

Query for synchronization events:

```kusto
traces
| where message contains "mapping.sync"
| order by timestamp desc
| take 50
```

### Function App Logs

1. Navigate to Azure Portal → Function App
2. Go to Functions → synchronizeSetMappings
3. Click "Monitor" to view execution history
4. Check logs for detailed sync progress

## Troubleshooting

### Trigger Failed

If the trigger step fails, the pipeline will continue with a warning. You can manually trigger the sync:

**Option 1: Azure Portal**

1. Navigate to Function App → Functions → synchronizeSetMappings
2. Click "Test/Run"
3. Execute the function

**Option 2: Azure CLI**

```bash
az functionapp function invoke \
  --name <function-app-name> \
  --resource-group <resource-group> \
  --function-name synchronizeSetMappings
```

**Option 3: Wait for Scheduled Run**
The function runs automatically on a schedule (default: daily at 7 AM UTC).

### Sync Taking Too Long

The synchronization runs asynchronously and typically takes 5-15 minutes. Monitor progress via:

- Application Insights: Look for `mapping.sync.completed` events
- Function App logs: Check execution duration
- Cosmos DB: Query SetMappings container for new records

### Database Not Populated

If the database isn't being populated after deployment:

1. **Check Function Logs**: Look for errors in the synchronizeSetMappings execution
2. **Verify API Keys**: Ensure `POKEDATA_API_KEY` and `POKEMON_TCG_API_KEY` are set
3. **Check Cosmos DB Connection**: Verify `COSMOS_DB_CONNECTION_STRING` is correct
4. **Review Monitoring Events**: Look for `mapping.sync.failed` events in Application Insights

## Configuration

### Environment Variables

The sync behavior can be configured via environment variables:

- `SET_MAPPING_SYNC_CRON`: Schedule for automatic runs (default: `0 0 7 * * *`)
- `SET_MAPPING_CACHE_TTL_SECONDS`: Cache TTL for mappings (default: `900`)

### Pipeline Parameters

The trigger step uses these parameters from the deploy-functions template:

- `environment`: Target environment (dev/staging/prod)
- `functionAppName`: Name of the Function App
- `resourceGroupName`: Azure resource group name
- `azureSubscription`: Azure service connection

## Benefits

✅ **Immediate Availability**: Database populated right after deployment
✅ **No Manual Intervention**: Fully automated process
✅ **Safe**: Won't fail deployments if trigger fails
✅ **Observable**: Full logging and monitoring support
✅ **Consistent**: Works across all environments
✅ **Asynchronous**: Doesn't block pipeline execution

## Related Documentation

- [Set Mapping Fixes Summary](./set-mapping-fixes-summary.md)
- [Deployment Guide](./deployment-guide.md)
- [Monitoring Guide](./monitoring.md)

## Version History

- **2025-10-26**: Initial implementation of pipeline integration
  - Added trigger script
  - Modified synchronizeSetMappings function to use force: true
  - Integrated into deploy-functions template
