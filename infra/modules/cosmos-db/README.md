# Azure Cosmos DB Terraform Module

## Overview

This Terraform module creates and configures an Azure Cosmos DB account with support for multiple environments, capacity modes, and security configurations. It follows Azure best practices and provides a flexible, reusable solution for deploying Cosmos DB.

## Features

- ✅ **Multi-environment support** (dev, staging, prod)
- ✅ **Serverless and provisioned capacity modes**
- ✅ **Automatic failover and geo-replication**
- ✅ **Continuous backup with point-in-time restore**
- ✅ **Network security with IP filtering and VNet integration**
- ✅ **CORS configuration support**
- ✅ **Comprehensive tagging strategy**
- ✅ **Sensitive output protection**

## Usage

### Basic Example (Development Environment)

```hcl
module "cosmos_db" {
  source = "../../modules/cosmos-db"
  
  name                = "pokedata-cosmos-dev"
  resource_group_name = "pokedata-rg-dev"
  location            = "centralus"
  environment         = "dev"
  
  # Use serverless for cost optimization in dev
  capacity_mode = "serverless"
  
  tags = {
    Project = "PokeData"
    Owner   = "DevOps Team"
  }
}
```

### Production Example with Enhanced Security

```hcl
module "cosmos_db" {
  source = "../../modules/cosmos-db"
  
  name                = "pokedata-cosmos-prod"
  resource_group_name = "pokedata-rg-prod"
  location            = "centralus"
  environment         = "prod"
  
  # Production configuration
  capacity_mode                   = "provisioned"
  enable_automatic_failover        = true
  enable_multiple_write_locations  = true
  backup_tier                      = "Continuous30Days"
  
  # Network security
  public_network_access_enabled = false
  ip_range_filter = [
    "20.0.0.0/16",  # Corporate network
    "10.0.0.0/8"    # Private network
  ]
  
  # VNet integration
  virtual_network_rules = [
    azurerm_subnet.app_subnet.id
  ]
  
  tags = {
    Project     = "PokeData"
    Environment = "Production"
    CostCenter  = "Engineering"
    Compliance  = "GDPR"
  }
}
```

### Using Module Outputs

```hcl
# Reference the Cosmos DB endpoint in another module
module "function_app" {
  source = "../../modules/function-app"
  
  # ... other configuration ...
  
  app_settings = {
    "CosmosDb__Endpoint"        = module.cosmos_db.endpoint
    "CosmosDb__Key"             = module.cosmos_db.primary_key
    "CosmosDb__DatabaseName"    = module.cosmos_db.database_name
  }
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.9.0 |
| azurerm | ~> 4.40.0 |
| random | ~> 3.6.0 |

## Providers

| Name | Version |
|------|---------|
| azurerm | ~> 4.40.0 |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name | The name of the Cosmos DB account | `string` | n/a | yes |
| resource_group_name | The name of the resource group | `string` | n/a | yes |
| location | The Azure region | `string` | n/a | yes |
| environment | Environment name (dev, staging, prod) | `string` | `"dev"` | no |
| capacity_mode | Capacity mode: 'serverless' or 'provisioned' | `string` | `"serverless"` | no |
| consistency_level | Consistency level for Cosmos DB | `string` | `"Session"` | no |
| backup_type | Backup type: 'Continuous' or 'Periodic' | `string` | `"Continuous"` | no |
| backup_tier | Backup tier for continuous backup | `string` | `"Continuous7Days"` | no |
| enable_automatic_failover | Enable automatic failover | `bool` | `true` | no |
| enable_multiple_write_locations | Enable multi-master | `bool` | `false` | no |
| enable_free_tier | Enable free tier | `bool` | `false` | no |
| public_network_access_enabled | Allow public network access | `bool` | `true` | no |
| ip_range_filter | List of allowed IP addresses/CIDR blocks | `list(string)` | `[]` | no |
| throughput_limit | Throughput limit for serverless (RU/s) | `number` | `4000` | no |
| tags | Additional tags | `map(string)` | `{}` | no |

## Outputs

| Name | Description | Sensitive |
|------|-------------|-----------|
| id | The ID of the Cosmos DB account | no |
| name | The name of the Cosmos DB account | no |
| endpoint | The endpoint URI | no |
| primary_key | Primary access key | yes |
| secondary_key | Secondary access key | yes |
| connection_strings | Connection strings | yes |
| read_endpoints | List of read endpoints | no |
| write_endpoints | List of write endpoints | no |

## Environment-Specific Behaviors

### Development
- Zone redundancy: **Disabled** (cost optimization)
- Example database and container created automatically
- Public network access typically enabled

### Staging
- Zone redundancy: **Disabled**
- Similar to production but with cost optimizations
- Network restrictions recommended

### Production
- Zone redundancy: **Enabled** (high availability)
- Strict network security recommended
- 30-day backup retention recommended
- Multi-region replication recommended

## Security Considerations

1. **Secrets Management**: All sensitive outputs (keys, connection strings) are marked as sensitive
2. **Network Security**: Use IP filtering and VNet integration in production
3. **TLS**: Minimum TLS 1.2 enforced
4. **Authentication**: Consider using Managed Identities instead of keys where possible
5. **Backup**: Continuous backup enabled by default for point-in-time restore

## Cost Optimization Tips

1. **Use Serverless** for development and variable workloads
2. **Enable Free Tier** if eligible (one per subscription)
3. **Set Throughput Limits** to prevent unexpected costs
4. **Use Reserved Capacity** for production provisioned accounts
5. **Monitor Metrics** to right-size provisioned throughput

## Testing

This module includes Terratest integration tests. To run:

```bash
cd tests
go test -v -timeout 30m
```

## Contributing

Please ensure all changes:
1. Pass `terraform fmt` and `terraform validate`
2. Include updated documentation
3. Have corresponding tests
4. Follow the existing naming conventions

## License

MIT

## Author

Created by [Your Name] as part of the PokeData Infrastructure Portfolio Project
