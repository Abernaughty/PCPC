# Function App Secrets Configuration Fix

## Problem Summary

Function App environment variables from Azure Key Vault were not being deployed correctly. The symptoms were:

- `POKEMON_TCG_API_KEY` existed but was empty
- `POKEDATA_API_KEY` was missing entirely
- Other secrets (`ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`) were also missing

## Root Cause

The issue was a **variable naming mismatch** between the Terraform variable defaults and the secrets from Azure Key Vault:

- **Key Vault secrets**: Use hyphens (e.g., `POKEDATA-API-KEY`)
- **Variable defaults**: Used underscores (e.g., `POKEMON_TCG_API_KEY`)

When Terraform merged the variables, it treated hyphenated and underscored names as different keys, resulting in:

- Secrets from Key Vault (with hyphens) were ignored
- Empty defaults (with underscores) were used instead

## Solution Implemented

Separated secrets from configuration using two distinct variables:

### Before (Single Variable)

```hcl
variable "function_app_settings" {
  type = map(string)
  default = {
    "POKEMON_TCG_API_KEY" = ""  # Underscore - didn't match Key Vault
    "ENVIRONMENT" = "development"
    "LOG_LEVEL" = "debug"
  }
}
```

### After (Separate Variables)

```hcl
variable "function_app_secrets" {
  description = "Secrets from Azure Key Vault (with hyphens)"
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "function_app_config" {
  description = "Non-secret configuration"
  type        = map(string)
  default = {
    "ENVIRONMENT" = "development"
    "LOG_LEVEL"   = "debug"
  }
}
```

## Files Modified

### 1. Terraform Variables (3 files)

- `infra/envs/dev/variables.tf` - Split into `function_app_secrets` and `function_app_config`
- `infra/envs/staging/variables.tf` - Split into `function_app_secrets` and `function_app_config`
- `infra/envs/prod/variables.tf` - Split into `function_app_secrets` and `function_app_config`

### 2. Terraform Main Configurations (3 files)

- `infra/envs/dev/main.tf` - Updated to merge both variables
- `infra/envs/staging/main.tf` - Updated to merge both variables
- `infra/envs/prod/main.tf` - Updated to merge both variables

### 3. Pipeline Template (1 file)

- `.ado/templates/deploy-infra.yml` - Changed `function_app_settings` to `function_app_secrets`

## How It Works Now

### 1. Pipeline Creates Secrets File

```bash
# .ado/templates/deploy-infra.yml
function_app_secrets = {
  "POKEDATA-API-KEY"     = "$(POKEDATA-API-KEY)"     # From Key Vault
  "POKEMON-TCG-API-KEY"  = "$(POKEMON-TCG-API-KEY)"  # From Key Vault
  "ARM-CLIENT-ID"        = "$(ARM-CLIENT-ID)"        # From Key Vault
  "ARM-CLIENT-SECRET"    = "$(ARM-CLIENT-SECRET)"    # From Key Vault
}
```

### 2. Terraform Merges Variables

```hcl
# infra/envs/dev/main.tf
app_settings = merge(
  var.function_app_secrets,  # Secrets with hyphens from Key Vault
  var.function_app_config,   # Config with underscores from defaults
  {
    "COSMOS_DB_CONNECTION_STRING" = ...
    "APPINSIGHTS_INSTRUMENTATIONKEY" = ...
    # ... other system-generated values
  }
)
```

### 3. Function App Module Transforms Names

```hcl
# infra/modules/function-app/main.tf
transformed_app_settings = {
  for key, value in var.app_settings :
  replace(key, "-", "_") => value  # Hyphens → Underscores
}
```

### 4. Final Result in Function App

```
POKEDATA_API_KEY = "actual_jwt_token"          # Transformed from POKEDATA-API-KEY
POKEMON_TCG_API_KEY = "actual_api_key"         # Transformed from POKEMON-TCG-API-KEY
ARM_CLIENT_ID = "actual_client_id"             # Transformed from ARM-CLIENT-ID
ARM_CLIENT_SECRET = "actual_client_secret"     # Transformed from ARM-CLIENT-SECRET
ENVIRONMENT = "development"                     # From function_app_config
LOG_LEVEL = "debug"                            # From function_app_config
COSMOS_DB_CONNECTION_STRING = "..."            # System-generated
APPINSIGHTS_INSTRUMENTATIONKEY = "..."         # System-generated
```

## Benefits of This Approach

1. **Clear Separation**: Secrets vs configuration are explicitly different
2. **Security**: Secrets marked as `sensitive = true` in Terraform
3. **Maintainability**: Easy to understand what comes from Key Vault vs what's configured
4. **Flexibility**: Can add config variables without touching secrets
5. **Type Safety**: Terraform validates both variables independently

## Verification Steps

After deploying with these changes, verify:

1. **Check Function App Configuration** in Azure Portal:

   ```bash
   az functionapp config appsettings list \
     --name pcpc-func-dev \
     --resource-group pcpc-rg-dev \
     --query "[?name=='POKEDATA_API_KEY' || name=='POKEMON_TCG_API_KEY'].{name:name, value:value}"
   ```

2. **Expected Output**:

   ```json
   [
     {
       "name": "POKEDATA_API_KEY",
       "value": "eyJ0eXAiOiJKV1QiLCJhbGc..." // Actual JWT token
     },
     {
       "name": "POKEMON_TCG_API_KEY",
       "value": "6906290c-cc0c-4557-a6ac-..." // Actual API key
     }
   ]
   ```

3. **Test API Endpoints**:
   - GetSetList should return 562 sets (not 0)
   - No authentication errors in Function App logs

## Next Steps

1. **Commit Changes**:

   ```bash
   git add infra/envs/*/variables.tf infra/envs/*/main.tf .ado/templates/deploy-infra.yml
   git commit -m "fix: Separate Function App secrets from config to resolve Key Vault integration"
   ```

2. **Push to Trigger Pipeline**:

   ```bash
   git push origin main
   ```

3. **Monitor Pipeline**:

   - Watch "Generate Secrets Configuration" step (should still show 953 bytes)
   - Watch "Terraform Plan" step (should show app_settings with actual values)
   - Watch "Terraform Apply" step (should deploy secrets to Function App)

4. **Verify Deployment**:
   - Check Function App configuration in Azure Portal
   - Test GetSetList endpoint (should return 562 sets)
   - Verify smoke tests pass

## Troubleshooting

### If secrets are still empty after deployment

1. **Check pipeline logs** for "Generate Secrets Configuration" step
2. **Verify variable group** `vg-pcpc-dev-secrets` is linked to Key Vault
3. **Check service principal permissions** on Key Vault (should have Get/List)
4. **Verify secrets exist** in Key Vault with actual values

### If Terraform plan fails

1. **Check syntax** of secrets.auto.tfvars file (should be valid HCL)
2. **Verify variable names** match between tfvars and variables.tf
3. **Check Terraform version** (should be >= 1.13.0)

## Related Documentation

- `docs/azure-key-vault-naming-transformation.md` - Explains hyphen-to-underscore transformation
- `.ado/PIPELINE_SETUP_GUIDE.md` - Complete pipeline setup instructions
- `infra/envs/dev/MIGRATION_GUIDE.md` - Terraform state management guide
