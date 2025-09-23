# Basic Cosmos DB Module Example

This example demonstrates how to use the Cosmos DB module in a basic development environment.

## Prerequisites

- Azure subscription
- Terraform >= 1.9.0
- Azure CLI (for authentication)

## Running the Example

1. **Authenticate with Azure:**
```bash
az login
az account set --subscription "your-subscription-id"
```

2. **Initialize Terraform:**
```bash
terraform init
```

3. **Review the plan:**
```bash
terraform plan
```

4. **Apply the configuration:**
```bash
terraform apply
```

5. **View outputs:**
```bash
# Show all outputs
terraform output

# Get specific output (e.g., endpoint)
terraform output cosmos_endpoint

# Get sensitive output (e.g., connection string)
terraform output -raw connection_string
```

## What This Creates

- A resource group named `pokedata-cosmos-example-rg`
- A Cosmos DB account with:
  - Serverless capacity mode (cost-optimized)
  - Free tier enabled (if available)
  - Basic configuration suitable for development
  - An example database and container (in dev environment)

## Cost Considerations

This example uses:
- **Serverless mode**: Pay only for what you use
- **Free tier**: First 1000 RU/s and 25GB storage free (if eligible)
- **Low throughput limit**: Capped at 1000 RU/s to prevent high costs

Estimated cost: $0-5/month for light development use

## Cleanup

To destroy all resources created by this example:

```bash
terraform destroy
```

## Customization

To customize this example for your needs:

1. **Change the location:**
   - Modify `location` in the resource group

2. **Add network security:**
   - Update `ip_range_filter` with your IP addresses
   - Set `public_network_access_enabled = false` for private access

3. **Switch to production mode:**
   - Change `environment = "prod"`
   - Set `capacity_mode = "provisioned"`
   - Disable `enable_free_tier`

## Troubleshooting

### Error: Name already exists
Cosmos DB names must be globally unique. Change the `name` parameter in the module.

### Error: Free tier already used
Only one free tier Cosmos DB account is allowed per subscription. Set `enable_free_tier = false`.

### Error: Authentication failed
Ensure you're logged in with `az login` and have selected the correct subscription.

## Next Steps

- Review the [module documentation](../../README.md)
- Check the [production example](../production/) for enterprise configurations
- Explore [testing](../../tests/) to validate your configurations
