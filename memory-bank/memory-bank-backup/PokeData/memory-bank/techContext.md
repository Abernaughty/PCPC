# Technical Context

## Overview
This document outlines the technologies used, development setup, technical constraints, dependencies, and tool usage patterns for the PokeData project.

## Technologies Used

### Current Frontend
- **Svelte**: Core UI framework for building the application
- **JavaScript**: Primary programming language
- **HTML/CSS**: Markup and styling
- **Fetch API**: For making HTTP requests to external APIs
- **Web Storage API**: For lightweight client-side storage

### Current Cloud Technologies (Default)
- **Azure Cosmos DB**: Primary database for card metadata and pricing information
- **Azure Functions**: Serverless API endpoints and background processing
- **Azure API Management**: API gateway and external API proxy
- **Azure Static Web Apps**: Frontend hosting

### Development Tools
- **Rollup**: Module bundler for JavaScript
- **NPM**: Package manager for Node.js dependencies (project standard, required for Azure Functions v4 compatibility)
- **SirvCLI**: Static file server for development and testing
- **Batch Scripts**: Automation for common development tasks
- **Azure CLI**: Command-line tools for Azure resource management (✅ installed and configured)
- **Azure Storage Explorer**: Visual tool for managing Azure storage resources (planned)
- **Azure MCP Server**: Model Context Protocol server for Azure service integration (✅ installed)
- **GitHub MCP Server**: Model Context Protocol server for GitHub integration (✅ installed 2025-08-12)
- **Go Programming Language**: v1.24.6 installed for building MCP servers from source (✅ installed 2025-08-12)

### External Services
- **Pokémon TCG API**: Primary source for card metadata, set information, and high-quality images
- **PokeData API**: Secondary source for enhanced pricing data and graded card values
- **CORS Proxy**: For handling cross-origin requests to external APIs

## Development Setup

### Local Development Environment
1. **Prerequisites**:
   - Windows operating system
   - Node.js (v14 or higher)
   - PNPM package manager
   - Internet connection (for initial setup and API calls)
   - Azure CLI (planned for cloud resource management)

2. **Repository Structure**:
   ```
   PokeData/
   ├── .github/               # GitHub Actions workflows
   │   └── workflows/
   ├── docs/                  # Documentation files
   │   ├── api-documentation.md
   │   ├── azure-deployment.md
   │   ├── cicd-deployment-guide.md
   │   ├── debugging-guide.md
   │   └── ...
   ├── memory-bank/           # Project memory documentation
   │   ├── activeContext.md
   │   ├── productContext.md
   │   ├── progress.md
   │   ├── projectbrief.md
   │   ├── systemPatterns.md
   │   └── techContext.md
   ├── PokeDataFunc/          # Azure Functions backend
   │   ├── src/               # TypeScript source code
   │   ├── scripts/           # Data management scripts
   │   ├── docs/              # Backend documentation
   │   ├── package.json       # Backend dependencies (npm)
   │   ├── package-lock.json  # NPM lock file
   │   └── ...
   ├── public/                # Static assets
   │   ├── build/             # Compiled code (generated)
   │   ├── images/            # Images
   │   ├── data/              # Static data files
   │   ├── debug-api.js       # API debugging utilities
   │   ├── global.css         # Global styles
   │   ├── index.html         # HTML entry point
   │   └── staticwebapp.config.json # Azure Static Web Apps configuration
   ├── scripts/               # Build and utility scripts
   │   ├── build-app.bat      # Production build script
   │   ├── build.js           # Build configuration
   │   ├── deploy-frontend.js # Frontend deployment script
   │   ├── server.bat         # Unified server script
   │   ├── tools.bat          # Utility tools
   │   └── README.md          # Scripts documentation
   ├── src/                   # Source code
   │   ├── components/        # UI components
   │   │   ├── CardSearchSelect.svelte
   │   │   ├── CardVariantSelector.svelte
   │   │   ├── SearchableInput.svelte
   │   │   └── SearchableSelect.svelte
   │   ├── data/              # Static data and configuration
   │   │   ├── apiConfig.js
   │   │   ├── cloudApiConfig.js
   │   │   └── setList.js
   │   ├── services/          # Business logic and API services
   │   │   ├── cloudDataService.js
   │   │   ├── pokeDataService.js
   │   │   └── storage/
   │   │       └── db.js
   │   ├── stores/            # Svelte stores
   │   ├── App.svelte         # Main application component
   │   ├── corsProxy.js       # CORS proxy utility
   │   ├── debug-env.js       # Debugging utilities
   │   └── main.js            # Application entry point
   ├── .env.example           # Example environment variables
   ├── .gitignore             # Git ignore file
   ├── .npmrc                 # NPM configuration
   ├── DEPLOYMENT_GUIDE.md    # Comprehensive deployment guide
   ├── package.json           # Package configuration (npm)
   ├── package-lock.json      # NPM lock file
   ├── README.md              # Project documentation
   └── rollup.config.cjs      # Rollup configuration
   ```

3. **Setup Commands**:
   
   **Command Prompt:**
   ```bash
   # Clone repository
   git clone https://github.com/Abernaughty/PokeData.git
   cd PokeData

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```
   
   **PowerShell:**
   ```powershell
   # Clone repository
   git clone https://github.com/Abernaughty/PokeData.git
   cd PokeData

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```

   Note: The PokeData repository is located at `C:\Users\maber\Documents\GitHub\PokeData` and is also available on GitHub at https://github.com/Abernaughty/PokeData. There is a separate static web app workflow directory at `C:\Users\maber\Documents\GitHub\git-maber\PokeData` that should not be modified unless explicitly requested.

4. **Automation Scripts** (located in `scripts/` directory):
   - **scripts/server.bat**: Unified server script with parameter support (http://localhost:3000)
     - Use `scripts\server.bat` or `scripts\server.bat dev` for development server with hot reloading
     - Use `scripts\server.bat prod` for production server with optimized build
     - Automatically detects and safely terminates any existing processes on port 3000
     - Includes automatic build check for production mode
     - Uses a robust process termination approach to avoid conflicts
   - **scripts/build-app.bat**: Builds the application for production
     - Use `scripts\build-app.bat` for a full build
     - Use `scripts\build-app.bat css` to rebuild only CSS
   - **scripts/tools.bat**: Provides utility tools
     - Use `scripts\tools.bat setup` to install dependencies
     - Use `scripts\tools.bat diagnose` to diagnose environment issues
     - Use `scripts\tools.bat fix-path` to fix Node.js path issues
   - **scripts/deploy-frontend.js**: Node.js script for deploying frontend to Azure Static Web Apps
     - Interactive menu with multiple deployment options
     - Automatic token management from .env file
     - Cross-platform compatibility

### Development Workflow
1. **Local Development**:
   - Run `npm run dev` or `scripts\server.bat dev` to start the development server
   - Access the application at http://localhost:3000
   - Changes to source files trigger hot reloading

2. **Building for Production**:
   - Run `npm run build` or `scripts\build-app.bat` to create a production build
   - Output is generated in the `public/build` directory

3. **Running in Production Mode**:
   - Run `npm start` or `scripts\server.bat prod` to serve the production build
   - Access the application at http://localhost:3000

### Planned Cloud Development Workflow
1. **Azure Resource Management**:
   - Use Azure CLI or Azure Portal to create and manage resources
   - Deploy Azure Functions using Azure Functions Core Tools
   - Manage Cosmos DB collections and documents using Azure Portal or SDK
   - Configure Azure API Management using Azure Portal or ARM templates

2. **Local Development with Cloud Resources**:
   - Develop and test Azure Functions locally using Azure Functions Core Tools
   - Connect to development instances of Azure resources
   - Use local.settings.json for local configuration
   - Use Azure Storage Emulator for local storage testing

3. **Deployment**:
   - Deploy frontend to Azure Static Web Apps
   - Deploy Azure Functions using GitHub Actions or Azure DevOps
   - Configure API Management using ARM templates
   - Manage Cosmos DB indexes and partitioning using Azure Portal or SDK

## Technical Constraints

### Browser Compatibility
- **Supported Browsers**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Minimum Versions**:
  - Chrome 60+
  - Firefox 55+
  - Safari 11+
  - Edge 16+
- **Features Requiring Modern Browsers**:
  - IndexedDB for storage
  - ES6+ JavaScript features
  - CSS Grid and Flexbox

### Performance Requirements
- **Initial Load Time**: Under 2 seconds on broadband connections
- **Search Response Time**: Under 500ms for local searches
- **API Response Handling**: Graceful loading states for remote data
- **Offline Functionality**: Core features work without internet connection

### Current Storage Limitations
- **Browser Storage**: Limited by browser storage allocation
- **Cache Invalidation**: Required for data freshness
- **Fallback Mechanisms**: Needed for API unavailability

### Cloud Storage Implementation
- **Cosmos DB**: Configured with card data in Cards container and set data in Sets container
  - On-demand population strategy for efficient storage usage
  - Currently populated with data for Scarlet & Violet sets, with older sets loaded on-demand
  - Cards are stored by Set ID partition key for efficient querying

### API Constraints
- **Rate Limiting**: External APIs may have request limits
- **CORS Restrictions**: Cross-origin requests require proxy or proper headers
- **Data Format Variations**: APIs may return inconsistent data structures
- **API Availability**: External services may experience downtime

### Cloud Service Constraints
- **Cosmos DB RU Limits**: Request Units need to be properly provisioned
- **Azure Functions Execution Time**: Maximum execution time for functions
- **API Management Throughput**: Request limits based on selected tier
- **Cost Management**: Operational costs need to be monitored and optimized

## Dependencies

### Current Dependency Status
The project uses fixed dependency versions to ensure stability. As of September 16, 2025, the dependency status is as follows:

**Package Manager Status**: Reverted from pnpm to npm due to Azure Functions v4 compatibility issues

| Package | Current Version | Latest Version | Status |
|---------|----------------|----------------|--------|
| NPM | Latest | Latest | ✅ Using system npm |
| Svelte | 4.2.19 | 5.28.2 | Major version update available |
| Rollup | 2.79.2 | 4.40.0 | Major version update available |
| @rollup/plugin-commonjs | 21.1.0 | 28.0.3 | Major version update available |
| @rollup/plugin-node-resolve | 13.3.0 | 16.0.1 | Major version update available |
| @rollup/plugin-replace | 6.0.2 | 6.0.2 | ✅ Up to date |
| rollup-plugin-css-only | 3.1.0 | 4.5.2 | Major version update available |
| rollup-plugin-livereload | 2.0.5 | 2.0.5 | ✅ Up to date |
| rollup-plugin-svelte | 7.2.2 | 7.2.2 | ✅ Up to date |
| rollup-plugin-terser | 7.0.2 | 7.0.2 | ✅ Up to date |
| sirv-cli | 1.0.0 | 3.0.1 | Major version update available |
| dotenv | 16.5.0 | 16.5.0 | ✅ Up to date |
| rimraf | 3.0.2 | 6.0.1 | Major version update available |

### Cloud Architecture Dependencies
For the cloud-based architecture, we've implemented the following dependencies:

| Package | Purpose | Status |
|---------|---------|--------|
| @azure/cosmos | Cosmos DB client for Node.js | ✅ Implemented |
| axios | HTTP client for API requests | ✅ Implemented |
| @azure/identity | Authentication for Azure services | ✅ Implemented |
| @azure/functions | Azure Functions runtime | ✅ Implemented |
| chart.js | Library for price history visualization | 🔄 Planned |
| azure-functions-core-tools | Local development tools for Azure Functions | ✅ Implemented |

### Package Manager Compatibility Constraints

#### Azure Functions v4 + pnpm Incompatibility (Critical Finding - September 16, 2025)
- **Issue**: Azure Functions v4 programming model is fundamentally incompatible with pnpm's symlink-based node_modules structure
- **Symptoms**: 
  - Functions fail to register with Azure runtime despite successful deployments
  - "No job functions found" errors in Azure portal
  - 404 responses from all function endpoints
  - GitHub Actions report successful builds and deployments
- **Root Cause**: pnpm's symlink structure prevents Azure Functions runtime from properly resolving modules
- **Resolution**: Complete reversion from pnpm to npm required
- **Impact**: No workaround available - this is a platform limitation, not a configuration issue

#### Package Manager Decision Matrix
| Platform/Service | npm Support | pnpm Support | Recommendation |
|------------------|-------------|--------------|----------------|
| Azure Functions v4 | ✅ Full | ❌ Incompatible | npm required |
| GitHub Actions | ✅ Full | ✅ Full | Either |
| Local Development | ✅ Full | ✅ Full | Either |
| Azure Static Web Apps | ✅ Full | ✅ Full | Either |
| Rollup Build Process | ✅ Full | ✅ Full | Either |

#### Current Package Manager Status
- **Frontend**: npm (reverted from pnpm September 16, 2025)
- **Backend (PokeDataFunc)**: npm (reverted from pnpm September 16, 2025)
- **CI/CD Pipeline**: npm with proper caching configuration
- **Reason for Reversion**: Azure Functions v4 compatibility requirement

### Dependency Update Plan
1. **Package Manager Stability**:
   - Maintain npm for Azure Functions compatibility
   - Monitor Azure Functions roadmap for potential pnpm support
   - Consider pnpm for frontend-only projects in the future

2. **Non-Breaking Updates**:
   - Apply patch and minor updates first (rollup-plugin-livereload, rollup-plugin-svelte, rollup-plugin-terser)
   - Test application functionality after each update
   - Document any changes in behavior or configuration

3. **Major Version Updates**:
   - Evaluate each major update separately (Rollup, plugins, sirv-cli)
   - Research breaking changes and migration guides
   - Create migration plan for each dependency
   - Implement updates incrementally with thorough testing

4. **Svelte Framework Update**:
   - Special consideration for Svelte 3.x to 5.x update
   - Research Svelte 5 migration guide
   - Identify breaking changes and required code modifications
   - Create a separate branch for Svelte 5 migration
   - Test thoroughly before merging

5. **Cloud Dependencies Addition**:
   - Add Azure SDK packages as needed for cloud resource integration
   - Implement proper authentication and security practices
   - Create abstraction layers for cloud service interactions
   - Develop local development workflows with cloud emulators where possible

### Production Dependencies
```json
{
  "dependencies": {
    "axios": "1.9.0",
    "node-fetch": "3.3.2",
    "sirv-cli": "1.0.0"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@rollup/plugin-commonjs": "21.1.0",
    "@rollup/plugin-node-resolve": "13.3.0",
    "@rollup/plugin-replace": "6.0.2",
    "dotenv": "16.5.0",
    "rimraf": "3.0.2",
    "rollup": "2.79.2",
    "rollup-plugin-css-only": "3.1.0",
    "rollup-plugin-livereload": "2.0.5",
    "rollup-plugin-svelte": "7.2.2",
    "rollup-plugin-terser": "7.0.2",
    "svelte": "4.2.19"
  }
}
```

### Key Dependency Details

1. **Svelte**:
   - Current Version: 3.38.3
   - Latest Version: 5.28.2
   - Purpose: UI framework for building reactive components
   - Features Used: Component system, reactivity, event handling, conditional rendering
   - Update Considerations: Major version jump with significant API changes

2. **Rollup**:
   - Current Version: 2.30.0
   - Latest Version: 4.40.0
   - Purpose: JavaScript module bundler
   - Features Used: Code splitting, tree shaking, plugin system
   - Update Considerations: Configuration changes required for v4

3. **NPM**:
   - Current Version: System npm (reverted from pnpm September 16, 2025)
   - Purpose: Package manager for Node.js dependencies
   - Features Used: Package installation, script running, dependency management
   - Migration Status: Reverted from pnpm to npm due to Azure Functions v4 incompatibility
   - Compatibility: Required for Azure Functions v4 programming model
   - Update Considerations: Maintain npm for Azure Functions compatibility

4. **sirv-cli**:
   - Current Version: 1.0.0
   - Latest Version: 3.0.1
   - Purpose: Static file server for development and production
   - Features Used: HTTP serving, compression, caching
   - Update Considerations: Command line options may have changed

## Tool Usage Patterns

### Code Quality and Review
- **Comprehensive Code Review**: Using the standardized prompt in `memory-bank/codeReviewPrompt.md`
- **Review Timing**: Pre-implementation, post-implementation, pre-release, and maintenance reviews
- **Issue Prioritization**: Critical, High, Medium, and Low severity ratings
- **Review Focus Areas**: 16 key areas including project structure, code quality, architecture, security, and more
- **Reporting Format**: Structured format with actionable recommendations and code examples
- **Cross-Session AI Integration**: Special attention to inconsistencies from AI-assisted development

### Version Control
- **Git**: For source code management
- **GitHub**: For repository hosting
- **Branching Strategy**: Feature branches with main as the primary branch
- **Commit Conventions**: Descriptive commit messages with prefixes (feat, fix, docs, etc.)

### Development Patterns
- **Component Development**:
  - One component per file
  - Clear separation of concerns
  - Props for configuration
  - Events for communication

- **Service Development**:
  - Centralized services for data operations
  - Clear error handling
  - Caching strategies
  - Fallback mechanisms

- **Testing Approach**:
  - Manual testing during development
  - Console logging for debugging
  - Mock data for offline testing
  - Browser developer tools for inspection

### Build Process
- **Development Build**:
  - Source maps for debugging
  - Hot module replacement
  - Minimal optimization for faster builds

- **Production Build**:
  - Code minification and optimization
  - CSS extraction and minification
  - Bundle splitting for performance
  - Cache optimization

### Current Deployment
- **Static Hosting**:
  - Azure Static Web Apps (planned)
  - GitHub Pages (alternative)
  - Netlify (alternative)

- **Configuration**:
  - Environment-specific settings
  - Feature flags
  - API endpoints

### Azure Static Web Apps Architecture Insights
- **🔑 CRITICAL DISCOVERY**: Static Web Apps create permanent binding between deployment tokens and workflow file names
  - **Token-Workflow Binding**: Each deployment token is tied to the specific workflow file name that was active during creation
  - **Configuration Persistence**: Mixed configuration states can persist even through Azure CLI disconnect/reconnect operations
  - **Portal UI Limitations**: Azure Portal UI cannot resolve configuration mismatches that Azure CLI can detect and analyze
  - **Clean Resource Strategy**: Creating new resources is more reliable than repairing mixed configuration states
- **📋 SYSTEMATIC DEBUGGING APPROACH**: 
  - **Azure CLI Investigation**: Use `az staticwebapp show` to identify configuration state mismatches
  - **Token Validation**: Use REST API calls to validate deployment token authenticity and binding
  - **Filename Testing**: Temporarily rename workflow files to verify Azure's workflow file expectations
  - **Clean Slate Solution**: Create new resources when configuration repair proves unreliable
- **🛠️ TECHNICAL ARCHITECTURE**: 
  - **Deployment Process**: Azure automatically generates workflow files with embedded API tokens during resource creation
  - **CORS Integration**: Static Web Apps require explicit CORS configuration in connected Azure Functions for API access
  - **GitHub Integration**: Fresh GitHub repository connections create clean, working deployment workflows
  - **Domain Management**: New resources support custom domain configuration and SSL certificates

### Cloud Deployment
- **Frontend**: 
  - Azure Static Web Apps for hosting (✅ implemented - Pokedata-SWA with clean configuration)
  - CDN for static assets and images (planned)
  - Environment-specific configuration (planned)
  - **Custom Domain**: https://pokedata.maber.io (✅ configured and working)
  - **Deployment Script (deploy-frontend.js)**:
    - Fixed static progress display issue (2025-01-12)
    - Implemented real-time progress indicator with animated spinner
    - Shows continuously updating elapsed time during deployment
    - Parses and displays SWA CLI status messages with timestamps
    - Corrected app URL from incorrect Azure default to custom domain

- **Backend**:
  - Azure Functions for serverless API endpoints (✅ implemented)
  - Azure API Management for API gateway (✅ implemented)
  - GitHub Actions for CI/CD (✅ implemented)

- **Data Storage**:
  - Cosmos DB for card data and pricing (✅ implemented)

- **Monitoring**:
  - Azure Monitor for application insights (planned)
  - Log Analytics for log aggregation (planned)
  - Alerts for critical issues (planned)

## Pagination Pattern Implementation

### Client-Side Pagination
The cloudDataService.js implements client-side pagination to handle sets with many cards:

```javascript
async getCardsForSet(setCode, options = {}) {
  // Default options
  const fetchAllPages = options.fetchAllPages !== false; // Default to true
  const pageSize = options.pageSize || 500; // Increased page size to reduce requests
  
  // If we're not fetching all pages, just get the requested page
  if (!fetchAllPages) {
    return this.fetchCardsPage(setCode, initialPage, pageSize, options.forceRefresh);
  }
  
  // If we are fetching all pages, start with page 1
  let allCards = [];
  let currentPage = initialPage;
  let totalPages = 1; // Will be updated after first request
  
  // Fetch first page to get total pages
  const firstPageResult = await this.fetchCardsPage(setCode, currentPage, pageSize, options.forceRefresh);
  
  // Extract pagination info
  totalPages = firstPageResult.totalPages || 1;
  
  // Add cards from first page
  allCards = [...allCards, ...firstPageResult.items];
  
  // Fetch remaining pages if any
  while (currentPage < totalPages) {
    currentPage++;
    const pageResult = await this.fetchCardsPage(setCode, currentPage, pageSize, options.forceRefresh);
    allCards = [...allCards, ...pageResult.items];
  }
  
  // Return all cards with pagination metadata
  const result = {
    items: allCards,
    totalCount: allCards.length,
    pageNumber: 1,
    pageSize: allCards.length,
    totalPages: 1
  };
  
  return result;
}
```

### Server-Side Pagination
The Azure Function implements server-side pagination for delivering card lists in manageable chunks:

```typescript
// Apply pagination
const totalCount = cards.length;
const totalPages = Math.ceil(totalCount / pageSize);
const startIndex = (page - 1) * pageSize;
const endIndex = Math.min(startIndex + pageSize, totalCount);
const paginatedCards = cards.slice(startIndex, endIndex);
```

### Component-Level Display Limits
The CardSearchSelect component implements a display limit for performance when showing large card lists:

```javascript
// When empty, show all cards (up to a reasonable limit)
filteredCards = [...cards].slice(0, 500); // Increased from 100 to 500 to match backend pagination
```

### Key Pagination Lessons
Through troubleshooting pagination issues, we've learned:

1. **Always Explicitly Set Pagination Parameters**: Don't rely on server-side defaults, as they may not be applied consistently
2. **Consistent Page Sizes**: Use the same page size limit (500) on both client and server
3. **Multi-Level Implementation**: Pagination must be properly handled at all levels:
   - Server-side API responses
   - Client-side data retrieval
   - Component-level display
4. **Performance vs. Completeness**: Balance between showing all items and maintaining UI performance

## API Integration

### Current API Configuration
The client-side application uses a simplified API client with hardcoded subscription key defined in `src/data/apiConfig.js`:

```javascript
export const API_CONFIG = {
  // Base URL for the API
  baseUrl: 'https://maber-apim-test.azure-api.net/pokedata-api/v0',
  
  // Subscription key for API Management
  subscriptionKey: '1c3e73f4352b415c98eb89f91541c4e4',
  
  // Endpoints
  endpoints: {
    pricing: '/pricing', // Get Info and Pricing for Card or Product
    sets: '/sets',      // List All Sets 
    set: '/set'         // List Cards in Set
  },
  
  // Headers function to get standard headers
  getHeaders() {
    return {
      'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      'Content-Type': 'application/json'
    };
  },
  
  // URL builder functions
  buildPricingUrl(id) {
    return `${this.baseUrl}${this.endpoints.pricing}?id=${encodeURIComponent(id)}&asset_type=CARD`;
  },
  
  buildSetsUrl() {
    return `${this.baseUrl}${this.endpoints.sets}`;
  },
  
  buildCardsForSetUrl(setId) {
    return `${this.baseUrl}${this.endpoints.set}?set_id=${encodeURIComponent(setId)}`;
  }
};
```

This approach uses a hardcoded subscription key instead of environment variables, simplifying the development workflow while maintaining security through API Management restrictions (origin limitations, rate limits). Authentication is handled by the API Management service, which adds the actual API key on the server side.

### Implemented Hybrid API Approach
The Azure Function implementation uses a hybrid API approach leveraging both the Pokémon TCG API and PokeData API:

1. **Pokémon TCG API**:
   - Primary source for card metadata and set information
   - Source for high-quality card images
   - Well-documented and reliable API
   - Comprehensive coverage of all Pokémon card sets

2. **PokeData API**:
   - Enhanced pricing data from multiple sources
   - Graded card values (PSA, CGC)
   - Market trends and historical pricing
   - Additional metadata not available in the TCG API

3. **Azure API Management**:
   - Unified interface for both APIs
   - Rate limiting and throttling
   - Caching and response transformation
   - Authentication and authorization
   - Monitoring and analytics

4. **Azure Functions**:
   - Data normalization and transformation (✅ implemented)
   - Error handling and fallback mechanisms (✅ implemented)
   - Background processing (✅ implemented)
   - On-demand database population strategy (✅ implemented)
   - Cache access pattern (Cosmos DB → External API) (✅ implemented)

### Enhanced CORS Proxy
The application currently uses an enhanced CORS proxy to handle cross-origin requests and ensure proper header handling:

```javascript
// Enhanced CORS proxy with better header handling
export async function fetchWithProxy(url, options = {}) {
  try {
    console.log(`Fetching from: ${url}`);
    
    // Ensure headers object exists
    if (!options.headers) {
      options.headers = {};
    }
    
    // Log the headers we're trying to send
    console.log('Attempting to send headers:', JSON.stringify(options.headers, null, 2));
    
    // Create a new Headers object to ensure proper header formatting
    const headers = new Headers();
    
    // Add all headers from options
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    
    // Ensure content-type is set
    if (!headers.has('Content-Type')) {
      headers.append('Content-Type', 'application/json');
    }
    
    // Create a new options object with the properly formatted headers
    const enhancedOptions = {
      ...options,
      headers: headers,
      mode: 'cors', // Use CORS mode to allow cross-origin requests
      credentials: 'same-origin' // Don't send cookies for cross-origin requests
    };
    
    // Log the actual headers being sent
    console.log('Sending headers:', Array.from(headers.entries()));
    
    // Make the fetch request with enhanced options
    const response = await fetch(url, enhancedOptions);
    
    // Handle non-OK responses
    if (!response.ok) {
      let errorDetails = 'Unable to get error details';
      try {
        // Try to get error details as text
        errorDetails = await response.text();
      } catch (e) {
        console.warn('Could not read error response text:', e);
      }
      
      console.error(`HTTP Error: ${response.status} - ${response.statusText}\nURL: ${url}\nDetails: ${errorDetails}`);
      
      // Special handling for 401 errors
      if (response.status === 401) {
        console.error('Authentication error: Check if subscription key is being sent correctly');
        console.error('Response headers:', Array.from(response.headers.entries()));
      }
      
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error(`Fetch error for URL [${url}]:`, error);
    
    // Provide more helpful error messages for common issues
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      console.error('Network error: Check your internet connection or if CORS is properly configured');
    } else if (error.message.includes('401')) {
      console.error('Authentication error: Check if your API key is valid and being sent correctly');
    }
    
    throw error;
  }
}
```

In the planned architecture, CORS handling will be managed by Azure API Management, eliminating the need for a client-side CORS proxy.

### Error Handling
The application provides clear error messages when API calls fail, rather than generating misleading fallback data:

```javascript
// Example from App.svelte - Error handling when no cards are found
if (!cards || cards.length === 0) {
  console.log('No cards returned for this set');
  error = `No cards found for set "${set.name}". Please try another set or check your connection.`;
  isLoadingCards = false;
  return;
}
```

This approach ensures users only see real data from the API, with clear error messages when data is unavailable. In the planned architecture, comprehensive error handling will be implemented in Azure Functions with detailed logging and monitoring.

## Storage Implementation

### Current IndexedDB Structure
The application currently uses IndexedDB through a service wrapper in `src/services/storage/db.js`:

```javascript
// Database configuration
const DB_NAME = 'poke-data-db';
const DB_VERSION = 2; // Increment version for schema update
const STORES = {
  setList: 'setList',
  cardsBySet: 'cardsBySet',
  cardPricing: 'cardPricing',
  currentSets: 'currentSets',      // New store for current sets
  currentSetCards: 'currentSetCards', // New store for current set cards
  config: 'config'                 // New store for configuration
};

// Example methods
export const dbService = {
  async getSetList() {
    // Implementation to retrieve sets from IndexedDB
  },
  
  async saveSetList(sets) {
    // Implementation to save sets to IndexedDB
  },
  
  async getCardsForSet(setCode) {
    // Implementation to retrieve cards for a set from IndexedDB
  },
  
  async saveCardsForSet(setCode, cards) {
    // Implementation to save cards for a set to IndexedDB
  },
  
  async getCardPricing(cardId) {
    // Implementation to retrieve pricing data from IndexedDB
  },
  
  async saveCardPricing(cardId, pricingData) {
    // Implementation to save pricing data to IndexedDB
  }
};
```

### Planned Cloud Storage Structure

#### Cosmos DB Document Structure
The planned architecture will use Cosmos DB for card data and pricing information:

```json
{
  "id": "sv8pt5-161",
  "setCode": "PRE",
  "setId": 557,
  "setName": "Prismatic Evolutions",
  "cardId": "sv8pt5-161",
  "cardName": "Umbreon ex",
  "cardNumber": "161",
  "rarity": "Secret Rare",
  "imageUrl": "https://images.pokemontcg.io/sv8pt5/161.png",
  "imageUrlHiRes": "https://images.pokemontcg.io/sv8pt5/161_hires.png",
  "tcgPlayerPrice": {
    "market": 1414.77,
    "low": 1200.00,
    "mid": 1400.00,
    "high": 1800.00
  },
  "enhancedPricing": {
    "psaGrades": {
      "9": { "value": 1191.66 },
      "10": { "value": 2868.03 }
    },
    "cgcGrades": {
      "8": { "value": 1200.00 }
    },
    "ebayRaw": { "value": 752.58 }
  },
  "lastUpdated": "2025-04-29T12:00:00Z"
}
```

#### Blob Storage Structure
Card images will be stored in Azure Blob Storage with the following structure:

```
container/
├── sets/
│   ├── sv8pt5/
│   │   ├── 161.png
│   │   ├── 161_hires.png
│   │   └── ...
│   ├── sv8/
│   │   ├── 001.png
│   │   ├── 001_hires.png
│   │   └── ...
│   └── ...
└── variants/
    ├── graded/
    │   ├── psa/
    │   │   ├── sv8pt5-161-psa10.png
    │   │   └── ...
    │   └── cgc/
    │       ├── sv8pt5-161-cgc9.5.png
    │       └── ...
    └── special/
        ├── first-edition/
        │   ├── base-4-first-edition.png
        │   └── ...
        └── ...
```

#### Redis Cache Structure
Frequently accessed data will be cached in Azure Cache for Redis:

1. **Set List Cache**:
   - Key: `sets:list`
   - Value: JSON array of set objects
   - TTL: 7 days

2. **Card List Cache**:
   - Key: `cards:set:{setCode}`
   - Value: JSON array of card objects for the set
   - TTL: 24 hours

3. **Popular Card Cache**:
   - Key: `cards:popular`
   - Value: JSON array of popular card objects
   - TTL: 1 hour

4. **User Session Cache**:
   - Key: `session:{sessionId}`
   - Value: JSON object with user session data
   - TTL: 30 minutes

### Current Caching Strategy
The application currently implements a sophisticated hybrid caching strategy:

1. **Set List Caching**:
   - Long-lived cache (days to weeks)
   - Full refresh on version changes
   - Fallback to static data if unavailable
   - Current sets identified and prioritized

2. **Card List Caching - Hybrid Approach**:
   - **Current Sets (Scarlet & Violet era)**:
     - Dedicated storage in currentSetCards store
     - Proactive background loading and caching
     - Automatic refresh via scheduled background sync
     - Higher priority for cache retention
   - **Legacy Sets**:
     - Standard caching in cardsBySet store
     - Loaded on demand when a set is selected
     - Lower priority for cache retention
     - Cached by set code

3. **Pricing Data Caching - TTL-Based**:
   - Time-To-Live (TTL) of 24 hours
   - Cached by card ID with timestamp
   - Automatic expiration and cleanup
   - Metadata for cache status transparency
   - Fallback to stale data when API unavailable

4. **Background Processes**:
   - Automatic sync for current sets (every 24 hours)
   - Cleanup of expired pricing data (every 12 hours)
   - Configuration updates for current sets list (every 7 days)
   - Network status monitoring for offline handling

### Implemented Cloud Caching Strategy
The Azure Function implementation features a multi-tiered caching strategy:

1. **Redis Cache**:
   - In-memory caching for frequently accessed data (✅ implemented)
   - TTL-based cache invalidation (7 days for sets, 24 hours for cards) (✅ implemented)
   - Shared cache across all users (✅ implemented)
   - Cache-aside pattern implementation (✅ implemented)

2. **API Management Cache**:
   - Response caching for API calls (✅ implemented)
   - Cache-Control header management (✅ implemented)
   - Cache invalidation on data updates (🔄 in progress)

3. **CDN Cache**:
   - Edge caching for static assets and images (🔄 in progress)
   - Geographic distribution for reduced latency (🔄 planned)
   - Cache-Control header management (🔄 planned)

4. **Browser Cache**:
   - Local caching for static assets
   - Service worker for offline support
   - IndexedDB for user-specific data
   - Local Storage for user preferences

5. **Background Processes**:
   - Timer-triggered Azure Functions for data updates
   - Event-driven cache invalidation
   - Scheduled cache warming for popular items
   - Monitoring and analytics for cache performance

## Azure MCP Server Integration

### Overview
The Azure MCP (Model Context Protocol) Server provides direct integration with Azure services through a standardized protocol. This enables AI assistants to interact with Azure resources programmatically.

### Installation and Configuration
- **Server Name**: `github.com/Azure/azure-mcp`
- **Location**: `C:\Users\maber\OneDrive\Documents\Cline\MCP\azure-mcp`
- **Configuration File**: `C:\Users\maber\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **Version**: 0.5.4
- **Authentication**: Uses existing Azure CLI credentials

### Available Azure Services
The Azure MCP Server provides tools for interacting with the following services:

#### Data Services
- **Cosmos DB**: List accounts, databases, containers, and query data
  - Current Account: `pokemon-card-pricing-db`
  - Database: `PokemonCards`
  - Containers: `Cards`, `Sets`
- **Storage**: Manage storage accounts, blobs, tables, file shares, and Data Lake
- **SQL Database**: Manage databases, servers, elastic pools, and firewall rules
- **PostgreSQL**: List and query databases, manage servers
- **Redis Cache**: List cache resources and manage access policies

#### Compute and Container Services
- **Azure Kubernetes Service (AKS)**: List and manage AKS clusters
- **Azure Functions**: Through Azure Developer CLI integration
- **Virtual Desktop**: Manage host pools and user sessions

#### Developer and Integration Services
- **App Configuration**: Manage key-value pairs and configuration settings
- **Key Vault**: Manage certificates, keys, and secrets
- **Service Bus**: Manage queues, topics, and subscriptions
- **API Management**: Through marketplace integration

#### Monitoring and Analytics
- **Azure Monitor**: Query logs and metrics
- **Data Explorer (Kusto)**: Execute KQL queries
- **Grafana**: Manage Azure Managed Grafana workspaces
- **Workbooks**: Create and manage interactive dashboards
- **Load Testing**: Create and run load tests

#### AI and Search Services
- **Azure AI Search**: List services, indexes, and execute search queries
- **Azure Foundry**: List and deploy foundry models
- **Documentation Search**: Search Microsoft/Azure documentation

#### Management and Governance
- **Subscriptions**: List and manage Azure subscriptions
  - Active: Thunderdome, Bing Bong
  - Disabled: Subscrippy
- **Resource Groups**: List and manage resource groups
- **Role-Based Access Control (RBAC)**: Manage role assignments
- **Marketplace**: Access Azure Marketplace products

#### Infrastructure as Code
- **Bicep**: Get Bicep schemas for Azure resources
- **Terraform Best Practices**: Get Azure Terraform best practices
- **Azure Developer CLI (azd)**: Template discovery, provisioning, and deployment

### Tool Usage Pattern
Tools are accessed through a hierarchical command structure:

```javascript
// Example: List Cosmos DB containers
{
  "intent": "List containers in PokemonCards database",
  "command": "cosmos_database_container_list",
  "parameters": {
    "account": "pokemon-card-pricing-db",
    "database": "PokemonCards",
    "subscription": "Thunderdome"
  }
}
```

### Key Features
1. **Unified Interface**: Single interface for all Azure services
2. **Authentication**: Uses existing Azure CLI credentials
3. **Learning Mode**: Tools support `learn=true` parameter to discover available commands
4. **Error Handling**: Comprehensive error messages and retry logic
5. **Cross-Platform**: Works on Windows, macOS, and Linux

### Integration Benefits
- **Direct Azure Access**: Query and manage Azure resources without leaving the development environment
- **Real-Time Data**: Access live data from Cosmos DB, Storage, and other services
- **Documentation**: Built-in documentation search for Azure services
- **Best Practices**: Access to Azure best practices for SDK and Terraform
- **Monitoring**: Query logs and metrics directly from Azure Monitor

### Current Usage in Project
The Azure MCP Server is actively used for:
- Querying Cosmos DB for Pokemon card data and pricing
- Managing Azure Storage for card images
- Monitoring Azure Functions performance
- Accessing Azure documentation for development guidance
- Managing deployment configurations

## GitHub MCP Server Integration

### Overview
The GitHub MCP (Model Context Protocol) Server provides direct integration with GitHub's API through a standardized protocol. This enables AI assistants to interact with GitHub repositories, issues, pull requests, and workflows programmatically.

### Installation and Configuration
- **Server Name**: `github.com/github/github-mcp-server`
- **Location**: `C:\Users\maber\OneDrive\Documents\Cline\MCP\github-mcp-server`
- **Executable**: `github-mcp-server.exe` (built from source)
- **Configuration File**: `C:\Users\maber\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **Authentication**: GitHub Personal Access Token (PAT)
- **Installation Date**: 2025-08-12

### Build Process
The GitHub MCP server was built from source:
1. Cloned repository from https://github.com/github/github-mcp-server
2. Installed Go v1.24.6 via winget
3. Built executable using `go build -o github-mcp-server.exe ./cmd/github-mcp-server`
4. Configured in MCP settings with PAT authentication

### Available GitHub Tools
The GitHub MCP Server provides comprehensive tools for GitHub operations:

#### Repository Management
- **get_file_contents**: Read files from repositories
- **create_or_update_file**: Create or modify files
- **delete_file**: Delete files from repositories
- **create_branch**: Create new branches
- **list_branches**: List repository branches
- **list_commits**: Get commit history
- **get_commit**: Get specific commit details
- **push_files**: Push multiple files in a single commit
- **fork_repository**: Fork repositories
- **create_repository**: Create new repositories
- **list_tags**: List repository tags
- **get_tag**: Get tag details

#### Issues Management
- **create_issue**: Open new issues
- **list_issues**: List repository issues
- **get_issue**: Get issue details
- **update_issue**: Edit existing issues
- **add_issue_comment**: Add comments to issues
- **get_issue_comments**: Get issue comments
- **search_issues**: Search for issues
- **add_sub_issue**: Add sub-issues to parent issues
- **remove_sub_issue**: Remove sub-issues
- **reprioritize_sub_issue**: Change sub-issue priority
- **list_sub_issues**: List sub-issues
- **assign_copilot_to_issue**: Assign Copilot to work on issues

#### Pull Requests
- **create_pull_request**: Open new pull requests
- **list_pull_requests**: List pull requests
- **get_pull_request**: Get PR details
- **update_pull_request**: Edit pull requests
- **merge_pull_request**: Merge pull requests
- **get_pull_request_diff**: Get PR diff
- **get_pull_request_files**: Get changed files
- **get_pull_request_comments**: Get PR comments
- **get_pull_request_reviews**: Get PR reviews
- **get_pull_request_status**: Get PR status checks
- **update_pull_request_branch**: Update PR branch
- **search_pull_requests**: Search for pull requests
- **request_copilot_review**: Request Copilot code review

#### Pull Request Reviews
- **create_pending_pull_request_review**: Start a review
- **add_comment_to_pending_review**: Add review comments
- **submit_pending_pull_request_review**: Submit review
- **delete_pending_pull_request_review**: Delete pending review
- **create_and_submit_pull_request_review**: Create and submit review in one step

#### GitHub Actions
- **list_workflows**: List GitHub Actions workflows
- **run_workflow**: Trigger workflow runs
- **get_workflow_run**: Get workflow run details
- **list_workflow_runs**: List workflow runs
- **list_workflow_jobs**: List jobs in a workflow run
- **get_workflow_run_logs**: Download workflow logs
- **get_job_logs**: Get specific job logs
- **get_workflow_run_usage**: Get workflow usage metrics
- **list_workflow_run_artifacts**: List workflow artifacts
- **download_workflow_run_artifact**: Download artifacts
- **cancel_workflow_run**: Cancel running workflows
- **delete_workflow_run_logs**: Delete workflow logs
- **rerun_workflow_run**: Re-run entire workflow
- **rerun_failed_jobs**: Re-run only failed jobs

#### Search Capabilities
- **search_repositories**: Find repositories
- **search_code**: Search code across GitHub
- **search_users**: Find GitHub users
- **search_orgs**: Find organizations
- **search_issues**: Search for issues
- **search_pull_requests**: Search for pull requests

#### Notifications
- **list_notifications**: List GitHub notifications
- **get_notification_details**: Get notification details
- **dismiss_notification**: Mark notifications as read/done
- **manage_notification_subscription**: Manage notification subscriptions
- **manage_repository_notification_subscription**: Manage repo notifications
- **mark_all_notifications_read**: Mark all as read

#### Security and Scanning
- **list_code_scanning_alerts**: List code scanning alerts
- **get_code_scanning_alert**: Get alert details
- **list_dependabot_alerts**: List Dependabot alerts
- **get_dependabot_alert**: Get Dependabot alert details
- **list_secret_scanning_alerts**: List secret scanning alerts
- **get_secret_scanning_alert**: Get secret alert details

#### Gists
- **create_gist**: Create new gists
- **list_gists**: List user gists
- **update_gist**: Update existing gists

#### Discussions
- **list_discussions**: List repository discussions
- **get_discussion**: Get discussion details
- **get_discussion_comments**: Get discussion comments
- **list_discussion_categories**: List discussion categories

#### User Profile
- **get_me**: Get authenticated user's profile

#### Releases
- **list_releases**: List repository releases
- **get_latest_release**: Get latest release

### Resource Templates
The server also provides resource templates for accessing repository content:
- `repo://{owner}/{repo}/contents{/path*}`: Repository content
- `repo://{owner}/{repo}/refs/heads/{branch}/contents{/path*}`: Branch content
- `repo://{owner}/{repo}/sha/{sha}/contents{/path*}`: Commit content
- `repo://{owner}/{repo}/refs/pull/{prNumber}/head/contents{/path*}`: PR content
- `repo://{owner}/{repo}/refs/tags/{tag}/contents{/path*}`: Tag content

### Integration Benefits for PokeData Project

#### CI/CD Automation
- Trigger and monitor GitHub Actions workflows
- Automatically create issues for failed deployments
- Generate pull requests for dependency updates
- Monitor workflow performance and costs

#### Repository Management
- Automated file updates for configuration changes
- Branch management for feature development
- Tag creation for releases
- Commit history analysis

#### Issue and PR Workflow
- Create issues for bugs found during testing
- Automated PR creation for code changes
- Request Copilot reviews for code quality
- Manage sub-issues for complex features

#### Documentation
- Update README and documentation files directly
- Create gists for code snippets
- Search for similar implementations across GitHub

#### Monitoring and Notifications
- Track GitHub notifications programmatically
- Monitor security alerts (Dependabot, code scanning)
- Get notified of important repository events

### Current Usage in Project
The GitHub MCP Server enables:
- Direct repository management without manual GitHub UI interaction
- Automated issue and PR creation for development workflow
- GitHub Actions monitoring and triggering
- Security alert monitoring and management
- Code search across the entire GitHub platform
- Notification management for staying updated on project activity

### Example Use Cases
1. **Automated Deployment**: Trigger GitHub Actions deployment workflow and monitor its progress
2. **Issue Creation**: Automatically create issues when errors are detected in production
3. **PR Management**: Create PRs for dependency updates and request reviews
4. **Code Search**: Find similar implementations or usage patterns across GitHub
5. **Security Monitoring**: Check for Dependabot alerts and security vulnerabilities
6. **Documentation Updates**: Update README and docs directly from the development environment

## PCPC Enterprise Technology Stack (September 2025)

### Enterprise Architecture Technologies
The PCPC migration introduces enterprise-grade technologies and patterns:

#### Infrastructure as Code (Enhanced)
- **Terraform**: v1.9.0+ with advanced module patterns
- **State Management**: Remote backends with locking and versioning
- **Module Registry**: Reusable modules with semantic versioning
- **Multi-Environment**: Dev, staging, production with environment-specific configurations

#### API Management as Code
- **Azure API Management**: Policy management, versioning, product management
- **OpenAPI Specifications**: Contract-first API design
- **Policy Templates**: Reusable policy fragments (CORS, rate limiting, JWT validation)
- **ARM/Bicep Templates**: Infrastructure templates for APIM deployment

#### Database Management
- **Schema as Code**: JSON-defined container schemas and indexing policies
- **Migration Framework**: Version-controlled database migrations with rollback capability
- **Seed Data Management**: Environment-specific seed data with automated seeding
- **Contract Testing**: Database query and partition validation

#### Comprehensive Testing Framework
- **Terratest**: Go-based infrastructure testing
- **Playwright**: End-to-end browser testing
- **K6**: Load and performance testing
- **OWASP ZAP**: Security vulnerability scanning
- **Axe**: Accessibility compliance testing
- **Jest/Vitest**: Unit testing for frontend and backend

#### CI/CD Platform Matrix
- **Azure DevOps**: Primary enterprise CI/CD platform
  - Multi-stage pipelines with approval gates
  - Variable groups and service connections
  - Artifact management and deployment tracking
- **GitHub Actions**: Secondary CI/CD for open source workflows
  - Matrix builds for multiple environments
  - OIDC authentication to Azure
  - Dependency scanning and security alerts
- **Jenkins**: Learning platform for enterprise environments
  - Pipeline as Code (Jenkinsfile)
  - Shared libraries and agent management
  - Blue Ocean UI for visualization

#### Monitoring and Observability Stack
- **Azure Monitor**: Centralized logging and metrics
- **Application Insights**: Application performance monitoring
- **Log Analytics**: KQL queries and custom dashboards
- **Azure Workbooks**: Interactive monitoring dashboards
- **Custom Metrics**: Business and technical KPIs
- **Alert Management**: Proactive alerting with action groups

#### Security and Compliance
- **Azure Policy**: Infrastructure compliance validation
- **RBAC**: Role-based access control across all environments
- **Key Vault**: Centralized secrets management
- **Security Scanning**: SonarQube, Snyk, Checkov integration
- **Compliance Documentation**: GDPR, security controls, audit logging

#### Development Environment
- **Dev Containers**: Reproducible development environment with all tools
- **VS Code Workspace**: Optimized workspace configuration
- **Docker**: Containerized development and CI/CD environments
- **Makefile**: Unified command interface for all operations

### Enterprise Development Workflow

#### 1. Local Development
```bash
# Initialize development environment
make init

# Start local development
make dev

# Run comprehensive tests
make test

# Build for production
make build
```

#### 2. Infrastructure Management
```bash
# Format and validate Terraform
make fmt
make validate

# Plan infrastructure changes
make plan

# Apply infrastructure changes
make apply

# Run infrastructure tests
make test-infra
```

#### 3. Application Deployment
```bash
# Deploy to development
make deploy-dev

# Deploy to staging
make deploy-staging

# Deploy to production (with approval)
make deploy-prod
```

### Technology Stack Comparison

| Domain | Current PokeData | PCPC Enterprise | Enhancement |
|--------|------------------|-----------------|-------------|
| **Frontend** | Svelte + Rollup | Svelte + Vite (planned) | Modern build tools |
| **Backend** | Azure Functions | Azure Functions + Testing | Comprehensive testing |
| **Database** | Cosmos DB | Cosmos DB + Schema Mgmt | Migration framework |
| **API Management** | Basic APIM | APIM as Code | Policy management |
| **Testing** | Manual | Automated (Unit/E2E/Load) | Full test pyramid |
| **CI/CD** | GitHub Actions | Multi-platform | Enterprise patterns |
| **Monitoring** | Basic | Comprehensive | Full observability |
| **Documentation** | Good | Enterprise-grade | ADRs, runbooks |
| **Security** | Basic | Comprehensive | Compliance framework |

### Enterprise Skills Demonstrated

#### Technical Leadership
- **Architecture Decision Records**: Documented decision-making process
- **Migration Planning**: Systematic approach to complex system evolution
- **Risk Management**: Comprehensive risk assessment and mitigation strategies
- **Knowledge Transfer**: Detailed documentation for team collaboration

#### DevOps Excellence
- **Infrastructure as Code**: Advanced Terraform patterns with modules and testing
- **CI/CD Mastery**: Multi-platform pipeline implementation
- **Testing Strategy**: Comprehensive testing across all layers
- **Monitoring Implementation**: Full observability stack with custom metrics

#### Software Architecture
- **Domain-Driven Design**: Clear domain boundaries and separation of concerns
- **API-First Design**: OpenAPI specifications and contract testing
- **Database Design**: Schema management and migration frameworks
- **Security Architecture**: Defense-in-depth security implementation

#### Operational Excellence
- **Disaster Recovery**: Documented procedures and automated backups
- **Cost Optimization**: Resource sizing and cost monitoring
- **Performance Engineering**: Load testing and optimization strategies
- **Compliance Management**: Security controls and audit documentation

This enterprise technology stack transformation demonstrates advanced software engineering capabilities and positions the project as a comprehensive showcase for senior engineering and architecture roles.

## Component Implementation

### SearchableSelect Component with Grouping Support
The SearchableSelect component provides a reusable dropdown with search functionality and support for grouped items:

```html
<!-- src/components/SearchableSelect.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  // Props
  export let items = [];
  export let placeholder = 'Search...';
  export let labelField = 'name';
  export let secondaryField = null;
  export let value = null;
  
  // State
  let searchText = '';
  let showDropdown = false;
  let filteredItems = [];
  let flattenedItems = []; // Flattened list of all items for keyboard navigation
  let highlightedIndex = -1;
  let inputElement;
  let dropdownElement;
  
  const dispatch = createEventDispatcher();
  
  // Check if items are grouped (contains objects with type: 'group')
  $: isGroupedItems = items.some(item => item.type === 'group');
  
  // Flatten grouped items for easier filtering and navigation
  $: {
    if (isGroupedItems) {
      flattenedItems = [];
      items.forEach(group => {
        if (group.type === 'group' && Array.isArray(group.items)) {
          group.items.forEach(item => {
            flattenedItems.push({
