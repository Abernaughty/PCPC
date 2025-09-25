#!/bin/bash

echo "🚀 Setting up PokeData DevOps Environment..."

# Install devcontainer dependencies
echo "📦 Installing devcontainer dependencies..."
cd .devcontainer && npm install && cd ..

# Install additional tools
echo "📦 Installing additional tools..."
npm install -g azurite
npm install -g @azure/static-web-apps-cli
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Install security scanning tools
echo "🔒 Installing security tools..."
curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash
pip3 install checkov

# Install Go testing dependencies
echo "🧪 Installing testing tools..."
# Terratest is a library - install when needed in test files with 'go mod tidy'
echo "🧪 Go testing tools will be installed via go mod when running tests"

# Set execute permissions
# chmod +x .devcontainer/startup.sh

# Wait for emulators to be ready
echo "⏳ Waiting for emulators to start..."
sleep 15

# Verify emulator connectivity
echo "✅ Verifying emulator connectivity..."
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem > ~/cosmos_emulator.pem
curl -v http://azurite:10000/devstoreaccount1/ | head

echo "🎉 Development environment ready!"
echo "📍 Cosmos DB Explorer: https://cosmosdb-emulator:8081/_explorer/index.html"
echo "📍 Azurite Blob: http://azurite:10000"

# Ensure .env exists
[ -f .env ] || cp .env.example .env
