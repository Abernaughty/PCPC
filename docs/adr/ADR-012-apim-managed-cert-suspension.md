# ADR-012: APIM Managed Cert Suspension — Defer Custom Hostnames

## Status

Accepted

Date: 2026-05-07

Supersedes: implementation choice in [ADR-008](./ADR-008-apim-vs-bff-gateway.md)
"Implementation Notes" — the original Phase 1B intent of using free
Azure-managed certs for `dev-api`/`staging-api`/`api.pcpc.maber.io` is
deferred per this ADR.

## Context

[Phase 1B](../PORTFOLIO_PLAN.md) shipped APIM custom-domain plumbing that
intended to bind `dev-api.pcpc.maber.io`, `staging-api.pcpc.maber.io`, and
`api.pcpc.maber.io` to each environment's APIM gateway with the **free
Azure-managed TLS certificate** option. The decision to use the managed
cert path resolved [Open Question #6 in the
plan](../PORTFOLIO_PLAN.md#open-questions).

After the Phase 1B + hotfix PRs merged, the dev CD pipeline failed at
`terraform apply` with:

```
Error: creating/updating Service ...: 400 Bad Request:
EncodedCertificateOrKeyVaultIdMustBeProvided:
EncodedCertificate or keyVaultId or freeCertificateKeyVaultId should be
provided to retrieve the custom SSL certificate for type: Proxy and
hostname : dev-api.pcpc.maber.io.
```

Investigation surfaced an active Azure breaking change:
**[Azure API Management — Managed certificates suspension for custom
domains (August
2025)](https://learn.microsoft.com/en-us/azure/api-management/breaking-changes/managed-certificates-suspension-august-2025).**
Microsoft has temporarily disabled creation of new free Azure-managed
certs for APIM custom domains from **August 15 2025 through June 30
2026** (one Microsoft Q&A source quotes a possible earlier resume date of
March 15 2026; neither has resumed as of today).

Cause: an industry-wide deprecation of CNAME-based Domain Control
Validation (DCV) is forcing DigiCert (the underlying CA) to migrate to a
new open-source DCV platform. Existing managed certs continue to
auto-renew (provided port 80 is reachable from DigiCert IPs), but **new
cert creation is blocked** for the duration.

Microsoft's documented workarounds during the suspension are limited to
customer-supplied certs:

- Provide an `EncodedCertificate` (PFX blob) directly to Terraform
- Reference a Key Vault secret containing the cert via `key_vault_id`
- Reference a Key Vault free-cert via `freeCertificateKeyVaultId`

None of these is the Azure-managed-cert path the original ADR-008
"Implementation Notes" assumed.

## Decision

**Defer custom hostname binding on APIM until Microsoft re-enables
managed cert creation.** Keep the IaC scaffolding in place; deactivate it
via empty per-env defaults; document the re-enable procedure.

Specifically:

1. The `gateway_hostnames` variable on
   `infra/modules/api-management` remains in the module — empty by
   default, validated, ready to accept hostname objects.
2. The per-env wrappers in `infra/envs/{dev,staging,prod}/variables.tf`
   set `apim_gateway_hostnames = []` until the suspension ends.
3. The dynamic `hostname_configuration` block in the module is skipped
   when the list is empty, so APIM provisions cleanly with its default
   `pcpc-apim-{env}.azure-api.net` hostname only.
4. The frontend's `BackendToggle` (Phase 1A) continues to work via the
   existing `path-b-azure.ts` fallback to
   `https://pcpc-apim-dev.azure-api.net/pcpc-api/v1` until custom
   hostnames are restored, after which the `PUBLIC_AZURE_API_BASE_URL`
   Vercel env var override starts pointing at the per-env custom
   hostname.
5. Cloudflare CNAMEs for `dev-api`, `staging-api`, and `api` are NOT
   added until immediately before re-enabling, to avoid stale DNS
   records resolving to nothing useful.

The other Phase 1B work — CORS retarget at `pcpc.maber.io`, `/health`
exposure through APIM, the cors_origins validator update — is unaffected
and proceeds to apply.

## Consequences

### Positive

- **Unblocks the dev CD pipeline today** without depending on a Microsoft
  service that's known-broken for the next ~2 months minimum.
- **Honest scoping.** The portfolio plan explicitly accepts deferring
  cosmetic work when the alternative is a 1–2 week scope expansion (Key
  Vault + Let's Encrypt automation) for what amounts to prettier URLs.
- **Zero rework risk on re-enable.** The IaC scaffolding (module
  variable, dynamic block, per-env wrapper, validators) is in place and
  tested. Restoring custom hostnames after the suspension is a
  one-variable flip per env plus the Cloudflare CNAMEs.
- **Senior-judgment portfolio signal.** "Microsoft suspended the thing,
  here's the ADR explaining the deferral and the re-enable runbook"
  reads as deliberate and competent. An engineer who built a Let's
  Encrypt automation around a 2-month outage would be over-engineering;
  one who didn't notice the outage would be careless.
- **Path B still works.** The `BackendToggle` doesn't need custom
  hostnames to demonstrate the architectural comparison — it works
  against the bare `pcpc-apim-dev.azure-api.net` gateway hostname today.

### Negative

- **`pcpc-apim-dev.azure-api.net/pcpc-api/v1` is uglier than
  `dev-api.pcpc.maber.io/pcpc-api/v1` in the BackendToggle popover and in
  any architecture-comparison screenshots. Cosmetic only; functional
  parity is unchanged.
- **One more thing to remember.** When the suspension lifts, restoring
  hostnames requires the runbook below to be followed in the right
  order (CNAME → variable flip → apply → Vercel env var update). The
  ADR itself is the runbook; risk of forgetting is low.
- **Phase 2 timing dependency.** If Phase 2 (ACA path) ships before the
  suspension lifts, ACA's custom hostname (`aca.pcpc.maber.io`) will
  hit the same constraint. ACA Container Apps uses a different cert
  story (managed certs through ACA itself, which is not affected by
  the APIM-specific suspension), so this should be safe — but worth
  re-verifying when Phase 2 starts.

## Alternatives Considered

### Option B — Build a Key Vault + Let's Encrypt automation

Provision Let's Encrypt certs via cert-manager / Posh-ACME / a Function
App with an ACME client. Store in Key Vault. Reference from APIM via
`key_vault_id` on the hostname proxy block. Wire auto-renewal.

- **Pros:** Custom hostnames work immediately. Demonstrates significant
  cert-lifecycle automation, which is a portfolio-positive skill in its
  own right.
- **Cons:** 1–2 weeks of engineering work (ACME client, Key Vault wiring,
  renewal automation, secret rotation, monitoring). Scope explosion for
  what's ultimately a cosmetic URL improvement during a temporary
  Microsoft outage.
- **Reason for rejection:** The cost-benefit is poor for a one-developer
  portfolio with a 2-month suspension window. If the suspension extended
  past 6 months, Option B would become more attractive. If it
  becomes permanent, this ADR is superseded by ADR-013 (TBD) describing
  the Key Vault automation.

### Option C — Cloudflare proxied (orange cloud) on the APIM CNAMEs

Reverse the previously-recommended DNS-only setup. Use Cloudflare's
Universal SSL to terminate TLS at the edge with Cloudflare's cert; do
not bind any hostname on APIM. Cloudflare proxies HTTPS requests to
APIM's bare `*.azure-api.net` URL, possibly with Host-header rewriting
(Page Rules / Transform Rules).

- **Pros:** Works today without Azure cert provisioning at all.
- **Cons:** Adds Cloudflare into the request path (previously rejected
  in the Phase 1B planning conversation for reasons that mostly still
  hold — Cloudflare features are duplicative with APIM's own gateway
  policies). Requires Cloudflare Page Rules to rewrite the Host header
  so APIM accepts the request, which is config that lives outside
  Terraform. The TLS chain visitors see is Cloudflare's, not Azure's,
  which obscures the "APIM is the gateway" portfolio story.
- **Reason for rejection:** Adds a hop with operational + narrative cost
  to solve a problem that deferral solves with zero ongoing complexity.

### Option D — Wait

Don't ship Phase 1B at all until Microsoft re-enables managed certs.

- **Pros:** Zero ADR debt; the original plan executes cleanly when MSFT
  unblocks.
- **Cons:** Loses the CORS + `/health` exposure work that's already
  written, validated, and merged. The BackendToggle's healthcheck on
  Path B doesn't work without `/health` being exposed through APIM.
- **Reason for rejection:** Phase 1B's *other* work has independent
  value and ships fine. Holding everything for one cosmetic component
  is poor batching.

## Implementation Notes

This ADR documents the deferral; the actual implementation lives in:

- `infra/envs/{dev,staging,prod}/variables.tf` — per-env
  `apim_gateway_hostnames` defaults set to `[]` with descriptions
  explaining the post-suspension restoration values.
- `infra/modules/api-management/variables.tf` — module variable
  description updated to call out the suspension.
- `infra/modules/api-management/main.tf` — module `hostname_configuration`
  block comment updated to reflect deferred state.

### Re-enable runbook (post-suspension)

When Microsoft confirms managed cert creation has resumed (check
[the breaking-change page](https://learn.microsoft.com/en-us/azure/api-management/breaking-changes/managed-certificates-suspension-august-2025)
for status):

1. **Add Cloudflare CNAMEs** (DNS-only, gray cloud — see ADR-008
   discussion for why proxied is wrong here):
   - `dev-api.pcpc.maber.io` → `pcpc-apim-dev.azure-api.net`
   - `staging-api.pcpc.maber.io` → `pcpc-apim-staging.azure-api.net`
   - `api.pcpc.maber.io` → `pcpc-apim-prod.azure-api.net`
2. **Restore the per-env defaults** in
   `infra/envs/{dev,staging,prod}/variables.tf`:
   ```
   default = [
     { host_name = "<env>-api.pcpc.maber.io", default_ssl_binding = true }
   ]
   ```
   (For prod the hostname is `api.pcpc.maber.io` without the env
   prefix.)
3. **Open a PR** with the variable flip and merge it.
4. **Watch the dev CD pipeline** — `terraform apply` should succeed and
   provision the Azure-managed cert via DNS validation against the
   CNAME from step 1.
5. **Manually approve the staging and prod CD stages** in ADO once dev
   is green.
6. **Set `PUBLIC_AZURE_API_BASE_URL`** in Vercel project settings:
   - Production scope → `https://api.pcpc.maber.io`
   - Preview scope → `https://dev-api.pcpc.maber.io`
   - Development scope → `https://dev-api.pcpc.maber.io`
7. **Trigger a Vercel redeploy** so the new env vars get baked into the
   frontend bundle.
8. **Verify** the BackendToggle's Path B option resolves to the new
   hostname with healthy status across all three Vercel scopes.

## Related Decisions

- [ADR-007: API Architecture Spectrum (three paths)](./ADR-007-api-architecture-spectrum.md)
- [ADR-008: APIM vs SvelteKit BFF as Gateway](./ADR-008-apim-vs-bff-gateway.md) — Implementation Notes on cert source partially superseded by this ADR
- [ADR-011: Deployment Topology and Testing Model](./ADR-011-deployment-topology-and-testing-model.md)
- ADR-013 (hypothetical, would supersede this one): Key Vault + Let's Encrypt automation, IF the suspension extends past mid-2026 or becomes permanent
