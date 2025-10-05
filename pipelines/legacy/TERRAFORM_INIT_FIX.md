# Terraform Init Fix - Pipeline Working Directory Issue

## Problem

The Terraform plan stage was failing with the following error:

```
Error: Backend initialization required, please run "terraform init"

Reason: Initial configuration of the requested backend "azurerm"
```

## Root Cause

The Azure DevOps pipeline tasks were using the `workingDirectory` parameter, but this parameter only sets the working directory for the task execution context. However, when using inline scripts with `AzureCLI@2` tasks, the actual shell commands were not executing in the correct directory.

The issue occurred because:

1. The `workingDirectory` parameter in Azure DevOps tasks sets the context but doesn't change the shell's current directory
2. Terraform commands were being executed from the pipeline's default directory instead of `infra/envs/dev/`
3. This caused Terraform to not find the configuration files and fail initialization

## Solution

Updated both `terraform-plan.yml` and `terraform-apply.yml` templates to explicitly change to the working directory within the inline scripts using `cd $(workingDirectory)`.

### Changes Made

#### 1. Terraform Init Step

- Added explicit `cd $(workingDirectory)` command at the start of the script
- Added `rm -rf .terraform` to ensure clean initialization
- Added `-reconfigure` flag to Terraform init to handle backend configuration changes
- Removed `workingDirectory` parameter from task (now handled in script)
- Added debug output to show the working directory being used

#### 2. Terraform Plan Step

- Added explicit `cd $(workingDirectory)` command at the start of the script
- Removed `workingDirectory` parameter from task
- Added debug output to show the working directory

#### 3. Display Plan Summary Step

- Added explicit `cd $(workingDirectory)` at the start of the script
- Removed `workingDirectory` parameter from task

#### 4. Terraform Apply Steps (in terraform-apply.yml)

- Applied same pattern to all steps that need to execute Terraform commands
- Copy plan file, apply, and display outputs all now explicitly cd to working directory

## Key Improvements

1. **Explicit Directory Navigation**: All Terraform commands now explicitly navigate to the correct directory
2. **Clean Initialization**: Removes `.terraform` directory before init to prevent state conflicts
3. **Reconfigure Support**: Uses `-reconfigure` flag to handle backend configuration changes
4. **Better Debugging**: Added working directory output to help troubleshoot future issues
5. **Consistency**: Applied the same pattern across all pipeline templates

## Testing

After applying these changes, the pipeline should:

1. Successfully initialize Terraform with the remote backend
2. Generate a Terraform plan without errors
3. Apply the plan (if approved) without directory-related issues

## Files Modified

- `pipelines/templates/terraform-plan.yml`
- `pipelines/templates/terraform-apply.yml`

## Related Documentation

- Azure DevOps Task Working Directory: https://docs.microsoft.com/en-us/azure/devops/pipelines/process/tasks
- Terraform Backend Configuration: https://www.terraform.io/docs/language/settings/backends/configuration.html
- Terraform Init Reconfigure: https://www.terraform.io/docs/cli/commands/init.html

## Date Fixed

October 3, 2025
