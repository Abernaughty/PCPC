#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./infra/envs/generate-secrets-tfvars.sh <environment>

Creates or refreshes infra/envs/<environment>/secrets.auto.tfvars by pulling
secrets from the corresponding Key Vault.

Environments: dev, staging, prod

Prerequisites:
  - Azure CLI (az) installed and logged in
  - Access to the Key Vault (pcpc-kv-<environment>)

Example:
  az login
  ./infra/envs/generate-secrets-tfvars.sh dev
USAGE
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

environment="$1"
case "$environment" in
  dev|staging|prod) ;;
  *)
    echo "Error: environment must be one of dev, staging, prod" >&2
    usage
    exit 1
    ;;
esac

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) is not installed or not on PATH." >&2
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Error: not logged in to Azure. Run 'az login' first." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "${script_dir}/../.." && pwd)"
fi

target_dir="${repo_root}/infra/envs/${environment}"
mkdir -p "${target_dir}"

vault_name="pcpc-kv-${environment}"
tfvars_path="${target_dir}/secrets.auto.tfvars"

declare -A secrets=(
  ["POKEDATA_API_KEY"]="POKEDATA-API-KEY"
  ["POKEMON_TCG_API_KEY"]="POKEMON-TCG-API-KEY"
  ["ARM_CLIENT_ID"]="ARM-CLIENT-ID"
  ["ARM_CLIENT_SECRET"]="ARM-CLIENT-SECRET"
)

declare -A values

echo "Fetching secrets from Key Vault '${vault_name}'..."
for env_key in "${!secrets[@]}"; do
  secret_name="${secrets[$env_key]}"
  if ! secret_value="$(az keyvault secret show \
    --vault-name "${vault_name}" \
    --name "${secret_name}" \
    --query value \
    --output tsv 2>&1)"; then
    echo "Error: failed to read secret '${secret_name}' from '${vault_name}'." >&2
    echo "Azure CLI output:" >&2
    echo "${secret_value}" >&2
    exit 1
  fi

  if [[ -z "${secret_value}" ]]; then
    echo "Error: secret '${secret_name}' returned an empty value from '${vault_name}'." >&2
    echo "Make sure your account has 'Get' access to secrets in this Key Vault." >&2
    exit 1
  fi

  values["$env_key"]="$secret_value"
  echo "  ✓ ${env_key}"
done

cat >"${tfvars_path}" <<EOF
# Auto-generated secrets file - DO NOT COMMIT
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Environment: ${environment}

function_app_secrets = {
  "POKEDATA_API_KEY"    = "${values["POKEDATA_API_KEY"]}"
  "POKEMON_TCG_API_KEY" = "${values["POKEMON_TCG_API_KEY"]}"
  "ARM_CLIENT_ID"       = "${values["ARM_CLIENT_ID"]}"
  "ARM_CLIENT_SECRET"   = "${values["ARM_CLIENT_SECRET"]}"
}
EOF

chmod 600 "${tfvars_path}"

echo ""
echo "✓ secrets.auto.tfvars created at '${tfvars_path}'"
