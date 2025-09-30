#!/bin/bash

echo "🚀 Initializing PCPC DevContainer (ACR Optimized)..."

# Verify pre-installed tools from ACR image
echo "✅ Verifying pre-installed development tools..."
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo "   Azure CLI: $(az --version | head -1)"
echo "   Terraform: $(terraform version | head -1)"
echo "   Azure Functions Core Tools: $(func --version)"
echo "   Go: $(go version)"
echo "   PowerShell: $(pwsh --version)"

# Install devcontainer-specific Node.js dependencies
echo "📦 Installing DevContainer Node.js dependencies..."
cd .devcontainer && npm install && cd ..

# Wait for emulators to be ready
echo "⏳ Waiting for emulators to start..."
sleep 15

# Verify emulator connectivity
echo "✅ Verifying emulator connectivity..."
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem > ~/cosmos_emulator.pem 2>/dev/null || echo "   ⚠️  Cosmos DB emulator starting..."
curl -s http://azurite:10000/devstoreaccount1/ > /dev/null && echo "   ✅ Azurite ready" || echo "   ⚠️  Azurite starting..."

echo "🎉 DevContainer ready!"
echo "📍 Cosmos DB Explorer: https://cosmosdb-emulator:8081/_explorer/index.html"
echo "📍 Azurite Blob: http://azurite:10000"
echo ""
echo "💡 All tools pre-installed from ACR image (95% faster startup!)"

# Ensure .env exists
[ -f .env ] || cp .env.example .env
