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
