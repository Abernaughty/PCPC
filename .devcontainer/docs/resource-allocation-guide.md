# DevContainer Resource Allocation Guide

## Overview

This guide documents the optimized resource allocation implemented to improve devcontainer performance and resolve slow startup/runtime issues.

## Resource Allocation Summary

### Total System Requirements

**Minimum System Requirements:**

- **RAM**: 12 GB total (10 GB allocated to Docker)
- **CPU**: 6 cores
- **Storage**: 50+ GB available
- **Docker Desktop Memory**: 10-12 GB allocated

**Recommended System Requirements:**

- **RAM**: 16 GB total (12-14 GB allocated to Docker)
- **CPU**: 8 cores
- **Storage**: 100+ GB available (SSD preferred)
- **Docker Desktop Memory**: 12-14 GB allocated

## Container Resource Allocations

### 1. Cosmos DB Emulator (Highest Priority)

```yaml
deploy:
  resources:
    limits:
      memory: 6G # Maximum memory usage
      cpus: "4" # Maximum CPU cores
    reservations:
      memory: 4G # Guaranteed memory
      cpus: "2" # Guaranteed CPU cores
shm_size: 2G # Shared memory for performance
```

**Rationale:**

- Cosmos DB emulator is the most resource-intensive component
- Requires substantial memory for database operations
- Benefits significantly from dedicated CPU resources
- Shared memory improves internal communication performance

### 2. DevContainer (Development Environment)

```yaml
deploy:
  resources:
    limits:
      memory: 4G # Maximum memory usage
      cpus: "4" # Maximum CPU cores
    reservations:
      memory: 2G # Guaranteed memory
      cpus: "2" # Guaranteed CPU cores
```

**Rationale:**

- Hosts VS Code server, Node.js, TypeScript compilation
- Needs sufficient resources for development tools
- Handles build processes and file operations
- Supports multiple concurrent development tasks

### 3. Azurite Storage Emulator (Lightweight)

```yaml
deploy:
  resources:
    limits:
      memory: 1G # Maximum memory usage
      cpus: "1" # Maximum CPU cores
    reservations:
      memory: 512M # Guaranteed memory
      cpus: "0.5" # Guaranteed CPU cores
```

**Rationale:**

- Lightweight storage emulator with minimal requirements
- Handles blob, queue, and table storage operations
- Efficient resource usage for storage simulation

## Performance Optimizations Added

### 1. Data Persistence

- **Cosmos DB**: Added persistent volume for data retention
- **Azurite**: Existing persistent volume maintained
- **Benefit**: Faster subsequent startups, data preservation

### 2. Restart Policies

- **All services**: `restart: unless-stopped`
- **Benefit**: Automatic recovery from resource exhaustion or crashes

### 3. Shared Memory Optimization

- **Cosmos DB**: 2GB shared memory allocation
- **Benefit**: Improved internal process communication

### 4. Environment Variables

- **Data Persistence**: `AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true`
- **IP Override**: `AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1`

## Docker Desktop Configuration

### Required Settings

1. **Open Docker Desktop Settings**
2. **Navigate to Resources → Advanced**
3. **Configure the following:**
   - **Memory**: 12-14 GB (for 16 GB system)
   - **CPUs**: 6-8 cores
   - **Swap**: 2-4 GB
   - **Disk Image Size**: 100+ GB

### Windows-Specific Optimizations

```powershell
# Increase virtual memory (run as Administrator)
# Set initial size: 16384 MB, Maximum size: 32768 MB
wmic computersystem where name="%computername%" set AutomaticManagedPagefile=False
wmic pagefileset where name="C:\\pagefile.sys" set InitialSize=16384,MaximumSize=32768
```

## Performance Monitoring

### Resource Usage Commands

```powershell
# Monitor Docker container resources
docker stats

# Check system memory usage
Get-WmiObject -Class Win32_OperatingSystem | Select-Object @{Name="Total RAM (GB)";Expression={[math]::Round($_.TotalVisibleMemorySize/1MB,2)}}, @{Name="Free RAM (GB)";Expression={[math]::Round($_.FreePhysicalMemory/1MB,2)}}

# Monitor CPU usage
Get-Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 5
```

### Performance Indicators

**Good Performance:**

- Container startup: 2-5 minutes
- VS Code responsive within 30 seconds
- TypeScript compilation: <10 seconds
- Memory usage: <80% of allocated Docker memory

**Poor Performance Indicators:**

- Container startup: >10 minutes
- High CPU usage: >90% sustained
- Memory usage: >95% of allocated
- Frequent container restarts
- VS Code unresponsive or slow

## Troubleshooting

### Common Issues and Solutions

#### 1. "Not enough memory" errors

**Solution:**

- Increase Docker Desktop memory allocation
- Close unnecessary applications
- Restart Docker Desktop

#### 2. Containers frequently restarting

**Solution:**

- Check resource limits aren't too restrictive
- Monitor system resource availability
- Review container logs for specific errors

#### 3. Slow performance despite resource allocation

**Solution:**

- Verify Docker Desktop has sufficient resources allocated
- Check for Windows Defender real-time scanning interference
- Ensure using SSD storage for Docker volumes

#### 4. Resource limits not being enforced

**Solution:**

- Ensure Docker Desktop is updated to latest version
- Verify Docker Compose version supports resource constraints
- Use `docker stats` to monitor actual usage

### Diagnostic Commands

```powershell
# Check Docker system info
docker system info

# View container resource usage
docker compose -f .devcontainer/docker-compose.yml ps
docker compose -f .devcontainer/docker-compose.yml top

# Check container logs for resource issues
docker compose -f .devcontainer/docker-compose.yml logs cosmosdb-emulator
docker compose -f .devcontainer/docker-compose.yml logs devcontainer
```

## Testing the Configuration

### Performance Test Script

Run the automated performance test:

```bash
# From Git Bash or WSL
bash .devcontainer/scripts/test-startup-performance.sh
```

### Manual Testing

1. **Clean restart:**

   ```powershell
   docker compose -f .devcontainer/docker-compose.yml down --remove-orphans
   Measure-Command { docker compose -f .devcontainer/docker-compose.yml up -d }
   ```

2. **Monitor startup:**

   ```powershell
   docker compose -f .devcontainer/docker-compose.yml ps
   docker compose -f .devcontainer/docker-compose.yml logs -f
   ```

3. **Test VS Code performance:**
   - Open devcontainer in VS Code
   - Time to full responsiveness
   - Test TypeScript compilation speed
   - Monitor resource usage during development

## Rollback Instructions

If resource constraints cause issues, you can revert by removing the `deploy` sections:

```yaml
# Remove these sections from each service:
deploy:
  resources:
    limits:
      memory: XG
      cpus: "X"
    reservations:
      memory: XG
      cpus: "X"
```

## Expected Performance Improvements

### Before Optimization

- **Startup Time**: 45+ minutes (reported issue)
- **Memory Usage**: Uncontrolled, potential system exhaustion
- **Performance**: Slow, unresponsive development environment

### After Optimization

- **Startup Time**: 2-5 minutes (normal conditions)
- **Memory Usage**: Controlled, predictable allocation
- **Performance**: Responsive development environment
- **Stability**: Automatic restart on failures
- **Resource Efficiency**: Optimal allocation per service needs

## Maintenance

### Regular Monitoring

- Check resource usage weekly during development
- Monitor for container restart patterns
- Review Docker Desktop resource allocation monthly

### Updates and Adjustments

- Adjust limits based on actual usage patterns
- Scale resources up/down based on development needs
- Update documentation when making changes

---

**Implementation Date**: September 24, 2025  
**Status**: ✅ Implemented and ready for testing  
**Expected Outcome**: Significant performance improvement and stable resource usage  
**Next Review**: Monitor performance over 2 weeks and adjust as needed
