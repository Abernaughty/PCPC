# DevContainer Cosmos DB Emulator Fixes

## Issues Resolved

### 1. SSL Certificate Validation Problem
**Issue**: The Cosmos DB emulator uses self-signed certificates that Node.js rejects by default, causing "self-signed certificate" errors.

**Root Cause**: Node.js Cosmos SDK couldn't establish secure connections despite system certificate installation.

**Solution Applied**:
- Added `process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"` to both readiness check and seed scripts
- Added `disableSSLVerification: true` to CosmosClient connection policy
- Added `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable to docker-compose.yml

### 2. Incorrect Seed Script Path Resolution
**Issue**: Startup script failed with "Cannot find module '/workspace/.devcontainer/.devcontainer/scripts/seed-cosmos.mjs'"

**Root Cause**: Incorrect relative path resolution causing double `.devcontainer` in the path.

**Solution Applied**:
- Changed from `node .devcontainer/scripts/seed-cosmos.mjs` 
- To `node /workspace/.devcontainer/scripts/seed-cosmos.mjs`

## Files Modified

### 1. `.devcontainer/scripts/cosmos-readiness-check.mjs`
- Added SSL bypass configuration
- Enhanced CosmosClient with `disableSSLVerification: true`

### 2. `.devcontainer/scripts/seed-cosmos.mjs`
- Added SSL bypass configuration
- Enhanced CosmosClient with `disableSSLVerification: true`

### 3. `.devcontainer/startup.sh`
- Fixed seed script path resolution

### 4. `.devcontainer/docker-compose.yml`
- Added `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable
- Added `AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true` for consistency

## Testing Instructions

### 1. Restart DevContainer
1. Close current DevContainer
2. Rebuild and reopen DevContainer
3. Monitor startup logs for successful Cosmos DB connection

### 2. Expected Success Indicators
- ✅ Cosmos DB emulator starts without SSL errors
- ✅ Readiness check completes successfully
- ✅ Seed script executes without path errors
- ✅ Database and containers are created
- ✅ Sample data is inserted

### 3. Verification Steps
1. Check Cosmos DB Explorer at https://localhost:8081/_explorer/index.html
2. Verify "PokemonCards" database exists
3. Verify "Sets" and "Cards" containers exist with sample data

## Security Notes

**Important**: The SSL bypass (`NODE_TLS_REJECT_UNAUTHORIZED=0`) is only for local development with the Cosmos DB emulator. This should NEVER be used in production environments.

## Next Steps

Once DevContainer starts successfully:
1. Proceed with Phase 3.1.3 Backend Build & Runtime Testing
2. Test Azure Functions connectivity to Cosmos DB
3. Validate complete application stack

## Troubleshooting

If issues persist:
1. Check Docker container logs: `docker logs <container_name>`
2. Verify emulator memory allocation (4GB should be sufficient)
3. Ensure ports 8081 and 10250-10255 are available
4. Check network connectivity between containers

## Technical Details

### SSL Configuration Applied
```javascript
// Environment variable approach
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// CosmosClient configuration approach
const client = new CosmosClient({ 
  endpoint, 
  key,
  connectionPolicy: {
    disableSSLVerification: true
  }
});
```

### Path Resolution Fix
```bash
# Before (incorrect)
node .devcontainer/scripts/seed-cosmos.mjs

# After (correct)
node /workspace/.devcontainer/scripts/seed-cosmos.mjs
```

This comprehensive fix addresses both the SSL certificate validation issues and the path resolution problems that were preventing successful DevContainer startup and Cosmos DB connectivity.
