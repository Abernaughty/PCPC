# PCPC Infrastructure

Terraform infrastructure-as-code for the Pokémon Card Price Checker (PCPC) application, deployed on Microsoft Azure.

## Overview

The infrastructure is organized into reusable modules and environment-specific configurations. All Azure resources are managed via Terraform with state stored in Azure Blob Storage.

## Structure

```
infra/
├── modules/                    # Reusable Terraform modules
│   ├── api-management/        # Azure API Management
│   ├── container-app/         # Azure Container Apps (Path C)
│   ├── container-registry/    # Azure Container Registry
│   ├── cosmos-db/             # Cosmos DB (serverless NoSQL)
│   ├── function-app/          # Azure Functions (Path B)
│   └── storage-account/       # Azure Blob Storage
└── envs/                      # Environment-specific configurations
    ├── dev/                   # Development environment
    ├── staging/               # Staging environment (planned)
    └── prod/                  # Production environment (planned)
```

## Azure Resources

| Resource | Purpose |
|---|---|
| Azure Functions (Node.js 22) | Serverless backend API (Path B) |
| Azure Container Apps + Container Registry | Containerized backend API (Path C) |
| Azure API Management | API gateway, rate limiting, caching |
| Cosmos DB (Serverless) | NoSQL document storage for card/price data |
| Azure Blob Storage | Function App content, state storage |

> Frontend is hosted on Vercel (see `frontend/`); the prior Azure Static Web Apps + Porkbun DNS provisioning was removed on 2026-05-14.

## Usage

See the [Deployment Guide](../docs/deployment-guide.md) for full setup and deployment instructions.

```bash
# Initialize for a specific environment
cd infra/envs/dev
terraform init

# Plan changes
terraform plan -var-file="terraform.tfvars"

# Apply changes
terraform apply -var-file="terraform.tfvars"
```

## Prerequisites

- Terraform >= 1.13.3
- Azure CLI (authenticated)
- Azure subscription with required permissions
- State storage backend configured (see `state-storage/` in the deployment guide)
