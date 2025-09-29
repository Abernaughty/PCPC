# ADR-001: Package Manager Standardization

## Status
Accepted

Date: 2025-09-22

## Context

During the PCPC project consolidation, we encountered a critical compatibility issue between Azure Functions v4 and pnpm (Performance npm). The original projects used different package managers:

- **PokeData Frontend**: npm (inherited from Azure Static Web Apps templates)
- **PokeDataFunc Backend**: Initially attempted with pnpm for performance benefits
- **Portfolio Infrastructure**: npm for consistency with Azure DevOps pipelines

**Problem Discovery**:
When attempting to deploy Azure Functions with pnpm, we encountered the error "No job functions found" despite successful builds and deployments. Investigation revealed that Azure Functions v4 runtime cannot properly discover and register functions when dependencies are installed via pnpm's symlink structure.

**Technical Root Cause**:
- pnpm uses symbolic links to share packages between projects, creating a different node_modules structure
- Azure Functions v4 runtime expects a traditional flat node_modules structure for function discovery
- The symlink-based approach prevents the runtime from locating function entry points

**Project Scale Impact**:
- Frontend: 154 npm packages across 67 migrated files
- Backend: 94 npm packages across 48 migrated files  
- Total: 248 packages requiring consistent management approach

## Decision

**Standardize on npm as the package manager for all PCPC components.**

**Scope of Standardization**:
1. **Frontend Application**: Continue using npm (already compliant)
2. **Backend Functions**: Convert from pnpm to npm (critical for compatibility)
3. **CI/CD Pipelines**: Use npm throughout all automation
4. **Developer Environment**: Configure DevContainer with npm as default
5. **Documentation**: Update all setup instructions to use npm commands

**Implementation Strategy**:
```bash
# Backend conversion process
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm install
npm run build
npm run start # Verify function registration works
```

## Consequences

### Positive

- **Azure Functions Compatibility**: Functions now register and execute properly in Azure Functions v4 runtime
- **Team Consistency**: Single package manager across all project components eliminates confusion
- **CI/CD Reliability**: Consistent build processes with proven npm caching strategies
- **Enterprise Standards**: Aligns with Microsoft Azure best practices and official documentation
- **Troubleshooting Simplified**: One package manager means fewer variables when debugging dependency issues
- **Onboarding Efficiency**: New developers learn one tool instead of multiple package managers

### Negative

- **Performance Impact**: npm is slower than pnpm for large dependency trees
  - Frontend: ~15-20 seconds longer for clean installs
  - Backend: ~8-12 seconds longer for clean installs
- **Disk Space Usage**: npm creates duplicate packages instead of pnpm's space-efficient symlinks
  - Estimated 200-400MB additional disk usage across all components
- **Lock File Size**: package-lock.json files are larger and more verbose than pnpm-lock.yaml
- **Missing Modern Features**: npm lacks some advanced features like pnpm's strict peer dependency handling

## Alternatives Considered

### Option 1: Continue with pnpm and Find Workaround
- **Pros**: 
  - Maintain performance benefits (~40-50% faster installs)
  - Keep space-efficient symlink approach
  - Preserve strict dependency resolution
- **Cons**: 
  - No reliable workaround found for Azure Functions v4 compatibility
  - Would require custom deployment scripts and complexity
  - Risk of future compatibility issues with Azure services
- **Reason for rejection**: Fundamental incompatibility with core deployment target

### Option 2: Mixed Approach (npm for backend, pnpm for frontend)
- **Pros**: 
  - Maintains pnpm performance benefits where possible
  - Ensures backend compatibility
- **Cons**: 
  - Team confusion with multiple package managers
  - CI/CD complexity with different toolchain paths
  - Increased maintenance overhead
  - Developer environment setup complexity
- **Reason for rejection**: Complexity outweighs marginal performance benefits

### Option 3: Yarn as Alternative
- **Pros**: 
  - Better performance than npm
  - Industry adoption and Azure compatibility
  - Advanced workspace features
- **Cons**: 
  - Introduction of yet another tool
  - No verified compatibility testing with Azure Functions v4
  - Additional learning curve for team
  - Less alignment with Microsoft's documented examples
- **Reason for rejection**: Unproven compatibility and increased complexity

### Option 4: Downgrade Azure Functions Runtime
- **Pros**: 
  - Might restore pnpm compatibility
  - Avoid package manager change
- **Cons**: 
  - Lose Azure Functions v4 features and improvements
  - Security and performance implications
  - Not future-proof approach
  - Contradicts Node.js 22.x modernization goals
- **Reason for rejection**: Backward-looking solution compromising modern platform benefits

## Implementation Notes

### Immediate Actions Required
1. **Backend Conversion** (Critical Path):
   ```bash
   cd app/backend
   rm pnpm-lock.yaml
   npm install
   npm run test # Verify all packages work correctly
   ```

2. **DevContainer Configuration**:
   ```json
   // Update .devcontainer/devcontainer.json
   "postCreateCommand": "npm install",
   // Remove any pnpm references
   ```

3. **CI/CD Pipeline Updates**:
   ```yaml
   # Update GitHub Actions and Azure DevOps pipelines
   - name: Install dependencies
     run: npm ci
   # Update caching strategies for npm
   ```

4. **Documentation Updates**:
   - Update all README files to use npm commands
   - Modify development setup instructions
   - Update troubleshooting guides

### Verification Checklist
- [ ] Backend functions register correctly in Azure Functions runtime
- [ ] All package scripts execute successfully with npm
- [ ] DevContainer startup completes without errors
- [ ] CI/CD pipelines build and deploy successfully
- [ ] No missing dependencies or version conflicts
- [ ] Performance impact documented and acceptable

### Performance Optimization Strategies
To mitigate npm's performance disadvantages:

1. **CI/CD Caching**:
   ```yaml
   - name: Cache node modules
     uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

2. **Development Optimization**:
   ```bash
   # Use npm ci in production/CI environments for faster, reliable installs
   npm ci --only=production
   
   # Consider npm workspaces for future multi-package scenarios
   ```

3. **Disk Space Management**:
   ```bash
   # Regular cleanup of npm cache
   npm cache clean --force
   
   # Use .npmrc for production optimizations
   package-lock=true
   shrinkwrap=false
   ```

## Related Decisions

- **ADR-002**: Node.js Runtime Modernization - Ensures npm compatibility with Node.js 22.x
- **Future ADR**: CI/CD Pipeline Optimization - Will detail npm-specific build optimizations
- **Future ADR**: DevContainer Performance - May revisit package management in development environment

## Monitoring and Review

**Success Metrics**:
- Zero "No job functions found" errors in deployments
- Consistent build times across environments
- Developer onboarding time for environment setup

**Review Schedule**:
- 3-month review: Assess performance impact and developer feedback
- 6-month review: Evaluate if npm ecosystem changes warrant reconsideration
- Annual review: Consider emerging package managers (like Bun) for future compatibility

**Decision Reversal Conditions**:
This decision should be reconsidered if:
1. Azure Functions adds official pnpm support with proven reliability
2. Performance impact becomes prohibitive for development velocity
3. Critical npm vulnerabilities or ecosystem issues emerge
4. Team consensus shifts significantly based on operational experience

## Lessons Learned

1. **Platform Compatibility First**: Always verify compatibility with deployment targets before optimizing for development convenience
2. **Early Testing Critical**: Package manager compatibility should be tested in deployment environment, not just development
3. **Documentation Importance**: Microsoft Azure documentation defaults to npm for good reason - following official guidance reduces risk
4. **Consistency Value**: Single toolchain simplification often outweighs marginal performance optimizations
