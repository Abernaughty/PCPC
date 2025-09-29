# 🚀 DevContainer Optimization with Azure Container Registry

## Problem

DevContainer rebuilds take 5-10 minutes on new machines due to feature installations, VS Code extensions, and package downloads. This impacts developer productivity and onboarding experience.

## Solution

Pre-build DevContainer image in Azure Container Registry for instant startup (30 seconds vs 5-10 minutes).

## Acceptance Criteria

- [ ] Container builds locally in under 2 minutes
- [ ] New environments start in under 30 seconds
- [ ] All current functionality preserved (35+ VS Code extensions, dev tools)
- [ ] Automated builds on dependency changes
- [ ] Documentation updated

## Implementation Plan

**Phase 1: Container Optimization (2-3 hours)**

- [ ] Create consolidated Dockerfile from devcontainer.json features
- [ ] Pre-install VS Code extensions and dev tools
- [ ] Test local build and functionality

**Phase 2: ACR Setup (1-2 hours)**

- [ ] Configure Azure Container Registry
- [ ] Set up authentication and push/pull workflow
- [ ] Test manual container operations

**Phase 3: Integration (1 hour)**

- [ ] Update devcontainer.json to use ACR image
- [ ] Preserve local services (Azurite, Cosmos DB)
- [ ] Test complete development workflow

**Phase 4: Automation (2-3 hours)**

- [ ] Create GitHub Actions for automated builds
- [ ] Update documentation and Makefile
- [ ] Implement version tagging strategy

## Files to Create/Modify

**New:**

- `.devcontainer/Dockerfile.optimized`
- `.github/workflows/devcontainer-build.yml`
- `docs/development/devcontainer-acr-setup.md`

**Modified:**

- `.devcontainer/devcontainer.json`
- `tools/Makefile`
- `memory-bank/techContext.md`

## Success Metrics

- **Build Time**: < 2 minutes (baseline: 5-10 minutes)
- **Startup Time**: < 30 seconds (baseline: 5-10 minutes)
- **Cost**: < $10/month for ACR storage
- **Functionality**: 100% feature parity

## Labels

`enhancement` `devops` `priority-medium` `effort-medium` `documentation`

---

**Estimated Effort**: 6-8 hours over 1-2 days
**Priority**: Medium (significant productivity improvement)
