#!/bin/bash

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

# Install devcontainer-specific Node.js dependencies
echo "📦 Installing DevContainer Node.js dependencies..."
cd .devcontainer && npm install && cd ..

# Wait for emulators to be ready
# echo "⏳ Waiting for emulators to start..."
# sleep 15

# Verify emulator connectivity
echo "✅ Verifying emulator connectivity..."
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem > ~/cosmos_emulator.pem 2>/dev/null || echo "   ⚠️  Cosmos DB emulator starting..."
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
cp /workspace/.devcontainer/.bashrc ~/.bashrc
if [ ! -f ~/.bash_profile ]; then
    cat > ~/.bash_profile << 'EOF'
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
