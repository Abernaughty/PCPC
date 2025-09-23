# -----------------------------------------------------------------------------
# EXAMPLE: Basic Cosmos DB Module Usage
# This shows how to use the module in a simple development environment
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40.0"
    }
  }
}

# Configure the Azure Provider
provider "azurerm" {
  features {}
}

# Create a resource group for the example
resource "azurerm_resource_group" "example" {
  name     = "pokedata-cosmos-example-rg"
  location = "Central US"

  tags = {
    Environment = "Example"
    Purpose     = "Module Testing"
  }
}

# Use the Cosmos DB module
module "cosmos_db" {
  source = "../.." # Points to the module root

  # Required variables
  name                = "pokedata-cosmos-example"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location

  # Optional configurations
  environment   = "dev"
  capacity_mode = "serverless"

  # Cost optimization for example
  enable_free_tier = true
  throughput_limit = 1000 # Lower limit for testing

  # Basic security
  ip_range_filter = [
    "0.0.0.0/0" # WARNING: Open to all - only for testing!
  ]

  # Tags
  tags = {
    Project = "PokeData"
    Module  = "cosmos-db-example"
    Owner   = "DevOps Team"
  }
}

# -----------------------------------------------------------------------------
# OUTPUTS - Display important information
# -----------------------------------------------------------------------------

output "cosmos_endpoint" {
  description = "The Cosmos DB endpoint"
  value       = module.cosmos_db.endpoint
}

output "cosmos_name" {
  description = "The Cosmos DB account name"
  value       = module.cosmos_db.name
}

output "database_name" {
  description = "The example database name (if created)"
  value       = module.cosmos_db.database_name
}

output "primary_key" {
  description = "The primary key (sensitive)"
  value       = module.cosmos_db.primary_key
  sensitive   = true
}

output "connection_string" {
  description = "The primary SQL connection string (sensitive)"
  value       = module.cosmos_db.primary_sql_connection_string
  sensitive   = true
}
