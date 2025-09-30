# -----------------------------------------------------------------------------
# PCPC API Management as Code - Makefile
# -----------------------------------------------------------------------------
# Unified command interface for APIM configuration management
# 
# Usage:
#   make help                    # Show this help message
#   make validate                # Validate all configurations
#   make deploy-dev              # Deploy to development
#   make deploy-staging          # Deploy to staging
#   make deploy-prod             # Deploy to production
#   make test                    # Test API endpoints
#   make clean                   # Clean up temporary files

.PHONY: help validate deploy-dev deploy-staging deploy-prod test clean format lint docs

# Default target
.DEFAULT_GOAL := help

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

SHELL := /bin/bash
PROJECT_ROOT := $(shell pwd)
SCRIPTS_DIR := $(PROJECT_ROOT)/scripts
ENVIRONMENTS_DIR := $(PROJECT_ROOT)/environments

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# -----------------------------------------------------------------------------
# HELP TARGET
# -----------------------------------------------------------------------------

help: ## Show this help message
	@echo "PCPC API Management as Code - Available Commands"
	@echo "================================================"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(BLUE)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Environment Variables Required:"
	@echo "  ARM_CLIENT_ID             Azure Service Principal Client ID"
	@echo "  ARM_CLIENT_SECRET         Azure Service Principal Client Secret"
	@echo "  ARM_SUBSCRIPTION_ID       Azure Subscription ID"
	@echo "  ARM_TENANT_ID             Azure Tenant ID"
	@echo "  TF_VAR_function_app_key   Function App access key"

# -----------------------------------------------------------------------------
# VALIDATION TARGETS
# -----------------------------------------------------------------------------

validate: ## Validate all configurations and OpenAPI specs
	@echo -e "$(BLUE)[INFO]$(NC) Validating PCPC APIM configuration..."
	@$(SCRIPTS_DIR)/deploy.sh dev validate-only
	@echo -e "$(GREEN)[SUCCESS]$(NC) Validation completed successfully"

validate-openapi: ## Validate OpenAPI specification only
	@echo -e "$(BLUE)[INFO]$(NC) Validating OpenAPI specification..."
	@if command -v swagger-codegen >/dev/null 2>&1; then \
		swagger-codegen validate -i specs/pcpc-api-v1.yaml; \
		echo -e "$(GREEN)[SUCCESS]$(NC) OpenAPI validation passed"; \
	elif command -v openapi-generator >/dev/null 2>&1; then \
		openapi-generator validate -i specs/pcpc-api-v1.yaml; \
		echo -e "$(GREEN)[SUCCESS]$(NC) OpenAPI validation passed"; \
	else \
		echo -e "$(YELLOW)[WARNING]$(NC) OpenAPI validation tools not found"; \
		echo -e "$(YELLOW)[WARNING]$(NC) Install swagger-codegen or openapi-generator for validation"; \
	fi

validate-terraform: ## Validate Terraform configurations
	@echo -e "$(BLUE)[INFO]$(NC) Validating Terraform configurations..."
	@for env in dev staging prod; do \
		if [ -d "$(ENVIRONMENTS_DIR)/$$env" ]; then \
			echo -e "$(BLUE)[INFO]$(NC) Validating $$env environment..."; \
			cd "$(ENVIRONMENTS_DIR)/$$env" && terraform init -backend=false && terraform validate; \
		fi; \
	done
	@echo -e "$(GREEN)[SUCCESS]$(NC) Terraform validation completed"

# -----------------------------------------------------------------------------
# DEPLOYMENT TARGETS
# -----------------------------------------------------------------------------

deploy-dev: ## Deploy to development environment
	@echo -e "$(BLUE)[INFO]$(NC) Deploying to development environment..."
	@$(SCRIPTS_DIR)/deploy.sh dev
	@echo -e "$(GREEN)[SUCCESS]$(NC) Development deployment completed"

deploy-staging: ## Deploy to staging environment
	@echo -e "$(BLUE)[INFO]$(NC) Deploying to staging environment..."
	@$(SCRIPTS_DIR)/deploy.sh staging
	@echo -e "$(GREEN)[SUCCESS]$(NC) Staging deployment completed"

deploy-prod: ## Deploy to production environment
	@echo -e "$(YELLOW)[WARNING]$(NC) Deploying to PRODUCTION environment"
	@read -p "Are you sure you want to deploy to production? (y/N): " confirm && \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		$(SCRIPTS_DIR)/deploy.sh prod; \
		echo -e "$(GREEN)[SUCCESS]$(NC) Production deployment completed"; \
	else \
		echo -e "$(YELLOW)[INFO]$(NC) Production deployment cancelled"; \
	fi

# -----------------------------------------------------------------------------
# TESTING TARGETS
# -----------------------------------------------------------------------------

test: test-dev ## Run API endpoint tests (default: dev)

test-dev: ## Test development API endpoints
	@echo -e "$(BLUE)[INFO]$(NC) Testing development API endpoints..."
	@$(SCRIPTS_DIR)/test-apis.sh dev

test-staging: ## Test staging API endpoints
	@echo -e "$(BLUE)[INFO]$(NC) Testing staging API endpoints..."
	@$(SCRIPTS_DIR)/test-apis.sh staging

test-prod: ## Test production API endpoints
	@echo -e "$(BLUE)[INFO]$(NC) Testing production API endpoints..."
	@$(SCRIPTS_DIR)/test-apis.sh prod

# -----------------------------------------------------------------------------
# UTILITY TARGETS
# -----------------------------------------------------------------------------

format: ## Format Terraform and other configuration files
	@echo -e "$(BLUE)[INFO]$(NC) Formatting configuration files..."
	@find . -name "*.tf" -exec terraform fmt {} \;
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --write "specs/*.yaml" "**/*.json" "**/*.md" 2>/dev/null || true; \
	fi
	@echo -e "$(GREEN)[SUCCESS]$(NC) Formatting completed"

lint: ## Lint configuration files
	@echo -e "$(BLUE)[INFO]$(NC) Linting configuration files..."
	@if command -v tflint >/dev/null 2>&1; then \
		find . -name "*.tf" -execdir tflint {} \; 2>/dev/null || true; \
	else \
		echo -e "$(YELLOW)[WARNING]$(NC) tflint not found, skipping Terraform linting"; \
	fi
	@if command -v yamllint >/dev/null 2>&1; then \
		yamllint specs/ policies/ 2>/dev/null || true; \
	else \
		echo -e "$(YELLOW)[WARNING]$(NC) yamllint not found, skipping YAML linting"; \
	fi
	@echo -e "$(GREEN)[SUCCESS]$(NC) Linting completed"

clean: ## Clean up temporary files and generated policies
	@echo -e "$(BLUE)[INFO]$(NC) Cleaning up temporary files..."
	@find . -name "terraform.tfplan" -delete 2>/dev/null || true
	@find . -name "terraform.tfstate.backup" -delete 2>/dev/null || true
	@find . -name ".terraform.lock.hcl" -delete 2>/dev/null || true
	@rm -rf .terraform/ 2>/dev/null || true
	@rm -rf policies/generated/ 2>/dev/null || true
	@echo -e "$(GREEN)[SUCCESS]$(NC) Cleanup completed"

# -----------------------------------------------------------------------------
# DEVELOPMENT TARGETS
# -----------------------------------------------------------------------------

init-dev: ## Initialize development environment
	@echo -e "$(BLUE)[INFO]$(NC) Initializing development environment..."
	@if [ ! -f "$(ENVIRONMENTS_DIR)/dev/terraform.tfvars" ]; then \
		cp "$(ENVIRONMENTS_DIR)/dev/terraform.tfvars.example" "$(ENVIRONMENTS_DIR)/dev/terraform.tfvars"; \
		echo -e "$(YELLOW)[WARNING]$(NC) Created terraform.tfvars from example"; \
		echo -e "$(YELLOW)[WARNING]$(NC) Please update the values in $(ENVIRONMENTS_DIR)/dev/terraform.tfvars"; \
	fi
	@cd "$(ENVIRONMENTS_DIR)/dev" && terraform init
	@echo -e "$(GREEN)[SUCCESS]$(NC) Development environment initialized"

plan-dev: ## Show Terraform plan for development
	@echo -e "$(BLUE)[INFO]$(NC) Creating Terraform plan for development..."
	@cd "$(ENVIRONMENTS_DIR)/dev" && terraform plan

plan-staging: ## Show Terraform plan for staging
	@echo -e "$(BLUE)[INFO]$(NC) Creating Terraform plan for staging..."
	@cd "$(ENVIRONMENTS_DIR)/staging" && terraform plan

plan-prod: ## Show Terraform plan for production
	@echo -e "$(BLUE)[INFO]$(NC) Creating Terraform plan for production..."
	@cd "$(ENVIRONMENTS_DIR)/prod" && terraform plan

# -----------------------------------------------------------------------------
# DOCUMENTATION TARGETS
# -----------------------------------------------------------------------------

docs: ## Generate documentation
	@echo -e "$(BLUE)[INFO]$(NC) Generating documentation..."
	@if [ -f "docs/generate-docs.sh" ]; then \
		./docs/generate-docs.sh; \
	else \
		echo -e "$(YELLOW)[WARNING]$(NC) Documentation generator not found"; \
	fi
	@echo -e "$(GREEN)[SUCCESS]$(NC) Documentation generation completed"

# -----------------------------------------------------------------------------
# MONITORING TARGETS
# -----------------------------------------------------------------------------

status: ## Show deployment status for all environments
	@echo -e "$(BLUE)[INFO]$(NC) Checking deployment status..."
	@for env in dev staging prod; do \
		if [ -d "$(ENVIRONMENTS_DIR)/$$env" ]; then \
			echo -e "$(BLUE)[INFO]$(NC) Status for $$env environment:"; \
			cd "$(ENVIRONMENTS_DIR)/$$env" && terraform show -json 2>/dev/null | jq -r '.values.outputs // "No outputs available"' || echo "No state file found"; \
		fi; \
	done

outputs: ## Show Terraform outputs for all environments
	@echo -e "$(BLUE)[INFO]$(NC) Showing Terraform outputs..."
	@for env in dev staging prod; do \
		if [ -d "$(ENVIRONMENTS_DIR)/$$env" ]; then \
			echo -e "$(BLUE)[INFO]$(NC) Outputs for $$env environment:"; \
			cd "$(ENVIRONMENTS_DIR)/$$env" && terraform output 2>/dev/null || echo "No outputs available"; \
			echo ""; \
		fi; \
	done

# -----------------------------------------------------------------------------
# PREREQUISITES CHECK
# -----------------------------------------------------------------------------

check-prereqs: ## Check if all required tools are installed
	@echo -e "$(BLUE)[INFO]$(NC) Checking prerequisites..."
	@missing_tools=(); \
	command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform"); \
	command -v az >/dev/null 2>&1 || missing_tools+=("azure-cli"); \
	command -v jq >/dev/null 2>&1 || missing_tools+=("jq"); \
	command -v curl >/dev/null 2>&1 || missing_tools+=("curl"); \
	if [ $${#missing_tools[@]} -ne 0 ]; then \
		echo -e "$(RED)[ERROR]$(NC) Missing required tools: $${missing_tools[*]}"; \
		exit 1; \
	else \
		echo -e "$(GREEN)[SUCCESS]$(NC) All required tools are installed"; \
	fi

check-env: ## Check if required environment variables are set
	@echo -e "$(BLUE)[INFO]$(NC) Checking environment variables..."
	@missing_vars=(); \
	[ -z "$$ARM_CLIENT_ID" ] && missing_vars+=("ARM_CLIENT_ID"); \
	[ -z "$$ARM_CLIENT_SECRET" ] && missing_vars+=("ARM_CLIENT_SECRET"); \
	[ -z "$$ARM_SUBSCRIPTION_ID" ] && missing_vars+=("ARM_SUBSCRIPTION_ID"); \
	[ -z "$$ARM_TENANT_ID" ] && missing_vars+=("ARM_TENANT_ID"); \
	[ -z "$$TF_VAR_function_app_key" ] && missing_vars+=("TF_VAR_function_app_key"); \
	if [ $${#missing_vars[@]} -ne 0 ]; then \
		echo -e "$(RED)[ERROR]$(NC) Missing required environment variables: $${missing_vars[*]}"; \
		exit 1; \
	else \
		echo -e "$(GREEN)[SUCCESS]$(NC) All required environment variables are set"; \
	fi

# -----------------------------------------------------------------------------
# COMBINED TARGETS
# -----------------------------------------------------------------------------

full-deploy-dev: check-prereqs check-env validate deploy-dev test-dev ## Full development deployment with all checks

full-deploy-staging: check-prereqs check-env validate deploy-staging test-staging ## Full staging deployment with all checks

full-deploy-prod: check-prereqs check-env validate deploy-prod test-prod ## Full production deployment with all checks
