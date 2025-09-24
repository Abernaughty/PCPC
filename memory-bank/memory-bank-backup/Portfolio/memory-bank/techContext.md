# PokeData Technical Context

## Technology Stack

### Infrastructure as Code
- **Terraform**: v1.9.0+ (currently using azurerm provider 4.40.0)
- **State Management**: Azure Storage Account backends
- **Module Registry**: Local modules initially, potential for private registry

### Azure Services
1. **Azure Static Web Apps**
   - Free tier for development
   - Standard tier for production
   - GitHub Actions integration built-in

2. **Azure Functions**
   - Runtime: .NET 8.0
   - OS: Windows
   - Plan: Consumption (dev/staging), Premium (production)
   - Application Insights integration

3. **Azure API Management**
   - Consumption tier (dev)
   - Developer/Standard tier (staging/prod)
   - Policy management for rate limiting and caching

4. **Azure Cosmos DB**
   - API: SQL (Core)
   - Capacity: Serverless
   - Backup: Continuous (7-day retention)
   - Consistency: Session

### CI/CD Platforms

#### Primary: Azure DevOps
- **Why chosen**: Native Azure integration, enterprise standard
- **Features to use**:
  - Azure Pipelines for CI/CD
  - Azure Artifacts for module storage
  - Azure Boards for work tracking
  - Service connections for authentication

#### Secondary: GitHub Actions
- **Why included**: User familiarity, good for open source
- **Features to use**:
  - Matrix builds for multiple environments
  - Environments with protection rules
  - Secrets management
  - OIDC authentication to Azure

#### Learning: Jenkins
- **Why included**: Industry standard, valuable for career
- **Features to explore**:
  - Pipeline as Code (Jenkinsfile)
  - Blue Ocean UI
  - Shared libraries
  - Agent management

### Testing Framework
- **Terratest**: Go-based testing for Terraform
- **tfsec**: Static analysis security scanning
- **terraform validate**: Built-in validation
- **terraform fmt**: Code formatting
- **checkov**: Policy as code scanning

### Development Tools
- **VS Code**: Primary IDE
- **Azure CLI**: Command-line management
- **Git**: Version control
- **Docker**: Container support for CI/CD agents

## Authentication & Security

### Service Principal Strategy
```
Development: Contributor role on resource group
Staging: Contributor role on resource group + Reader on subscription
Production: Custom role with least privilege
```

### Secret Management
- **Azure Key Vault**: Production secrets
- **GitHub Secrets**: CI/CD credentials
- **Azure DevOps Variable Groups**: Pipeline secrets
- **Managed Identities**: Where possible for Azure-to-Azure auth

## Networking Architecture

### Development Environment
- Public endpoints for all services
- No VNet integration
- Basic firewall rules

### Staging Environment
- Optional VNet integration
- Private endpoints for Cosmos DB
- Application Gateway consideration

### Production Environment
- Full VNet integration
- Private endpoints for all data services
- Azure Firewall or NSG rules
- DDoS protection

## Monitoring & Observability

### Application Insights
- Separate instances per environment
- Custom metrics for business KPIs
- Distributed tracing enabled
- Log Analytics workspace integration

### Azure Monitor
- Resource metrics collection
- Alert rules for critical issues
- Action groups for notifications
- Workbooks for dashboards

## Backup & Disaster Recovery

### Cosmos DB
- Continuous backup enabled
- Point-in-time restore capability
- Geo-replication for production

### Infrastructure State
- State file versioning
- State file locking
- Regular state backups

### Application Code
- GitHub repository as source of truth
- Branch protection rules
- Required reviews for main branch

## Cost Management

### Tagging Strategy
```hcl
tags = {
  Environment = var.environment
  Project     = "PokeData"
  Owner       = var.owner
  CostCenter  = var.cost_center
  ManagedBy   = "Terraform"
  CreatedDate = var.created_date  # Fixed: Use variable instead of timestamp()
}
```

### Resource Sizing
- **Dev**: Minimal SKUs, serverless where possible
- **Staging**: Production-like but smaller scale
- **Production**: Right-sized based on load testing

## Dependency Management

### Terraform Providers
```hcl
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
}
```

### Module Versioning
- Semantic versioning for modules
- Git tags for releases
- Changelog maintenance

## Local Development Setup

### Prerequisites
1. Azure CLI installed and configured
2. Terraform installed (tfenv recommended)
3. VS Code with Terraform extension
4. Git configured with SSH keys
5. Go installed (for Terratest)

### Environment Variables
```bash
# Azure Authentication
export ARM_CLIENT_ID="xxx"
export ARM_CLIENT_SECRET="xxx"
export ARM_SUBSCRIPTION_ID="xxx"
export ARM_TENANT_ID="xxx"

# Terraform
export TF_VAR_environment="dev"
export TF_VAR_location="centralus"
```

## Known Technical Constraints
- Windows Function App requirement for .NET 8
- CORS configuration must support multiple origins
- Static Web App requires GitHub repository
- Cosmos DB serverless has throughput limits
