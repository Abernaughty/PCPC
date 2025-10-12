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
az account show >/dev/null 2>&1 || az login --use-device-code

echo "Configure git"
git config --global user.name "Michael Abernathy"
git config --global user.email "mabernathy87@gmail.com"

echo "Fix repository ownership (for mounted volumes)"
git config --global --add safe.directory /workspace