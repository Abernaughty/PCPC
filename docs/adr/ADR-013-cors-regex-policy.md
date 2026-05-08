# ADR-013: CORS Regex-Based Origin Allowlist Policy

## Status

Accepted

Date: 2026-05-07

Supersedes: row 31 of [ADR-011](./ADR-011-deployment-topology-and-testing-model.md)
("APIM CORS (Phase 1B) | dev = `*`") and the Phase 1B intent in PR #132's
`base_cors_origins = ["*"]`.

## Context

[Phase 1B](../PORTFOLIO_PLAN.md) configured CORS on the dev APIM as `*` so
Vercel per-PR preview URLs (`https://pcpc-git-{branch-slug}-abernaughtys-projects.vercel.app`)
could exercise the BackendToggle's Path B healthcheck. Staging and prod
were locked to `https://pcpc.maber.io`.

The `*` choice was motivated by an APIM constraint Microsoft documents:
the built-in `<cors>` policy element accepts only literal `*` or exact
HTTP/HTTPS URLs in `<allowed-origins>`. Wildcard subdomains
(e.g. `https://*.vercel.app`) are not supported. With per-PR Vercel
preview URLs being inherently ephemeral, an explicit allowlist of literal
URLs would either need maintenance per PR or settle for `*`.

This ADR was prompted by an internal architecture review of the dev `*`
choice. Three alternatives were evaluated:

- **Adopt a `preview` branch workflow** (assign a stable Vercel custom
  domain to a long-lived branch, e.g. `preview.pcpc.maber.io`) — rejected
  for adding workflow ceremony in a one-developer project for marginal
  gain. (Vercel's "All Branches" UI option for custom domains does not
  actually save without a specific branch selected.)
- **Lock to literal stable URLs only** (`https://pcpc.maber.io` plus
  Vercel's auto-generated stable production aliases) — defensible but
  loses per-PR browser-level testing of Path B for no real benefit over
  the option below.
- **Accept `*` permanently** — defensible for read-only public Pokémon
  pricing data with no auth or cookies, but reads as careless in a
  portfolio review.

A fourth option — a custom regex-based policy using APIM's
`<choose>/<when>` constructs to match the Origin header against an
assembled regex — turned out to be the right answer. It eliminates the
APIM constraint that motivated `*`, supports Vercel per-PR previews
without per-PR maintenance, and keeps a tight allowlist in code.

## Decision

**Replace the built-in `<cors>` policy element with a regex-based custom
policy.** The allowed-origins are expressed as glob-style hostname
patterns in Terraform (`cors_origin_patterns` variable); a `locals` block
in `apim/terraform/main.tf` assembles them into a single regex applied by
the policy template.

### Mechanism

Terraform per-env wrappers set `base_cors_origin_patterns`:

| Env | Patterns |
|---|---|
| dev | `pcpc.maber.io`, `pcpc-git-*-abernaughtys-projects.vercel.app`, `pcpc-*-abernaughtys-projects.vercel.app` |
| staging | `pcpc.maber.io` |
| prod | `pcpc.maber.io` |

The `apim/terraform/main.tf` `locals` block converts patterns to regex by:
1. Escaping literal `.` (so regex sees `\.`)
2. Replacing glob `*` with `[a-z0-9-]+` (one or more hostname-safe chars)
3. Anchoring each alternative INDIVIDUALLY with `^https://...$` and joining
   with `|`

Example dev regex (assembled at `terraform plan` time):

```
^https://pcpc\.maber\.io$|^https://pcpc-git-[a-z0-9-]+-abernaughtys-projects\.vercel\.app$|^https://pcpc-[a-z0-9-]+-abernaughtys-projects\.vercel\.app$
```

> **Why per-alternative anchoring instead of a single grouped `(...)`?**
> APIM's policy expression parser does not respect C# verbatim string
> boundaries — it naively counts `(` and `)` inside a `@"..."` regex
> literal as code parens. A regex like `^https://(a|b|c)$` therefore
> orphans the `IsMatch(` call in the surrounding C# code, producing a
> `ValidationError: An opening "(" is missing the corresponding closing ")"`
> 400 at deploy time. Anchoring each alternative individually produces an
> equivalent regex with zero parens, sidestepping the parser quirk.

The regex is interpolated into `apim/policies/templates/global-policy.xml.tpl`,
which uses APIM's policy expressions to:

- Read the request's `Origin` header into a context variable
- Test the regex once and store the boolean result in another context
  variable
- For OPTIONS preflight requests: return 204 + CORS headers if allowed,
  403 if not — short-circuiting before rate-limit
- For non-preflight requests: pass through to backend, then add CORS
  headers in the outbound stage if origin matched

### Validation

The `cors_origin_patterns` variable validation:
- Rejects standalone `*` (the `*` shorthand for "any origin" is no longer
  supported; this is intentional per this ADR)
- Restricts characters to lowercase alphanumerics, `.`, `-`, `*` —
  preventing accidental injection of regex metacharacters that would
  silently widen the allowlist

## Consequences

### Positive

- **Tight allowlist with zero per-PR maintenance.** Vercel preview URLs
  for any new branch automatically match the existing pattern; no code
  change per PR.
- **Uniform policy mechanism across envs.** dev/staging/prod use the
  same template; only the input data differs. Reading any env's policy
  XML, a reviewer sees the same `<choose>/<when>` shape — easier to
  audit than envs that use different policy mechanisms.
- **Stronger portfolio signal.** A regex-based allowlist with a clean
  Terraform interface (pattern list → assembled regex via `locals`)
  reads as "engineer who knows APIM policy XML beyond the cookbook" to
  enterprise reviewers, and "engineer who solved the actual UX problem"
  to startup reviewers.
- **Echo-back semantics, not wildcard.** The policy echoes the matched
  Origin in `Access-Control-Allow-Origin` rather than `*`, which is
  both more correct (browsers reject `*` for credentialed requests) and
  enables future use of `Vary: Origin` for cache correctness — both
  already configured in the policy.
- **Hard rejection of disallowed preflight requests.** Returning 403 on
  unmatched origins (rather than passing through and relying on the
  browser to enforce CORS) provides defense-in-depth.

### Negative

- **More complex policy XML.** ~70 lines vs the prior ~30. Mitigated by
  comments in both the template and ADR-013, plus the fact that the
  policy is read-once-then-trusted: reviewers don't need to re-parse it
  on every PR.
- **Regex injection risk** if the pattern list ever accepted untrusted
  input. Mitigated by the strict validation regex
  (`^[a-z0-9.*-]+$`) — any other character is rejected at `terraform
  plan` time.
- **`<cors>` element's automatic preflight handling is replaced by
  manual XML.** If APIM ever changes how `<cors>` handles edge cases
  (e.g. malformed Origin headers), this policy won't get those changes
  for free. Acceptable cost; the manual implementation is small enough
  to audit.
- **The `*` escape hatch is gone.** If a future use case genuinely
  needs `Access-Control-Allow-Origin: *` (e.g. embedding the API in a
  truly cross-origin context), this policy will need to be modified.
  No such use case exists today.

## Alternatives Considered

### Option A — `preview` branch + stable Vercel custom domain

Create a long-lived `preview` branch (or `develop`). Assign
`preview.pcpc.maber.io` to it as a Vercel custom domain. PRs target
`preview` first; the latest commit on `preview` is always live at
`preview.pcpc.maber.io`. CORS list: `pcpc.maber.io`, `preview.pcpc.maber.io`.

- **Pros:** Truly stable preview URL. Tight CORS without regex.
- **Cons:** Adds workflow ceremony (extra branch, extra merge step per
  PR) for marginal gain in a one-developer project. ADR-011 already
  rejected per-env Vercel deployments for this same reason.
- **Reason for rejection:** Not worth the workflow tax for a solo workflow.

### Option B — Lock to literal stable URLs only

`https://pcpc.maber.io`, `https://pcpc.vercel.app`,
`https://pcpc-abernaughtys-projects.vercel.app`. Per-PR Vercel preview
URLs are CORS-blocked; browser-level Path B testing on previews is
unavailable. Use curl/Postman during PR work.

- **Pros:** Tight CORS without any policy complexity (uses APIM's
  built-in `<cors>` element).
- **Cons:** Loses per-PR browser-level testing of Path B. Mostly
  acceptable for solo workflow but loses an ability we can have for free.
- **Reason for rejection:** This decision was the original
  recommendation from the implementer. An internal architecture review
  pushed back: Option D (this ADR) gets the same security tightness AND
  the per-PR functionality, at the cost of more policy XML. The
  XML-complexity cost is one-time-read, not per-PR.

### Option C — `*` for dev (status quo before this ADR)

- **Pros:** Zero complexity; works with all current and future Vercel
  preview URLs without code change.
- **Cons:** Reads as careless in a portfolio review. The "read-only
  public data, who cares" justification is technically true but invites
  the "did you think about this?" question rather than answering it.
- **Reason for rejection:** Portfolio narrative cost; no functional
  benefit over the regex policy.

### Option E — Cloudflare proxy + Cloudflare-side CORS

Front APIM with Cloudflare Workers and handle CORS in the worker.

- **Pros:** Cloudflare's HTTP framework supports wildcard origins
  natively.
- **Cons:** Adds Cloudflare into the request path, which ADR-012 already
  rejected for similar reasons; obscures the APIM-as-gateway portfolio
  story.
- **Reason for rejection:** Solves a problem this ADR's chosen approach
  also solves, with worse architectural-narrative properties.

## Implementation Notes

### Files modified

- `apim/terraform/variables.tf` — `cors_origins` (list of URLs) →
  `cors_origin_patterns` (list of glob patterns); validator restricts
  characters and rejects standalone `*`
- `apim/terraform/main.tf` — adds `cors_origin_regex` local that
  assembles the regex from patterns; threads it through `policy_vars`
- `apim/terraform/outputs.tf` — exposes `cors_origin_patterns` (input)
  and `cors_origin_regex` (assembled) for debugging and audit
- `apim/policies/templates/global-policy.xml.tpl` — replaces `<cors>`
  with `<choose>/<when>` regex policy; includes preflight handler with
  hard 403 rejection of unmatched origins
- `apim/environments/{dev,staging,prod}/variables.tf` — renames
  `cors_origins` and `additional_cors_origins` to
  `cors_origin_patterns` and `additional_cors_origin_patterns`
- `apim/environments/{dev,staging,prod}/main.tf` — sets per-env
  `base_cors_origin_patterns` defaults; renames internal locals
- `pipelines/ado/templates/deploy-apim.yml` — writes
  `cors_origin_patterns` JSON key in the pipeline-generated tfvars file
  instead of `cors_origins`; ADO variable name `APIM_CORS_ORIGINS` is
  preserved so the variable group entry doesn't need recreation, but
  its value semantics change (URLs → patterns)

### Manual ADO variable group update required

The ADO variable group `vg-pcpc-{env}-config` entry `APIM_CORS_ORIGINS`
was previously a list of HTTP/HTTPS URLs. After this PR merges, update
each env's variable group as follows (or leave empty to use code defaults):

| Env | New `APIM_CORS_ORIGINS` value |
|---|---|
| dev | `pcpc.maber.io,pcpc-git-*-abernaughtys-projects.vercel.app,pcpc-*-abernaughtys-projects.vercel.app` (or leave empty) |
| staging | `pcpc.maber.io` (or leave empty) |
| prod | `pcpc.maber.io` (or leave empty) |

If left empty, the per-env code defaults (in
`apim/environments/{env}/main.tf`) take effect.

### Testing the policy after deploy

```
# Allowed origin should get a 204 + CORS headers on preflight
curl -i -X OPTIONS https://pcpc-apim-dev.azure-api.net/pcpc-api/v1/sets \
  -H "Origin: https://pcpc.maber.io" \
  -H "Access-Control-Request-Method: GET"
# → 204 No Content, Access-Control-Allow-Origin: https://pcpc.maber.io

# Vercel preview URL should also pass
curl -i -X OPTIONS https://pcpc-apim-dev.azure-api.net/pcpc-api/v1/sets \
  -H "Origin: https://pcpc-git-foo-abernaughtys-projects.vercel.app" \
  -H "Access-Control-Request-Method: GET"
# → 204 No Content, Access-Control-Allow-Origin: https://pcpc-git-foo-abernaughtys-projects.vercel.app

# Disallowed origin should get a 403
curl -i -X OPTIONS https://pcpc-apim-dev.azure-api.net/pcpc-api/v1/sets \
  -H "Origin: https://malicious.example.com" \
  -H "Access-Control-Request-Method: GET"
# → 403 Origin not allowed by CORS policy

# GET on actual endpoint with allowed origin should include CORS headers in response
curl -i https://pcpc-apim-dev.azure-api.net/pcpc-api/v1/sets \
  -H "Origin: https://pcpc.maber.io"
# → 200 with Access-Control-Allow-Origin: https://pcpc.maber.io
```

## Related Decisions

- [ADR-007: API Architecture Spectrum](./ADR-007-api-architecture-spectrum.md)
- [ADR-008: APIM vs SvelteKit BFF as Gateway](./ADR-008-apim-vs-bff-gateway.md)
- [ADR-011: Deployment Topology and Testing Model](./ADR-011-deployment-topology-and-testing-model.md) — row 31 superseded
- [ADR-012: APIM Managed Cert Suspension](./ADR-012-apim-managed-cert-suspension.md)
