PCPC CI Containers

Overview
- Goal: Run CI jobs in pinned, prebuilt containers to eliminate tool drift, speed up pipelines, and improve supply‑chain security. Images are hosted in ACR and consumed by digest in Azure DevOps jobs.
- Scope:
  - Stage 1: Decisions and version matrix (complete)
  - Stage 2: Dockerfiles + ADO build template/pipeline to build/push and capture digests (complete)
  - Playwright container is intentionally omitted for now.

Registry & Auth
- Registry: maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io
- Access from ADO: Use an Azure Container Registry service connection (or OIDC in later stages). Pipelines will pull images from ACR only.

Images (initial set)
- pcpc-ci-terraform: Terraform toolchain for infra validation (Terraform, TFLint, Checkov, jq, bash).
- pcpc-ci-node22: Node 22 LTS toolchain for frontend/backend/APIM validation (Node/NPM, Git; Spectral CLI for OpenAPI).
- Note: Playwright/browser image is out of scope for now by request.

Version Pin Matrix (Stage 1 decisions)
- Terraform: 1.13.3 (aligns with current pipelines)
- Node: node:22-bullseye-slim (aligns with repo engines; exact digest will be used)
- Spectral CLI: 6.11.1 (matches .ado/templates/validate-apim.yml)
- TFLint: pin to an exact release (to be finalized in Stage 2 after build/test)
- Checkov: pin to an exact release (to be finalized in Stage 2 after build/test)

Tagging & Digests
- Build/push with semantic tags (e.g., :v1.0.0 and :latest), then capture the registry-reported digest.
- Consume images by digest in CI: <acr>/<repo>@sha256:<digest> to ensure immutability and reproducibility.

Naming Conventions
- Repositories: pcpc-ci-terraform, pcpc-ci-node22
- Tags: vMAJOR.MINOR.PATCH and latest (humans), but jobs use digests (machines).

Maintenance (high level)
- Monthly rebuilds with security scans and updated base images.
- Update digests in a single variables file consumed by templates.
- Optional: Sign images (Cosign) and verify signatures in CI.

Next Stages
- Stage 3: (Optional) Add image scanning/signing and publish signed attestations.
- Stage 4: Update validation templates to run inside container jobs using digests.

Artifacts added in Stage 2
- Dockerfiles:
  - .ci/images/terraform/Dockerfile
  - .ci/images/node22/Dockerfile
- ADO templates/pipeline:
  - .ado/templates/build-ci-images.yml
  - .ado/azure-pipelines-ci-images.yml
- Version pins updated: .ci/versions.yaml

How to use (Azure DevOps)
- Create a service connection to ACR named: pcpc-acr-service-connection
- Run the pipeline: .ado/azure-pipelines-ci-images.yml (manually)
- After completion, download artifact "ci-image-digests"; it includes:
  - image-manifest.json (names, tags, digests, full references)
  - ci-images-variables.yml (ready-to-include variables with digest references)

