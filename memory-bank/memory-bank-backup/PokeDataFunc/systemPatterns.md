# System Patterns - PokeData Function App

## Architectural Patterns

### 1. Cache-Aside Pattern
```typescript
// Check cache first
const cached = await cache.get(key);
if (cached) return cached;

// Cache miss - fetch from source
const data = await api.getData();
await cache.set(key, data, ttl);
return data;
```

### 2. Repository Pattern
```typescript
interface DataRepository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T>;
    save(entity: T): Promise<void>;
}
```

### 3. Response Wrapper Pattern
```typescript
interface ApiResponse<T> {
    status: number;
    data?: T;
    error?: string;
    timestamp: string;
    cached?: boolean;
    cacheAge?: number;
}
```

## Data Access Patterns

### Service Layer Organization
- **PokeDataApiService**: External API integration
- **RedisCacheService**: Caching operations
- **CosmosDbService**: Persistent storage

### Error Handling Strategy
- Graceful degradation on cache failures
- Retry logic for external API calls
- Structured error responses
- Correlation IDs for tracing

### Pagination Strategy
```typescript
interface PaginationParams {
    page: number;
    pageSize: number;
}

interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
    };
}
```

## Performance Patterns

### Caching Strategy
- **Sets**: 7-day TTL (rarely change)
- **Cards**: 24-hour TTL (moderate change)
- **Dynamic data**: 1-hour TTL

### Memory Management
- Streaming large datasets
- Lazy loading for optional fields
- Connection pooling for databases

## Security Patterns
- API key validation
- Request rate limiting
- Input sanitization
- Environment variable configuration