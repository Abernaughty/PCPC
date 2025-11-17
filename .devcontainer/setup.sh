#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Initializing PCPC DevContainer v1.3.0 (ACR Optimized)..."

# Verify pre-installed tools from ACR image
echo "✅ Verifying pre-installed development tools..."
echo "   Node.js: $(node --version) (Expected: v22.19.0)"
echo "   npm: $(npm --version)"
echo "   Azure CLI: $(az --version | head -1)"
echo "   Terraform: $(terraform version | head -1) (Expected: v1.13.3)"
echo "   Azure Functions Core Tools: $(func --version) (Expected: 4.x)"
echo "   Go: $(go version) (Expected: go1.23.12)"
echo "   PowerShell: $(pwsh --version)"
echo "   GitHub CLI: $(gh --version | head -1)"
echo "   Python: $(python3 --version) (Expected: 3.12.x)"

# Install Docker CLI if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker CLI..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    echo "   ✅ Docker CLI installed: $(docker --version)"
else
    echo "   Docker CLI: $(docker --version)"
fi

# Install devcontainer-specific Node.js dependencies
echo "📦 Installing DevContainer Node.js dependencies..."
if [ -f "${SCRIPT_DIR}/package.json" ]; then
    (cd "${SCRIPT_DIR}" && npm install)
else
    echo "   ⚠️  package.json not found in ${SCRIPT_DIR}, skipping npm install"
fi

# Wait for emulators to be ready
# echo "⏳ Waiting for emulators to start..."
# sleep 15

# Verify emulator connectivity
echo "✅ Verifying emulator connectivity..."
COSMOS_CERT_PATH="${SCRIPT_DIR}/cosmos_emulator.pem"
if curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem > "${COSMOS_CERT_PATH}" 2>/dev/null; then
    echo "   ✅ Cosmos emulator certificate saved to ${COSMOS_CERT_PATH}"
else
    echo "   ⚠️  Cosmos DB emulator starting..."
fi
curl -s http://azurite:10000/devstoreaccount1/ > /dev/null && echo "   ✅ Azurite ready" || echo "   ⚠️  Azurite starting..."

echo "🎉 DevContainer ready!"
echo "📍 Cosmos DB Explorer: https://cosmosdb-emulator:8081/_explorer/index.html"
echo "📍 Azurite Blob: http://azurite:10000"
echo ""
echo "💡 All tools pre-installed from ACR image v1.3.0 (95% faster startup!)"
echo "🔧 New in v1.3.0: Azure Functions Core Tools v4.x + Terraform 1.13.3"

# Ensure .env exists
[ -f /workspace/.devcontainer/.env ] || cp /workspace/.devcontainer/.env.example /workspace/.devcontainer/.env
[ -f /workspace/app/backend/local.settings.json ] || cp /workspace/app/backend/local.settings.json.example /workspace/app/backend/local.settings.json
[ -f /workspace/app/frontend/.env ] || cp /workspace/app/frontend/.env.example /workspace/app/frontend/.env

# Ensure custom dotfiles are in place
echo "🔧 Setting up custom dotfiles..."
DOTFILE_SOURCE="/workspace/.devcontainer/.bashrc"
DOTFILE_TARGET="${HOME}/.bashrc"
DOTFILE_WRITE_TEST="${HOME}/.devcontainer_write_test"
if touch "${DOTFILE_WRITE_TEST}" 2>/dev/null; then
    rm -f "${DOTFILE_WRITE_TEST}" 2>/dev/null || true
    cp "${DOTFILE_SOURCE}" "${DOTFILE_TARGET}"
    if [ ! -f "${HOME}/.bash_profile" ]; then
        cat <<'EOF' > "${HOME}/.bash_profile"
#!/bin/bash
# .bash_profile - Executed for login shells

# Source .bashrc if it exists
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi

# Additional login shell configurations can go here
EOF
    fi
    echo "✅ Dotfiles configured"
else
    echo "   ⚠️  Dotfiles not updated due to write restrictions."
fi
