# PCPC Project Makefile
# Common operations for development, testing, and deployment

.PHONY: help install clean build test deploy-dev deploy-staging deploy-prod terraform-init terraform-plan terraform-apply terraform-destroy

# Default target
help: ## Show this help message
	@echo "PCPC Project - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment Variables:"
	@echo "  ENVIRONMENT    - Target environment (dev, staging, prod)"
	@echo "  AZURE_SUBSCRIPTION_ID - Azure subscription ID"
	@echo ""

# Installation and Setup
install: ## Install all dependencies for frontend and backend
	@echo "Installing dependencies..."
	@if [ -d "app/frontend" ]; then \
		echo "Installing frontend dependencies..."; \
		cd app/frontend && npm install; \
	fi
	@if [ -d "app/backend" ]; then \
		echo "Installing backend dependencies..."; \
		cd app/backend && npm install; \
	fi
	@echo "Dependencies installed successfully!"

setup-dev: ## Set up development environment
	@echo "Setting up development environment..."
	@echo "Checking required tools..."
	@command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
	@command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }
	@command -v az >/dev/null 2>&1 || { echo "Azure CLI is required but not installed. Aborting." >&2; exit 1; }
	@echo "Installing global tools..."
	@npm install -g @azure/functions-core-tools@4
	@npm install -g @azure/static-web-apps-cli
	@echo "Development environment setup complete!"

# Cleaning
clean: ## Clean build artifacts and dependencies
	@echo "Cleaning build artifacts..."
	@rm -rf app/frontend/node_modules app/frontend/public/build
	@rm -rf app/backend/node_modules app/backend/dist
	@rm -rf node_modules
	@echo "Clean complete!"

clean-terraform: ## Clean Terraform state and cache
	@echo "Cleaning Terraform artifacts..."
	@find infra -name ".terraform" -type d -exec rm -rf {} + 2>/dev/null || true
	@find infra -name "*.tfstate*" -type f -delete 2>/dev/null || true
	@find infra -name ".terraform.lock.hcl" -type f -delete 2>/dev/null || true
	@echo "Terraform clean complete!"

# Building
build: ## Build frontend and backend
	@echo "Building applications..."
	@if [ -d "app/frontend" ]; then \
		echo "Building frontend..."; \
		cd app/frontend && npm run build; \
	fi
	@if [ -d "app/backend" ]; then \
		echo "Building backend..."; \
		cd app/backend && npm run build; \
	fi
	@echo "Build complete!"

build-frontend: ## Build frontend only
	@echo "Building frontend..."
	@cd app/frontend && npm run build
	@echo "Frontend build complete!"

build-backend: ## Build backend only
	@echo "Building backend..."
	@cd app/backend && npm run build
	@echo "Backend build complete!"

# Testing
test: ## Run all tests
	@echo "Running tests..."
	@if [ -d "app/frontend" ]; then \
		echo "Running frontend tests..."; \
		cd app/frontend && npm test; \
	fi
	@if [ -d "app/backend" ]; then \
		echo "Running backend tests..."; \
		cd app/backend && npm test; \
	fi
	@echo "All tests complete!"

test-frontend: ## Run frontend tests only
	@echo "Running frontend tests..."
	@cd app/frontend && npm test

test-backend: ## Run backend tests only
	@echo "Running backend tests..."
	@cd app/backend && npm test

test-e2e: ## Run end-to-end tests
	@echo "Running end-to-end tests..."
	@cd tests/e2e && npx playwright test

# Development
dev: ## Start development servers
	@echo "Starting development servers..."
	@echo "This will start both frontend and backend in parallel"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:7071"
	@echo ""
	@trap 'kill %1; kill %2' INT; \
	(cd app/frontend && npm run dev) & \
	(cd app/backend && func start) & \
	wait

dev-frontend: ## Start frontend development server only
	@echo "Starting frontend development server..."
	@cd app/frontend && npm run dev

dev-backend: ## Start backend development server only
	@echo "Starting backend development server..."
	@cd app/backend && func start

dev-swa: ## Start Static Web Apps CLI emulator
	@echo "Starting Static Web Apps emulator..."
	@swa start app/frontend/public --api-location app/backend

# Terraform Operations
terraform-init: ## Initialize Terraform for specified environment
	@if [ -z "$(ENVIRONMENT)" ]; then \
		echo "Error: ENVIRONMENT variable is required (dev, staging, prod)"; \
		exit 1; \
	fi
	@echo "Initializing Terraform for $(ENVIRONMENT) environment..."
	@cd infra/envs/$(ENVIRONMENT) && terraform init

terraform-plan: ## Plan Terraform changes for specified environment
	@if [ -z "$(ENVIRONMENT)" ]; then \
		echo "Error: ENVIRONMENT variable is required (dev, staging, prod)"; \
		exit 1; \
	fi
	@echo "Planning Terraform changes for $(ENVIRONMENT) environment..."
	@cd infra/envs/$(ENVIRONMENT) && terraform plan

terraform-apply: ## Apply Terraform changes for specified environment
	@if [ -z "$(ENVIRONMENT)" ]; then \
		echo "Error: ENVIRONMENT variable is required (dev, staging, prod)"; \
		exit 1; \
	fi
	@echo "Applying Terraform changes for $(ENVIRONMENT) environment..."
	@cd infra/envs/$(ENVIRONMENT) && terraform apply

terraform-destroy: ## Destroy Terraform resources for specified environment
	@if [ -z "$(ENVIRONMENT)" ]; then \
		echo "Error: ENVIRONMENT variable is required (dev, staging, prod)"; \
		exit 1; \
	fi
	@echo "WARNING: This will destroy all resources in $(ENVIRONMENT) environment!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	@cd infra/envs/$(ENVIRONMENT) && terraform destroy

# Deployment
deploy-dev: ## Deploy to development environment
	@echo "Deploying to development environment..."
	@$(MAKE) ENVIRONMENT=dev terraform-apply
	@$(MAKE) build
	@echo "Development deployment complete!"

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging environment..."
	@$(MAKE) ENVIRONMENT=staging terraform-apply
	@$(MAKE) build
	@echo "Staging deployment complete!"

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production environment..."
	@echo "WARNING: This will deploy to PRODUCTION!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	@$(MAKE) ENVIRONMENT=prod terraform-apply
	@$(MAKE) build
	@echo "Production deployment complete!"

# Validation and Quality
lint: ## Run linting on all code
	@echo "Running linters..."
	@if [ -d "app/frontend" ]; then \
		echo "Linting frontend..."; \
		cd app/frontend && npm run lint; \
	fi
	@if [ -d "app/backend" ]; then \
		echo "Linting backend..."; \
		cd app/backend && npm run lint; \
	fi

format: ## Format all code
	@echo "Formatting code..."
	@if [ -d "app/frontend" ]; then \
		echo "Formatting frontend..."; \
		cd app/frontend && npm run format; \
	fi
	@if [ -d "app/backend" ]; then \
		echo "Formatting backend..."; \
		cd app/backend && npm run format; \
	fi

validate: ## Validate Terraform configurations
	@echo "Validating Terraform configurations..."
	@for env in dev staging prod; do \
		echo "Validating $$env environment..."; \
		cd infra/envs/$$env && terraform validate; \
		cd ../../..; \
	done

security-scan: ## Run security scans
	@echo "Running security scans..."
	@if command -v npm audit >/dev/null 2>&1; then \
		echo "Running npm audit..."; \
		cd app/frontend && npm audit; \
		cd ../backend && npm audit; \
	fi

# Documentation
docs: ## Generate documentation
	@echo "Generating documentation..."
	@echo "Documentation generation not yet implemented"

# Container Management
container-build: ## Build and push devcontainer to ACR
	@if [ -z "$(ACR_NAME)" ]; then \
		echo "Error: ACR_NAME variable is required"; \
		exit 1; \
	fi
	@echo "Building and pushing devcontainer to $(ACR_NAME).azurecr.io..."
	@echo "Logging into Azure Container Registry..."
	@az acr login --name $(ACR_NAME)
	@echo "Building container image..."
	@docker build -f .devcontainer/Dockerfile.optimized -t $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest .devcontainer
	@docker tag $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest $(ACR_NAME).azurecr.io/pcpc-devcontainer:$$(git rev-parse --short HEAD)
	@echo "Pushing container images..."
	@docker push $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest
	@docker push $(ACR_NAME).azurecr.io/pcpc-devcontainer:$$(git rev-parse --short HEAD)
	@echo "Container build and push complete!"

container-pull: ## Pull latest devcontainer from ACR
	@echo "Pulling latest devcontainer from ACR..."
	@az acr login --name maberdevcontainerregistry
	@docker pull maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io/pcpc-devcontainer:latest
	@echo "Container pull complete!"

container-test: ## Test devcontainer functionality
	@echo "Testing devcontainer functionality..."
	@echo "Checking Node.js..."
	@docker run --rm $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest node --version
	@echo "Checking Azure CLI..."
	@docker run --rm $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest az --version | head -n1
	@echo "Checking Terraform..."
	@docker run --rm $(ACR_NAME).azurecr.io/pcpc-devcontainer:latest terraform --version | head -n1
	@echo "Container functionality test complete!"

container-update: ## Update DevContainer to latest ACR image
	@echo "Updating DevContainer to latest ACR image..."
	@az acr login --name maberdevcontainerregistry
	@docker-compose -f ../.devcontainer/docker-compose.yml pull devcontainer
	@docker-compose -f ../.devcontainer/docker-compose.yml up -d --force-recreate devcontainer
	@echo "DevContainer update complete!"

container-clean: ## Clean local container images
	@echo "Cleaning local container images..."
	@docker images | grep "pcpc-devcontainer" | awk '{print $$3}' | xargs -r docker rmi -f
	@echo "Container cleanup complete!"

container-status: ## Show container registry status
	@if [ -z "$(ACR_NAME)" ]; then \
		echo "Error: ACR_NAME variable is required"; \
		exit 1; \
	fi
	@echo "Container Registry Status for $(ACR_NAME)"
	@echo "=========================================="
	@echo ""
	@echo "Registry info:"
	@az acr show --name $(ACR_NAME) --query "{name:name,loginServer:loginServer,sku:sku.name}" -o table
	@echo ""
	@echo "Available images:"
	@az acr repository list --name $(ACR_NAME) -o table
	@echo ""
	@echo "pcpc-devcontainer tags:"
	@az acr repository show-tags --name $(ACR_NAME) --repository pcpc-devcontainer -o table 2>/dev/null || echo "No pcpc-devcontainer images found"

# Utilities
logs-dev: ## View development environment logs
	@echo "Viewing development logs..."
	@az functionapp logs tail --name func-pcpc-dev --resource-group rg-pcpc-dev

logs-staging: ## View staging environment logs
	@echo "Viewing staging logs..."
	@az functionapp logs tail --name func-pcpc-staging --resource-group rg-pcpc-staging

logs-prod: ## View production environment logs
	@echo "Viewing production logs..."
	@az functionapp logs tail --name func-pcpc-prod --resource-group rg-pcpc-prod

status: ## Show project status
	@echo "PCPC Project Status"
	@echo "==================="
	@echo ""
	@echo "Node.js version: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "npm version: $$(npm --version 2>/dev/null || echo 'Not installed')"
	@echo "Terraform version: $$(terraform --version 2>/dev/null | head -n1 || echo 'Not installed')"
	@echo "Azure CLI version: $$(az --version 2>/dev/null | head -n1 || echo 'Not installed')"
	@echo "Functions Core Tools: $$(func --version 2>/dev/null || echo 'Not installed')"
	@echo ""
	@echo "Project structure:"
	@ls -la
