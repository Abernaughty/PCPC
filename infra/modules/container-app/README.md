# container-app

Terraform module that deploys the PCPC Functions image to Azure Container
Apps (Path C of the three-path portfolio architecture). Added in Phase 2.2.

See [`docs/adr/ADR-009-functions-consumption-vs-container-apps.md`](../../../docs/adr/ADR-009-functions-consumption-vs-container-apps.md)
for the runtime tradeoff between Path B (Functions on Consumption) and
Path C (Functions in container on ACA).

## What this module composes

| Resource | Purpose |
|---|---|
| `azurerm_user_assigned_identity` | ACR pull identity. **First UAMI in the PCPC repo** — the sibling `function-app` module uses SystemAssigned; ACR pull is the production-correct UAMI use case. |
| `azurerm_role_assignment` | Grants the UAMI `AcrPull` on the caller-supplied ACR. |
| `azurerm_container_app_environment` | Container Apps Environment. Consumes the caller-supplied Log Analytics workspace so Path B and Path C traces land in the same workspace. |
| `azurerm_container_app` | The application itself. Single revision mode, HTTP scale rule, ingress CORS configured, secret/env wiring identical to Path B's Function App app_settings. |

## Inputs

See [`variables.tf`](./variables.tf) for the canonical descriptions; the
non-obvious ones:

- **`acr_id` / `acr_login_server`** — passed in, not provisioned. PCPC reuses
  the shared `maberdevcontainerregistry` registry (login server
  `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`) for both CI
  tooling images and the application image. Per-env ACRs were not added.
  The hyphenated suffix is Azure's dedicated-data-endpoint convention on
  the FQDN, not part of the registry's `name` property.
- **`log_analytics_workspace_id`** — pass `module.log_analytics.id` from
  the dev env so Path B (App Insights → this workspace) and Path C share
  the workspace.
- **`min_replicas` (default `1`)** — keeps the frontend's 2-second
  `probeHealth` timeout from falsely degrading Path C after idle periods.
  Resolved as PORTFOLIO_PLAN open question #7. `min=0` is supported (the
  variable validation allows it) but the toggle will hide Path C after
  every idle window unless the probe timeout is also raised.
- **`cors_allowed_origins`** — Path C bypasses APIM, so this is the only
  CORS allowlist gate. Keep in sync with the APIM regex policy
  (see ADR-013) — both should be driven from the `APIM_CORS_ORIGINS`
  variable group entry.
- **`app_settings` / `secret_settings`** — pass the Scrydex creds,
  Cosmos connection string, and App Insights connection string the same
  way the function-app module receives them. The module performs the
  same hyphen-to-underscore transform as `function-app` so callers can
  pass either form. `secret_settings` materialize as Container App
  `secret` blocks referenced from env via `secret_name` — values never
  appear in `az containerapp env` dumps or revision describes.

## Container image tag handling

`image_tag` is the **baseline** the resource records at `terraform apply`
time. The ADO pipeline (`pipelines/ado/templates/deploy-aca.yml`) runs
`az containerapp update --image <new_sha>` post-Terraform-apply to roll
new revisions. The module's `lifecycle.ignore_changes` block ignores
`template[0].container[0].image` to prevent Terraform from flapping the
image back to the baseline on every CD run.

This split — **Terraform owns the resource shape, the pipeline owns the
image tag** — mirrors how Path B handles its `DEPLOY_PACKAGE_HASH`
app-setting (also pipeline-managed, also ignored by Terraform).

## Outputs

| Output | Used by |
|---|---|
| `ingress_fqdn` | Vercel env var `PUBLIC_ACA_API_BASE_URL` (see PR-3 of Phase 2.2) |
| `id`, `name` | Pipeline `az containerapp update` calls |
| `principal_id` | If a caller later grants the UAMI extra roles (e.g. Cosmos data reader) |

## Why no HEALTHCHECK in the Dockerfile

Health probes are configured on the ACA ingress itself (revision-level
liveness, readiness, startup probes). Adding a Dockerfile `HEALTHCHECK`
would create a redundant probe surface that complicates debugging.
ACA's signal is canonical.

## Why no APIM in front

Path C is the "skip the gateway, see what the runtime alone gives you"
demonstration. Routing through APIM would blur the architectural
comparison the portfolio is designed to expose. CORS, secrets, and
observability parity with Path B are configured at the ACA ingress and
in app_settings — same code runs in both envelopes; only the gateway
differs. See ADR-009 Implementation Notes for the rationale.
