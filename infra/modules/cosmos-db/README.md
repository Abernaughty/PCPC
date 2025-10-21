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
- ✅ **Automatic SQL database and container provisioning (Cards/Sets)**

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
| capacity_mode | Capacity mode: `serverless` or `provisioned` | `string` | `"serverless"` | no |
| database_name | SQL database name created within the account | `string` | `"PokemonCards"` | no |
| database_throughput | RU/s to assign to the SQL database (provisioned only) | `number` | `null` | no |
| cards_container_name | Name of the cards container | `string` | `"Cards"` | no |
| cards_partition_key_path | Partition key path for the cards container | `string` | `"/setId"` | no |
| cards_container_throughput | RU/s for the cards container (provisioned only) | `number` | `null` | no |
| sets_container_name | Name of the sets container | `string` | `"Sets"` | no |
| sets_partition_key_path | Partition key path for the sets container | `string` | `"/code"` | no |
| sets_container_throughput | RU/s for the sets container (provisioned only) | `number` | `null` | no |
| consistency_level | Consistency level for Cosmos DB | `string` | `"Session"` | no |
| backup_type | Backup type: `Continuous` or `Periodic` | `string` | `"Continuous"` | no |
| backup_tier | Backup tier for continuous backup | `string` | `"Continuous7Days"` | no |
| enable_automatic_failover | Enable automatic failover | `bool` | `true` | no |
| enable_multiple_write_locations | Enable multi-master | `bool` | `false` | no |
| enable_free_tier | Enable free tier | `bool` | `false` | no |
| public_network_access_enabled | Allow public network access | `bool` | `true` | no |
| ip_range_filter | List of allowed IP addresses/CIDR blocks | `list(string)` | `[]` | no |
| throughput_limit | Throughput limit for serverless accounts (RU/s) | `number` | `4000` | no |
| tags | Additional tags | `map(string)` | `{}` | no |
| virtual_network_rules | Subnet IDs granted access | `list(string)` | `[]` | no |
| enable_private_endpoint | Enable a private endpoint for Cosmos DB | `bool` | `false` | no |
| analytical_storage_enabled | Enable analytical storage | `bool` | `false` | no |
| cors_rules | CORS rules applied to the account | `list(object)` | `[]` | no |

## Outputs

| Name | Description | Sensitive |
|------|-------------|-----------|
| id | The ID of the Cosmos DB account | no |
| name | The name of the Cosmos DB account | no |
| endpoint | The endpoint URI of the Cosmos DB account | no |
| primary_key | Primary access key | yes |
| secondary_key | Secondary access key | yes |
| primary_readonly_key | Primary read-only access key | yes |
| primary_sql_connection_string | Constructed SQL connection string | yes |
| read_endpoints | List of read endpoints | no |
| write_endpoints | List of write endpoints | no |
| consistency_level | Configured consistency level | no |
| capacity_mode | Capacity mode (serverless or provisioned) | no |
| location | Primary location of the Cosmos DB account | no |
| database_name | Name of the SQL database | no |
| cards_container_name | Name of the cards container | no |
| cards_container_id | Resource ID of the cards container | no |
| sets_container_name | Name of the sets container | no |
| sets_container_id | Resource ID of the sets container | no |
| resource_group_name | Resource group hosting the Cosmos DB account | no |
| diagnostic_settings_enabled | Indicates if diagnostic settings should be configured | no |
| public_network_access_enabled | Whether public network access is enabled | no |
| ip_range_filter | Applied IP range filter | no |

## Environment-Specific Behaviors

### Development
- Zone redundancy: **Disabled** (cost optimization)
- Example SQL database and containers created automatically
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
