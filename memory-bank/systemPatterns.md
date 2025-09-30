# PCPC System Patterns

## System Architecture Overview

### High-Level Architecture

The PCPC system follows a modern cloud-native architecture pattern with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │   Backend       │
│   (Svelte SPA)  │◄──►│   (Azure APIM)   │◄──►│   (Functions)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Static Web    │    │   Monitoring     │    │   Database      │
│   App Hosting   │    │   & Logging      │    │   (Cosmos DB)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Architectural Patterns

#### 1. Microservices Architecture

**Pattern**: Function-based microservices using Azure Functions
**Implementation**:

- Each business capability as separate function
- Independent deployment and scaling
- Event-driven communication where applicable
- Shared data layer with proper partitioning

**Functions Structure**:

- `GetSetList` - Retrieve Pokemon card sets
- `GetCardsBySet` - Fetch cards for specific set
- `GetCardInfo` - Detailed card information and pricing
- `RefreshData` - Data synchronization and updates
- `HealthCheck` - System health monitoring

#### 2. API Gateway Pattern

**Pattern**: Centralized API management with Azure API Management
**Implementation**:

- Single entry point for all client requests
- Request/response transformation
- Rate limiting and throttling
- Authentication and authorization
- API versioning and documentation

**APIM Configuration**:

- Product-based access control (Public/Premium)
- Policy-based request processing
- Backend service abstraction
- Comprehensive logging and monitoring

#### 3. Database Per Service Pattern

**Pattern**: Cosmos DB with container-based data isolation
**Implementation**:

- Logical separation using containers
- Partition key strategy for performance
- Consistent data access patterns
- Cross-container queries where necessary

**Container Structure**:

- `cards` - Individual card data and metadata
- `sets` - Pokemon set information
- `pricing-history` - Historical pricing data
- `cache` - Temporary data and computed results

## Design Patterns

### Frontend Patterns

#### 1. Component-Based Architecture

**Pattern**: Svelte component composition
**Implementation**:

```
App.svelte
├── SearchableSelect.svelte
├── CardSearchSelect.svelte
├── CardVariantSelector.svelte
├── ThemeToggle.svelte
└── DebugPanel.svelte
```

**Key Principles**:

- Single responsibility per component
- Props-down, events-up communication
- Reusable and composable components
- Clear component boundaries

#### 2. State Management Pattern

**Pattern**: Svelte stores with reactive state
**Implementation**:

- `themeStore.js` - UI theme management
- `appState.js` - Application-wide state
- Reactive updates across components
- Persistent state where appropriate

#### 3. Service Layer Pattern

**Pattern**: Business logic abstraction
**Implementation**:

- `cloudDataService.js` - API communication
- `hybridDataService.js` - Local/remote data coordination
- `featureFlagService.js` - Feature toggle management
- Clear separation of concerns

#### 4. CSS Variable Theming Pattern

**Pattern**: Centralized theme management with CSS custom properties
**Implementation**:

- **Global Theme System**: Comprehensive CSS variables in `global.css`
- **Light/Dark Mode Support**: Theme-aware variable definitions
- **Component Integration**: Components use `var(--variable-name)` syntax

**CSS Variable Categories**:

```css
:root {
  /* Background Colors */
  --bg-primary: #000000;
  --bg-secondary: rgba(0, 0, 0, 0.9);
  --bg-dropdown: #41444e;
  --bg-hover: #000000;

  /* Text Colors */
  --text-primary: #000000;
  --text-secondary: #000000;
  --text-inverse: #000000;

  /* Theme Colors */
  --color-pokemon-blue: #000000;
  --color-pokemon-red: #000000;
}

[data-theme="dark"] {
  --bg-primary: #000000;
  --bg-dropdown: #22242f;
  --text-primary: #d7dee3;
  --text-inverse: #eeff00;
  /* ... dark mode overrides */
}
```

**Anti-Pattern Identified**: Hardcoded color values breaking theme consistency

**Problematic Implementation**:

```css
/* WRONG - Hardcoded colors */
.dropdown {
  background-color: white; /* Breaks dark mode */
  color: #333; /* Ignores theme */
}

/* CORRECT - Theme-aware */
.dropdown {
  background-color: var(--bg-dropdown);
  color: var(--text-primary);
}
```

**Components with Theme Issues**:

- `CardSearchSelect.svelte` - 15+ hardcoded colors
- `App.svelte` - Hardcoded header text and rgba values
- `SearchableInput.svelte` - 15+ hardcoded colors
- `CardVariantSelector.svelte` - 20+ hardcoded colors
- `FeatureFlagDebugPanel.svelte` - 10+ hardcoded colors

**Reference Implementation**: `SearchableSelect.svelte` properly uses CSS variables throughout

### Backend Patterns

#### 1. Repository Pattern

**Pattern**: Data access abstraction
**Implementation**:

```typescript
interface CardRepository {
  getById(id: string): Promise<Card>;
  getBySet(setId: string): Promise<Card[]>;
  search(criteria: SearchCriteria): Promise<Card[]>;
}
```

**Benefits**:

- Database implementation independence
- Testable data access layer
- Consistent data operations
- Easy mocking for testing

#### 2. Service Layer Pattern

**Pattern**: Business logic encapsulation
**Implementation**:

- `cosmosService.ts` - Database operations
- `pokemonTcgService.ts` - External API integration
- `pokeDataService.ts` - Business logic coordination
- `cacheService.ts` - Caching strategy implementation

#### 3. Dependency Injection Pattern

**Pattern**: Loose coupling through dependency injection
**Implementation**:

```typescript
export class CardService {
  constructor(
    private cardRepository: CardRepository,
    private cacheService: CacheService,
    private logger: Logger
  ) {}
}
```

## Infrastructure Patterns

### 1. Infrastructure as Code (IaC)

**Pattern**: Terraform-based infrastructure management
**Implementation**:

- Modular Terraform architecture
- Environment-specific configurations
- State management with remote backend
- Automated deployment pipelines

**Module Structure**:

```
infra/modules/
├── resource-group/
├── static-web-app/
├── function-app/
├── cosmos-db/
├── api-management/
├── storage-account/
├── application-insights/
└── networking/
```

### 2. Environment Promotion Pattern

**Pattern**: Consistent environment progression
**Implementation**:

- Development → Staging → Production
- Infrastructure parity across environments
- Automated promotion with validation gates
- Environment-specific configuration management

### 3. GitOps Pattern

**Pattern**: Git-driven infrastructure and deployment
**Implementation**:

- Infrastructure changes via pull requests
- Automated validation and testing
- Audit trail through Git history
- Rollback capability through Git revert

## Data Patterns

### 1. CQRS (Command Query Responsibility Segregation)

**Pattern**: Separate read and write operations
**Implementation**:

- Write operations through Functions
- Read operations optimized for queries
- Event sourcing for data changes
- Materialized views for complex queries

### 2. Event Sourcing Pattern

**Pattern**: Store events rather than current state
**Implementation**:

- Price change events
- Data refresh events
- User interaction events
- Audit trail maintenance

### 3. Caching Strategy Pattern

**Pattern**: Multi-level caching for performance
**Implementation**:

- Browser cache for static assets
- CDN cache for API responses
- Application cache for computed data
- Database query result caching

## Security Patterns

### 1. Defense in Depth

**Pattern**: Multiple security layers
**Implementation**:

- Network security (VNet, NSG)
- Application security (APIM policies)
- Data security (encryption, access control)
- Identity security (Azure AD integration)

### 2. Zero Trust Architecture

**Pattern**: Never trust, always verify
**Implementation**:

- Explicit verification for every request
- Least privilege access principles
- Assume breach mentality
- Continuous monitoring and validation

### 3. Secrets Management Pattern

**Pattern**: Centralized secrets management
**Implementation**:

- Azure Key Vault for sensitive data
- Managed identities for service authentication
- Rotation policies for credentials
- Audit logging for access

## Monitoring and Observability Patterns

### 1. Three Pillars of Observability

**Pattern**: Metrics, Logs, and Traces
**Implementation**:

- **Metrics**: Performance counters, business metrics
- **Logs**: Structured logging with correlation IDs
- **Traces**: Distributed tracing across services

### 2. Health Check Pattern

**Pattern**: Proactive system health monitoring
**Implementation**:

- Endpoint health checks
- Dependency health validation
- Graceful degradation strategies
- Automated alerting and recovery

### 3. Circuit Breaker Pattern

**Pattern**: Fault tolerance and resilience
**Implementation**:

- External API call protection
- Automatic failure detection
- Fallback mechanisms
- Recovery strategies

## Testing Patterns

### 1. Test Pyramid Pattern

**Pattern**: Balanced testing strategy
**Implementation**:

```
        /\
       /  \     E2E Tests (Few)
      /____\
     /      \   Integration Tests (Some)
    /________\
   /          \ Unit Tests (Many)
  /__________\
```

### 2. Test Doubles Pattern

**Pattern**: Isolated testing with mocks/stubs
**Implementation**:

- Mock external dependencies
- Stub database calls
- Fake services for testing
- Spy on function calls

### 3. Contract Testing Pattern

**Pattern**: API contract validation
**Implementation**:

- OpenAPI specification validation
- Consumer-driven contract testing
- Schema validation
- Backward compatibility testing

## Performance Patterns

### 1. Lazy Loading Pattern

**Pattern**: Load resources on demand
**Implementation**:

- Component lazy loading
- Data pagination
- Image lazy loading
- Route-based code splitting

### 2. Caching Strategy Pattern

**Pattern**: Strategic data caching
**Implementation**:

- Cache-aside pattern for database
- Write-through for critical data
- Time-based expiration
- Cache invalidation strategies

### 3. Connection Pooling Pattern

**Pattern**: Efficient resource utilization
**Implementation**:

- Database connection pooling
- HTTP connection reuse
- Resource lifecycle management
- Connection health monitoring

### 4. Direct URL Generation Pattern

**Pattern**: Eliminate external API dependencies for predictable resources
**Implementation**:

- **Problem**: Pokemon TCG API timeouts (60+ seconds, 504 Gateway Timeout)
- **Solution**: Direct URL construction using proven patterns
- **Pattern**: `https://images.pokemontcg.io/{tcgSetId}/{cardNumber}.png`
- **Benefits**: Sub-second response times, 100% reliability, no external dependencies

**Code Example**:

```typescript
private generateImageUrls(tcgSetId: string, cardNumber: string): { small: string; large: string } {
  const cleanCardNumber = cardNumber.replace(/^0+/, "") || "0";
  return {
    small: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}.png`,
    large: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}_hires.png`,
  };
}
```

**Implementation Details**:

- **Card Number Normalization**: Remove leading zeros (e.g., "020" → "20")
- **Set Mapping Integration**: Use existing PokeDataToTcgMappingService for set ID conversion
- **Fallback Strategy**: Graceful degradation when mapping unavailable
- **Performance Impact**: 95%+ reduction in response time vs API calls

## Critical Implementation Paths

### 1. Data Flow Path

```
User Request → APIM → Function → Cosmos DB → Response
     ↓
Cache Check → Cache Hit/Miss → Data Processing → Cache Update
```

### 2. Authentication Flow

```
User → APIM → JWT Validation → Function Authorization → Resource Access
```

### 3. Error Handling Path

```
Error Occurrence → Logging → Monitoring Alert → Graceful Degradation → User Notification
```

### 4. Deployment Pipeline

```
Code Commit → Build → Test → Security Scan → Deploy → Smoke Test → Monitor
```

These patterns provide the foundation for building a scalable, maintainable, and secure Pokemon Card Price Checker application while demonstrating enterprise-grade software engineering practices.
