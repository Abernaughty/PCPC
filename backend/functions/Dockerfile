# -----------------------------------------------------------------------------
# PCPC Functions — ACA container image
#
# Phase 2.2 (ACA path). Packages the SAME Functions code that Path B's
# Consumption-plan Function App runs (no app-level differences), inside the
# official Azure Functions Node.js 22 base image, for deployment to
# Azure Container Apps.
#
# Build context: backend/   (NOT backend/functions/)
# Dockerfile path: backend/functions/Dockerfile
#
# The context-root setting is required so the `file:../shared` reference in
# backend/functions/package.json (the @pcpc/shared workspace package) resolves
# during `npm ci`. Build command from the repo root:
#
#   docker build -f backend/functions/Dockerfile backend/
#
# The image is published to ACR as pcpc/functions:<tag>. See ADR-009 for the
# decision to keep CORS, secrets, and observability gateway-layer rather than
# baking environment-specific behavior into the image (the same image is
# deployed to dev/staging/prod with only env-var differences).
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Stage 1: build
#
# Installs all dependencies (including @pcpc/shared via the file:../shared
# reference) and runs `tsc` to emit dist/. The build stage is discarded in
# the final image so devDependencies and TypeScript sources never reach
# the runtime image.
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/azure-functions/node:4-node22 AS build

WORKDIR /build

# Copy the @pcpc/shared workspace first so the file:../shared dependency
# resolves when we run `npm ci` in the functions directory.
COPY shared/ ./shared/

# Copy lockfile + manifest only, install with `npm ci` to fetch deps using
# Docker layer caching: the deps layer is rebuilt only when package-lock.json
# changes, not when source files change.
COPY functions/package.json functions/package-lock.json ./functions/
WORKDIR /build/functions
RUN npm ci --no-audit --no-fund

# Now copy source and compile.
COPY functions/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: runtime
#
# Copies only the compiled output and a clean production-only node_modules
# tree onto the official Functions image. @pcpc/shared is a devDependency
# (types-only — interfaces erase at compile time, no runtime references),
# so `npm ci --omit=dev` correctly excludes it from the final image.
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    FUNCTIONS_WORKER_RUNTIME=node

WORKDIR /home/site/wwwroot

COPY --from=build /build/functions/dist ./dist
COPY --from=build /build/functions/host.json ./host.json
COPY --from=build /build/functions/package.json ./package.json
COPY --from=build /build/functions/package-lock.json ./package-lock.json

RUN npm ci --omit=dev --no-audit --no-fund

# No HEALTHCHECK directive here. ACA's `ingress.health_probes` block in the
# container-app Terraform module is the canonical liveness/readiness signal;
# adding HEALTHCHECK here would create a redundant probe surface that
# confuses debugging. See ADR-009 Implementation Notes for the rationale.

# No ENTRYPOINT / CMD either — the Functions base image's entrypoint
# (`/opt/startup/start_nonappservice.sh`) launches the Functions host with
# the right environment. Overriding it would require reimplementing host
# startup, which defeats the purpose of using the official base image.
