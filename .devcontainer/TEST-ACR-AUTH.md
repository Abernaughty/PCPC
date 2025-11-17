# ACR Authentication Testing Guide

## Overview

This guide provides step-by-step instructions to test the ACR authentication fix after rebuilding the devcontainer.

## Prerequisites

- Devcontainer has been rebuilt with the latest changes
- Azure CLI is authenticated (`az login` completed)
- Correct subscription is set

---

## Test Sequence

### Step 1: Verify Docker Installation

```bash
# Check Docker version
docker --version

# Expected output: Docker version 20.x or higher
```

### Step 2: Verify Docker Socket Access

```bash
# List running containers
docker ps

# Expected output: Container list (may be empty) without permission errors
```

### Step 3: Check Docker Daemon Info

```bash
# Get Docker system information
docker info

# Expected output: Docker system information including server version
```

### Step 4: Verify Azure CLI Authentication

```bash
# Check current Azure account
az account show

# Set correct subscription if needed
az account set --subscription 555b4cfa-ad2e-4c71-9433-620a59cf7616

# Verify subscription is set
az account show --query name -o tsv
# Expected output: Thunderdome
```

### Step 5: Test ACR Control Plane Access

```bash
# Get ACR details (control plane operation)
az acr show --name maberdevcontainerregistry-ccedhvhwfndwetdp --query loginServer -o tsv

# Expected output: maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io
```

### Step 6: Login to ACR

```bash
# Login to ACR using Docker
az acr login --name maberdevcontainerregistry-ccedhvhwfndwetdp

# Expected output: Login Succeeded
```

### Step 7: Test ACR Data Plane - List Repositories

```bash
# List all repositories in ACR
az acr repository list --name maberdevcontainerregistry-ccedhvhwfndwetdp

# Expected output: JSON array of repository names
# Example: ["pcpc-ci-terraform", "pcpc-ci-node22", "pcpc-ci-node-azure", "pcpc-devcontainer"]
```

### Step 8: Test ACR Data Plane - List Tags

```bash
# List tags for a specific repository
az acr repository show-tags \
  --name maberdevcontainerregistry-ccedhvhwfndwetdp \
  --repository pcpc-ci-terraform

# Expected output: JSON array of tags
# Example: ["latest", "v1.0.0"]
```

### Step 9: Test ACR Data Plane - Get Manifest Metadata

```bash
# Get manifest metadata (this is what the pipeline uses)
az acr manifest list-metadata \
  --name pcpc-ci-terraform \
  --registry maberdevcontainerregistry-ccedhvhwfndwetdp

# Expected output: JSON array with digest, tags, timestamp, etc.
```

### Step 10: Test Specific Version Digest Retrieval

```bash
# Simulate the pipeline script to get digest for a specific version
ACR_NAME='maberdevcontainerregistry-ccedhvhwfndwetdp'
VERSION='v1.0.0'

# Get digest for specific version
DIGEST=$(az acr manifest list-metadata \
  --name pcpc-ci-terraform \
  --registry "$ACR_NAME" \
  --query "[?tags[?@ == '$VERSION']].digest | [0]" -o tsv)

echo "Digest for $VERSION: $DIGEST"

# Expected output: sha256:abc123... (actual digest hash)
```

---

## Troubleshooting

### Issue: Docker permission denied

```bash
# Check socket permissions
ls -la /var/run/docker.sock

# Check if vscode user is in docker group
groups vscode

# Manual fix (if needed)
sudo chmod 666 /var/run/docker.sock
```

### Issue: ACR login fails

```bash
# Try with expose-token method
az acr login --name maberdevcontainerregistry-ccedhvhwfndwetdp --expose-token

# Check service principal permissions
az role assignment list --assignee ed17c3a9-636a-4ab3-84da-00d9e33f4ccc --scope /subscriptions/555b4cfa-ad2e-4c71-9433-620a59cf7616
```

### Issue: Manifest commands fail

```bash
# Verify you're logged in
docker login maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io

# Check if repository exists
az acr repository list --name maberdevcontainerregistry-ccedhvhwfndwetdp
```

---

## Success Criteria

✅ All tests pass without errors  
✅ `docker ps` runs without permission errors  
✅ `az acr login` succeeds  
✅ `az acr manifest list-metadata` returns data  
✅ Digest retrieval works for specific versions

---

## Pipeline Testing

After local testing succeeds, test the pipeline:

1. Commit and push the devcontainer changes
2. Trigger the CI Images Build Pipeline
3. Monitor the "Capture image digests from ACR" step
4. Verify it completes successfully and publishes artifacts

---

## Notes

- The startup.sh script automatically attempts ACR login on container start
- If auto-login fails, manual `az acr login` is required
- Docker socket permissions are configured automatically in startup.sh
- The fix uses Docker-outside-of-Docker (host Docker daemon)
