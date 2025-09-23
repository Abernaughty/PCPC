# Active Context

## Current Focus (September 22, 2025)
🚀 **NEW INITIATIVE**: PCPC Enterprise Repository Migration - Consolidating PokeData and Portfolio projects into enterprise-grade monorepo structure.

**Latest Work Completed (September 22, 2025 - 4:30-4:45 PM)**:
- **Enterprise Migration Planning**: Created comprehensive migration plan for Pokemon Card Price Checker (PCPC) repository
- **Directory Structure Design**: Designed complete enterprise-grade directory structure with 15+ top-level domains
- **Migration Strategy**: Developed 4-phase migration plan with detailed timelines and risk mitigation
- **Memory Bank Enhancement**: Created new `pcpc-migration-plan.md` with complete migration documentation
- **Portfolio Impact Analysis**: Identified significant career enhancement opportunities through enterprise architecture demonstration

**Key Migration Objectives**:
1. **Enterprise Architecture**: Transform current projects into production-ready monorepo structure
2. **DevOps Excellence**: Showcase advanced CI/CD and infrastructure patterns
3. **Portfolio Enhancement**: Demonstrate enterprise-scale software development skills
4. **Risk Mitigation**: Preserve existing working systems during transition

**Target Repository**: `C:\Users\maber\Documents\GitHub\PCPC`
**Migration Timeline**: 4 weeks (Phase 1: Foundation, Phase 2: Application, Phase 3: Advanced Features, Phase 4: Documentation)
**Risk Level**: Low-Medium (new repository preserves originals)

**Previous Resolution (September 16, 2025 - Earlier)**:
✅ **RESOLVED**: Azure Functions deployment issues after npm→pnpm migration successfully investigated and resolved.

**Problem Resolved**: After migrating PokeDataFunc from npm to pnpm, Azure Functions were no longer visible in the Azure portal and endpoints returned 404 responses, despite "successful" deployments.

**Root Cause Identified**: 
- **Azure Functions v4 Programming Model Incompatibility**: Azure Functions v4 programming model is fundamentally incompatible with pnpm's symlink-based node_modules structure
- **Function Discovery Failure**: Functions failed to register with Azure runtime due to symlink structure preventing proper module resolution
- **False Positive Deployments**: GitHub Actions reported successful deployments while Azure Functions failed to discover and register functions
- **Error Pattern**: "No job functions found. Try making your job classes and methods public"

**Resolution Implemented**: Complete reversion from pnpm back to npm across entire project

## ✅ COMPLETED: Complete npm Reversion Strategy

### Phase 1: GitHub Actions Workflow Reversion ✅ COMPLETED
**Critical Changes Made to `.github/workflows/deploy-function.yml`:**
- **Removed**: pnpm setup section entirely (`pnpm/action-setup@v2`)
- **Updated**: Node setup to use npm cache instead of pnpm cache
- **Reverted**: All pnpm commands back to npm equivalents (`npm ci`, `npm run build`, `npm test`)
- **Fixed**: Cache dependency path to reference `package-lock.json` instead of `pnpm-lock.yaml`

### Phase 2: Package Configuration Reversion ✅ COMPLETED
**PokeDataFunc/.funcignore Updates:**
- **Reverted**: Exclude `package-lock.json` instead of `pnpm-lock.yaml`
- **Removed**: pnpm-specific ignore patterns

### Phase 3: Dependency Cleanup ✅ COMPLETED
**Files Removed:**
- `pnpm-lock.yaml` (root level)
- `PokeDataFunc/pnpm-lock.yaml`

**Files Restored:**
- `PokeDataFunc/package-lock.json` (force-added to resolve GitHub Actions caching issues)

### Phase 4: Build Environment Cleanup ✅ COMPLETED
**Local Development Cleanup:**
- Deleted `node_modules` in both root and `PokeDataFunc/` directories
- Cleaned `PokeDataFunc/dist/` folder
- Regenerated dependencies with `npm install`
- Rebuilt with `npm run build` to ensure proper dependency resolution

### Phase 5: Secondary Issue Resolution ✅ COMPLETED
**GitHub Actions npm Caching Fix:**
- **Issue**: "Some specified paths were not resolved, unable to cache dependencies"
- **Root Cause**: Missing `package-lock.json` file required for npm caching
- **Solution**: Force-added `PokeDataFunc/package-lock.json` to repository
- **Result**: GitHub Actions npm caching now works correctly

## Key Technical Learnings

### Azure Functions v4 + pnpm Incompatibility
- **Symlink Structure Issue**: pnpm's symlink-based node_modules structure prevents Azure Functions runtime from properly resolving modules
- **Function Discovery Failure**: Azure Functions v4 programming model cannot discover functions when dependencies are symlinked
- **Deployment Success vs Runtime Failure**: GitHub Actions can successfully build and deploy while Azure Functions fail to register functions
- **No Workaround Available**: This is a fundamental incompatibility, not a configuration issue

### Package Manager Migration Risks
- **Staging Testing Critical**: Always test package manager migrations in staging environment first
- **Runtime Environment Sensitivity**: Some platforms (like Azure Functions) have specific requirements for dependency structure
- **False Positive Monitoring**: Deployment success doesn't guarantee runtime functionality
- **Rollback Strategy Essential**: Have a complete rollback plan before attempting package manager migrations

### GitHub Actions Caching Behavior
- **npm Cache Requirements**: npm caching requires `package-lock.json` file to be present in repository
- **Cache Path Specificity**: Cache dependency paths must match actual lockfile locations
- **Error Handling**: Missing lockfiles cause caching warnings but don't fail the build

## Current Project State

### Package Management Status
- **Frontend**: Uses npm (reverted from pnpm)
- **Backend (PokeDataFunc)**: Uses npm (reverted from pnpm)
- **CI/CD Pipeline**: Configured for npm with proper caching
- **Deployment**: Fully operational with npm-based builds

### Deployment Status
- **GitHub Actions**: Successfully building and deploying with npm
- **Azure Functions**: Functions now visible in Azure portal
- **API Endpoints**: All endpoints responding correctly
- **Production**: Service fully restored and operational

### Documentation Updates Needed
- Update technical documentation to reflect npm usage
- Document Azure Functions v4 + pnpm incompatibility for future reference
- Update deployment guides with npm-specific instructions

## Previous Completed Work (September 16, 2025)

### Latest Updates (Just Completed - September 16, 2025 - 4:30 PM)

1. **Azure Functions Deployment Issue Investigation and Resolution**:
   - **Problem**: Azure Functions no longer visible in portal after npm→pnpm migration
   - **Investigation Method**: Used GitHub MCP Server to access workflow deployment logs
   - **Root Cause Discovered**: Azure Functions v4 programming model incompatible with pnpm symlink structure
   
   - **Resolution Strategy**: Complete reversion from pnpm back to npm
     - Reverted GitHub Actions workflow configuration
     - Updated .funcignore file to exclude package-lock.json instead of pnpm-lock.yaml
     - Removed pnpm-lock.yaml files from both root and PokeDataFunc directories
     - Cleaned and rebuilt with npm to ensure proper dependency resolution
     - Fixed GitHub Actions npm caching by force-adding required package-lock.json
   
   - **Technical Findings**:
     - pnpm's symlink-based node_modules structure prevents Azure Functions runtime from discovering functions
     - GitHub Actions can report successful deployments while Azure Functions fail to register
     - Azure Functions v4 programming model requires traditional npm dependency structure
     - No configuration workaround available - this is a fundamental incompatibility
   
   - **Deployment Status**: Successfully reverted to npm, functions now visible in Azure portal
   - **Lessons Learned**: Package manager migrations require thorough staging testing, especially for serverless platforms

### Previous Updates (September 14, 2025)

### Latest Updates (Just Completed - September 14, 2025 - 3:19 PM)

1. **Dark Mode Implementation for PokeData Site**:
   - **Purpose**: Add dark/light theme toggle functionality to improve user experience
   
   - **Implementation Details**:
     - Created `src/stores/themeStore.js` - Svelte store for theme management
     - Detects system preference on first visit
     - Saves user preference to localStorage for persistence
     - Smooth 0.3s transitions between themes
   
   - **Files Created/Modified**:
     - `src/stores/themeStore.js` - New theme management store
     - `public/global.css` - Converted to CSS variable system with light/dark themes
     - `src/App.svelte` - Added theme toggle button with sun/moon icons
     - `src/components/SearchableSelect.svelte` - Updated to use CSS variables
     - `scripts/server.bat` - Fixed batch script errors for development server
     - `rollup.config.cjs` - Fixed serve() function to use correct npm script
   
   - **Key Features**:
     - Automatic system preference detection
     - Manual toggle with sun/moon icons in header
     - Persistent theme choice across sessions
     - Smooth transitions (0.3s ease)
     - Maintains Pokémon blue branding in both themes
     - Complete CSS variable coverage for all UI elements
   
   - **Color Schemes**:
     - Light Mode: White backgrounds, light gray containers, dark text
     - Dark Mode: Dark backgrounds (#1a1a1a), dark gray containers (#2d2d2d), light text
     - Both modes preserve the Pokémon blue (#3b82c4) header
   
   - **Technical Fixes**:
     - Resolved server.bat "or was unexpected" error by using temp file for netstat
     - Fixed rollup.config.cjs to call correct npm script
     - Installed missing sirv dependency

### Previous Updates (August 12, 2025 - 4:38 PM)

1. **Memory Bank Cleanup - Removed Non-Implemented Technologies**:
   - **Purpose**: Clean up documentation to accurately reflect current architecture
   - **Technologies Removed from Documentation**:
     - Azure Cache for Redis (evaluated but not implemented)
     - Azure Blob Storage (evaluated but not implemented)
     - Azure CDN (evaluated but not implemented)
     - IndexedDB (legacy, replaced by Cosmos DB)
   
   - **Files Updated**:
     - `systemPatterns.md`: Removed architecture diagrams and references to Redis, Blob Storage, CDN, IndexedDB
     - `productContext.md`: Updated to reflect actual implemented infrastructure
     - `techContext.md`: Removed non-implemented technologies from lists and dependencies
     - `progress.md`: Updated infrastructure claims to match reality
   
   - **Key Findings**:
     - These technologies were evaluated during planning but determined unsuitable
     - Current architecture is simpler: Cosmos DB for storage, direct API image URLs
     - No Redis caching - using Cosmos DB as primary storage
     - No Blob Storage/CDN - images served directly from Pokemon TCG API
   
   - **Documentation Now Reflects**:
     - Actual implemented architecture only
     - Simplified cloud stack: Azure Functions, Cosmos DB, API Management, Static Web Apps
     - Direct API integration without intermediate caching layers
     - Cleaner, more accurate technical documentation

### Previous Updates (August 12, 2025 - 4:10 PM)

1. **GitHub MCP Server Integration**:
   - **Purpose**: Enable direct programmatic access to GitHub's API through Model Context Protocol
   - **Installation**: Successfully built and installed GitHub MCP Server from source
   
   - **Build Process**:
     - Cloned repository from https://github.com/github/github-mcp-server
     - Installed Go v1.24.6 via winget
     - Built executable: `github-mcp-server.exe`
     - Configured with GitHub Personal Access Token
   
   - **Configuration Details**:
     - Server Name: `github.com/github/github-mcp-server`
     - Location: `C:\Users\maber\OneDrive\Documents\Cline\MCP\github-mcp-server`
     - Executable: `github-mcp-server.exe` (19.3 MB)
     - Config File: `cline_mcp_settings.json` in VS Code global storage
     - Authentication: GitHub PAT (Personal Access Token)
   
   - **Verified GitHub Access**:
     - Successfully retrieved GitHub profile for user Abernaughty
     - Name: Mike Abernathy
     - Email: mabernathy87@gmail.com
     - Public Repos: 5
     - Account Created: February 19, 2017
   
   - **Available Tools** (100+ GitHub operations):
     - Repository: File operations, branches, commits, tags, releases
     - Issues: Create, update, search, manage sub-issues, assign Copilot
     - Pull Requests: Create, merge, review, request Copilot review
     - GitHub Actions: Trigger workflows, monitor runs, download artifacts
     - Security: Monitor Dependabot, code scanning, secret scanning alerts
     - Search: Code, repositories, users, organizations, issues, PRs
     - Notifications: List, dismiss, manage subscriptions
     - Gists: Create, update, list
   
   - **Documentation Updates**:
     - Added comprehensive GitHub MCP Server section to `techContext.md`
     - Documented installation process, build steps, and available tools
     - Listed integration benefits and use cases for PokeData project
     - Updated development tools section with Go installation

### Previous Updates (January 12, 2025 - 3:49 PM)

1. **Azure MCP Server Integration**:
   - **Purpose**: Enable direct programmatic access to Azure services through Model Context Protocol
   - **Installation**: Successfully installed Azure MCP Server v0.5.4
   
   - **Configuration Details**:
     - Server Name: `github.com/Azure/azure-mcp`
     - Location: `C:\Users\maber\OneDrive\Documents\Cline\MCP\azure-mcp`
     - Config File: `cline_mcp_settings.json` in VS Code global storage
     - Authentication: Uses existing Azure CLI credentials (mabernathy87@gmail.com)
   
   - **Available Azure Subscriptions**:
     - Thunderdome (Active) - Primary subscription with Cosmos DB
     - Bing Bong (Active) - Secondary subscription
     - Subscrippy (Disabled) - Inactive subscription
   
   - **Verified Cosmos DB Access**:
     - Account: `pokemon-card-pricing-db`
     - Database: `PokemonCards`
     - Containers: `Cards` (card data), `Sets` (set information)
     - Successfully queried sample data showing Prismatic Evolutions cards with pricing
   
   - **Available Services** (20+ Azure services):
     - Data: Cosmos DB, Storage, SQL, PostgreSQL, Redis
     - Compute: AKS, Functions, Virtual Desktop
     - Developer: App Config, Key Vault, Service Bus
     - Monitoring: Azure Monitor, Kusto, Grafana
     - AI/Search: Azure AI Search, Foundry
     - Management: Subscriptions, RBAC, Resource Groups
     - IaC: Bicep, Terraform best practices, Azure Developer CLI
   
   - **Documentation Updates**:
     - Added comprehensive Azure MCP Server section to `techContext.md`
     - Documented installation, configuration, and usage patterns
     - Listed all available services and tools with examples

### Previous Updates (January 12, 2025 - 3:00 PM)

1. **.gitignore File Cleanup**:
   - **Problem**: .gitignore contained irrelevant Python-related entries and non-existent files
   - **Solution**: Cleaned up .gitignore to only include relevant patterns for JavaScript/TypeScript project
   
   - **Removed Entries**:
     - All Python-related patterns (20+ lines) - project is JavaScript/TypeScript only
     - Non-existent batch files (init-git.bat, stage-and-commit.bat, push-to-github.bat)
   
   - **Improvements Made**:
     - Better organization with clearer section headers
     - Added `.vscode/` to IDE section for VS Code settings
     - Added `desktop.ini` and `*.orig` files to ignored patterns
     - Added temp directories (`.temp/`, `.tmp/`)
     - Consolidated log file patterns
   
   - **Clarifications**:
     - `PokeDataFunc/dist/` correctly remains ignored (contains TypeScript compilation output)
     - Data files in `PokeDataFunc/data/` are the source files and should be tracked
     - Files in `PokeDataFunc/dist/data/` are copies/build artifacts and should remain ignored

2. **Project Structure Clarification**:
   - **Monorepo Architecture Confirmed**:
     - Frontend (Svelte app) at project root with its own package.json and rollup.config.cjs
     - Backend (Azure Functions) in PokeDataFunc/ subdirectory with separate package.json
     - This is the correct structure for separate frontend/backend with different build tools
   
   - **File Locations Verified**:
     - `deploy-frontend.js` and `server.bat` are correctly in `scripts/` folder (not root)
     - All utility scripts properly organized in `scripts/` directory

### Previous Updates (January 12, 2025 - 2:44 PM)

1. **Root Directory Reorganization**:
   - **Problem**: Build and utility scripts cluttering the root directory
   - **Solution**: Created `scripts/` directory and moved all build/utility scripts
   
   - **Files Moved to `scripts/` (5 total)**:
     - `build-app.bat` → `scripts/build-app.bat`
     - `build.js` → `scripts/build.js`
     - `deploy-frontend.js` → `scripts/deploy-frontend.js`
     - `server.bat` → `scripts/server.bat`
     - `tools.bat` → `scripts/tools.bat`
   
   - **Documentation Updates**:
     - Created `scripts/README.md` documenting each script's purpose and usage
     - Updated main `README.md` with new script paths
     - Updated `package.json` deploy:frontend script path
   
   - **Benefits**:
     - Cleaner root directory (reduced from 15 to 10 files)
     - Better organization with related scripts grouped together
     - Follows common JavaScript/Node.js project best practices

### Previous Updates (January 12, 2025 - Late Afternoon)

1. **PokeDataFunc Scripts Consolidation**:
   - **Problem**: 9 redundant scripts with overlapping functionality causing maintenance overhead
   - **Solution**: Consolidated into 3 multi-purpose scripts with command-line options
   
   - **New Consolidated Scripts**:
     - `set-mapping.js`: All set mapping operations (--analyze, --generate, --manual)
     - `manage-image-urls.js`: All image URL management (--fix, --all, --set=ID)
     - `test-image-urls.js`: All testing and verification (--simple, --with-db, --test-fix, --verify)
   
   - **Scripts Removed (9 total)**:
     - `analyze-ptcgo-mapping.js` → Now `set-mapping.js --analyze`
     - `generate-set-mapping.js` → Now `set-mapping.js --generate --manual`
     - `generate-optimized-set-mapping.js` → Now `set-mapping.js --generate`
     - `update-image-urls.js` → Now `manage-image-urls.js`
     - `fix-image-urls.js` → Now `manage-image-urls.js --fix`
     - `test-image-url-update.js` → Now `test-image-urls.js --with-db`
     - `test-image-url-simple.js` → Now `test-image-urls.js --simple`
     - `test-url-fix.js` → Now `test-image-urls.js --test-fix`
     - `verify-optimization.js` → Now `test-image-urls.js --verify`
   
   - **Documentation Created**:
     - `PokeDataFunc/scripts/README.md`: Comprehensive usage guide for consolidated scripts
     - Includes prerequisites, typical workflows, troubleshooting, and migration notes

2. **Comprehensive Deployment Guide Created**:
   - **New File**: `DEPLOYMENT_GUIDE.md` at project root
   - **Clear Distinction Between Environments**:
     - Local Development: Scripts that run locally only
     - Production Deployment: CI/CD via GitHub Actions (primary) with manual backup options
     - Data Management: Scripts that run locally but connect to production DB
   
   - **Key Deployment Methods Documented**:
     - Frontend: GitHub Actions → Azure Static Web Apps (automatic on push to main)
     - Backend: GitHub Actions → Azure Functions (automatic on push to main)
     - Database/Cache: Managed Azure services (no deployment needed)
   
   - **Important Clarifications**:
     - Data management scripts run locally but modify production database
     - Manual deployment scripts are backup methods only
     - CI/CD is the preferred deployment method for both frontend and backend

### Previous Updates (January 12, 2025 - Afternoon)

1. **Build/Deployment Script Consolidation**:
   - **Files Removed (7 total)**:
     - `package-lock.json` - Redundant npm file (project uses pnpm)
     - `deploy-to-production.bat` - Obsolete deployment script
     - `run-app.bat` - Redundant launcher script
     - `dev-server.bat` - Replaced by unified script
     - `prod-server.bat` - Replaced by unified script
   
   - **Unified Server Script Created**:
     - Created `server.bat` with parameter support
     - Usage: `server.bat` (defaults to dev mode)
     - Usage: `server.bat dev` (development with hot reloading)
     - Usage: `server.bat prod` (production with optimized build)
   
   - **Package.json Cleanup**:
     - Removed redundant scripts: `sirv`, `prod-install`, `prune`
     - Removed duplicate deploy scripts

2. **Frontend Deployment Script Fixes**:
   - Fixed static progress display with animated spinner
   - Corrected app URL to https://pokedata.maber.io
   - Enhanced deployment feedback with timestamps

### Previous Updates (January 12, 2025 - Morning)

1. **Frontend UI Improvements**:
   - Fixed PSA graded pricing indentation
   - Added comma separators to prices ($1,234.56 format)
   - Switched to large image URLs for better quality

### Previous Updates (January 10, 2025)

1. **GitHub Actions Federated Credential Authentication Fixed**
2. **Pre-Deployment Testing Implementation**
3. **Deploy.bat Improvements**

## Current Project State

### Scripts Organization
- **Frontend Scripts** (in `scripts/`): 
  - `server.bat` - Unified development/production server
  - `deploy-frontend.js` - Azure Static Web Apps deployment
  - `build-app.bat` - Production build script
  - `build.js` - Build configuration
  - `tools.bat` - Utility tools for setup and diagnostics
- **Backend Scripts**: 
  - `PokeDataFunc/deploy.bat` - Azure Functions deployment
  - `PokeDataFunc/test-api.js` - API testing
- **Data Management**: 3 consolidated scripts in `PokeDataFunc/scripts/`
- **Documentation**: Comprehensive guides for deployment and script usage

### Deployment Architecture
- **Primary Method**: GitHub Actions CI/CD (push to main triggers deployment)
- **Backup Method**: Manual scripts for emergency deployments
- **Data Updates**: Local scripts with production credentials

### Key URLs
- Production Frontend: https://pokedata.maber.io
- Production API: https://pokedata-func.azurewebsites.net
- Staging API: https://pokedata-func-staging.azurewebsites.net
- GitHub Actions: https://github.com/Abernaughty/PokeData/actions

## Next Steps
1. Monitor deployments after pushing consolidated scripts
2. Consider creating automated tests for the consolidated scripts
3. Review and potentially consolidate documentation files in /docs
4. Set up monitoring for script execution in production

## Important Patterns
- **Script Consolidation**: Reduce redundancy by combining similar scripts with options
- **Clear Documentation**: Separate guides for different audiences (developers vs. operators)
- **Environment Clarity**: Always distinguish between local, staging, and production
- **CI/CD First**: Manual deployment scripts are backup options only

## Configuration Requirements
- **Frontend**: No .env needed in production (configured in Azure Portal)
- **Backend**: Environment variables set in Azure Function App Configuration
- **Local Scripts**: Require .env with production credentials (use cautiously)

## Testing Checklist
After any deployment:
1. Frontend: Check https://pokedata.maber.io loads correctly
2. Backend: Test API endpoints return 200 status
3. Data Scripts: Run `test-image-urls.js --verify` to check optimizations
4. Monitor Application Insights for errors

## Development Workflow
1. Make changes locally
2. Test with local servers (`server.bat` for frontend, `func start` for backend)
3. Push to feature branch
4. Create PR to main (triggers validation)
5. Merge to main (auto-deploys via GitHub Actions)
6. Verify deployment in production
7. Run data scripts if needed (with caution)

The project now has a much cleaner structure with consolidated scripts, clear deployment paths, and comprehensive documentation for all use cases.
