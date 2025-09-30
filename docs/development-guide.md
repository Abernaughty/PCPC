# PCPC Development Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Debugging](#debugging)
- [Performance](#performance)
- [Contributing](#contributing)

## Getting Started

Welcome to the Pokemon Card Price Checker (PCPC) development environment! This guide will take you from zero to productive development in under 5 minutes thanks to our revolutionary DevContainer optimization.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop**: Required for DevContainer support
- **Visual Studio Code**: Primary development IDE
- **VS Code DevContainer Extension**: For container-based development
- **Git**: Version control (usually pre-installed)
- **Azure CLI**: For Azure resource management (optional for local development)

### Quick Start (< 5 Minutes)

1. **Clone the Repository**

   ```bash
   git clone https://github.com/Abernaughty/PCPC.git
   cd PCPC
   ```

2. **Open in DevContainer**

   - Open VS Code in the project directory
   - When prompted, click "Reopen in Container" or use `Ctrl+Shift+P` → "Dev Containers: Reopen in Container"
   - **Revolutionary Performance**: First startup ~60 seconds, subsequent startups ~10 seconds (95% improvement over traditional setup)

3. **Verify Environment**

   ```bash
   # Check Node.js version (should be 22.19.0 LTS)
   node --version

   # Check npm version
   npm --version

   # Check Azure CLI
   az --version

   # Check Terraform
   terraform --version
   ```

4. **Install Dependencies**

   ```bash
   # Frontend dependencies (154 packages)
   cd app/frontend && npm install

   # Backend dependencies (94 packages)
   cd ../backend && npm install

   # Return to root
   cd ../..
   ```

5. **Start Development**

   ```bash
   # Start frontend development server
   make dev-frontend

   # In another terminal, start backend
   make dev-backend
   ```

### Repository Structure

Understanding the PCPC repository structure is crucial for effective development:

```
PCPC/
├── app/                          # Application code
│   ├── frontend/                 # Svelte frontend application
│   │   ├── src/                  # Source code (components, services, stores)
│   │   ├── public/               # Static assets and build output
│   │   └── package.json          # Frontend dependencies and scripts
│   └── backend/                  # Azure Functions backend
│       ├── src/                  # TypeScript source code
│       │   ├── functions/        # Azure Functions (5 functions)
│       │   ├── services/         # Business logic services (11 services)
│       │   ├── models/           # TypeScript interfaces and types
│       │   └── utils/            # Utility functions and helpers
│       └── package.json          # Backend dependencies and scripts
├── infra/                        # Infrastructure as Code
│   ├── modules/                  # Terraform modules (7 modules)
│   └── envs/                     # Environment-specific configurations
├── tests/                        # Comprehensive testing framework
│   ├── frontend/                 # Frontend component tests
│   ├── backend/                  # Backend function tests
│   └── config/                   # Testing configuration and utilities
├── docs/                         # Documentation suite
├── apim/                         # API Management as Code
├── db/                           # Database schema management
├── .devcontainer/                # Development environment configuration
├── tools/                        # Development and operational tools
└── memory-bank/                  # Project documentation and context
```

## Development Environment

### DevContainer Architecture

The PCPC project uses a revolutionary DevContainer setup that provides:

- **95% Faster Startup**: Pre-built Azure Container Registry images
- **Consistent Environment**: Same tools and versions across all developers
- **Complete Toolchain**: All development tools pre-installed and configured

#### Pre-installed Tools

The DevContainer includes all necessary development tools:

**Core Development Tools**:

- Node.js 22.19.0 LTS (latest stable)
- npm (package manager, Azure Functions v4 compatible)
- TypeScript 5.8.3 (latest stable)
- Azure Functions Core Tools v4.x

**Infrastructure and DevOps**:

- Terraform 1.13.3 (latest stable)
- Azure CLI 2.77.0 (with azure-devops extension)
- Docker (for container operations)
- Git 2.51.0 (with GitHub CLI 2.80.0)

**Additional Tools**:

- Go 1.23.12 (for infrastructure tooling)
- PowerShell 7.5.3 (cross-platform scripting)
- Python 3.12.11 (for automation scripts)

#### VS Code Extensions (35 Pre-installed)

The DevContainer includes a comprehensive extension pack:

**Frontend Development**:

- Svelte for VS Code (syntax highlighting, IntelliSense)
- JavaScript and TypeScript support
- HTML/CSS/JSON language support
- Prettier (code formatting)
- ESLint (code linting)

**Backend Development**:

- Azure Functions extension
- Azure Account and Resources
- REST Client (for API testing)
- Thunder Client (API testing)

**Infrastructure and DevOps**:

- HashiCorp Terraform
- Azure Resource Manager Tools
- Docker extension
- Kubernetes support

**Development Productivity**:

- GitLens (enhanced Git capabilities)
- GitHub Pull Requests and Issues
- Live Share (collaborative development)
- Bracket Pair Colorizer
- Path Intellisense

### Environment Configuration

#### Frontend Environment Variables

Create `app/frontend/.env` based on `.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:7071/api
VITE_APIM_SUBSCRIPTION_KEY=your-subscription-key-here

# Feature Flags
VITE_ENABLE_DEBUG_PANEL=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_CACHE_DEBUGGING=true

# External APIs
VITE_POKEDATA_API_BASE_URL=https://www.pokedata.io/v0
VITE_POKEMON_TCG_API_BASE_URL=https://api.pokemontcg.io/v2

# Development Settings
VITE_ENVIRONMENT=development
VITE_LOG_LEVEL=debug
```

#### Backend Environment Variables

Create `app/backend/local.settings.json` based on the template:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "FUNCTIONS_EXTENSION_VERSION": "~4",

    "COSMOS_DB_CONNECTION_STRING": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "COSMOS_DB_DATABASE_NAME": "PokeData",

    "POKEDATA_API_KEY": "your-pokedata-api-key",
    "POKEMON_TCG_API_KEY": "your-pokemon-tcg-api-key",

    "REDIS_CACHE_ENABLED": "false",
    "REDIS_CONNECTION_STRING": "",

    "BLOB_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER_NAME": "images"
  }
}
```

### Port Configuration

The DevContainer automatically forwards the following ports:

- **3000**: Frontend development server (Svelte)
- **7071**: Azure Functions local runtime
- **8081**: Cosmos DB Emulator
- **10000-10002**: Azurite Storage Emulator
- **4280**: Static Web Apps CLI (when used)

## Development Workflow

### Daily Development Process

#### 1. Environment Startup

```bash
# Start DevContainer (if not already running)
# VS Code will automatically start the container

# Verify all services are healthy
make health-check

# Start development services
make dev
```

#### 2. Frontend Development

```bash
# Navigate to frontend directory
cd app/frontend

# Start development server with hot reload
npm run dev

# Build for production testing
npm run build

# Preview production build
npm run preview
```

**Frontend Development Features**:

- **Hot Reload**: Instant updates on file changes
- **Component Testing**: Live component development and testing
- **Debug Panel**: Built-in debugging tools for development
- **Theme Testing**: Light/dark mode toggle for UI testing
- **API Integration**: Live API testing with backend services

#### 3. Backend Development

```bash
# Navigate to backend directory
cd app/backend

# Start Azure Functions runtime
npm run start

# Build TypeScript
npm run build

# Watch mode for development
npm run watch
```

**Backend Development Features**:

- **Live Reload**: Automatic function reload on changes
- **Local Emulators**: Cosmos DB and Storage emulators for testing
- **Debug Support**: VS Code debugging integration
- **API Testing**: Built-in HTTP trigger testing
- **Timer Function Testing**: Manual timer function execution

#### 4. Testing Workflow

```bash
# Run all tests (26 tests across frontend and backend)
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Git Workflow

#### Branch Management

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Create bugfix branch
git checkout -b bugfix/issue-description

# Create documentation branch
git checkout -b docs/documentation-update
```

#### Commit Standards

Follow conventional commit format:

```bash
# Feature commits
git commit -m "feat: add new card search functionality"

# Bug fixes
git commit -m "fix: resolve API timeout issues"

# Documentation
git commit -m "docs: update development guide"

# Tests
git commit -m "test: add comprehensive component tests"

# Infrastructure
git commit -m "infra: update Terraform modules"
```

#### Pull Request Process

1. **Create Feature Branch**: Always work on feature branches
2. **Write Tests**: Ensure new code has appropriate test coverage
3. **Update Documentation**: Update relevant documentation
4. **Run Full Test Suite**: Ensure all tests pass
5. **Create Pull Request**: Use descriptive title and detailed description
6. **Code Review**: Address reviewer feedback
7. **Merge**: Squash and merge after approval

### Code Organization

#### Frontend Code Structure

```
app/frontend/src/
├── components/           # Reusable Svelte components
│   ├── SearchableSelect.svelte
│   ├── CardSearchSelect.svelte
│   ├── CardVariantSelector.svelte
│   ├── FeatureFlagDebugPanel.svelte
│   └── SearchableInput.svelte
├── services/            # Business logic and API services
│   ├── cloudDataService.js
│   ├── hybridDataService.js
│   ├── featureFlagService.js
│   ├── cacheService.js
│   ├── debugService.js
│   ├── performanceService.js
│   └── corsProxy.js
├── stores/              # Svelte stores for state management
│   ├── themeStore.js
│   ├── setStore.js
│   ├── cardStore.js
│   ├── cacheStore.js
│   └── debugStore.js
├── utils/               # Utility functions and helpers
│   ├── cacheUtils.js
│   ├── dateUtils.js
│   ├── formatUtils.js
│   └── validationUtils.js
├── config/              # Configuration and constants
│   ├── apiConfig.js
│   ├── cacheConfig.js
│   └── debugConfig.js
└── data/                # Static data and mappings
    └── setMappings.js
```

#### Backend Code Structure

```
app/backend/src/
├── functions/           # Azure Functions (HTTP and Timer)
│   ├── GetSetList/
│   ├── GetCardsBySet/
│   ├── GetCardInfo/
│   ├── RefreshData/
│   └── MonitorCredits/
├── services/            # Business logic services
│   ├── CosmosDbService.ts
│   ├── RedisCacheService.ts
│   ├── BlobStorageService.ts
│   ├── PokeDataApiService.ts
│   ├── PokemonTcgApiService.ts
│   ├── CreditMonitoringService.ts
│   ├── ImageEnhancementService.ts
│   ├── ImageUrlUpdateService.ts
│   ├── PokeDataToTcgMappingService.ts
│   ├── SetMappingService.ts
│   └── BlobStorageService_old.ts
├── models/              # TypeScript interfaces and types
│   ├── Card.ts
│   ├── Set.ts
│   ├── ApiResponse.ts
│   └── Config.ts
└── utils/               # Utility functions
    ├── cacheUtils.ts
    ├── errorUtils.ts
    ├── logUtils.ts
    ├── validationUtils.ts
    └── performanceUtils.ts
```

## Code Standards

### TypeScript Standards

#### Type Safety

```typescript
// Always use explicit types for function parameters and return values
export async function getCardsBySet(
  setId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ApiResponse<Card[]>> {
  // Implementation
}

// Use interfaces for complex objects
interface CardSearchCriteria {
  setId?: string;
  rarity?: string;
  condition?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}

// Use enums for constants
enum CardCondition {
  MINT = "mint",
  NEAR_MINT = "near_mint",
  EXCELLENT = "excellent",
  GOOD = "good",
  PLAYED = "played",
}
```

#### Error Handling

```typescript
// Use Result pattern for error handling
type Result<T, E = Error> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

export async function fetchCardData(cardId: string): Promise<Result<Card>> {
  try {
    const card = await cardService.getById(cardId);
    return { success: true, data: card };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}
```

### JavaScript Standards

#### ES6+ Features

```javascript
// Use const/let instead of var
const API_BASE_URL = "https://api.example.com";
let currentPage = 1;

// Use arrow functions for callbacks
const processCards = (cards) =>
  cards
    .filter((card) => card.rarity === "rare")
    .map((card) => ({ ...card, processed: true }));

// Use template literals
const buildApiUrl = (endpoint, params) =>
  `${API_BASE_URL}/${endpoint}?${new URLSearchParams(params)}`;

// Use destructuring
const { name, rarity, price } = card;
const [first, second, ...rest] = cardList;
```

#### Async/Await

```javascript
// Prefer async/await over Promises
async function loadCardData(setId) {
  try {
    const response = await fetch(`/api/sets/${setId}/cards`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to load card data:", error);
    throw error;
  }
}

// Handle multiple async operations
async function loadAllData() {
  try {
    const [sets, cards, pricing] = await Promise.all([
      loadSets(),
      loadCards(),
      loadPricing(),
    ]);
    return { sets, cards, pricing };
  } catch (error) {
    console.error("Failed to load data:", error);
    throw error;
  }
}
```

### Svelte Standards

#### Component Structure

```svelte
<script>
  // Imports first
  import { onMount } from 'svelte';
  import { themeStore } from '../stores/themeStore.js';

  // Props
  export let cards = [];
  export let loading = false;
  export let onCardSelect = () => {};

  // Local state
  let selectedCard = null;
  let searchTerm = '';

  // Reactive statements
  $: filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Functions
  function handleCardClick(card) {
    selectedCard = card;
    onCardSelect(card);
  }

  // Lifecycle
  onMount(() => {
    // Component initialization
  });
</script>

<!-- Template with proper indentation -->
<div class="card-list" class:dark={$themeStore.isDark}>
  {#if loading}
    <div class="loading">Loading cards...</div>
  {:else if filteredCards.length > 0}
    {#each filteredCards as card (card.id)}
      <div
        class="card-item"
        class:selected={selectedCard?.id === card.id}
        on:click={() => handleCardClick(card)}
      >
        <h3>{card.name}</h3>
        <p>{card.rarity}</p>
      </div>
    {/each}
  {:else}
    <div class="empty">No cards found</div>
  {/if}
</div>

<style>
  /* Component-scoped styles */
  .card-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  .card-item {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .card-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-item.selected {
    border-color: var(--primary-color);
    background-color: var(--primary-bg);
  }
</style>
```

### CSS Standards

#### CSS Custom Properties

```css
/* Use CSS custom properties for theming */
:root {
  /* Colors */
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif;
  --font-size-base: 1rem;
  --line-height-base: 1.5;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 3rem;

  /* Borders */
  --border-radius: 0.375rem;
  --border-width: 1px;
  --border-color: #dee2e6;
}

/* Dark theme overrides */
[data-theme="dark"] {
  --primary-color: #0d6efd;
  --border-color: #495057;
  --text-color: #f8f9fa;
  --bg-color: #212529;
}
```

## Testing Guidelines

### Testing Philosophy

PCPC follows the Test Pyramid pattern with comprehensive coverage:

```
        /\
       /  \     E2E Tests (Few, High Value)
      /____\    - Critical user journeys
     /      \   - Cross-browser compatibility
    /________\
   /          \ Integration Tests (Some, Key Flows)
  /____________\ - API integration
 /              \ - Component integration
/________________\ Unit Tests (Many, Fast)
                   - Pure functions
                   - Component logic
                   - Service methods
```

### Frontend Testing

#### Component Testing with Testing Library

```javascript
// tests/frontend/components/SearchableSelect.test.js
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { expect, test, describe, vi } from "vitest";
import SearchableSelect from "../../../app/frontend/src/components/SearchableSelect.svelte";

describe("SearchableSelect Component", () => {
  const mockOptions = [
    { value: "option1", label: "Option 1", group: "Group A" },
    { value: "option2", label: "Option 2", group: "Group B" },
  ];

  test("renders with options", () => {
    const { getByText } = render(SearchableSelect, {
      props: { options: mockOptions },
    });

    expect(getByText("Option 1")).toBeInTheDocument();
    expect(getByText("Option 2")).toBeInTheDocument();
  });

  test("filters options on search", async () => {
    const { getByPlaceholderText, queryByText } = render(SearchableSelect, {
      props: { options: mockOptions, placeholder: "Search..." },
    });

    const searchInput = getByPlaceholderText("Search...");
    await fireEvent.input(searchInput, { target: { value: "Option 1" } });

    await waitFor(() => {
      expect(queryByText("Option 1")).toBeInTheDocument();
      expect(queryByText("Option 2")).not.toBeInTheDocument();
    });
  });

  test("handles selection", async () => {
    const mockOnSelect = vi.fn();
    const { getByText } = render(SearchableSelect, {
      props: { options: mockOptions, onSelect: mockOnSelect },
    });

    await fireEvent.click(getByText("Option 1"));

    expect(mockOnSelect).toHaveBeenCalledWith(mockOptions[0]);
  });
});
```

#### Service Testing

```javascript
// tests/frontend/services/cacheService.test.js
import { describe, test, expect, beforeEach, vi } from "vitest";
import { cacheService } from "../../../app/frontend/src/services/cacheService.js";

describe("Cache Service", () => {
  beforeEach(() => {
    // Clear IndexedDB before each test
    vi.clearAllMocks();
  });

  test("stores and retrieves data", async () => {
    const testData = { id: 1, name: "Test Card" };

    await cacheService.set("test-key", testData, 3600); // 1 hour TTL
    const retrieved = await cacheService.get("test-key");

    expect(retrieved).toEqual(testData);
  });

  test("respects TTL expiration", async () => {
    const testData = { id: 1, name: "Test Card" };

    await cacheService.set("test-key", testData, -1); // Expired
    const retrieved = await cacheService.get("test-key");

    expect(retrieved).toBeNull();
  });
});
```

### Backend Testing

#### Azure Functions Testing

```javascript
// tests/backend/functions/GetSetList.test.js
import { describe, test, expect, beforeEach, vi } from "vitest";
import { app } from "@azure/functions";
import { GetSetList } from "../../../app/backend/src/functions/GetSetList/index.js";

describe("GetSetList Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns paginated set list", async () => {
    const mockRequest = {
      query: new Map([
        ["page", "1"],
        ["pageSize", "10"],
      ]),
    };

    const mockContext = {
      log: vi.fn(),
      res: {},
    };

    await GetSetList(mockRequest, mockContext);

    expect(mockContext.res.status).toBe(200);
    expect(mockContext.res.body).toHaveProperty("data");
    expect(mockContext.res.body).toHaveProperty("pagination");
  });

  test("handles invalid page parameters", async () => {
    const mockRequest = {
      query: new Map([
        ["page", "invalid"],
        ["pageSize", "10"],
      ]),
    };

    const mockContext = {
      log: vi.fn(),
      res: {},
    };

    await GetSetList(mockRequest, mockContext);

    expect(mockContext.res.status).toBe(400);
    expect(mockContext.res.body).toHaveProperty("error");
  });
});
```

#### Service Testing

```typescript
// tests/backend/services/CosmosDbService.test.ts
import { describe, test, expect, beforeEach, vi } from "vitest";
import { CosmosDbService } from "../../../app/backend/src/services/CosmosDbService";

describe("CosmosDbService", () => {
  let cosmosDbService: CosmosDbService;

  beforeEach(() => {
    cosmosDbService = new CosmosDbService();
    vi.clearAllMocks();
  });

  test("retrieves items by partition key", async () => {
    const mockItems = [
      { id: "1", setId: "base1", name: "Charizard" },
      { id: "2", setId: "base1", name: "Blastoise" },
    ];

    vi.spyOn(cosmosDbService, "getItemsByPartitionKey").mockResolvedValue(
      mockItems
    );

    const result = await cosmosDbService.getItemsByPartitionKey(
      "cards",
      "base1"
    );

    expect(result).toEqual(mockItems);
    expect(result).toHaveLength(2);
  });

  test("handles database errors gracefully", async () => {
    vi.spyOn(cosmosDbService, "getItemsByPartitionKey").mockRejectedValue(
      new Error("Database connection failed")
    );

    await expect(
      cosmosDbService.getItemsByPartitionKey("cards", "base1")
    ).rejects.toThrow("Database connection failed");
  });
});
```

### End-to-End Testing

#### Playwright Configuration

```typescript
// tests/config/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 3000,
    cwd: "./app/frontend",
  },
});
```

### Test Coverage

Maintain high test coverage across all components:

- **Unit Tests**: 80%+ coverage for services and utilities
- **Component Tests**: 70%+ coverage for UI components
- **Integration Tests**: Cover all API endpoints and critical user flows
- **E2E Tests**: Cover primary user journeys and cross-browser compatibility

## Debugging

### Frontend Debugging

#### Browser DevTools

The PCPC frontend includes comprehensive debugging tools:

```javascript
// Built-in debug panel (available in development)
// Access via: http://localhost:3000?debug=true

// Debug service provides comprehensive logging
import { debugService } from "../services/debugService.js";

debugService.log("component", "SearchableSelect rendered", { props });
debugService.warn("api", "API response slow", { duration: 2000 });
debugService.error("cache", "Cache write failed", { error });

// Performance monitoring
import { performanceService } from "../services/performanceService.js";

performanceService.mark("search-start");
// ... search operation
performanceService.mark("search-end");
performanceService.measure("search-duration", "search-start", "search-end");
```

#### VS Code Debugging

Configure VS Code debugging for frontend:

```json
// .vscode/launch.json (already configured)
{
  "name": "Debug Frontend",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/app/frontend/node_modules/.bin/rollup",
  "args": ["-c", "--watch"],
  "cwd": "${workspaceFolder}/app/frontend",
  "console": "integratedTerminal",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Backend Debugging

#### Azure Functions Local Debugging

```json
// .vscode/launch.json (already configured)
{
  "name": "Debug Backend",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/app/backend/node_modules/.bin/func",
  "args": ["start", "--typescript"],
  "cwd": "${workspaceFolder}/app/backend",
  "console": "integratedTerminal",
  "env": {
    "NODE_ENV": "development"
  }
}
```

#### Logging and Monitoring

```typescript
// Structured logging in Azure Functions
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function GetSetList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();

  context.log("GetSetList function started", {
    requestId: context.invocationId,
    method: request.method,
    url: request.url,
  });

  try {
    // Function logic here
    const result = await processRequest(request);

    context.log("GetSetList function completed successfully", {
      requestId: context.invocationId,
      duration: Date.now() - startTime,
      resultCount: result.data.length,
    });

    return { status: 200, jsonBody: result };
  } catch (error) {
    context.log.error("GetSetList function failed", {
      requestId: context.invocationId,
      duration: Date.now() - startTime,
      error: error.message,
      stack: error.stack,
    });

    return {
      status: 500,
      jsonBody: {
        error: "Internal server error",
        requestId: context.invocationId,
      },
    };
  }
}
```

### Common Debugging Scenarios

#### API Integration Issues

```javascript
// Debug API calls with detailed logging
async function debugApiCall(url, options = {}) {
  console.log("API Call:", { url, options });

  const startTime = performance.now();

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    console.log("API Response:", {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration.toFixed(2)}ms`,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("API Data:", data);

    return data;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error("API Call Failed:", {
      url,
      duration: `${duration.toFixed(2)}ms`,
      error: error.message,
    });
    throw error;
  }
}
```

#### Cache Debugging

```javascript
// Debug IndexedDB cache operations
class DebugCacheService {
  async get(key) {
    console.log(`Cache GET: ${key}`);
    const result = await this.cache.get(key);
    console.log(`Cache GET result:`, { key, found: !!result, data: result });
    return result;
  }

  async set(key, value, ttl) {
    console.log(`Cache SET: ${key}`, { value, ttl });
    const result = await this.cache.set(key, value, ttl);
    console.log(`Cache SET complete: ${key}`);
    return result;
  }

  async clear() {
    console.log("Cache CLEAR: all entries");
    const result = await this.cache.clear();
    console.log("Cache CLEAR complete");
    return result;
  }
}
```

## Performance

### Frontend Performance

#### Build Optimization

```javascript
// rollup.config.cjs - Production optimizations
export default {
  input: "src/main.js",
  output: {
    sourcemap: !production,
    format: "iife",
    name: "app",
    file: "public/build/bundle.js",
  },
  plugins: [
    svelte({
      compilerOptions: {
        dev: !production,
      },
    }),
    css({ output: "bundle.css" }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),

    // Production optimizations
    production &&
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      }),

    // Bundle analyzer (optional)
    production &&
      analyzer({
        summaryOnly: true,
        limit: 10,
      }),
  ],
};
```

#### Runtime Performance

```javascript
// Lazy loading for large components
import { onMount } from "svelte";

let HeavyComponent;

onMount(async () => {
  // Load component only when needed
  const module = await import("./HeavyComponent.svelte");
  HeavyComponent = module.default;
});

// Virtual scrolling for large lists
import { createVirtualList } from "@tanstack/svelte-virtual";

const virtualList = createVirtualList({
  count: items.length,
  getScrollElement: () => scrollElement,
  estimateSize: () => 50,
  overscan: 5,
});

// Debounced search to reduce API calls
import { debounce } from "lodash-es";

const debouncedSearch = debounce(async (term) => {
  if (term.length >= 2) {
    const results = await searchCards(term);
    searchResults = results;
  }
}, 300);
```

### Backend Performance

#### Azure Functions Optimization

```typescript
// Connection pooling and reuse
let cosmosClient: CosmosClient;

export function getCosmosClient(): CosmosClient {
  if (!cosmosClient) {
    cosmosClient = new CosmosClient({
      endpoint: process.env.COSMOS_DB_ENDPOINT,
      key: process.env.COSMOS_DB_KEY,
      connectionPolicy: {
        connectionMode: ConnectionMode.Gateway,
        requestTimeout: 10000,
        enableEndpointDiscovery: false,
        preferredLocations: ["East US"],
      },
    });
  }
  return cosmosClient;
}

// Batch operations for efficiency
export async function batchUpdateCards(cards: Card[]): Promise<void> {
  const client = getCosmosClient();
  const container = client.database("PokeData").container("cards");

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const operations = batch.map((card) => ({
      operationType: "Upsert",
      resourceBody: card,
    }));

    await container.items.batch(operations, card.setId);
  }
}

// Caching with TTL
const cache = new Map<string, { data: any; expires: number }>();

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
}
```

### Database Performance

#### Query Optimization

```sql
-- Optimized queries for Cosmos DB
SELECT c.id, c.name, c.rarity, c.price
FROM cards c
WHERE c.setId = @setId
  AND c.rarity IN (@rarity1, @rarity2)
ORDER BY c.price DESC
OFFSET @offset LIMIT @limit

-- Use partition key in all queries
SELECT * FROM cards c WHERE c.setId = @setId  -- Good: uses partition key

SELECT * FROM cards c WHERE c.name = @name    -- Avoid: cross-partition query
```

#### Indexing Strategy

```json
// Optimized indexing policy
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [
    {
      "path": "/setId/?",
      "indexes": [
        {
          "kind": "Range",
          "dataType": "String",
          "precision": -1
        }
      ]
    },
    {
      "path": "/rarity/?",
      "indexes": [
        {
          "kind": "Range",
          "dataType": "String",
          "precision": -1
        }
      ]
    },
    {
      "path": "/price/?",
      "indexes": [
        {
          "kind": "Range",
          "dataType": "Number",
          "precision": -1
        }
      ]
    }
  ],
  "excludedPaths": [
    {
      "path": "/description/*"
    },
    {
      "path": "/imageUrls/*"
    }
  ]
}
```

## Contributing

### Getting Started with Contributions

1. **Fork the Repository**: Create your own fork of the PCPC repository
2. **Clone Your Fork**: `git clone https://github.com/yourusername/PCPC.git`
3. **Set Up Development Environment**: Follow the Getting Started guide above
4. **Create Feature Branch**: `git checkout -b feature/your-feature-name`

### Contribution Guidelines

#### Code Quality Requirements

- **All tests must pass**: Run `npm test` before submitting
- **Code coverage**: Maintain or improve existing coverage levels
- **Linting**: Code must pass ESLint and Prettier checks
- **TypeScript**: All TypeScript code must compile without errors
- **Documentation**: Update relevant documentation for new features

#### Pull Request Process

1. **Create Descriptive PR Title**: Use conventional commit format
2. **Provide Detailed Description**: Explain what changes were made and why
3. **Link Related Issues**: Reference any related GitHub issues
4. **Add Screenshots**: For UI changes, include before/after screenshots
5. **Update Tests**: Add or update tests for new functionality
6. **Update Documentation**: Update relevant documentation files

#### Code Review Process

- **Automated Checks**: All CI/CD checks must pass
- **Peer Review**: At least one team member must approve
- **Architecture Review**: For significant changes, architecture review required
- **Security Review**: For security-related changes, security review required

### Development Best Practices

#### Commit Message Format

```bash
# Format: type(scope): description
feat(frontend): add card variant selector component
fix(backend): resolve API timeout issues in GetCardInfo
docs(readme): update installation instructions
test(frontend): add comprehensive SearchableSelect tests
refactor(backend): improve error handling in CosmosDbService
perf(frontend): optimize bundle size with lazy loading
```

#### Branch Naming

```bash
# Feature branches
feature/card-variant-selector
feature/advanced-search-filters

# Bug fix branches
bugfix/api-timeout-handling
bugfix/cache-invalidation-issue

# Documentation branches
docs/api-reference-update
docs/deployment-guide-enhancement

# Infrastructure branches
infra/terraform-module-updates
infra/ci-cd-pipeline-improvements
```

### Issue Reporting

#### Bug Reports

When reporting bugs, include:

- **Environment Details**: OS, browser, Node.js version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: Visual evidence of the issue
- **Console Logs**: Any relevant error messages
- **Additional Context**: Any other relevant information

#### Feature Requests

When requesting features, include:

- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternative Solutions**: Other approaches considered
- **Use Cases**: Who would benefit and how?
- **Implementation Notes**: Technical considerations

### Community Guidelines

- **Be Respectful**: Treat all contributors with respect and kindness
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning and contributing their time
- **Follow Code of Conduct**: Adhere to the project's code of conduct
- **Ask Questions**: Don't hesitate to ask for help or clarification

---

## Summary

This development guide provides comprehensive coverage of the PCPC development environment, workflows, standards, and best practices. With the revolutionary DevContainer optimization providing 95% faster startup times, developers can be productive in under 5 minutes.

Key highlights:

- **Quick Setup**: Revolutionary DevContainer with 30-60 second startup times
- **Comprehensive Tooling**: All development tools pre-installed and configured
- **Enterprise Standards**: Professional code standards and testing practices
- **Complete Testing**: 26 tests across frontend and backend with Test Pyramid pattern
- **Performance Optimization**: Build and runtime performance best practices
- **Contribution Ready**: Clear guidelines for contributing to the project

For additional help, refer to the [Architecture Documentation](./architecture.md), [API Reference](./api-reference.md), and [Troubleshooting Guide](./troubleshooting.md).

**Next Steps**: After setting up your development environment, explore the [Deployment Guide](./deployment-guide.md) to learn about infrastructure deployment and the [Troubleshooting Guide](./troubleshooting.md) for common issue resolution.

```

```
