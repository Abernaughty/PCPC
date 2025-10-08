# PokeData Function App - Project Brief

## Core Requirements

- Azure Function App providing Pokémon Trading Card Game data via REST API
- Integrates with PokeData API for comprehensive set and card information
- Implements caching layer with Redis for performance optimization
- Provides paginated responses for large datasets

## Primary Goals

1. **Performance**: Fast API responses through intelligent caching
2. **Scalability**: Handle high traffic loads efficiently
3. **Data Completeness**: Comprehensive access to Pokémon TCG data
4. **Developer Experience**: Clean, well-documented API endpoints

## Key Endpoints

- `/api/sets` - Retrieve paginated list of card sets
- `/api/sets/{setId}/cards` - Get cards within a specific set
- `/api/sets/{setId}/cards/{cardId}` - Individual card details
- `MonitorCredits` - API usage monitoring
- `RefreshData` - Cache invalidation

## Technology Stack

- **Runtime**: Node.js 20+, TypeScript
- **Platform**: Azure Functions v4
- **Cache**: Redis for performance optimization
- **Data Source**: PokeData API integration
- **Storage**: Azure Cosmos DB for persistence

## Current Issue

Pagination implementation in GetSetList only returns first page (100 items) instead of all available sets when requested.
