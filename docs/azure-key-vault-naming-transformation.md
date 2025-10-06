# Azure Key Vault Naming Transformation Pattern

## Overview

This document describes the solution implemented to handle the naming incompatibility between Azure Key Vault secrets (which require hyphens) and Node.js environment variables (which require underscores).

## The Problem

### Azure Key Vault Limitation

Azure Key Vault secret names can only contain:

- Alphanumeric characters (a-z, A-Z, 0-9)
- Hyphens (-)

**Underscores are NOT allowed** in Key Vault secret names.

### Node.js Environment Variable Requirement

Node.js applications access environment variables using `process.env.VARIABLE_NAME`, where:

- Variable names conventionally use **underscores** (e.g., `POKEDATA_API_KEY`)
- Hyphens in variable names would require bracket notation: `process.env['POKEDATA-API-KEY']`
- This is non-standard and breaks many libraries that expect underscore-based naming

### The Conflict

```
Key Vault Secret:     POKEDATA-API-KEY  (hyphens required)
                            ↓
Azure DevOps Variable: POKEDATA-API-KEY  (linked to Key Vault)
                            ↓
Function App Setting:  POKEDATA-API-KEY  (deployed as-is)
                            ↓
Node.js Code:         process.env.POKEDATA_API_KEY  (expects underscores)
                            ↓
Result:               undefined ❌
```

## The Solution

### Terraform Transformation

We implemented a transformation in the Function App Terraform module that automatically converts hyphens to underscores when deploying app settings.

**Location**: `infra/modules/function-app/main.tf`

```hcl
locals {
  # Transform hyphenated variable names to underscores for Node.js compatibility
  # Azure Key Vault requires hyphens, but Node.js environment variables need underscores
  transformed_app_settings = {
    for key, value in var.app_settings :
    replace(key, "-", "_") => value
  }

  app_settings = merge(local.default_app_settings, local.transformed_app_settings)
}
```

### How It Works

1. **Key Vault**: Secrets stored with hyphens (e.g., `POKEDATA-API-KEY`)
2. **Variable Groups**: Azure DevOps variable groups linked to Key Vault (hyphens preserved)
3. **Terraform Input**: Variables passed to Terraform with hyphens
4. **Terraform Transformation**: `replace(key, "-", "_")` converts hyphens to underscores
5. **Function App Settings**: Deployed with underscores (e.g., `POKEDATA_API_KEY`)
6. **Node.js Code**: Accesses variables with standard underscore notation

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Azure Key Vault                                                 │
│ Secret: POKEDATA-API-KEY = "abc123"                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Azure DevOps Variable Group (vg-pcpc-dev-secrets)              │
│ Variable: POKEDATA-API-KEY (linked to Key Vault)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Terraform Pipeline                                              │
│ Input: var.app_settings["POKEDATA-API-KEY"] = "abc123"        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Terraform Transformation (function-app module)                  │
│ replace("POKEDATA-API-KEY", "-", "_") = "POKEDATA_API_KEY"    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Azure Function App Settings                                     │
│ POKEDATA_API_KEY = "abc123"                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Node.js Application                                             │
│ process.env.POKEDATA_API_KEY = "abc123" ✅                     │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Required Variables

All API keys and sensitive configuration must follow this pattern:

| Key Vault Secret Name | Function App Setting Name | Node.js Variable                  |
| --------------------- | ------------------------- | --------------------------------- |
| `POKEDATA-API-KEY`    | `POKEDATA_API_KEY`        | `process.env.POKEDATA_API_KEY`    |
| `POKEMON-TCG-API-KEY` | `POKEMON_TCG_API_KEY`     | `process.env.POKEMON_TCG_API_KEY` |
| `ARM-CLIENT-ID`       | `ARM_CLIENT_ID`           | `process.env.ARM_CLIENT_ID`       |
| `ARM-CLIENT-SECRET`   | `ARM_CLIENT_SECRET`       | `process.env.ARM_CLIENT_SECRET`   |

### Variable Group Configuration

**Secrets Variable Group** (`vg-pcpc-dev-secrets`):

- Linked to Azure Key Vault
- Contains sensitive values (API keys, client secrets)
- Variable names use hyphens (matching Key Vault)

**Config Variable Group** (`vg-pcpc-dev-config`):

- Regular Azure DevOps variables
- Contains non-sensitive configuration
- Can use either hyphens or underscores (will be transformed)

### Code Access Pattern

In your Node.js/TypeScript code, always use underscores:

```typescript
// ✅ CORRECT
const apiKey = process.env.POKEDATA_API_KEY;
const tcgKey = process.env.POKEMON_TCG_API_KEY;

// ❌ WRONG - Don't use hyphens
const apiKey = process.env["POKEDATA-API-KEY"];
```

## Benefits

1. **Compliance**: Meets Azure Key Vault naming requirements
2. **Standards**: Follows Node.js environment variable conventions
3. **Automation**: Transformation happens automatically in Terraform
4. **Consistency**: Same pattern works across all environments (dev, staging, prod)
5. **Maintainability**: Single source of truth in Key Vault
6. **Security**: Secrets remain in Key Vault, never hardcoded

## Troubleshooting

### Problem: Environment variable is undefined

**Symptom**: `process.env.POKEDATA_API_KEY` returns `undefined`

**Possible Causes**:

1. Variable not added to Azure DevOps variable group
2. Variable group not linked to pipeline
3. Terraform not deploying the variable
4. Variable name mismatch

**Solution**:

1. Verify secret exists in Key Vault with hyphenated name
2. Verify variable group is linked to Key Vault
3. Check Terraform plan output for app_settings
4. Verify Function App settings in Azure Portal (should have underscores)

### Problem: Key Vault rejects secret name with underscores

**Symptom**: Error when creating Key Vault secret with underscores

**Solution**: This is expected! Use hyphens in Key Vault. The transformation happens in Terraform.

### Verification Steps

1. **Check Key Vault**:

   ```bash
   az keyvault secret show --vault-name pcpc-kv-dev --name POKEDATA-API-KEY
   ```

2. **Check Function App Settings**:

   ```bash
   az functionapp config appsettings list \
     --name pcpc-func-dev \
     --resource-group pcpc-rg-dev \
     --query "[?name=='POKEDATA_API_KEY']"
   ```

3. **Check in Application**:
   - Add logging: `console.log('API Key:', process.env.POKEDATA_API_KEY ? 'Set' : 'Missing');`
   - Check Application Insights logs

## Related Documentation

- [Azure Key Vault Secret Naming](https://docs.microsoft.com/en-us/azure/key-vault/general/about-keys-secrets-certificates)
- [Azure Functions App Settings](https://docs.microsoft.com/en-us/azure/azure-functions/functions-app-settings)
- [Node.js Environment Variables](https://nodejs.org/api/process.html#process_process_env)

## Change History

- **2025-10-06**: Initial implementation of transformation pattern
- **2025-10-06**: Documentation created

## Authors

- PCPC Development Team
- Cline AI Assistant
