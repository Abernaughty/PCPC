#!/usr/bin/env bash
# Update pipelines/ado/variables/ci-images.yml with the current ACR digests for
# the CI toolchain images. Replaces the manual "download the ci-image-digests
# artifact and copy-paste it over the file" process (audit P3).
#
# Usage:
#   pipelines/ado/scripts/update-ci-image-digests.sh [--acr <name>] [--tag <tag>]
#
# Defaults: --acr maberdevcontainerregistry  --tag latest
# Requires: az CLI logged in with read access to the registry.
#
# The script only READS from ACR and writes the file locally — review the diff
# and commit it yourself.

set -euo pipefail

ACR_NAME="maberdevcontainerregistry"
TAG="latest"
ACR_SERVICE_CONNECTION="pcpc-acr-service-connection"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --acr) ACR_NAME="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Resolve the target file relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${SCRIPT_DIR}/../variables/ci-images.yml"

echo "ACR:    ${ACR_NAME}"
echo "Tag:    ${TAG}"
echo "Target: ${TARGET}"
echo

FQDN=$(az acr show -n "${ACR_NAME}" --query loginServer -o tsv)
if [[ -z "${FQDN}" ]]; then
  echo "Failed to resolve ACR login server for '${ACR_NAME}'." >&2
  exit 1
fi

get_digest() {
  local repo="$1"
  local digest
  digest=$(az acr repository show \
    --name "${ACR_NAME}" \
    --image "${repo}:${TAG}" \
    --query digest -o tsv 2>/dev/null || true)
  if [[ -z "${digest}" || "${digest}" == "null" ]]; then
    echo "Failed to resolve digest for ${repo}:${TAG} in ${ACR_NAME}." >&2
    exit 1
  fi
  printf '%s' "${digest}"
}

TF_DIGEST=$(get_digest pcpc-ci-terraform-azure)
NODE_DIGEST=$(get_digest pcpc-ci-node22)
NODE_AZURE_DIGEST=$(get_digest pcpc-ci-node-azure)

echo "pcpc-ci-terraform-azure  ${TF_DIGEST}"
echo "pcpc-ci-node22           ${NODE_DIGEST}"
echo "pcpc-ci-node-azure       ${NODE_AZURE_DIGEST}"
echo

cat > "${TARGET}" <<EOF
# CI Container Images Variables
# References to prebuilt CI container images stored in ACR.
#
# Digest-based (SHA256) references for immutability. Regenerate this file with:
#   pipelines/ado/scripts/update-ci-image-digests.sh [--acr <name>] [--tag <tag>]
# after rebuilding the images via azure-pipelines-ci-images.yml. Do not hand-edit
# the digests — re-run the script so they stay consistent with ACR.
#
# Image naming convention: <acr-fqdn>/<repository>@sha256:<digest>

variables:
  # Terraform image - infrastructure operations (Terraform, TFLint, Checkov, jq)
  CI_IMAGE_TERRAFORM: ${FQDN}/pcpc-ci-terraform-azure@${TF_DIGEST}
  # Node.js 22 image - JavaScript/TypeScript builds and validation
  CI_IMAGE_NODE22: ${FQDN}/pcpc-ci-node22@${NODE_DIGEST}
  # Node.js + Azure CLI image - builds and Azure deployments
  CI_IMAGE_NODE_AZURE: ${FQDN}/pcpc-ci-node-azure@${NODE_AZURE_DIGEST}
  ACR_SERVICE_CONNECTION: ${ACR_SERVICE_CONNECTION}
EOF

echo "✓ Wrote ${TARGET}"
echo "Review and commit:"
echo "  git diff -- ${TARGET}"
