#!/usr/bin/env bash

# resolve_apim_master_key fetches and exports the APIM subscription key.
# It returns success when the key is resolved or when no APIM name is provided,
# and returns non-zero if it cannot determine the subscription id or key.
resolve_apim_master_key() {
  local apim_name="${1:-}"
  local resource_group="${2:-}"
  local apim_subscription="${3:-master}"
  local az_cli="${AZ_CLI_BIN:-az}"

  if [ -z "$apim_name" ]; then
    return 0
  fi

  local subscription_id
  subscription_id=$("$az_cli" account show --query id -o tsv 2>/dev/null || echo "")

  if [ -z "$subscription_id" ]; then
    echo "Could not resolve Azure subscription id from service connection context" >&2
    return 1
  fi

  local master_key
  master_key=$("$az_cli" rest \
    --method post \
    --url "https://management.azure.com/subscriptions/${subscription_id}/resourceGroups/${resource_group}/providers/Microsoft.ApiManagement/service/${apim_name}/subscriptions/${apim_subscription}/listSecrets?api-version=2024-05-01" \
    --query primaryKey \
    -o tsv 2>/dev/null || echo "")

  master_key=$(printf '%s' "$master_key" | tr -d '\r\n')

  if [ -z "$master_key" ]; then
    echo "Could not resolve APIM subscription key" >&2
    return 1
  fi

  export APIM_SUBSCRIPTION_KEY="$master_key"
}
