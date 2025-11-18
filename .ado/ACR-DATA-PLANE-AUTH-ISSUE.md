# ACR Data Plane Authentication Issue in DevContainer

## ✅ RESOLVED - Docker Socket Permissions

**Date:** 2025-11-16  
**Solution:** Docker-outside-of-Docker with permission fixes

### Implementation

- Removed Docker-in-Docker feature (conflicted with socket mounting)
- Added Docker socket permission fixes to `startup.sh`
- Using host Docker daemon via `/var/run/docker.sock` mount

### Testing Results - All Tests Passed ✅

```bash
# Docker CLI installed and working
$ docker --version
Docker version 29.0.1, build eedd969

# Docker daemon accessible via host socket
$ docker ps
CONTAINER ID   IMAGE                                                                       COMMAND                  CREATED         STATUS
5d33cb3b6a98   vsc-pcpc-5c04df8cf79f69e8c0cd7535e8c4455c8abd798a7dadfad154a25e8d55ac9e1b   "/bin/sh -c 'echo Co…"   6 minutes ago   Up 6 minutes

# ACR login successful (NOTE: Use registry name, not FQDN)
$ az acr login --name maberdevcontainerregistry
Login Succeeded

# ACR repository list working
$ az acr repository list --name maberdevcontainerregistry
[
  "pcpc-ci-node-azure",
  "pcpc-ci-node22",
  "pcpc-ci-terraform-azure",
  "pcpc-devcontainer"
]

# ACR manifest metadata retrieval working (CRITICAL for pipeline)
$ az acr manifest list-metadata --name pcpc-ci-terraform-azure --registry maberdevcontainerregistry
[
  {
    "digest": "sha256:7ab5120f0bae3e7b1d5a39da31c10084eb3dc6c9ac1389e278c33a2bd07ec0fe",
    "tags": ["20251116.5", "latest"],
    "imageSize": 206342133,
    ...
  }
]

# Pipeline script simulation - Get FQDN
$ az acr show -n maberdevcontainerregistry --query loginServer -o tsv
maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io

# Pipeline script simulation - Get digest for specific tag
$ az acr manifest list-metadata --name pcpc-ci-terraform-azure --registry maberdevcontainerregistry --query "[?tags[?@ == 'latest']].digest | [0]" -o tsv
sha256:7ab5120f0bae3e7b1d5a39da31c10084eb3dc6c9ac1389e278c33a2bd07ec0fe
```

### Key Findings

1. **ACR Name vs FQDN**: Use `maberdevcontainerregistry` (registry name) for `az acr` commands, not the full FQDN `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`
2. **Docker CLI Required**: The base image did not include Docker CLI - added installation to `setup.sh`
3. **Socket Permissions**: Docker socket permissions were already correctly configured in `startup.sh`
4. **Auto-login**: Updated `startup.sh` to use correct ACR name for automatic login on container startup

````

### Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `.devcontainer/devcontainer.json` | Removed Docker-in-Docker feature | Eliminate conflict with socket mounting |
| `.devcontainer/setup.sh` | Added Docker CLI installation | Install Docker CLI if not present in base image |
| `.devcontainer/startup.sh` | Updated ACR name to `maberdevcontainerregistry` | Use correct registry name for auto-login |

### Pipeline Impact

✅ **Pipeline fix applied** - Switched from Azure CLI to Docker commands for digest retrieval (industry standard approach).

**The Problem:** The pipeline was failing with `ERROR: authentication required` when running `az acr manifest list-metadata`. The Azure CLI data plane commands don't work reliably with service principal authentication in Azure Pipelines, even after explicit `az acr login`.

**The Solution:** Replaced Azure CLI commands with Docker commands in `.ado/templates/build-ci-images.yml`:

```bash
# Use Docker manifest inspect to get digests (works with existing Docker@2 login)
get_digest() {
  local repo="$1"
  echo "Fetching digest for $repo:$VERSION..."
  docker manifest inspect "$FQDN/$repo:$VERSION" --verbose | jq -r '.Descriptor.digest'
}
```

**Why This Works:**
- Uses Docker credentials already established by the `Docker@2` task
- Industry standard approach for CI/CD pipelines
- No Azure CLI authentication issues
- More reliable and doesn't depend on preview Azure CLI commands

### Next Steps for Future DevContainer Builds

Consider adding Docker CLI to the base ACR image (`pcpc-devcontainer`) to avoid needing to install it on every container rebuild:

```dockerfile
# Add to .ci/images/devcontainer/Dockerfile
RUN curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && \
    sh /tmp/get-docker.sh && \
    rm /tmp/get-docker.sh
```

---

## Problem Summary (Historical)

Azure CLI commands that interact with ACR data plane operations (like `az acr manifest list-metadata` and `az acr repository list`) fail with authentication errors when run from within the devcontainer, but work correctly when run from the host machine.

## Root Cause Analysis

### The Issue

ACR has two distinct authentication planes:

1. **Control Plane (Azure Resource Manager)**: Management operations like `az acr show`, `az acr list`

   - Uses Azure AD authentication via service principal
   - Works correctly in devcontainer ✅

2. **Data Plane (Container Registry)**: Image and manifest operations like `az acr manifest list-metadata`, `az acr repository list`
   - Requires Docker login or explicit token authentication
   - **Fails in devcontainer** ❌

### Why It Fails in DevContainer

When you run data plane commands like `az acr manifest list-metadata`, the Azure CLI internally needs to authenticate with the container registry's data plane. This typically happens through one of these methods:

1. **Docker Login**: `az acr login` uses Docker to store credentials

   - **Problem**: Docker is not installed in the devcontainer
   - Error: `DOCKER_COMMAND_ERROR - Please verify if Docker client is installed and running`

2. **Token-based Authentication**: Azure CLI can use tokens from MSAL cache
   - **Problem**: Service principal authentication doesn't automatically establish data plane credentials
   - Error: `authentication required, visit https://aka.ms/acr/authorization`

### Why It Works on Host

On your host machine, you likely have:

- Docker installed and running
- Previously ran `az acr login` which stored credentials in Docker's credential store
- Or you're using a user account (not service principal) which has better token handling

## Current Service Principal Permissions

The service principal (`ed17c3a9-636a-4ab3-84da-00d9e33f4ccc`) has the correct RBAC roles:

- ✅ **Reader** - Can read ACR resource properties
- ✅ **AcrPull** - Can pull images
- ✅ **AcrPush** - Can push images

However, these roles alone don't automatically grant data plane access without proper authentication.

## Solutions

### Option 1: Install Docker in DevContainer (Recommended for Development)

Add Docker CLI to the devcontainer so `az acr login` can work:

```json
// .devcontainer/devcontainer.json
{
  "features": {
    "ghcr.io/devcontainers/features/azure-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {} // Add this
  }
}
````

Then run:

```bash
az acr login --name maberdevcontainerregistry
az acr manifest list-metadata --name pcpc-ci-terraform-azure --registry maberdevcontainerregistry
```

### Option 2: Use Admin Credentials (Quick Fix, Less Secure)

Since admin is already enabled on the ACR:

```bash
# Get admin credentials
ADMIN_USER=$(az acr credential show --name maberdevcontainerregistry --query username -o tsv)
ADMIN_PASS=$(az acr credential show --name maberdevcontainerregistry --query passwords[0].value -o tsv)

# Use with Docker (if available)
docker login maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io -u $ADMIN_USER -p $ADMIN_PASS

# Or use directly with az acr commands
az acr repository list --name maberdevcontainerregistry --username $ADMIN_USER --password $ADMIN_PASS
```

### Option 3: Use Access Token (For Scripts/Automation)

```bash
# Get an access token
TOKEN=$(az acr login --name maberdevcontainerregistry --expose-token --output tsv --query accessToken)

# Use the token with Docker
echo $TOKEN | docker login maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io --username 00000000-0000-0000-0000-000000000000 --password-stdin

# Or use with az acr commands
az acr repository list --name maberdevcontainerregistry --suffix $TOKEN
```

**Note**: The `--expose-token` flag returns a refresh token, not an access token, which is why this approach has limitations.

### Option 4: Use REST API Directly (Advanced)

For pipeline scenarios where Docker isn't available, use the ACR REST API with Azure AD tokens:

```bash
# Get Azure AD token for ACR
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# Call ACR REST API
curl -H "Authorization: Bearer $TOKEN" \
  "https://management.azure.com/subscriptions/555b4cfa-ad2e-4c71-9433-620a59cf7616/resourceGroups/dev-rg/providers/Microsoft.ContainerRegistry/registries/maberdevcontainerregistry/listCredentials?api-version=2023-01-01-preview"
```

## Pipeline Implications

For the Azure DevOps pipeline (`build-ci-images.yml`), the current approach using `AzureCLI@2` task should work because:

1. The pipeline agent (ubuntu-latest) has Docker pre-installed
2. The `Docker@2` task with `command: login` establishes Docker credentials
3. Subsequent `az acr` commands can use those credentials

However, if you encounter issues, consider:

- Ensuring `Docker@2` login happens before any `az acr` data plane commands
- Using the `--expose-token` approach with proper token handling
- Or using the ACR REST API for manifest queries

## Recommended Action

For your devcontainer, **add Docker support** (Option 1) so you can run `az acr login` and have full ACR functionality during development.

For the pipeline, the current implementation should work, but verify that:

1. Docker login completes successfully
2. The service principal has the necessary permissions
3. The ACR is accessible from the pipeline agent

## References

- [Azure Container Registry authentication with service principals](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-auth-service-principal)
- [Authenticate with Azure Container Registry from Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/aks/cluster-container-registry-integration)
- [Azure Container Registry REST API](https://learn.microsoft.com/en-us/rest/api/containerregistry/)
