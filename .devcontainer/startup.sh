#!/usr/bin/env bash
set -euo pipefail

echo "[devcontainer] Running startup.sh..."

# Wait for Cosmos DB Emulator HTTP endpoint
endpoint="https://cosmosdb-emulator:8081"
max_attempts=60
attempt=1

echo "[devcontainer] Checking Cosmos DB Emulator at $endpoint"
while ! curl -k --silent --head "$endpoint/_explorer/index.html" >/dev/null; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[devcontainer] ERROR: Cosmos DB Emulator HTTP not available after $((attempt*3))s"
    exit 1
  fi
  echo "[devcontainer] HTTP not ready yet... retry $attempt/$max_attempts"
  attempt=$((attempt+1))
  sleep 3
done

echo "[devcontainer] HTTP endpoint up, downloading Cosmos emulator TLS certificate for user trust..."

# Download emulator certificate to user-scoped certs for per-process trust
mkdir -p "$HOME/.certs"
curl --insecure https://cosmosdb-emulator:8081/_explorer/emulator.pem > "$HOME/.certs/emulator.pem"
echo "[devcontainer] TLS certificate saved to $HOME/.certs/emulator.pem"

echo "[devcontainer] Certificate installed, checking data plane readiness..."

# Check data plane readiness with Node.js script
# cd .devcontainer && node scripts/cosmos-readiness-check.mjs && cd ..

# echo "[devcontainer] Cosmos DB fully ready, running seed script..."
# node /workspace/.devcontainer/scripts/seed-cosmos.mjs

# echo "[devcontainer] Startup seeding complete."

echo "Checking Azure CLI login"
# Ensure Azure CLI config dir exists and is writable for the current user
mkdir -p "$HOME/.azure" || true
# On some host-mounted filesystems (e.g., Windows), chmod may not be supported; silence errors
chmod 700 "$HOME/.azure" 2>/dev/null || true

# Make Cosmos emulator cert available to Node-based tools without affecting system trust stores
if [ -f "$HOME/.certs/emulator.pem" ]; then
  export NODE_EXTRA_CA_CERTS="$HOME/.certs/emulator.pem"
fi
az account show >/dev/null 2>&1 || az login --use-device-code

echo "Configure git"
git config --global --add safe.directory /workspace
git config --global user.name "Michael Abernathy"
git config --global user.email "mabernathy87@gmail.com"
git config pull.rebase true
git config rebase.autoStash true

echo "Configuring Docker socket permissions..."
# Fix Docker socket permissions for vscode user
if [ -S /var/run/docker.sock ]; then
    # Try to add user to docker group (may not exist in container)
    if getent group docker > /dev/null 2>&1; then
        sudo usermod -aG docker vscode 2>/dev/null || true
    fi
    
    # Ensure socket is accessible (fallback if group doesn't work)
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    
    echo "✅ Docker socket permissions configured"
else
    echo "⚠️  Docker socket not found at /var/run/docker.sock"
fi

echo "Testing Docker connectivity..."
if docker ps > /dev/null 2>&1; then
    echo "✅ Docker daemon accessible"
    
    # Optional: Pre-authenticate with ACR if credentials are available
    if az account show > /dev/null 2>&1; then
        echo "Checking ACR authentication..."
        ACR_NAME="maberDevContainerRegistry"
        if az acr show --name "$ACR_NAME" > /dev/null 2>&1; then
            echo "Logging into ACR: $ACR_NAME"
            az acr login --name "$ACR_NAME" 2>/dev/null && echo "✅ ACR authenticated" || echo "⚠️  ACR login skipped (manual login required)"
        fi
    fi
else
    echo "⚠️  Docker daemon not accessible yet (may require container restart)"
fi
