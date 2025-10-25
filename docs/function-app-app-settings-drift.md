# Function App `app_settings` Drift – Investigation Summary

## Overview
- **Date detected:** 2025-10-24  
- **Environment:** `infra/envs/dev` Terraform stack  
- **Symptom:** `terraform plan` always reported an update to `module.function_app.azurerm_windows_function_app.this[0].app_settings`, even when no configuration had changed.
- **Impact:** Terraform pipelines could not produce clean plans/applies, increasing deployment risk and requiring manual approval for no-op changes.

## What Was Happening
1. After each deploy, the Azure Functions App ended up with extra settings (`DEPLOY_PACKAGE_HASH`, `WEBSITE_RUN_FROM_PACKAGE`, etc.) that Terraform was not expecting.
2. We added a Terraform lifecycle ignore block for some keys, but the drift persisted because the deployment pipeline rewrote `DEPLOY_PACKAGE_HASH` after Terraform finished.
3. Terraform compared its desired map (from `function_app_config` + secrets) with the live map (including pipeline-managed keys) and attempted to remove the hash on every run.

## Key Findings
- The deployment pipeline intentionally patches `DEPLOY_PACKAGE_HASH` post-deploy to record the hash of the function artifact.
- The Terraform module overwrote the entire app settings map, so any key not supplied by Terraform was lost (or attempted to be removed).
- Debug outputs we added temporarily (`debug_function_app_settings_keys`, etc.) proved the difference but were noisy for normal runs.

## Fix Implemented
| Area | Change |
|------|--------|
| External settings preservation | Added `infra/modules/function-app/scripts/get-app-settings.sh` to fetch existing app settings before Terraform writes them. The helper supports **client secret**, **workload identity/OIDC**, **App Service MSI**, and **IMDS MSI** flows, with Azure CLI fallback. |
| Terraform module | `infra/modules/function-app/main.tf` now merges the live values from the helper (when present) with the desired map, so externally managed keys like `DEPLOY_PACKAGE_HASH` are preserved. The external data source is skipped entirely if no keys are listed. |
| Environment wiring | `infra/envs/*/main.tf` passes the subscription ID and lists keys to preserve (`["DEPLOY_PACKAGE_HASH"]`). |
| Debug outputs | Added `enable_debug_outputs` variable in each environment to gate the troubleshooting outputs. Default is `false`, so normal plans are clean; the flag can be flipped temporarily if deeper visibility is needed. |

## Verification
1. `terraform plan` (dev) before the fix showed the `app_settings` change every run.  
2. After the fix and a single `terraform apply`, subsequent plans return **“No changes”**.  
3. Azure DevOps pipeline (`Terraform Apply` stage) completed with zero resource changes, confirming the state and live config now match.  
4. Manual spot check with `az functionapp config appsettings list` confirmed that `DEPLOY_PACKAGE_HASH` remains intact after Terraform finishes.

## Remaining Actions / Notes
- The helper script prints an empty JSON object if it cannot retrieve settings; Terraform then falls back to its configuration. This prevents a failed lookup from erasing app settings but still keeps plans clean.
- If we ever add more pipeline-managed keys, append them to `external_app_settings_preserve_keys` in the corresponding environment module.
- Debug outputs can be re-enabled per environment by setting `enable_debug_outputs = true` in the relevant `terraform.tfvars` (or via CLI) when troubleshooting.

## Files Modified
- `infra/modules/function-app/scripts/get-app-settings.sh`
- `infra/modules/function-app/main.tf`
- `infra/modules/function-app/variables.tf`
- `infra/envs/dev|staging|prod/main.tf`
- `infra/envs/dev|staging|prod/variables.tf`
- `infra/envs/dev/outputs.tf` (debug output gating)

## Lessons Learned
- When external systems mutate Azure resource settings post-provisioning, Terraform should merge or ignore those keys instead of blindly overwriting them.
- Providing a toggle for verbose debug outputs avoids long-term plan noise while keeping troubleshooting tools handy.
