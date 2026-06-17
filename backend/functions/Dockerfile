# -----------------------------------------------------------------------------
# PCPC Functions — ACA container image
#
# Phase 2.2 (ACA path). Packages the SAME Functions code that Path B's
# Consumption-plan Function App runs (no app-level differences), inside the
# official Azure Functions Node.js 22 base image, for deployment to
# Azure Container Apps.
#
# Build context: a pre-built deploy folder produced by
#   pnpm --filter pcpc-backend deploy --prod --legacy --config.node-linker=hoisted <dir>
# (see pipelines/ado/templates/build-and-push-image.yml). That folder is
# self-contained — dist/ + host.json + package.json + a flat PRODUCTION
# node_modules (devDependencies, incl. the type-only @pcpc/shared, are omitted
# by --prod). So this image just copies it; there is no npm/pnpm install or
# TypeScript build inside Docker. Build command (from repo root):
#
#   pnpm --filter pcpc-backend deploy --prod --legacy --config.node-linker=hoisted .deploy
#   docker build -f backend/functions/Dockerfile .deploy
#
# The image is published to ACR as pcpc/functions:<tag>. See ADR-009 for the
# decision to keep CORS, secrets, and observability gateway-layer rather than
# baking environment-specific behavior into the image (the same image is
# deployed to dev/staging/prod with only env-var differences).
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/azure-functions/node:4-node22

# Pull Debian-patched OS packages. The upstream Functions base image rebuilds
# lag CVE patches by days-to-weeks; without this layer the Trivy CVE scan in
# build-and-push-image.yml blocks on any HIGH CVE patched in Debian since the
# base was last rebuilt (e.g. CVE-2026-27135 in libnghttp2-14).
RUN apt-get update && \
    apt-get upgrade -y --no-install-recommends && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    FUNCTIONS_WORKER_RUNTIME=node

WORKDIR /home/site/wwwroot

# The build context IS the pnpm-deploy output: dist/, host.json, package.json,
# and a flat production node_modules. Copy it verbatim.
COPY . ./

# No HEALTHCHECK directive here. ACA's `ingress.health_probes` block in the
# container-app Terraform module is the canonical liveness/readiness signal;
# adding HEALTHCHECK here would create a redundant probe surface that
# confuses debugging. See ADR-009 Implementation Notes for the rationale.
#
# No ENTRYPOINT / CMD either — the Functions base image's entrypoint
# (`/opt/startup/start_nonappservice.sh`) launches the Functions host with
# the right environment. Overriding it would require reimplementing host
# startup, which defeats the purpose of using the official base image.
