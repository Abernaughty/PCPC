# APIM Product State Migration

The `infra` Terraform stack no longer manages the API Management *Starter* product.  
To prevent Terraform from deleting the existing product (and its subscriptions), move
the resource state from the infrastructure workspace into each APIM environment
workspace before running `terraform apply`.

> ⚠️ **Do not skip these steps.** If the infra stack runs `terraform apply`
> while it still owns the product, Terraform will destroy the product and remove
> any active subscriptions.

## Prerequisites

- Terraform CLI ≥ 1.0 installed
- Access to the remote state backends for both the infrastructure stack
  (`infra/envs/<env>`) and APIM stack (`apim/environments/<env>`)
- Azure CLI permissions to read the APIM instance (optional, for validation)

## Migration Steps per Environment

Repeat the following for **dev**, **staging**, and **prod** (where applicable).

1. **Change to the infra workspace**

   ```bash
   cd infra/envs/<env>
   terraform init
   ```

2. **Confirm the product is still tracked**

   ```bash
   terraform state show \
     'module.api_management[0].azurerm_api_management_product.starter'
   ```

   If this command fails with `Error: No instance found`, the state was already
   migrated—continue with the next environment.

3. **Detach the product from the infra state**

   ```bash
   terraform state rm \
     'module.api_management[0].azurerm_api_management_product.starter'
   ```

   This removes Terraform ownership without touching the live resource.

4. **Switch to the APIM environment workspace**

   ```bash
   cd ../../apim/environments/<env>
   terraform init
   ```

5. **Import the existing product into the APIM stack**

   ```bash
   terraform import \
     'module.pcpc_apim.azurerm_api_management_product.products["starter"]' \
     /subscriptions/<subscription-id>/resourceGroups/pcpc-rg-<env>/providers/Microsoft.ApiManagement/service/pcpc-apim-<env>/products/starter
   ```

   Adjust the subscription ID if it differs from the default settings.

6. **Validate**

   ```bash
   terraform plan
   ```

   The plan should show no actions for the `starter` product. Investigate any
   updates before applying.

## After Migration

- Future `terraform apply` runs from `infra/envs/<env>` will no longer mention
  the *Starter* product.
- The APIM environment stack now retains full ownership of the product
  configuration alongside other APIM policies and settings.

Keep these instructions handy for onboarding new environments so the product
state is imported before Terraform applies.
