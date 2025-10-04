# DevContainer Troubleshooting Guide

## Issues Resolved - September 24, 2025

This document outlines the comprehensive troubleshooting and fixes applied to resolve devcontainer startup failures.

## Primary Issues Identified

### 1. Port Conflicts ✅ FIXED

**Problem**: Port 10000 was already allocated by existing Docker containers

- **Symptom**: `Bind for 0.0.0.0:10000 failed: port is already allocated`
- **Root Cause**: Previous devcontainer instances were still running
- **Solution**:
  ```bash
  docker stop devcontainer-azurite-1 devcontainer-cosmosdb-emulator-1 devcontainer-devcontainer-1
  docker rm devcontainer-azurite-1 devcontainer-cosmosdb-emulator-1 devcontainer-devcontainer-1
  ```

### 2. Missing Node.js Dependencies ✅ FIXED

**Problem**: Cosmos readiness scripts required `@azure/cosmos` but no package.json existed

- **Symptom**: Setup script attempted `npm install` in .devcontainer directory but failed
- **Root Cause**: Missing package.json for Node.js dependencies
- **Solution**: Created `.devcontainer/package.json`:
  ```json
  {
    "name": "pcpc-devcontainer-scripts",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
      "@azure/cosmos": "^4.0.0"
    }
  }
  ```

### 3. Incorrect Container Hostnames ✅ FIXED

**Problem**: Scripts used `localhost:8081` instead of `cosmosdb-emulator:8081`

- **Symptom**: Network connectivity issues between containers
- **Root Cause**: Inconsistent endpoint configuration
- **Solution**: Updated both scripts to use proper container hostnames:
  - `cosmos-readiness-check.mjs`: `https://cosmosdb-emulator:8081`
  - `seed-cosmos.mjs`: `https://cosmosdb-emulator:8081`

### 4. Missing Service Health Checks ✅ FIXED

**Problem**: DevContainer started before emulators were ready

- **Symptom**: Services not available when devcontainer initialization ran
- **Root Cause**: No health checks or proper dependency ordering
- **Solution**: Added comprehensive health checks and proper startup dependencies

## Applied Solutions

### 1. Enhanced Docker Compose Configuration

#### Added Azurite Health Check

```yaml
healthcheck:
  test:
    [
      "CMD",
      "sh",
      "-c",
      "apk add --no-cache curl >/dev/null 2>&1 || true; curl -s -o /dev/null http://localhost:10000/devstoreaccount1/",
    ]
  interval: 5s
  timeout: 3s
  retries: 20
```

#### Added Cosmos DB Health Check

```yaml
environment:
  - AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1
healthcheck:
  test:
    [
      "CMD",
      "sh",
      "-lc",
      "curl -k -s https://localhost:8081/_explorer/emulator.pem >/dev/null",
    ]
  interval: 5s
  timeout: 3s
  retries: 40
```

#### Updated Service Dependencies

```yaml
depends_on:
  azurite:
    condition: service_healthy
  cosmosdb-emulator:
    condition: service_healthy
```

### 2. Script Configuration Fixes

All scripts now use proper container hostnames:

- ✅ `https://cosmosdb-emulator:8081` for Cosmos DB
- ✅ `http://azurite:10000` for Azurite blob storage

### 3. Added Critical Environment Variable

Based on documentation, added `AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1` to prevent POST request hang issues.

## Verification Results

### Container Status ✅ VERIFIED

```
pcpc_devcontainer-azurite-1             Up 2 minutes (healthy)   0.0.0.0:10000-10002
pcpc_devcontainer-cosmosdb-emulator-1   Up 2 minutes (healthy)   0.0.0.0:8081,10250-10255
pcpc_devcontainer-devcontainer-1        Up 11 seconds
```

### Service Connectivity ✅ VERIFIED

- **Azurite**: `http://localhost:10000/devstoreaccount1/` - Connected successfully
- **Cosmos DB**: `https://localhost:8081/_explorer/emulator.pem` - Returning SSL certificate

### Startup Timing ✅ OPTIMIZED

- **Azurite**: Became healthy in 7.6 seconds
- **Cosmos DB**: Became healthy in 120.6 seconds (normal for emulator)
- **DevContainer**: Started immediately after both services were healthy

## Key Learnings

### 1. Importance of Health Checks

- Health checks ensure services are fully operational before dependent containers start
- Cosmos DB emulator requires 40+ retries due to lengthy initialization process
- Proper timeout and retry configuration prevents false failures

### 2. Container Networking

- Use service names (`cosmosdb-emulator:8081`) not `localhost` between containers
- `localhost` inside a container refers to that container, not siblings
- Proper hostname resolution is critical for inter-container communication

### 3. Documentation Value

- Existing documentation in `local-emulators.md` provided crucial configuration guidance
- The `AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1` setting prevents known POST hang issues
- Following documented patterns saves significant troubleshooting time

### 4. Dependency Management

- Node.js scripts require explicit package.json even in devcontainers
- Missing dependencies cause silent failures in setup scripts
- Always verify all runtime dependencies are explicitly declared

## Future Recommendations

### 1. Proactive Monitoring

- Add container resource monitoring (CPU, memory usage)
- Implement log aggregation for easier troubleshooting
- Consider adding automated health reporting

### 2. Error Handling Improvements

- Add more descriptive error messages for common failure scenarios
- Implement graceful degradation when optional services fail
- Add retry logic for transient network issues

### 3. Documentation Maintenance

- Keep troubleshooting guide updated with new issues/solutions
- Document environment-specific configurations
- Maintain examples of working configurations

## Quick Reference Commands

### Clean Slate Restart

```bash
# Stop and remove all containers
docker compose -p pcpc_devcontainer -f .devcontainer/docker-compose.yml down --remove-orphans

# Start fresh
docker compose -p pcpc_devcontainer -f .devcontainer/docker-compose.yml up -d

# Monitor startup
docker compose -p pcpc_devcontainer -f .devcontainer/docker-compose.yml ps
```

### Check Service Health

```bash
# Azurite test
curl -v http://localhost:10000/devstoreaccount1/

# Cosmos DB test
curl -k https://localhost:8081/_explorer/emulator.pem

# Container logs
docker compose -p pcpc_devcontainer -f .devcontainer/docker-compose.yml logs azurite
docker compose -p pcpc_devcontainer -f .devcontainer/docker-compose.yml logs cosmosdb-emulator
```

### Port Conflict Debugging

```powershell
# Windows: Check port usage
netstat -ano | findstr :10000
tasklist /FI "PID eq <PID>"

# Find Docker containers using ports
docker ps --filter "publish=10000"
```

---

**Resolution Date**: September 24, 2025  
**Status**: ✅ All issues resolved and verified working  
**Next Review**: Update when new issues encountered or configurations change
