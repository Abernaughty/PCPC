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

echo "[devcontainer] HTTP endpoint up, downloading and installing TLS certificate..."

# Download and install emulator certificate
curl --insecure https://cosmosdb-emulator:8081/_explorer/emulator.pem > ~/emulatorcert.crt
sudo cp ~/emulatorcert.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates

echo "[devcontainer] Certificate installed, checking data plane readiness..."

# Check data plane readiness with Node.js script
# cd .devcontainer && node scripts/cosmos-readiness-check.mjs && cd ..

# echo "[devcontainer] Cosmos DB fully ready, running seed script..."
# node /workspace/.devcontainer/scripts/seed-cosmos.mjs

# echo "[devcontainer] Startup seeding complete."

echo "Checking Azure CLI login"
azure_config_dir="${AZURE_CONFIG_DIR:-$HOME/.azure}"
usable_azure_dir=""

if [ -d "$azure_config_dir" ]; then
  if [ -w "$azure_config_dir" ]; then
    usable_azure_dir="$azure_config_dir"
  fi
else
  if mkdir -p "$azure_config_dir" 2>/dev/null && [ -w "$azure_config_dir" ]; then
    usable_azure_dir="$azure_config_dir"
  fi
fi

if [ -z "$usable_azure_dir" ]; then
  fallback_dir="$HOME/.azure-config"
  if mkdir -p "$fallback_dir" 2>/dev/null && [ -w "$fallback_dir" ]; then
    usable_azure_dir="$fallback_dir"
    export AZURE_CONFIG_DIR="$fallback_dir"
    if ! grep -q 'AZURE_CONFIG_DIR=' "$HOME/.bashrc" 2>/dev/null; then
      echo 'export AZURE_CONFIG_DIR="$HOME/.azure-config"' >> "$HOME/.bashrc"
    fi
    echo "[devcontainer] Using fallback Azure config directory at $fallback_dir"
  else
    echo "[devcontainer] Skipping Azure CLI login check (no writable Azure config directory)"
  fi
fi

if [ -n "$usable_azure_dir" ]; then
  az account show >/dev/null 2>&1 || az login --use-device-code
fi

echo "Configure git"
git config --global user.name "Michael Abernathy"
git config --global user.email "mabernathy87@gmail.com"
git config pull.rebase true
git config rebase.autoStash true

echo "Fix repository ownership (for mounted volumes)"
git config --global --add safe.directory /workspace
