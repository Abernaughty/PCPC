# PCPC Documentation Index

Documentation for the Pokemon Card Price Checker (PCPC) — architecture, development, deployment, and operations.

## Getting Started

- [Main Project README](../README.md) — project overview and quick start
- [Development Guide](./development-guide.md) — developer setup and workflow
- [Local Development](./LOCAL_DEVELOPMENT.md) — running the stack locally
- [Architecture Overview](./architecture.md) — system architecture and design patterns
- [Architecture Comparison](./architecture-comparison.md) — the three deployment paths (Vercel BFF, APIM + Functions, ACA container) compared on real tradeoffs

## Architecture Decision Records

The reasoning behind PCPC's technical choices lives in [`docs/adr/`](./adr/). Highlights:

- [ADR-007](./adr/ADR-007-api-architecture-spectrum.md) — API architecture spectrum (why three deployment paths exist)
- [ADR-008](./adr/ADR-008-apim-vs-bff-gateway.md) — APIM vs SvelteKit BFF as gateway
- [ADR-009](./adr/ADR-009-functions-consumption-vs-container-apps.md) — Functions Consumption vs Container Apps
- [ADR-011](./adr/ADR-011-deployment-topology-and-testing-model.md) — deployment topology and testing model
- [ADR-012](./adr/ADR-012-apim-managed-cert-suspension.md) — APIM managed-certificate suspension (incident-driven)
- [ADR-013](./adr/ADR-013-cors-regex-policy.md) — CORS regex policy

See the [ADR index](./adr/README.md) for the full list, including earlier infrastructure decisions (package manager, devcontainer ACR optimization).

## Development

- [API Reference](./api-reference.md) — API documentation with examples
- [Performance Guide](./performance.md) — performance considerations and monitoring
- [Security Guide](./security.md) — security model and planned enhancements
- [Frontend Theming & Style Guide](./frontend-theming-style-guide.md)

## Operations

- [Deployment Guide](./deployment-guide.md) — infrastructure and application deployment
- [Troubleshooting Guide](./troubleshooting.md) — problem diagnosis and resolution
- [Monitoring Documentation](./monitoring.md) — observability and alerting

## Reference

- [DevContainer Optimization](./README-devcontainer-optimization.md) — how container startup went from minutes to seconds
- [DevContainer ACR Workflow](./development/devcontainer-acr-workflow.md) — image build and publish workflow
- Topic notes: [APIM product state migration](./apim-product-state-migration.md), [Key Vault naming](./azure-key-vault-naming-transformation.md), [Function App settings drift](./function-app-app-settings-drift.md), [set-mapping pipeline integration](./set-mapping-pipeline-integration.md), [set-mapping fixes](./set-mapping-fixes-summary.md)

## Highlights

- **Three-path architecture**: one frontend, three interchangeable backends (Vercel BFF, APIM + Functions, Azure Container Apps), switchable at runtime via `?backend=`.
- **DevContainer performance**: pre-built ACR images cut environment startup from 5–10 minutes to under a minute, with Azurite and the Cosmos DB emulator orchestrated alongside.
- **Infrastructure as Code**: Terraform modules with per-environment overlays (`infra/envs/{dev,staging,prod}`), plus APIM-as-code with policies and OpenAPI specs.
- **Observability**: metrics, logs, and traces via Application Insights and Log Analytics.
- **Caching**: multi-tier strategy spanning IndexedDB on the client, Redis, and API Management response caching.

## Conventions

Docs use Mermaid diagrams for architecture and workflows, and tables for structured comparisons. Internal links are relative so they work on GitHub and locally. If you find an inaccuracy, open a GitHub issue or PR.
