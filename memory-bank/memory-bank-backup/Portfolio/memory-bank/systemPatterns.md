# PokeData System Patterns

## Architecture Patterns

### Module Structure Pattern
```
modules/
├── <resource-name>/
│   ├── main.tf           # Resource definitions
│   ├── variables.tf      # Input variables
│   ├── outputs.tf        # Output values
│   ├── versions.tf       # Provider requirements
│   └── README.md         # Module documentation
```

### Naming Conventions
```hcl
# Resource naming pattern
"${var.project}-${var.resource_type}-${var.environment}-${var.location_short}"

# Examples:
# pokedata-rg-dev-cus        (resource group)
# pokedata-func-prod-cus     (function app)
# pokedata-cosmos-staging-cus (cosmos db)
```

### Module Design Principles

#### 1. Single Responsibility
Each module manages one logical Azure resource or tightly coupled resource group:
- `api-management/` - APIM instance and policies
- `function-app/` - Function app and app service plan
- `static-web-app/` - SWA and custom domains
- `cosmos-db/` - Cosmos account, databases, and containers

#### 2. Composability
Modules can be combined to create complete environments:
```hcl
module "cosmos" {
  source = "../../modules/cosmos-db"
  # ...
}

module "function" {
  source = "../../modules/function-app"
  cosmos_connection_string = module.cosmos.connection_string
  # ...
}
```

#### 3. Environment Abstraction
```hcl
# environments/dev/main.tf
module "infrastructure" {
  source = "../../modules/complete-stack"
  
  environment = "dev"
  sku_tier    = "free"
  replicas    = 1
}

# environments/prod/main.tf
module "infrastructure" {
  source = "../../modules/complete-stack"
  
  environment = "prod"
  sku_tier    = "standard"
  replicas    = 3
}
```

## State Management Pattern

### Backend Configuration
```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "pokedata-terraform-state-rg"
    storage_account_name = "tfstateyul4ts"
    container_name       = "tfstate${environment}"
    key                  = "${tenant}/${subscription}/${environment}.tfstate"
  }
}
```

### State Isolation
- One state file per environment
- Separate storage accounts for production
- State file locking enabled
- Versioning and soft delete enabled

## Variable Management Pattern

### Variable Hierarchy
1. **Module defaults** - Sensible defaults in module
2. **Environment variables** - Environment-specific values
3. **Runtime overrides** - CI/CD pipeline injections

```hcl
# Module variable with default
variable "sku_name" {
  description = "SKU for the resource"
  type        = string
  default     = "Free"  # Module default
}

# Environment override
# terraform.tfvars
sku_name = "Standard"  # Environment specific

# Runtime override
# terraform apply -var="sku_name=Premium"
```

### Secret Handling
```hcl
# Never hardcode secrets
variable "cosmos_key" {
  description = "Cosmos DB access key"
  type        = string
  sensitive   = true
}

# Reference from Key Vault
data "azurerm_key_vault_secret" "cosmos_key" {
  name         = "cosmos-key"
  key_vault_id = var.key_vault_id
}
```

## CI/CD Pipeline Patterns

### Pipeline Stages Pattern
```yaml
stages:
  - validate    # Syntax and security checks
  - test        # Infrastructure tests
  - plan        # Terraform plan
  - approve     # Manual gate
  - apply       # Terraform apply
  - verify      # Post-deployment tests
```

### Environment Promotion Pattern
```
feature/* → dev (auto)
    ↓
develop → staging (auto with tests)
    ↓
main → production (manual approval)
```

### Rollback Pattern
1. **Terraform State Rollback**: Revert to previous state version
2. **Git Revert**: Revert infrastructure code changes
3. **Blue-Green**: Switch traffic back to previous version
4. **Backup Restore**: Restore data from backups

## Testing Patterns

### Test Pyramid
```
         /\
        /  \  E2E Tests (5%)
       /    \
      /------\ Integration Tests (25%)
     /        \
    /----------\ Unit Tests (70%)
```

### Terratest Pattern
```go
func TestModule(t *testing.T) {
    // Arrange
    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../modules/function-app",
        Vars: map[string]interface{}{
            "environment": "test",
        },
    })
    
    // Act
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)
    
    // Assert
    output := terraform.Output(t, terraformOptions, "function_url")
    assert.NotEmpty(t, output)
}
```

## Security Patterns

### Least Privilege Access
```hcl
# Service Principal per environment
resource "azuread_application" "sp" {
  display_name = "sp-terraform-${var.environment}"
}

# Role assignment scoped to resource group
resource "azurerm_role_assignment" "sp" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = var.environment == "prod" ? "Reader" : "Contributor"
  principal_id         = azuread_service_principal.sp.object_id
}
```

### Network Security Pattern
```hcl
# Progressive network isolation
locals {
  network_rules = {
    dev     = { public = true,  vnet = false }
    staging = { public = false, vnet = true  }
    prod    = { public = false, vnet = true  }
  }
}
```

## Monitoring Patterns

### Observability Stack
```hcl
# Centralized logging
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project}-law-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "${var.project}-ai-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}
```

### Alert Pattern
```hcl
# Standardized alerts across environments
locals {
  alerts = {
    high_error_rate = {
      threshold = var.environment == "prod" ? 1 : 5
      severity  = var.environment == "prod" ? 1 : 3
    }
    high_latency = {
      threshold = var.environment == "prod" ? 1000 : 3000
      severity  = var.environment == "prod" ? 2 : 4
    }
  }
}
```

## Cost Optimization Patterns

### Resource Sizing
```hcl
locals {
  sku_mapping = {
    dev = {
      apim_sku     = "Consumption_0"
      func_sku     = "Y1"
      cosmos_mode  = "Serverless"
      swa_sku      = "Free"
    }
    prod = {
      apim_sku     = "Standard_1"
      func_sku     = "P1v2"
      cosmos_mode  = "Provisioned"
      swa_sku      = "Standard"
    }
  }
}
```

### Auto-Shutdown Pattern
```hcl
# Dev/Test environments auto-shutdown
resource "azurerm_dev_test_global_vm_shutdown_schedule" "main" {
  count = var.environment != "prod" ? 1 : 0
  
  virtual_machine_id = azurerm_virtual_machine.main.id
  location          = azurerm_resource_group.main.location
  enabled           = true
  daily_recurrence_time = "1900"
  timezone          = "Central Standard Time"
}
```

## Multi-Tenant Patterns

### Tenant Isolation
```hcl
# Separate provider per tenant
provider "azurerm" {
  alias           = "tenant_a"
  subscription_id = var.tenant_a_subscription
  tenant_id       = var.tenant_a_id
}

provider "azurerm" {
  alias           = "tenant_b"
  subscription_id = var.tenant_b_subscription
  tenant_id       = var.tenant_b_id
}
```

### Cross-Tenant Resource Sharing
```hcl
# Shared services in management subscription
module "shared_services" {
  source = "./modules/shared"
  providers = {
    azurerm = azurerm.management
  }
}

# Tenant-specific resources
module "tenant_resources" {
  source = "./modules/tenant"
  providers = {
    azurerm = azurerm.tenant_a
  }
  shared_keyvault_id = module.shared_services.keyvault_id
}
```

## CI/CD Troubleshooting Patterns

### Multi-Repository Checkout Pattern (Azure DevOps)
```yaml
# Clean implementation without fallbacks
stages:
- stage: Checkout
  jobs:
  - job: MultiRepoCheckout
    steps:
    # Primary repository (infrastructure)
    - checkout: self
      displayName: 'Checkout Portfolio Infrastructure'
      clean: true
      
    # Secondary repository (application code)
    - checkout: git://PokeData/PokeData@main
      displayName: 'Checkout PokeData Application'
      clean: true
      
    # Immediate verification with fail-fast
    - powershell: |
        Write-Host "Verifying repository structure..."
        
        # Check primary repo structure
        if (-not (Test-Path "$(Agent.BuildDirectory)/s/IaC_Projects")) {
          Write-Error "Portfolio repository structure not found at expected path"
          Write-Host "Expected: $(Agent.BuildDirectory)/s/IaC_Projects"
          Write-Host "Available paths:"
          Get-ChildItem "$(Agent.BuildDirectory)/s" -Directory | ForEach-Object { Write-Host "  - $($_.Name)" }
          exit 1
        }
        
        # Check secondary repo structure
        if (-not (Test-Path "$(Agent.BuildDirectory)/s/PokeData")) {
          Write-Error "PokeData repository not found at expected path"
          Write-Host "Expected: $(Agent.BuildDirectory)/s/PokeData"
          Write-Host "Available paths:"
          Get-ChildItem "$(Agent.BuildDirectory)/s" -Directory | ForEach-Object { Write-Host "  - $($_.Name)" }
          exit 1
        }
        
        Write-Host "✅ Repository structure verified successfully"
      displayName: 'Verify Repository Structure'
      failOnStderr: true
```

### Service Connection Troubleshooting Pattern
```yaml
# Service connection validation and debugging
- powershell: |
    Write-Host "=== Service Connection Diagnostics ==="
    
    # Test GitHub API access
    try {
      $headers = @{
        'Authorization' = "token $(GITHUB_TOKEN)"
        'User-Agent' = 'Azure-DevOps-Pipeline'
      }
      
      # Test basic API access
      $response = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
      Write-Host "✅ GitHub API access successful for user: $($response.login)"
      
      # Test repository access
      $repoResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$(GITHUB_OWNER)/$(REPO_NAME)" -Headers $headers
      Write-Host "✅ Repository access confirmed: $($repoResponse.full_name)"
      
      # Verify token scopes
      $scopeHeader = $response.PSObject.Properties | Where-Object { $_.Name -eq 'X-OAuth-Scopes' }
      if ($scopeHeader) {
        Write-Host "Token scopes: $($scopeHeader.Value)"
      }
      
    } catch {
      Write-Error "❌ GitHub API access failed: $($_.Exception.Message)"
      Write-Host "Troubleshooting steps:"
      Write-Host "1. Verify service connection configuration in Azure DevOps"
      Write-Host "2. Check GitHub token has required scopes: repo, workflow, admin:repo_hook"
      Write-Host "3. Ensure token is not expired"
      Write-Host "4. Validate variable group contains correct token"
      exit 1
    }
  displayName: 'Validate Service Connection'
  env:
    GITHUB_TOKEN: $(GITHUB_PAT)
```

### Pipeline Debugging Methodology Pattern
```yaml
# Systematic debugging approach
- powershell: |
    Write-Host "=== Environment Diagnostics ==="
    
    # Agent information
    Write-Host "Agent Information:"
    Write-Host "  Build Directory: $(Agent.BuildDirectory)"
    Write-Host "  Source Directory: $(Build.SourcesDirectory)"
    Write-Host "  Agent Name: $(Agent.Name)"
    Write-Host "  Agent OS: $(Agent.OS)"
    
    # Available environment variables
    Write-Host "`nRelevant Environment Variables:"
    Get-ChildItem Env: | Where-Object { 
      $_.Name -like "*BUILD*" -or 
      $_.Name -like "*AGENT*" -or 
      $_.Name -like "*GITHUB*" 
    } | Sort-Object Name | ForEach-Object {
      if ($_.Name -like "*TOKEN*" -or $_.Name -like "*PAT*") {
        Write-Host "  $($_.Name): [REDACTED]"
      } else {
        Write-Host "  $($_.Name): $($_.Value)"
      }
    }
    
    # Directory structure
    Write-Host "`nDirectory Structure:"
    if (Test-Path "$(Agent.BuildDirectory)") {
      Get-ChildItem "$(Agent.BuildDirectory)" -Recurse -Directory | 
        Select-Object -First 20 | 
        ForEach-Object { Write-Host "  $($_.FullName)" }
    }
    
  displayName: 'Environment Diagnostics'
  condition: failed() # Only run on failure
```

### Clean Architecture Pattern (No Mock Fallbacks)
```yaml
# Production-ready approach without workarounds
parameters:
- name: enableFallbacks
  type: boolean
  default: false # Never enable fallbacks in production

stages:
- stage: Build
  condition: succeeded()
  jobs:
  - job: Infrastructure
    steps:
    # Real implementation only
    - checkout: self
    - checkout: git://PokeData/PokeData@main
    
    # No conditional fallbacks - fail fast if prerequisites not met
    - powershell: |
        # Verify all prerequisites
        $prerequisites = @(
          @{ Path = "$(Agent.BuildDirectory)/s/IaC_Projects"; Name = "Infrastructure Code" },
          @{ Path = "$(Agent.BuildDirectory)/s/PokeData"; Name = "Application Code" }
        )
        
        foreach ($prereq in $prerequisites) {
          if (-not (Test-Path $prereq.Path)) {
            Write-Error "❌ Missing prerequisite: $($prereq.Name) at $($prereq.Path)"
            Write-Host "This indicates a configuration issue that must be resolved."
            Write-Host "Do not add fallback logic - fix the root cause."
            exit 1
          }
          Write-Host "✅ $($prereq.Name) found at $($prereq.Path)"
        }
      displayName: 'Verify Prerequisites (No Fallbacks)'
```

### Azure DevOps Variable Group Management Pattern
```yaml
# Secure variable management
variables:
- group: terraform-dev # Contains sensitive values
- name: environment
  value: dev
- name: location
  value: centralus

# Variable validation
- powershell: |
    Write-Host "=== Variable Validation ==="
    
    # Check required variables are present
    $requiredVars = @('GITHUB_PAT', 'ARM_CLIENT_ID', 'ARM_CLIENT_SECRET', 'ARM_SUBSCRIPTION_ID', 'ARM_TENANT_ID')
    
    foreach ($var in $requiredVars) {
      $value = [Environment]::GetEnvironmentVariable($var)
      if ([string]::IsNullOrEmpty($value)) {
        Write-Error "❌ Required variable '$var' is not set or empty"
        Write-Host "Check variable group 'terraform-dev' configuration"
        exit 1
      } else {
        Write-Host "✅ Variable '$var' is configured"
      }
    }
    
    # Validate token format (basic check)
    $githubPat = [Environment]::GetEnvironmentVariable('GITHUB_PAT')
    if ($githubPat -and -not $githubPat.StartsWith('ghp_')) {
      Write-Warning "⚠️ GitHub PAT format may be incorrect (should start with 'ghp_')"
    }
    
  displayName: 'Validate Variables'
  env:
    GITHUB_PAT: $(GITHUB_PAT)
    ARM_CLIENT_ID: $(ARM_CLIENT_ID)
    ARM_CLIENT_SECRET: $(ARM_CLIENT_SECRET)
    ARM_SUBSCRIPTION_ID: $(ARM_SUBSCRIPTION_ID)
    ARM_TENANT_ID: $(ARM_TENANT_ID)
```

### Error Handling and Recovery Pattern
```yaml
# Comprehensive error handling
- powershell: |
    try {
      Write-Host "Executing main operation..."
      
      # Main operation here
      terraform plan -var-file="environments/dev/terraform.tfvars"
      
      if ($LASTEXITCODE -ne 0) {
        throw "Terraform plan failed with exit code $LASTEXITCODE"
      }
      
      Write-Host "✅ Operation completed successfully"
      
    } catch {
      Write-Error "❌ Operation failed: $($_.Exception.Message)"
      
      # Diagnostic information
      Write-Host "`n=== Diagnostic Information ==="
      Write-Host "Working Directory: $(Get-Location)"
      Write-Host "Terraform Version: $(terraform version)"
      Write-Host "Available Files:"
      Get-ChildItem -Name | ForEach-Object { Write-Host "  - $_" }
      
      # Specific troubleshooting based on error type
      if ($_.Exception.Message -like "*authentication*") {
        Write-Host "`n=== Authentication Troubleshooting ==="
        Write-Host "1. Verify service principal credentials"
        Write-Host "2. Check Azure subscription access"
        Write-Host "3. Validate service connection configuration"
      } elseif ($_.Exception.Message -like "*not found*") {
        Write-Host "`n=== File/Resource Troubleshooting ==="
        Write-Host "1. Verify file paths and repository structure"
        Write-Host "2. Check checkout configuration"
        Write-Host "3. Ensure all required files are present"
      }
      
      # Always exit with error to fail the pipeline
      exit 1
    }
  displayName: 'Execute with Error Handling'
  failOnStderr: true
```
