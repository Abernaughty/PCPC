# PCPC DevContainer ACR Build Guide v1.3.0

## Overview

This guide provides step-by-step instructions for building and deploying the updated PCPC DevContainer image to Azure Container Registry (ACR) with Azure Functions Core Tools v4.x and Terraform 1.13.3.

## New Features in v1.3.0

- ✅ **Azure Functions Core Tools v4.x** (the missing piece!)
- ✅ **Terraform 1.13.3** (updated from 1.9.8)
- ✅ **All 31 VS Code Extensions** pre-installed
- ✅ **Complete Development Stack** (Node.js 22.19.0, Azure CLI, Go 1.23.12, PowerShell, Python 3.12)

## Prerequisites

1. **Docker Desktop** running locally
2. **Azure CLI** installed and authenticated
3. **ACR Access** to `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`

## Step 1: Authenticate with ACR

```bash
# Login to Azure
az login

# Login to your ACR
az acr login --name maberdevcontainerregistry
```

## Step 2: Build the Image Locally

```bash
# Navigate to the .devcontainer directory
cd .devcontainer

# Build the image locally (this will take 10-15 minutes)
docker build -t pcpc-devcontainer:v1.3.0 .

# Verify the build completed successfully
docker images | grep pcpc-devcontainer
```

## Step 3: Test the Image Locally (Optional but Recommended)

```bash
# Run a test container to verify tools are installed
docker run --rm -it pcpc-devcontainer:v1.3.0 bash

# Inside the container, verify tools:
node --version          # Should show v22.19.0
terraform version       # Should show v1.13.3
func --version          # Should show 4.x
go version             # Should show go1.23.12
pwsh --version         # Should show PowerShell 7.x
python3 --version      # Should show Python 3.12.x
az --version           # Should show Azure CLI
gh --version           # Should show GitHub CLI

# Exit the test container
exit
```

## Step 4: Tag and Push to ACR

```bash
# Tag the image for ACR
docker tag pcpc-devcontainer:v1.3.0 maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:v1.3.0
docker tag pcpc-devcontainer:v1.3.0 maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest

# Push both tags to ACR
docker push maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:v1.3.0
docker push maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
```

## Step 5: Update docker-compose.yml (Already Done)

The docker-compose.yml is already configured to use the `latest` tag, so it will automatically use v1.3.0 once pushed.

Current configuration:

```yaml
services:
  devcontainer:
    image: maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
```

## Step 6: Test the New DevContainer

```bash
# Pull the updated image
docker-compose -f .devcontainer/docker-compose.yml pull

# Start the new DevContainer
docker-compose -f .devcontainer/docker-compose.yml up -d

# Or rebuild your DevContainer in VS Code
# Command Palette -> "Dev Containers: Rebuild Container"
```

## Step 7: Verify Installation

Once your DevContainer starts, the setup.sh script will verify all tools:

```bash
# Expected output:
🚀 Initializing PCPC DevContainer v1.3.0 (ACR Optimized)...
✅ Verifying pre-installed development tools...
   Node.js: v22.19.0 (Expected: v22.19.0)
   npm: 10.x.x
   Azure CLI: azure-cli 2.x.x
   Terraform: Terraform v1.13.3 (Expected: v1.13.3)
   Azure Functions Core Tools: 4.x.x (Expected: 4.x)
   Go: go version go1.23.12 linux/amd64 (Expected: go1.23.12)
   PowerShell: PowerShell 7.x.x
   GitHub CLI: gh version 2.x.x
   Python: Python 3.12.x (Expected: 3.12.x)
```

## Build Time Expectations

- **Local Build**: 10-15 minutes (first time)
- **ACR Push**: 2-3 minutes (1.5-2GB image)
- **DevContainer Startup**: 30-60 seconds (95% improvement maintained!)

## Troubleshooting

### Build Fails During VS Code Extensions

If the build fails during VS Code extension installation:

```bash
# The extensions are installed as the vscode user, ensure proper permissions
# This is already handled in the Dockerfile, but if issues persist:
docker build --no-cache -t pcpc-devcontainer:v1.3.0 .
```

### ACR Authentication Issues

```bash
# Refresh ACR login
az acr login --name maberdevcontainerregistry

# Verify access
az acr repository list --name maberdevcontainerregistry
```

### Image Size Concerns

The new image will be approximately 1.5-2GB due to all the development tools and VS Code extensions. This is expected for a comprehensive development environment.

## Version History

- **v1.0.0**: Original ACR image
- **v1.2.0**: Previous version (v1.1.0 was skipped)
- **v1.3.0**: Added Azure Functions Core Tools v4.x + Terraform 1.13.3 + All extensions

## Success Criteria

✅ **Azure Functions Core Tools**: `func --version` returns 4.x  
✅ **Terraform**: `terraform version` returns v1.13.3  
✅ **All Extensions**: 31 VS Code extensions pre-installed  
✅ **Fast Startup**: DevContainer ready in 30-60 seconds  
✅ **Complete Stack**: All development tools operational

## Next Steps

After successful deployment:

1. **Test Azure Functions Development**: Create a test function to verify `func` command works
2. **Test Terraform**: Run `terraform init` in the infra directory
3. **Verify Extensions**: Check that all VS Code extensions are loaded
4. **Update Documentation**: Update memory bank with v1.3.0 deployment success

## Commands Summary

```bash
# Complete build and deploy sequence:
cd .devcontainer
az acr login --name maberdevcontainerregistry
docker build -t pcpc-devcontainer:v1.3.0 .
docker tag pcpc-devcontainer:v1.3.0 maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:v1.3.0
docker tag pcpc-devcontainer:v1.3.0 maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
docker push maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:v1.3.0
docker push maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
```

---

**Note**: This build process will create a comprehensive development environment with all tools pre-installed, maintaining the 95% startup time improvement while ensuring Azure Functions Core Tools and updated Terraform are available.
