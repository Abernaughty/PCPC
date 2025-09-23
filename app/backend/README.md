# PCPC Backend Application

## Overview

Azure Functions backend application for the Pokemon Card Price Checker (PCPC) system.

## Technology Stack

- **Runtime**: Azure Functions v4.x
- **Language**: TypeScript
- **Node.js**: 22.19.0 LTS
- **Package Manager**: npm

## Azure Functions

### API Functions

- **GetSetList** - Retrieves available Pokemon card sets
- **GetCardsBySet** - Gets cards for a specific set
- **GetCardInfo** - Retrieves detailed card information and pricing
- **RefreshData** - Updates cached data from external APIs
- **MonitorCredits** - Monitors API usage and credits

## Development Setup

### Prerequisites

- Node.js 22.19.0 LTS
- Azure Functions Core Tools v4.x
- Azure CLI

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run start

# Build for production
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
├── functions/          # Azure Function implementations
│   ├── GetSetList/
│   ├── GetCardsBySet/
│   ├── GetCardInfo/
│   ├── RefreshData/
│   └── MonitorCredits/
├── services/           # Business logic services
├── models/             # Data models and types
├── utils/              # Utility functions
└── index.ts            # Main entry point

data/                   # Static data files
scripts/                # Backend-specific scripts
```

## Configuration

### Environment Variables

- `COSMOS_DB_CONNECTION_STRING` - Cosmos DB connection
- `POKEMON_TCG_API_KEY` - Pokemon TCG API key
- `APIM_SUBSCRIPTION_KEY` - API Management subscription key

### Local Development

Copy `.env.example` to `.env` and update with your configuration values.

## Migration Notes

This backend application was migrated from the original PokeData project as part of the PCPC enterprise repository consolidation.

Original source: `C:\Users\maber\Documents\GitHub\PokeData\PokeDataFunc`
Migration date: September 22, 2025
