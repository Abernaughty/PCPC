# DevContainer Optimization with Azure Container Registry

## 🎯 Problem Statement

**Current Pain Point**: DevContainer rebuilds take 5-10 minutes on new machines/locations due to:

- Feature installations (Azure CLI 2.77.0, Terraform 1.9.8, Node.js 22, Go 1.23, etc.)
- VS Code extension downloads (35+ extensions)
- Package installations and dependency resolution
- Docker layer rebuilding from base Ubuntu 22.04 image

**Impact**:

- Slow developer onboarding
- Reduced productivity when switching environments
- Inconsistent development environment setup times
- Poor developer experience for distributed team

## 🚀 Proposed Solution

Pre-build and store the DevContainer image in Azure Container Registry (ACR) to enable:

- **Instant startup**: Pull pre-built image instead of rebuilding
- **Consistency**: Same environment across all locations
- **Offline capability**: Works without internet after initial pull
- **Version control**: Tagged images for stability

## 📋 Acceptance Criteria

### Performance Requirements

- [ ] Container builds locally in under 2 minutes (vs current 5-10 minutes)
- [ ] New environments start in under 30 seconds (vs current 5-10 minutes)
- [ ] Image pull time under 1 minute on typical internet connections

### Functional Requirements

- [ ] All current DevContainer functionality preserved
- [ ] All VS Code extensions pre-installed and working
- [ ] All development tools available (Azure CLI, Terraform, Node.js, etc.)
- [ ] Environment variables and configurations maintained
- [ ] Docker-in-Docker functionality preserved
- [ ] Port forwarding and service integration intact

### Operational Requirements

- [ ] Automated container builds on dependency changes
- [ ] Version tagging strategy implemented
- [ ] Documentation updated with new workflow
- [ ] Rollback capability to previous working versions
- [ ] Cost optimization (estimated <$10/month for ACR storage)

## 🛠️ Technical Implementation Plan

### Phase 1: Container Optimization (2-3 hours)

- [ ] Create consolidated Dockerfile from current devcontainer.json features
- [ ] Optimize Docker layer caching for faster builds
- [ ] Pre-install all VS Code extensions in container image
- [ ] Test local container build and functionality

### Phase 2: Azure Container Registry Setup (1-2 hours)

- [ ] Create or configure ACR instance
- [ ] Set up authentication and access policies
- [ ] Configure container registry integration
- [ ] Test manual push/pull workflow

### Phase 3: DevContainer Configuration Update (1 hour)

- [ ] Update devcontainer.json to use ACR image
- [ ] Preserve docker-compose services (Azurite, Cosmos DB)
- [ ] Update environment variable handling
- [ ] Test complete development workflow

### Phase 4: Automation & Documentation (2-3 hours)

- [ ] Create GitHub Actions workflow for automated builds
- [ ] Implement version tagging strategy
- [ ] Update project documentation
- [ ] Create troubleshooting guide
- [ ] Update Makefile with container management commands

## 📁 Files to be Modified

### New Files

- `.devcontainer/Dockerfile.optimized` - Consolidated container definition
- `.github/workflows/devcontainer-build.yml` - Automated container builds
- `docs/development/devcontainer-acr-setup.md` - Setup documentation

### Modified Files

- `.devcontainer/devcontainer.json` - Update to use ACR image
- `.devcontainer/docker-compose.yml` - Preserve service dependencies
- `tools/Makefile` - Add container management commands
- `memory-bank/techContext.md` - Document new container strategy

## 🏗️ Architecture Changes

### Current Architecture

```
devcontainer.json → features → build time (5-10 min) → development environment
```

### Proposed Architecture

```
Dockerfile → ACR build → tagged image → devcontainer.json → pull (30s) → development environment
```

### Service Separation

- **Pre-built Container**: Development tools, VS Code extensions, base configuration
- **Local Services**: Azurite, Cosmos DB Emulator (remain in docker-compose)

## 🔧 Technical Specifications

### Container Image Details

- **Base Image**: `mcr.microsoft.com/devcontainers/base:ubuntu-22.04`
- **Target Registry**: `{your-acr}.azurecr.io/pcpc-devcontainer`
- **Tagging Strategy**:
  - `latest` - Current development version
  - `v1.0.0` - Stable releases
  - `sha-{commit}` - Specific builds

### Dependencies to Pre-install

- Azure CLI 2.77.0 with azure-devops extension
- Terraform 1.9.8 with tflint 0.59.1 and terragrunt 0.87.4
- Node.js 22 with npm and development tools
- Go 1.23 with standard toolchain
- PowerShell latest
- Docker-in-Docker v2
- Git with GitHub CLI
- Python 3.12 with development tools
- All 35+ VS Code extensions from current configuration

## 📊 Success Metrics

### Performance Metrics

- **Build Time**: < 2 minutes (baseline: 5-10 minutes)
- **Startup Time**: < 30 seconds (baseline: 5-10 minutes)
- **Image Size**: < 2GB (optimized layers)
- **Pull Time**: < 1 minute on 50Mbps connection

### Quality Metrics

- **Functionality**: 100% feature parity with current setup
- **Reliability**: Zero regression in development workflow
- **Documentation**: Complete setup and troubleshooting guides
- **Automation**: Hands-off container updates

## 💰 Cost Analysis

### Azure Container Registry Costs

- **Storage**: ~$5/month for image storage
- **Bandwidth**: Minimal (team size dependent)
- **Build Minutes**: ~$2/month for automated builds
- **Total Estimated**: <$10/month

### Time Savings

- **Per Developer**: 5-8 minutes saved per environment setup
- **Team of 5**: 25-40 minutes saved per setup cycle
- **Monthly Value**: Significant productivity improvement

## 🚨 Risk Assessment

### High Priority Risks

- **Container Registry Access**: Ensure proper authentication setup
- **Image Size**: Monitor and optimize for reasonable pull times
- **Feature Compatibility**: Verify all current functionality works

### Mitigation Strategies

- **Rollback Plan**: Keep current devcontainer.json as fallback
- **Testing Strategy**: Comprehensive testing on multiple environments
- **Documentation**: Clear troubleshooting and setup guides

## 🔗 Related Work

### Dependencies

- Existing DevContainer configuration (working)
- Azure subscription with ACR access
- GitHub Actions for automation

### Follow-up Issues

- Multi-architecture support (ARM64 for M1 Macs)
- Container security scanning integration
- Advanced caching strategies

## 📚 References

- [DevContainer Specification](https://containers.dev/implementors/spec/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/en-us/azure/container-registry/)
- [GitHub Actions for Container Builds](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)

## 🏷️ Labels

- `enhancement` - Improving developer experience
- `devops` - Infrastructure and tooling
- `priority-medium` - Significant productivity improvement
- `effort-medium` - 1-2 days of work
- `documentation` - Requires documentation updates

## 👥 Assignee

- Primary: Infrastructure/DevOps team member
- Reviewer: Senior developer familiar with current setup

---

**Estimated Effort**: 6-8 hours over 1-2 days
**Priority**: Medium (significant productivity improvement)
**Complexity**: Medium (infrastructure change with testing requirements)
