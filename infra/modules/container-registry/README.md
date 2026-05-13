# container-registry

Terraform module that provisions a PCPC-owned Azure Container Registry. Added in the Phase 2.2 polish PR.

## Why PCPC owns its own ACR

Phase 2.2's first dev CD apply consumed a shared registry (`maberdevcontainerregistry`) in a different resource group than PCPC's own resources. The ADO service principal had Contributor on `pcpc-rg-dev` but no `Microsoft.Authorization/roleAssignments/write` on the shared registry's RG — so the `AcrPull` role assignment for the Container App's UAMI failed with a 403.

The first instinct was to widen the SP's permissions (User Access Administrator scoped to the shared registry). That works but encodes a wrong ownership boundary: an *application* stack with role-write rights on *platform* infrastructure it doesn't own.

The chosen reframe (this module) is the opposite: bring the ACR into PCPC's stack. PCPC's Terraform owns the registry; the SP applying PCPC's Terraform already has rights on the RG; AcrPull/AcrPush role assignments against the new registry work without any cross-RG grants. The narrative becomes "PCPC owns its whole stack" rather than "PCPC consumes shared infra with special grants."

The shared `maberdevcontainerregistry` continues to serve CI tooling images (Terraform / Node / node-azure base images for the pipeline) for now. A separate follow-up PR migrates those into the PCPC ACR.

See [ADR-009 — Functions Consumption vs Container Apps](../../../docs/adr/ADR-009-functions-consumption-vs-container-apps.md) for the broader Path C context.

## What this module composes

| Resource | Notes |
|---|---|
| `azurerm_container_registry` | Single registry. `admin_enabled = false` (managed identity is the auth pattern). `public_network_access_enabled = true` (portfolio default; flip + Premium SKU for private endpoints). |

That's it. Role assignments (`AcrPull` for consuming UAMIs, `AcrPush` for the ADO SP) live in the *consumers'* Terraform, where they belong — the role-assignment resource's scope is this ACR's ID, but the principal is owned by the consumer. The container-app module already follows this pattern.

## Inputs

See [`variables.tf`](./variables.tf) for the full descriptions. The non-obvious ones:

- **`name`** — globally unique, alphanumeric only (no hyphens). Azure rejects hyphens, dots, and underscores in ACR names. The dev env uses `pcpcacr${local.environment}${random_string.suffix.result}` to satisfy uniqueness.
- **`sku`** — `Basic` is the default and is sufficient for portfolio use (10 GiB storage, no geo-replication). Upgrade to `Premium` if you need private endpoints, content trust, or geo-replication.
- **`admin_enabled`** — `false` by default. The admin user is a single shared credential with full push/pull rights and Microsoft's own docs advise against it for production. AcrPull/AcrPush + managed identity is the canonical pattern.

## Outputs

| Output | Used by |
|---|---|
| `id` | Caller's `azurerm_role_assignment` resources (AcrPull for UAMIs, AcrPush for the ADO SP) and the container-app module's `acr_id` input. |
| `login_server` | The container-app module's `acr_login_server` input; the ADO pipeline's image-push commands. |
| `name`, `resource_group_name` | Pipeline `az acr login --name <name>` invocations and Terraform output for downstream env states. |

## Cross-env consumption

Only one env (currently dev) owns the registry. Staging and prod consume it via `data "azurerm_container_registry"` against the owning env. Pattern:

```hcl
data "azurerm_container_registry" "app_images" {
  name                = "pcpcacrdev<suffix>"   # from dev's terraform output
  resource_group_name = "pcpc-rg-dev"
}
```

That `data` block is what staging/prod use; this module is what dev uses.

## Why not per-env registries

Three registries (one per env) costs 3× the storage tier minimum (~$15/mo Basic vs ~$5/mo for one) and gains nothing for a portfolio. Image tags carry the env discriminator (`pcpc/functions:git-<sha>` is the same image regardless of which env pulls it). One shared registry is the simpler shape.

## Why not in a separate "shared" resource group

Putting the registry in a dedicated `pcpc-rg-shared` RG would be cleaner if PCPC had multiple workloads sharing it. For one workload (PCPC itself) the extra RG is overhead without benefit. The registry lives in `pcpc-rg-dev` and that's fine.
