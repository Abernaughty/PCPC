#!/bin/bash

echo "🚀 Setting up PokeData DevOps Environment..."

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
go install github.com/gruntwork-io/terratest/modules/terraform@latest

# Wait for emulators to be ready
echo "⏳ Waiting for emulators to start..."
sleep 30

# Initialize Cosmos DB with sample data
echo "🗄️ Initializing Cosmos DB emulator..."
# Add script to create database and container

# Verify emulator connectivity
echo "✅ Verifying emulator connectivity..."
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem > ~/cosmos_emulator.pem
curl -v http://azurite:10000/devstoreaccount1/ | head

echo "🎉 Development environment ready!"
echo "📍 Cosmos DB Explorer: https://localhost:8081/_explorer/index.html"
echo "📍 Azurite Blob: http://localhost:10000"

# Ensure .devcontainer/local.env exists
[ -f .env ] || cp .env.example .env

# Ensure .devcontainer/local.env exists
[ -f .env ] || cp .env.example .env
