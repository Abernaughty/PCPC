# DevContainer Azure Container Registry Workflow

This document explains how to optimize your development environment by using Azure Container Registry (ACR) to store pre-built DevContainer images, eliminating the need to rebuild containers every time you access the project from a new location.

## Overview

### Current Problem

- DevContainer rebuilds take 5-10 minutes on new machines
- Feature installations (Azure CLI, Terraform, Node.js, etc.) happen every time
- VS Code extension downloads (35+ extensions) slow startup
- Inconsistent setup times across different environments

### Solution

- Pre-build DevContainer image with all tools and extensions
- Store in Azure Container Registry for instant access
- Pull pre-built image in 30 seconds vs 5-10 minute rebuilds
- Consistent environment across all locations

## Prerequisites

### Required Tools

- Docker Desktop or Docker Engine
- Azure CLI (`az`)
- Azure subscription with Container Registry access
- Git (for version tagging)

### Azure Resources

- Azure Container Registry (ACR) instance
- Appropriate permissions to push/pull images

## Quick Start

### 1. Create GitHub Issue

Use the provided issue templates to track this work:

```bash
# Copy the simplified template for GitHub
cat docs/github-issues/devcontainer-acr-issue-template.md
```

Create a new issue in your GitHub repository with this content.

### 2. Set Environment Variables

```bash
# Set your Azure Container Registry name
export ACR_NAME="your-acr-name"

# Verify ACR access
az acr show --name $ACR_NAME
```

### 3. Build and Push Container

```bash
# Build and push to ACR (requires Dockerfile.optimized)
make container-build ACR_NAME=$ACR_NAME

# Check container status
make container-status ACR_NAME=$ACR_NAME
```

### 4. Update DevContainer Configuration

Update `.devcontainer/devcontainer.json` to use your ACR image instead of building from features.

## Detailed Implementation

### Phase 1: Container Optimization

#### Create Optimized Dockerfile

Create `.devcontainer/Dockerfile.optimized` that consolidates all your current devcontainer features:

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash
RUN az extension add --name azure-devops

# Install Terraform
RUN wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list
RUN apt-get update && apt-get install -y terraform=1.9.8*

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs

# Install additional tools...
# (Add all your current devcontainer features here)

# Pre-install VS Code extensions
RUN code-server --install-extension HashiCorp.terraform
RUN code-server --install-extension ms-vscode.azure-account
# (Add all your extensions here)

WORKDIR /workspace
```

#### Test Local Build

```bash
# Build locally first
docker build -f .devcontainer/Dockerfile.optimized -t pcpc-devcontainer:test .devcontainer

# Test functionality
docker run --rm pcpc-devcontainer:test node --version
docker run --rm pcpc-devcontainer:test az --version
docker run --rm pcpc-devcontainer:test terraform --version
```

### Phase 2: Azure Container Registry Setup

#### Create or Configure ACR

```bash
# Create new ACR (if needed)
az acr create --resource-group rg-pcpc-dev --name $ACR_NAME --sku Basic

# Or use existing ACR
az acr show --name $ACR_NAME
```

#### Configure Authentication

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Verify access
az acr repository list --name $ACR_NAME
```

### Phase 3: DevContainer Configuration Update

#### Update devcontainer.json

Replace the current feature-based configuration:

```json
{
  "name": "PokeData Infrastructure DevOps",
  "image": "your-acr.azurecr.io/pcpc-devcontainer:latest",
  "dockerComposeFile": "docker-compose.yml",
  "service": "devcontainer",
  "workspaceFolder": "/workspace",

  "customizations": {
    "vscode": {
      "settings": {
        "terraform.experimentalFeatures.validateOnSave": true,
        "terraform.experimentalFeatures.prefillRequiredFields": true
      }
    }
  },

  "containerEnv": {
    "TF_VAR_environment": "local",
    "TF_VAR_location": "centralus",
    "AZURE_FUNCTIONS_ENVIRONMENT": "Development",
    "NODE_ENV": "development"
  },

  "postCreateCommand": ".devcontainer/setup.sh",
  "postStartCommand": ".devcontainer/startup.sh",
  "forwardPorts": [7071, 4280, 10000, 10001, 10002, 8081],
  "remoteUser": "vscode"
}
```

#### Preserve Local Services

Keep Azurite and Cosmos DB in `docker-compose.yml` as separate services:

```yaml
services:
  devcontainer:
    image: your-acr.azurecr.io/pcpc-devcontainer:latest
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    networks:
      - devcontainer-network

  azurite:
    # Keep existing azurite configuration

  cosmosdb-emulator:
    # Keep existing cosmos configuration
```

### Phase 4: Automation & Documentation

#### GitHub Actions Workflow

Create `.github/workflows/devcontainer-build.yml`:

```yaml
name: Build DevContainer

on:
  push:
    paths:
      - ".devcontainer/Dockerfile.optimized"
      - ".devcontainer/devcontainer.json"
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to ACR
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Build and push
        run: |
          docker build -f .devcontainer/Dockerfile.optimized \
            -t ${{ secrets.ACR_LOGIN_SERVER }}/pcpc-devcontainer:latest \
            -t ${{ secrets.ACR_LOGIN_SERVER }}/pcpc-devcontainer:${{ github.sha }} \
            .devcontainer
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/pcpc-devcontainer:latest
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/pcpc-devcontainer:${{ github.sha }}
```

## Available Make Commands

### Container Management Commands

```bash
# Build and push container to ACR
make container-build ACR_NAME=your-acr-name

# Pull latest container from ACR
make container-pull ACR_NAME=your-acr-name

# Test container functionality
make container-test ACR_NAME=your-acr-name

# Update container dependencies and rebuild
make container-update ACR_NAME=your-acr-name

# Clean local container images
make container-clean

# Show container registry status
make container-status ACR_NAME=your-acr-name
```

### Usage Examples

```bash
# Initial setup
export ACR_NAME="pcpcregistry"
make container-build ACR_NAME=$ACR_NAME

# Regular updates
make container-update ACR_NAME=$ACR_NAME

# Check status
make container-status ACR_NAME=$ACR_NAME
```

## Troubleshooting

### Common Issues

#### Authentication Errors

```bash
# Re-login to ACR
az acr login --name $ACR_NAME

# Check permissions
az acr show --name $ACR_NAME --query "adminUserEnabled"
```

#### Build Failures

```bash
# Check Docker daemon
docker info

# Build locally first
docker build -f .devcontainer/Dockerfile.optimized -t test .devcontainer

# Check logs
docker logs <container-id>
```

#### DevContainer Issues

```bash
# Rebuild container in VS Code
# Command Palette: "Dev Containers: Rebuild Container"

# Check container logs
# Command Palette: "Dev Containers: Show Container Log"
```

### Performance Optimization

#### Image Size Optimization

- Use multi-stage builds
- Minimize layers
- Clean up package caches
- Use .dockerignore

#### Pull Time Optimization

- Use appropriate base images
- Leverage Docker layer caching
- Consider image compression

## Cost Management

### Azure Container Registry Costs

- **Basic SKU**: ~$5/month for storage
- **Standard SKU**: ~$20/month with additional features
- **Premium SKU**: ~$500/month for enterprise features

### Optimization Strategies

- Use Basic SKU for development
- Clean up old image versions
- Monitor storage usage
- Use lifecycle policies

## Security Considerations

### Access Control

- Use Azure RBAC for ACR access
- Implement least privilege principles
- Use service principals for automation
- Enable admin user only when necessary

### Image Security

- Scan images for vulnerabilities
- Use trusted base images
- Keep dependencies updated
- Implement image signing (Premium SKU)

## Migration Checklist

### Pre-Migration

- [ ] Backup current devcontainer configuration
- [ ] Test current setup works
- [ ] Create ACR instance
- [ ] Set up authentication

### Implementation

- [ ] Create optimized Dockerfile
- [ ] Test local container build
- [ ] Push to ACR successfully
- [ ] Update devcontainer.json
- [ ] Test new configuration

### Post-Migration

- [ ] Verify all tools work
- [ ] Test development workflow
- [ ] Update documentation
- [ ] Train team members
- [ ] Set up automation

## Success Metrics

### Performance Improvements

- **Startup Time**: 30 seconds (vs 5-10 minutes)
- **Build Time**: 2 minutes (vs 5-10 minutes)
- **Consistency**: 100% identical environments
- **Reliability**: Zero setup failures

### Team Benefits

- Faster developer onboarding
- Consistent development environments
- Reduced support overhead
- Improved productivity

## Next Steps

1. **Create GitHub Issue**: Use the provided templates
2. **Set up ACR**: Create or configure Azure Container Registry
3. **Build Container**: Create optimized Dockerfile and test
4. **Update Configuration**: Modify devcontainer.json
5. **Automate Builds**: Set up GitHub Actions workflow
6. **Document Process**: Update team documentation
7. **Train Team**: Share new workflow with developers

## References

- [DevContainer Specification](https://containers.dev/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/en-us/azure/container-registry/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions for Containers](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
