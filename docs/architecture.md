# PCPC System Architecture

> **Comprehensive technical architecture documentation for the Pokemon Card Price Checker enterprise application**

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Components](#system-components)
- [Data Architecture](#data-architecture)
- [Integration Patterns](#integration-patterns)
- [Security Architecture](#security-architecture)
- [Performance Architecture](#performance-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Development Architecture](#development-architecture)
- [Monitoring Architecture](#monitoring-architecture)
- [Architecture Decisions](#architecture-decisions)

## Architecture Overview

### High-Level System Architecture

The PCPC system follows a modern cloud-native, serverless architecture pattern with clear separation of concerns and enterprise-grade scalability.

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile Browser]
    end

    subgraph "CDN & Edge"
        CDN[Azure CDN<br/>Global Distribution]
    end

    subgraph "Frontend Layer"
        SWA[Azure Static Web Apps<br/>Svelte SPA]
        ASSETS[Static Assets<br/>Images, CSS, JS]
    end

    subgraph "API Gateway Layer"
        APIM[Azure API Management<br/>Consumption Tier]
        POLICIES[Policy Engine<br/>Rate Limiting, CORS, Auth]
        CACHE_APIM[Response Cache<br/>5-60 minutes TTL]
    end

    subgraph "Backend Services Layer"
        AF[Azure Functions v4<br/>Node.js 22 LTS]
        subgraph "Functions"
            GET_SETS[GetSetList<br/>HTTP Trigger]
            GET_CARDS[GetCardsBySet<br/>HTTP Trigger]
            GET_CARD[GetCardInfo<br/>HTTP Trigger]
            REFRESH[RefreshData<br/>Timer Trigger]
            MONITOR[MonitorCredits<br/>Timer Trigger]
        end
    end

    subgraph "Data Layer"
        COSMOS[Cosmos DB<br/>Serverless NoSQL]
        subgraph "Containers"
            SETS_CONTAINER[Sets Container<br/>Partition: /series]
            CARDS_CONTAINER[Cards Container<br/>Partition: /setId]
        end
        REDIS[Redis Cache<br/>Optional Performance]
        BLOB[Azure Blob Storage<br/>Image Assets]
    end

    subgraph "External APIs"
        POKEDATA[PokeData API<br/>Enhanced Pricing]
        POKEMONTCG[Pokemon TCG API<br/>Card Metadata]
    end

    subgraph "Monitoring & Observability"
        APPINSIGHTS[Application Insights<br/>Telemetry & Logging]
        MONITOR_AZURE[Azure Monitor<br/>Metrics & Alerts]
        LOGS[Log Analytics<br/>Centralized Logging]
    end

    WEB --> CDN
    MOBILE --> CDN
    CDN --> SWA
    SWA --> ASSETS
    SWA --> APIM
    APIM --> POLICIES
    APIM --> CACHE_APIM
    APIM --> AF
    AF --> GET_SETS
    AF --> GET_CARDS
    AF --> GET_CARD
    AF --> REFRESH
    AF --> MONITOR
    AF --> COSMOS
    AF --> SETS_CONTAINER
    AF --> CARDS_CONTAINER
    AF --> REDIS
    AF --> BLOB
    AF --> POKEDATA
    AF --> POKEMONTCG
    AF --> APPINSIGHTS
    APPINSIGHTS --> MONITOR_AZURE
    APPINSIGHTS --> LOGS
```

### Architecture Principles

#### 1. Cloud-Native Design

- **Serverless-First**: Leverage Azure Functions and Cosmos DB serverless for optimal cost and scaling
- **Managed Services**: Minimize operational overhead with fully managed Azure services
- **Auto-Scaling**: Automatic scaling based on demand without manual intervention

#### 2. Microservices Architecture

- **Function-Based Services**: Each business capability implemented as separate Azure Function
- **Independent Deployment**: Functions can be deployed independently without affecting others
- **Loose Coupling**: Services communicate through well-defined APIs and events

#### 3. API-First Design

- **Unified Gateway**: Single entry point through Azure API Management
- **Consistent Interface**: RESTful APIs with OpenAPI specifications
- **Version Management**: API versioning strategy for backward compatibility

#### 4. Performance-Optimized

- **Multi-Tier Caching**: Browser, CDN, API Management, and application-level caching
- **Optimized Data Access**: Efficient Cosmos DB partitioning and indexing strategies
- **Content Delivery**: Global CDN for static assets and API responses

#### 5. Security-First

- **Defense in Depth**: Multiple security layers from network to application
- **Zero Trust**: Explicit verification for every request and resource access
- **Managed Identity**: Azure AD integration for service-to-service authentication

## System Components

### Frontend Components

#### Svelte Single Page Application (SPA)

```mermaid
graph TB
    subgraph "Svelte Application Architecture"
        APP[App.svelte<br/>Root Component]

        subgraph "Components"
            SEARCH[SearchableSelect<br/>Card Search Interface]
            CARD_SELECT[CardSearchSelect<br/>Card Selection]
            VARIANT[CardVariantSelector<br/>Variant Selection]
            THEME[ThemeToggle<br/>UI Theme Management]
            DEBUG[DebugPanel<br/>Development Tools]
        end

        subgraph "Services"
            HYBRID[HybridDataService<br/>Data Orchestration]
            CLOUD[CloudDataService<br/>API Communication]
            FEATURE[FeatureFlagService<br/>Feature Management]
            CACHE_SVC[CacheService<br/>IndexedDB Management]
        end

        subgraph "Stores"
            SET_STORE[SetStore<br/>Set Data State]
            THEME_STORE[ThemeStore<br/>UI Theme State]
            APP_STATE[AppState<br/>Application State]
        end

        subgraph "Utilities"
            API_CLIENT[ApiClient<br/>HTTP Communication]
            CACHE_UTIL[CacheUtils<br/>Storage Management]
            DEBUG_UTIL[DebugUtils<br/>Development Helpers]
        end
    end

    APP --> SEARCH
    APP --> CARD_SELECT
    APP --> VARIANT
    APP --> THEME
    APP --> DEBUG

    SEARCH --> HYBRID
    CARD_SELECT --> HYBRID
    VARIANT --> CLOUD

    HYBRID --> CLOUD
    HYBRID --> CACHE_SVC
    CLOUD --> API_CLIENT
    CACHE_SVC --> CACHE_UTIL

    SEARCH --> SET_STORE
    THEME --> THEME_STORE
    APP --> APP_STATE
```

**Key Features**:

- **Reactive Components**: Svelte's compiled reactivity for optimal performance
- **State Management**: Centralized state with Svelte stores
- **Service Layer**: Clean separation between UI and business logic
- **Caching Strategy**: Sophisticated IndexedDB caching with TTL management

#### Static Web App Hosting

- **Global Distribution**: Azure CDN integration for worldwide performance
- **Custom Domain**: Professional domain with SSL certificate management
- **Build Integration**: Automated builds from GitHub repository
- **Environment Configuration**: Separate configurations for dev/staging/production

### Backend Components

#### Azure Functions v4 Architecture

```mermaid
graph TB
    subgraph "Azure Functions Runtime v4"
        HOST[Functions Host<br/>Node.js 22 LTS]

        subgraph "HTTP Triggered Functions"
            GET_SETS[GetSetList<br/>GET /api/sets]
            GET_CARDS[GetCardsBySet<br/>GET /api/sets/{setId}/cards]
            GET_CARD[GetCardInfo<br/>GET /api/sets/{setId}/cards/{cardId}]
        end

        subgraph "Timer Triggered Functions"
            REFRESH[RefreshData<br/>0 0 */12 * * *]
            MONITOR[MonitorCredits<br/>0 0 */6 * * *]
        end

        subgraph "Service Layer"
            COSMOS_SVC[CosmosDbService<br/>Database Operations]
            REDIS_SVC[RedisCacheService<br/>Caching Operations]
            POKEDATA_SVC[PokeDataApiService<br/>Pricing API Integration]
            POKEMONTCG_SVC[PokemonTcgApiService<br/>Metadata API Integration]
            BLOB_SVC[BlobStorageService<br/>Asset Management]
            IMAGE_SVC[ImageEnhancementService<br/>Image Processing]
            MAPPING_SVC[PokeDataToTcgMappingService<br/>Data Mapping]
            CREDIT_SVC[CreditMonitoringService<br/>Usage Tracking]
        end

        subgraph "Utilities"
            CACHE_UTIL[CacheUtils<br/>Cache Management]
            ERROR_UTIL[ErrorHandling<br/>Error Processing]
            LOG_UTIL[LoggingUtils<br/>Structured Logging]
            CONFIG_UTIL[ConfigUtils<br/>Configuration Management]
        end
    end

    HOST --> GET_SETS
    HOST --> GET_CARDS
    HOST --> GET_CARD
    HOST --> REFRESH
    HOST --> MONITOR

    GET_SETS --> COSMOS_SVC
    GET_SETS --> REDIS_SVC
    GET_SETS --> POKEDATA_SVC

    GET_CARDS --> COSMOS_SVC
    GET_CARDS --> POKEMONTCG_SVC
    GET_CARDS --> MAPPING_SVC

    GET_CARD --> COSMOS_SVC
    GET_CARD --> IMAGE_SVC
    GET_CARD --> POKEDATA_SVC

    REFRESH --> COSMOS_SVC
    REFRESH --> POKEDATA_SVC
    REFRESH --> POKEMONTCG_SVC

    MONITOR --> CREDIT_SVC
    MONITOR --> LOG_UTIL

    COSMOS_SVC --> CACHE_UTIL
    REDIS_SVC --> ERROR_UTIL
    POKEDATA_SVC --> CONFIG_UTIL
```

**Function Specifications**:

| Function           | Trigger     | Purpose                              | Dependencies                               |
| ------------------ | ----------- | ------------------------------------ | ------------------------------------------ |
| **GetSetList**     | HTTP GET    | Retrieve paginated Pokemon card sets | CosmosDB, PokeData API, Redis Cache        |
| **GetCardsBySet**  | HTTP GET    | Fetch cards for specific set         | CosmosDB, Pokemon TCG API, Mapping Service |
| **GetCardInfo**    | HTTP GET    | Individual card details and pricing  | CosmosDB, Image Service, PokeData API      |
| **RefreshData**    | Timer (12h) | Background data synchronization      | All external APIs, CosmosDB                |
| **MonitorCredits** | Timer (6h)  | API usage monitoring and alerting    | Credit Service, Logging                    |

### API Gateway Components

#### Azure API Management Configuration

```mermaid
graph TB
    subgraph "API Management Layer"
        APIM_GATEWAY[APIM Gateway<br/>Consumption Tier]

        subgraph "Products"
            STARTER[Starter Product<br/>Basic Access]
            PREMIUM[Premium Product<br/>Enhanced Limits]
        end

        subgraph "APIs"
            PCPC_API[PCPC API v1<br/>OpenAPI 3.0]
            subgraph "Operations"
                OP_SETS[GET /sets<br/>List Pokemon Sets]
                OP_CARDS[GET /sets/{setId}/cards<br/>Cards by Set]
                OP_CARD[GET /sets/{setId}/cards/{cardId}<br/>Card Details]
            end
        end

        subgraph "Policies"
            GLOBAL[Global Policy<br/>CORS, Rate Limiting]
            CACHE_POLICY[Cache Policy<br/>Response Caching]
            BACKEND[Backend Policy<br/>Function Integration]
        end

        subgraph "Backend"
            FUNCTION_BACKEND[Azure Functions Backend<br/>Load Balancing]
        end
    end

    APIM_GATEWAY --> STARTER
    APIM_GATEWAY --> PREMIUM
    APIM_GATEWAY --> PCPC_API

    PCPC_API --> OP_SETS
    PCPC_API --> OP_CARDS
    PCPC_API --> OP_CARD

    APIM_GATEWAY --> GLOBAL
    APIM_GATEWAY --> CACHE_POLICY
    APIM_GATEWAY --> BACKEND

    BACKEND --> FUNCTION_BACKEND
```

**Policy Configuration**:

- **Rate Limiting**: 300 calls per 60 seconds (configurable by environment)
- **CORS**: Configured for frontend domains with credentials support
- **Caching**: Response caching with 5-60 minute TTL based on endpoint
- **Authentication**: Subscription key authentication with future OAuth2 support

## Data Architecture

### Database Design

#### Cosmos DB Container Strategy

```mermaid
graph TB
    subgraph "Cosmos DB Account (Serverless)"
        DATABASE[PCPC Database]

        subgraph "Sets Container"
            SETS_PARTITION[Partition Key: /series<br/>Logical Partitions by Series]
            SETS_INDEX[Composite Indexes<br/>series + releaseDate<br/>series + name]
            SETS_DATA[Set Documents<br/>Metadata, Release Info]
        end

        subgraph "Cards Container"
            CARDS_PARTITION[Partition Key: /setId<br/>Logical Partitions by Set]
            CARDS_INDEX[Composite Indexes<br/>setId + cardNumber<br/>setId + name<br/>setId + rarity]
            CARDS_DATA[Card Documents<br/>Metadata, Pricing, Images]
        end

        subgraph "Performance Optimization"
            HOT_PARTITION[Hot Partition Mitigation<br/>Popular sets distributed]
            QUERY_PATTERNS[Optimized Query Patterns<br/>Single-partition queries preferred]
            RU_ANALYSIS[RU Cost Analysis<br/>2-5 RU single-partition<br/>5-50 RU cross-partition]
        end
    end

    DATABASE --> SETS_PARTITION
    DATABASE --> CARDS_PARTITION

    SETS_PARTITION --> SETS_INDEX
    SETS_PARTITION --> SETS_DATA

    CARDS_PARTITION --> CARDS_INDEX
    CARDS_PARTITION --> CARDS_DATA

    SETS_INDEX --> HOT_PARTITION
    CARDS_INDEX --> QUERY_PATTERNS
    HOT_PARTITION --> RU_ANALYSIS
```

**Container Specifications**:

| Container | Partition Key | Purpose                          | Indexing Strategy                                                     |
| --------- | ------------- | -------------------------------- | --------------------------------------------------------------------- |
| **Sets**  | `/series`     | Pokemon card set metadata        | Composite indexes on series + releaseDate, series + name              |
| **Cards** | `/setId`      | Individual card data and pricing | Composite indexes on setId + cardNumber, setId + name, setId + rarity |

#### Data Models

**Set Document Structure**:

```json
{
  "id": "base1",
  "series": "Base",
  "name": "Base Set",
  "releaseDate": "1999-01-09",
  "totalCards": 102,
  "symbolUrl": "https://images.pokemontcg.io/base1/symbol.png",
  "logoUrl": "https://images.pokemontcg.io/base1/logo.png",
  "isRecent": false,
  "metadata": {
    "source": "pokemontcg",
    "lastUpdated": "2025-09-28T21:00:00Z"
  }
}
```

**Card Document Structure**:

```json
{
  "id": "base1-1",
  "setId": "base1",
  "cardNumber": "1",
  "name": "Alakazam",
  "rarity": "Rare Holo",
  "images": {
    "small": "https://images.pokemontcg.io/base1/1.png",
    "large": "https://images.pokemontcg.io/base1/1_hires.png"
  },
  "pricing": {
    "market": 45.5,
    "low": 35.0,
    "mid": 45.5,
    "high": 65.0,
    "lastUpdated": "2025-09-28T20:30:00Z"
  },
  "metadata": {
    "tcgSetId": "base1",
    "pokeDataId": "base-set-alakazam-1",
    "lastSync": "2025-09-28T21:00:00Z"
  }
}
```

### Caching Architecture

#### Multi-Tier Caching Strategy

```mermaid
graph TB
    subgraph "Client-Side Caching"
        BROWSER[Browser Cache<br/>Static Assets]
        INDEXEDDB[IndexedDB<br/>Application Data]
        subgraph "IndexedDB Stores"
            SET_CACHE[setList<br/>TTL: 24h]
            CARD_CACHE[cardsBySet<br/>TTL: 12h]
            PRICE_CACHE[cardPricing<br/>TTL: 6h]
            CONFIG_CACHE[config<br/>TTL: 1h]
        end
    end

    subgraph "CDN Caching"
        AZURE_CDN[Azure CDN<br/>Global Edge Locations]
        STATIC_CACHE[Static Assets<br/>TTL: 30 days]
        API_CACHE[API Responses<br/>TTL: 5-60 minutes]
    end

    subgraph "API Gateway Caching"
        APIM_CACHE[APIM Response Cache<br/>Environment-based TTL]
        SET_RESPONSE[Set List Responses<br/>TTL: 60 minutes]
        CARD_RESPONSE[Card Responses<br/>TTL: 30 minutes]
        PRICE_RESPONSE[Pricing Responses<br/>TTL: 5 minutes]
    end

    subgraph "Application Caching"
        REDIS_CACHE[Redis Cache<br/>Optional Performance Layer]
        MEMORY_CACHE[In-Memory Cache<br/>Function Instance Cache]
        COMPUTED_CACHE[Computed Results<br/>Expensive Operations]
    end

    BROWSER --> INDEXEDDB
    INDEXEDDB --> SET_CACHE
    INDEXEDDB --> CARD_CACHE
    INDEXEDDB --> PRICE_CACHE
    INDEXEDDB --> CONFIG_CACHE

    AZURE_CDN --> STATIC_CACHE
    AZURE_CDN --> API_CACHE

    APIM_CACHE --> SET_RESPONSE
    APIM_CACHE --> CARD_RESPONSE
    APIM_CACHE --> PRICE_RESPONSE

    REDIS_CACHE --> MEMORY_CACHE
    REDIS_CACHE --> COMPUTED_CACHE
```

**Cache Invalidation Strategy**:

- **Time-Based**: TTL expiration for different data types
- **Event-Based**: Manual invalidation on data updates
- **Version-Based**: Cache versioning for breaking changes
- **Graceful Degradation**: Fallback to source when cache unavailable

## Integration Patterns

### External API Integration

#### Hybrid API Strategy

```mermaid
graph TB
    subgraph "PCPC Backend"
        FUNCTIONS[Azure Functions]
        MAPPING[Data Mapping Service]
        CACHE[Cache Layer]
    end

    subgraph "External APIs"
        POKEDATA[PokeData API<br/>Enhanced Pricing Data]
        POKEMONTCG[Pokemon TCG API<br/>Card Metadata]
    end

    subgraph "Data Sources"
        PRICING[Pricing Information<br/>Market Values, Trends]
        METADATA[Card Metadata<br/>Names, Images, Sets]
        IMAGES[Card Images<br/>High-Quality Assets]
    end

    subgraph "Integration Patterns"
        CIRCUIT_BREAKER[Circuit Breaker<br/>Fault Tolerance]
        RETRY_LOGIC[Retry Logic<br/>Exponential Backoff]
        RATE_LIMITING[Rate Limiting<br/>API Quota Management]
        FALLBACK[Fallback Strategy<br/>Graceful Degradation]
    end

    FUNCTIONS --> MAPPING
    FUNCTIONS --> CACHE

    FUNCTIONS --> POKEDATA
    FUNCTIONS --> POKEMONTCG

    POKEDATA --> PRICING
    POKEMONTCG --> METADATA
    POKEMONTCG --> IMAGES

    FUNCTIONS --> CIRCUIT_BREAKER
    FUNCTIONS --> RETRY_LOGIC
    FUNCTIONS --> RATE_LIMITING
    FUNCTIONS --> FALLBACK
```

**API Integration Specifications**:

| API                 | Purpose                                | Rate Limits      | Caching Strategy | Fallback             |
| ------------------- | -------------------------------------- | ---------------- | ---------------- | -------------------- |
| **PokeData API**    | Enhanced pricing data, graded values   | 1000 calls/day   | 6-hour TTL       | Cached pricing data  |
| **Pokemon TCG API** | Card metadata, images, set information | 20,000 calls/day | 24-hour TTL      | Local metadata cache |

#### Error Handling and Resilience

```mermaid
graph TB
    subgraph "Resilience Patterns"
        REQUEST[API Request]

        subgraph "Circuit Breaker"
            CLOSED[Closed State<br/>Normal Operation]
            OPEN[Open State<br/>Fast Fail]
            HALF_OPEN[Half-Open State<br/>Testing Recovery]
        end

        subgraph "Retry Strategy"
            IMMEDIATE[Immediate Retry<br/>Transient Failures]
            EXPONENTIAL[Exponential Backoff<br/>Rate Limit Errors]
            CIRCUIT_RETRY[Circuit Breaker Retry<br/>Service Recovery]
        end

        subgraph "Fallback Strategy"
            CACHE_FALLBACK[Cache Fallback<br/>Stale Data Acceptable]
            DEFAULT_FALLBACK[Default Values<br/>Minimal Functionality]
            ERROR_RESPONSE[Error Response<br/>Graceful Failure]
        end
    end

    REQUEST --> CLOSED
    CLOSED --> OPEN
    OPEN --> HALF_OPEN
    HALF_OPEN --> CLOSED

    REQUEST --> IMMEDIATE
    IMMEDIATE --> EXPONENTIAL
    EXPONENTIAL --> CIRCUIT_RETRY

    REQUEST --> CACHE_FALLBACK
    CACHE_FALLBACK --> DEFAULT_FALLBACK
    DEFAULT_FALLBACK --> ERROR_RESPONSE
```

## Security Architecture

### Security Layers

```mermaid
graph TB
    subgraph "Network Security"
        VNET[Virtual Network<br/>Network Isolation]
        NSG[Network Security Groups<br/>Traffic Filtering]
        FIREWALL[Azure Firewall<br/>Advanced Protection]
    end

    subgraph "Identity & Access"
        AAD[Azure Active Directory<br/>Identity Provider]
        MANAGED_ID[Managed Identity<br/>Service Authentication]
        RBAC[Role-Based Access Control<br/>Least Privilege]
    end

    subgraph "API Security"
        APIM_AUTH[APIM Authentication<br/>Subscription Keys]
        OAUTH[OAuth 2.0<br/>Future Implementation]
        RATE_LIMIT[Rate Limiting<br/>DDoS Protection]
    end

    subgraph "Data Security"
        ENCRYPTION_REST[Encryption at Rest<br/>Cosmos DB, Storage]
        ENCRYPTION_TRANSIT[Encryption in Transit<br/>TLS 1.2+]
        KEY_VAULT[Azure Key Vault<br/>Secrets Management]
    end

    subgraph "Application Security"
        INPUT_VALIDATION[Input Validation<br/>XSS Prevention]
        OUTPUT_ENCODING[Output Encoding<br/>Injection Prevention]
        SECURITY_HEADERS[Security Headers<br/>OWASP Compliance]
    end

    VNET --> NSG
    NSG --> FIREWALL

    AAD --> MANAGED_ID
    MANAGED_ID --> RBAC

    APIM_AUTH --> OAUTH
    OAUTH --> RATE_LIMIT

    ENCRYPTION_REST --> ENCRYPTION_TRANSIT
    ENCRYPTION_TRANSIT --> KEY_VAULT

    INPUT_VALIDATION --> OUTPUT_ENCODING
    OUTPUT_ENCODING --> SECURITY_HEADERS
```

### Authentication and Authorization

**Current Implementation**:

- **API Management**: Subscription key authentication
- **Function Apps**: Function-level authorization keys
- **Cosmos DB**: Connection string authentication (development)

**Planned Enhancements**:

- **Azure AD Integration**: Managed identity for service-to-service authentication
- **OAuth 2.0**: User authentication for premium features
- **Certificate-Based**: Client certificate authentication for high-security scenarios

## Performance Architecture

### Performance Optimization Strategy

```mermaid
graph TB
    subgraph "Frontend Performance"
        CODE_SPLITTING[Code Splitting<br/>Route-based Loading]
        LAZY_LOADING[Lazy Loading<br/>Component Loading]
        ASSET_OPTIMIZATION[Asset Optimization<br/>Minification, Compression]
        SERVICE_WORKER[Service Worker<br/>Offline Capability]
    end

    subgraph "API Performance"
        RESPONSE_CACHING[Response Caching<br/>Multi-tier Strategy]
        COMPRESSION[Response Compression<br/>Gzip, Brotli]
        CDN_ACCELERATION[CDN Acceleration<br/>Global Distribution]
        CONNECTION_POOLING[Connection Pooling<br/>Database Efficiency]
    end

    subgraph "Database Performance"
        PARTITION_STRATEGY[Partition Strategy<br/>Optimal Data Distribution]
        INDEX_OPTIMIZATION[Index Optimization<br/>Query Performance]
        QUERY_OPTIMIZATION[Query Optimization<br/>Single-partition Queries]
        RU_OPTIMIZATION[RU Optimization<br/>Cost Efficiency]
    end

    subgraph "Monitoring & Optimization"
        PERFORMANCE_MONITORING[Performance Monitoring<br/>Real-time Metrics]
        BOTTLENECK_ANALYSIS[Bottleneck Analysis<br/>Performance Profiling]
        CAPACITY_PLANNING[Capacity Planning<br/>Scaling Strategy]
        COST_OPTIMIZATION[Cost Optimization<br/>Resource Efficiency]
    end

    CODE_SPLITTING --> LAZY_LOADING
    LAZY_LOADING --> ASSET_OPTIMIZATION
    ASSET_OPTIMIZATION --> SERVICE_WORKER

    RESPONSE_CACHING --> COMPRESSION
    COMPRESSION --> CDN_ACCELERATION
    CDN_ACCELERATION --> CONNECTION_POOLING

    PARTITION_STRATEGY --> INDEX_OPTIMIZATION
    INDEX_OPTIMIZATION --> QUERY_OPTIMIZATION
    QUERY_OPTIMIZATION --> RU_OPTIMIZATION

    PERFORMANCE_MONITORING --> BOTTLENECK_ANALYSIS
    BOTTLENECK_ANALYSIS --> CAPACITY_PLANNING
    CAPACITY_PLANNING --> COST_OPTIMIZATION
```

### Performance Metrics

**Target Performance Metrics**:

- **Frontend Load Time**: < 2 seconds (first contentful paint)
- **API Response Time**: < 500ms (95th percentile)
- **Database Query Time**: < 100ms (single-partition queries)
- **Cache Hit Ratio**: > 80% (application-level caching)

**Achieved Performance**:

- **DevContainer Startup**: 30-60 seconds (95% improvement)
- **Frontend Build Time**: 2.4 seconds (production build)
- **Test Execution**: ~40 seconds (26 comprehensive tests)
- **Development Environment**: $0/month cost optimization

## Deployment Architecture

### Infrastructure as Code

```mermaid
graph TB
    subgraph "Terraform Infrastructure"
        MODULES[Terraform Modules<br/>Reusable Components]

        subgraph "Core Modules"
            RG[Resource Group<br/>Resource Organization]
            SWA[Static Web App<br/>Frontend Hosting]
            FUNC[Function App<br/>Backend Services]
            COSMOS[Cosmos DB<br/>Database Services]
            APIM[API Management<br/>Gateway Services]
            STORAGE[Storage Account<br/>Asset Storage]
            INSIGHTS[Application Insights<br/>Monitoring Services]
        end

        subgraph "Environment Configs"
            DEV[Development<br/>Cost-optimized]
            STAGING[Staging<br/>Production-like]
            PROD[Production<br/>High-availability]
        end

        subgraph "Deployment Pipeline"
            VALIDATE[Terraform Validate<br/>Syntax Checking]
            PLAN[Terraform Plan<br/>Change Preview]
            APPLY[Terraform Apply<br/>Infrastructure Deployment]
            DESTROY[Terraform Destroy<br/>Cleanup Operations]
        end
    end

    MODULES --> RG
    MODULES --> SWA
    MODULES --> FUNC
    MODULES --> COSMOS
    MODULES --> APIM
    MODULES --> STORAGE
    MODULES --> INSIGHTS

    MODULES --> DEV
    MODULES --> STAGING
    MODULES --> PROD

    MODULES --> VALIDATE
    VALIDATE --> PLAN
    PLAN --> APPLY
    APPLY --> DESTROY
```

### Environment Strategy

**Environment Specifications**:

| Environment     | Purpose                       | Configuration                          | Cost Target    |
| --------------- | ----------------------------- | -------------------------------------- | -------------- |
| **Development** | Local development and testing | Serverless/consumption tiers           | $0/month       |
| **Staging**     | Pre-production validation     | Production-like with reduced scale     | $50-100/month  |
| **Production**  | Live application              | High-availability, global distribution | $200-500/month |

## Development Architecture

### Revolutionary DevContainer Architecture

```mermaid
graph TB
    subgraph "DevContainer Ecosystem"
        ACR[Azure Container Registry<br/>Pre-built Images]

        subgraph "Container Image (1.28GB)"
            BASE[Ubuntu 22.04 LTS<br/>Base Operating System]
            NODE[Node.js 22.19.0 LTS<br/>Runtime Environment]
            TOOLS[Development Tools<br/>9 Pre-installed Tools]
            EXTENSIONS[VS Code Extensions<br/>35 Pre-configured Extensions]
        end

        subgraph "Development Tools"
            AZURE_CLI[Azure CLI 2.77.0<br/>Cloud Management]
            TERRAFORM[Terraform 1.9.8<br/>Infrastructure as Code]
            FUNCTIONS_TOOLS[Functions Core Tools<br/>Local Development]
            GO[Go 1.23.12<br/>Additional Language Support]
            POWERSHELL[PowerShell 7.5.3<br/>Scripting Environment]
            GIT[Git 2.51.0<br/>Version Control]
            GITHUB_CLI[GitHub CLI 2.80.0<br/>GitHub Integration]
            PYTHON[Python 3.12.11<br/>Scripting Support]
        end

        subgraph "Container Orchestration"
            DEVCONTAINER[DevContainer<br/>Main Development Environment]
            AZURITE[Azurite Emulator<br/>Storage Services]
            COSMOS_EMU[Cosmos DB Emulator<br/>Database Services]
            HEALTH_CHECKS[Health Checks<br/>Service Dependencies]
        end

        subgraph "Performance Optimization"
            LAYER_CACHING[Docker Layer Caching<br/>Efficient Updates]
            IMAGE_OPTIMIZATION[Image Optimization<br/>Size Reduction]
            STARTUP_OPTIMIZATION[Startup Optimization<br/>95% Time Reduction]
        end
    end

    ACR --> BASE
    BASE --> NODE
    NODE --> TOOLS
    TOOLS --> EXTENSIONS

    TOOLS --> AZURE_CLI
    TOOLS --> TERRAFORM
    TOOLS --> FUNCTIONS_TOOLS
    TOOLS --> GO
    TOOLS --> POWERSHELL
    TOOLS --> GIT
    TOOLS --> GITHUB_CLI
    TOOLS --> PYTHON

    ACR --> DEVCONTAINER
    DEVCONTAINER --> AZURITE
    DEVCONTAINER --> COSMOS_EMU
    DEVCONTAINER --> HEALTH_CHECKS

    ACR --> LAYER_CACHING
    LAYER_CACHING --> IMAGE_OPTIMIZATION
    IMAGE_OPTIMIZATION --> STARTUP_OPTIMIZATION
```

**DevContainer Performance Achievements**:

- **95% Time Reduction**: Environment setup from 5-10 minutes to 30-60 seconds
- **Pre-built Optimization**: All tools and extensions ready immediately
- **Layer Caching**: Efficient Docker layer management for updates
- **Container Orchestration**: Health checks ensure reliable service startup

### Testing Architecture

```mermaid
graph TB
    subgraph "Test Pyramid Implementation"
        E2E[End-to-End Tests<br/>Playwright Cross-browser]
        INTEGRATION[Integration Tests<br/>API & Database]
        UNIT[Unit Tests<br/>Frontend & Backend]
    end

    subgraph "Frontend Testing"
        COMPONENT[Component Tests<br/>Svelte Testing Library]
        RENDER[Rendering Tests<br/>DOM Validation]
        INTERACTION[Interaction Tests<br/>User Events]
        ACCESSIBILITY[Accessibility Tests<br/>A11y Compliance]
    end

    subgraph "Backend Testing"
        FUNCTION[Function Tests<br/>Azure Functions]
        SERVICE[Service Tests<br/>Business Logic]
        API_TEST[API Tests<br/>Endpoint Validation]
        DATABASE[Database Tests<br/>Cosmos DB Integration]
    end

    subgraph "Test Infrastructure"
        JEST[Jest Framework<br/>Projects Configuration]
        PLAYWRIGHT[Playwright<br/>Cross-browser Testing]
        MOCKS[Test Mocks<br/>External Dependencies]
        COVERAGE[Coverage Reports<br/>HTML, LCOV, JSON]
    end

    E2E --> INTEGRATION
    INTEGRATION --> UNIT

    UNIT --> COMPONENT
    COMPONENT --> RENDER
    RENDER --> INTERACTION
    INTERACTION --> ACCESSIBILITY

    UNIT --> FUNCTION
    FUNCTION --> SERVICE
    SERVICE --> API_TEST
    API_TEST --> DATABASE

    JEST --> PLAYWRIGHT
    PLAYWRIGHT --> MOCKS
    MOCKS --> COVERAGE
```

## Monitoring Architecture

### Observability Strategy

```mermaid
graph TB
    subgraph "Three Pillars of Observability"
        METRICS[Metrics<br/>Performance Counters]
        LOGS[Logs<br/>Structured Logging]
        TRACES[Traces<br/>Distributed Tracing]
    end

    subgraph "Azure Monitor Stack"
        APPINSIGHTS[Application Insights<br/>APM & Analytics]
        LOG_ANALYTICS[Log Analytics<br/>Centralized Logging]
        AZURE_MONITOR[Azure Monitor<br/>Infrastructure Metrics]
        WORKBOOKS[Azure Workbooks<br/>Custom Dashboards]
    end

    subgraph "Custom Monitoring"
        BUSINESS_METRICS[Business Metrics<br/>API Usage, Errors]
        PERFORMANCE_METRICS[Performance Metrics<br/>Response Times, Throughput]
        COST_METRICS[Cost Metrics<br/>Resource Usage, Optimization]
        SECURITY_METRICS[Security Metrics<br/>Authentication, Authorization]
    end

    subgraph "Alerting & Response"
        ALERTS[Alert Rules<br/>Threshold-based]
        NOTIFICATIONS[Notifications<br/>Email, Teams, SMS]
        RUNBOOKS[Automated Runbooks<br/>Response Automation]
        ESCALATION[Escalation Policies<br/>On-call Management]
    end

    METRICS --> APPINSIGHTS
    LOGS --> LOG_ANALYTICS
    TRACES --> APPINSIGHTS

    APPINSIGHTS --> AZURE_MONITOR
    LOG_ANALYTICS --> WORKBOOKS

    AZURE_MONITOR --> BUSINESS_METRICS
    WORKBOOKS --> PERFORMANCE_METRICS
    BUSINESS_METRICS --> COST_METRICS
    PERFORMANCE_METRICS --> SECURITY_METRICS

    COST_METRICS --> ALERTS
    SECURITY_METRICS --> NOTIFICATIONS
    ALERTS --> RUNBOOKS
    NOTIFICATIONS --> ESCALATION
```

## Architecture Decisions

### Key Technical Decisions

#### 1. Serverless-First Architecture

**Decision**: Use Azure Functions and Cosmos DB serverless for backend services
**Rationale**:

- Cost optimization for variable workloads
- Automatic scaling without infrastructure management
- Pay-per-use pricing model aligns with usage patterns

**Alternatives Considered**:

- Container-based services (Azure Container Apps)
- Traditional VM-based hosting
- Kubernetes orchestration

**Trade-offs**:

- ✅ Lower operational overhead
- ✅ Automatic scaling
- ✅ Cost efficiency for variable loads
- ❌ Cold start latency
- ❌ Vendor lock-in considerations

#### 2. Multi-Tier Caching Strategy

**Decision**: Implement caching at browser, CDN, API gateway, and application levels
**Rationale**:

- Optimize performance across all system layers
- Reduce external API calls and costs
- Improve user experience with faster response times

**Implementation**:

- **Browser**: IndexedDB with TTL management
- **CDN**: Azure CDN for static assets and API responses
- **API Gateway**: APIM response caching
- **Application**: Optional Redis for computed results

#### 3. Hybrid API Integration

**Decision**: Combine PokeData API (pricing) with Pokemon TCG API (metadata)
**Rationale**:

- PokeData provides enhanced pricing data not available elsewhere
- Pokemon TCG API offers comprehensive metadata and images
- Hybrid approach provides best of both data sources

**Resilience Patterns**:

- Circuit breaker for fault tolerance
- Exponential backoff for rate limiting
- Graceful fallback to cached data

#### 4. DevContainer ACR Optimization

**Decision**: Pre-build development environment in Azure Container Registry
**Rationale**:

- 95% reduction in environment setup time
- Consistent development environment across team
- Eliminates dependency on external package repositories

**Implementation**:

- 1.28GB optimized container image
- 35 VS Code extensions pre-installed
- 9 development tools ready to use
- Health checks for service dependencies

#### 5. Infrastructure as Code with Terraform

**Decision**: Use Terraform for all infrastructure management
**Rationale**:

- Declarative infrastructure definition
- Version control for infrastructure changes
- Multi-environment deployment consistency
- Azure provider maturity and feature coverage

**Module Strategy**:

- Reusable modules for common patterns
- Environment-specific configurations
- Remote state management for team collaboration

### Architecture Evolution

#### Phase 1: Foundation (Completed)

- Basic infrastructure setup
- Development environment optimization
- Core service architecture

#### Phase 2: Application Migration (Completed)

- Frontend and backend application migration
- Database schema implementation
- API integration patterns

#### Phase 3: Advanced Features (Completed)

- API Management as Code
- Comprehensive testing framework
- Database schema management

#### Phase 4: Enterprise Documentation (In Progress)

- Comprehensive documentation suite
- Monitoring and observability setup
- Production readiness validation

### Future Architecture Considerations

#### Planned Enhancements

1. **Enhanced Security**

   - Azure AD integration for authentication
   - Certificate-based authentication
   - Advanced threat protection

2. **Global Distribution**

   - Multi-region deployment
   - Global database replication
   - Edge computing optimization

3. **Advanced Analytics**

   - Real-time analytics pipeline
   - Machine learning integration
   - Predictive pricing models

4. **Microservices Evolution**
   - Service mesh implementation
   - Event-driven architecture
   - CQRS pattern adoption

#### Scalability Roadmap

- **Current**: Single-region serverless architecture
- **Phase 1**: Multi-region deployment with global distribution
- **Phase 2**: Event-driven microservices with service mesh
- **Phase 3**: AI/ML integration for predictive analytics

---

## Summary

The PCPC system architecture demonstrates enterprise-grade design principles with:

- **Cloud-Native**: Serverless-first approach with Azure managed services
- **Performance-Optimized**: Multi-tier caching and optimized data access patterns
- **Security-First**: Defense in depth with comprehensive security layers
- **Developer-Friendly**: Revolutionary DevContainer with 95% setup time reduction
- **Scalable**: Designed for growth with clear evolution path

This architecture serves as both a functional Pokemon card price checking application and a comprehensive demonstration of advanced software engineering capabilities suitable for senior-level technical roles.
