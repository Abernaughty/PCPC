# ACR Authentication Guide for PCPC DevContainer

## Overview

The PCPC DevContainer now uses pre-built images from Azure Container Registry (ACR) to achieve 95% reduction in environment setup time (from 5-10 minutes to 30-60 seconds).

## ACR Details

- **Registry**: `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`
- **Repository**: `pcpc-devcontainer`
- **Image Tags**: `latest`, `v1.0.0`
- **Image Size**: 1.28GB (optimized with 24 layers)
- **Pre-installed**: 35 VS Code extensions, 9 development tools

## Authentication Methods

### Method 1: Azure CLI Authentication (Recommended for Development)

```bash
# Login to Azure CLI
az login

# Login to ACR (automatically uses Azure CLI credentials)
az acr login --name maberdevcontainerregistry
```

### Method 2: Admin User Authentication (Current Setup)

```bash
# Get admin credentials
az acr credential show --name maberdevcontainerregistry

# Login with admin user
docker login maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io
# Username: maberdevcontainerregistry
# Password: [from credential show command]
```

### Method 3: Service Principal (Production Recommended)

```bash
# Create service principal (one-time setup)
az ad sp create-for-rbac --name pcpc-acr-sp --role acrpull --scopes /subscriptions/{subscription-id}/resourceGroups/{rg-name}/providers/Microsoft.ContainerRegistry/registries/maberdevcontainerregistry

# Login with service principal
docker login maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io \
  --username {service-principal-id} \
  --password {service-principal-password}
```

## Container Management Commands

### Pull Latest Image

```bash
# Using Makefile
make container-pull

# Manual command
docker pull maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
```

### Update DevContainer

```bash
# Using Makefile
make container-update

# Manual commands
docker-compose -f .devcontainer/docker-compose.yml pull devcontainer
docker-compose -f .devcontainer/docker-compose.yml up -d --force-recreate devcontainer
```

### Check Container Status

```bash
# Using Makefile
make container-status

# Manual command
docker images | grep pcpc-devcontainer
```

## Performance Metrics

### Before ACR Optimization

- **Environment Setup**: 5-10 minutes
- **Process**: Download base image + install 9 tools + install 35 extensions
- **Network Usage**: High (multiple package downloads)
- **Reliability**: Dependent on external package repositories

### After ACR Optimization

- **Environment Setup**: 30-60 seconds
- **Process**: Pull pre-built image from ACR
- **Network Usage**: Single 1.28GB download (cached after first use)
- **Reliability**: High (all dependencies pre-installed and tested)

## Troubleshooting

### Authentication Issues

```bash
# Check current Docker authentication
docker system info | grep -A 10 "Registry Mirrors"

# Clear Docker credentials and re-authenticate
docker logout maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io
az acr login --name maberdevcontainerregistry
```

### Image Pull Issues

```bash
# Check ACR connectivity
az acr check-health --name maberdevcontainerregistry

# Manual image pull with verbose output
docker pull maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest --debug
```

### Container Startup Issues

```bash
# Check container logs
docker-compose -f .devcontainer/docker-compose.yml logs devcontainer

# Restart with fresh image
docker-compose -f .devcontainer/docker-compose.yml down
docker-compose -f .devcontainer/docker-compose.yml pull
docker-compose -f .devcontainer/docker-compose.yml up -d
```

## Fallback to Local Build

If ACR access is unavailable, you can temporarily revert to local build:

```bash
# Restore backup configuration
cp .devcontainer/docker-compose.yml.backup .devcontainer/docker-compose.yml
cp .devcontainer/devcontainer.json.backup .devcontainer/devcontainer.json

# Rebuild locally
docker-compose -f .devcontainer/docker-compose.yml build --no-cache devcontainer
```

## Security Considerations

### Development Environment

- Admin user credentials acceptable for development
- Credentials should not be committed to version control
- Use Azure CLI authentication when possible

### Production Environment

- Use managed identity or service principal
- Implement least-privilege access (AcrPull role)
- Enable audit logging for ACR access

## Cost Optimization

### ACR Storage Costs

- **Image Storage**: ~$5/month for 1.28GB image
- **Bandwidth**: Minimal for small team usage
- **Total Estimated**: <$10/month

### Development Time Savings

- **Time Saved**: 4.5-9.5 minutes per environment setup
- **Team Productivity**: Significant improvement in developer experience
- **ROI**: Cost savings far exceed ACR expenses

## Maintenance

### Image Updates

- New images should be tagged with semantic versions
- Latest tag should always point to current stable version
- Old versions should be retained for rollback capability

### Monitoring

- Monitor ACR usage and costs through Azure portal
- Track image pull metrics and performance
- Set up alerts for authentication failures

## Next Steps

1. **Automated Builds**: Set up GitHub Actions to automatically build and push updated images
2. **Multi-Architecture**: Add ARM64 support for M1 Mac compatibility
3. **Security Scanning**: Integrate container vulnerability scanning
4. **Team Rollout**: Distribute ACR access to entire development team
