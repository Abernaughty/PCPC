#!/usr/bin/env bash

# Fetch selected Function App app settings using Azure REST APIs.
# Designed to help Terraform preserve externally-managed settings (e.g. deployment hashes)
# so that plans remain clean even when other systems mutate those values.
# Supports client secret auth, workload identity (OIDC), managed identity (MSI/IMDS),
# and falls back to Azure CLI if available.

set -euo pipefail

output_empty() {
  printf '{}\n'
  exit 0
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    >&2 echo "Required command '$1' not found in PATH."
    output_empty
  fi
}

require_command jq
require_command curl

payload="$(cat)"

function_app_name="$(jq -r '.function_app_name // ""' <<<"${payload}")"
resource_group_name="$(jq -r '.resource_group_name // ""' <<<"${payload}")"
subscription_id="$(jq -r '.subscription_id // ""' <<<"${payload}")"
keys_json_raw="$(jq -r '.keys_json // "[]"' <<<"${payload}")"

# Validate basic inputs
if [[ -z "${function_app_name}" || -z "${resource_group_name}" || -z "${subscription_id}" ]]; then
  >&2 echo "Missing required inputs to lookup app settings; returning empty map."
  output_empty
fi

keys_json="$(jq -c '.' <<<"${keys_json_raw}" 2>/dev/null || echo "[]")"
if [[ "${keys_json}" == "[]" ]]; then
  output_empty
fi

management_resource="https://management.azure.com/"
management_scope="${management_resource}.default"

urlencode() {
  jq -nr --arg v "$1" '$v|@uri'
}

properties_json=""
access_token=""

try_sp_secret() {
  local client_id="$1"
  local client_secret="$2"
  local tenant_id="$3"

  if [[ -z "${client_id}" || -z "${client_secret}" || -z "${tenant_id}" ]]; then
    return 0
  fi

  local data="grant_type=client_credentials"
  data="${data}&client_id=$(urlencode "${client_id}")"
  data="${data}&client_secret=$(urlencode "${client_secret}")"
  data="${data}&resource=$(urlencode "${management_resource}")"

  local response
  response="$(curl -sS -X POST -H "Content-Type: application/x-www-form-urlencoded" \
    -d "${data}" \
    "https://login.microsoftonline.com/${tenant_id}/oauth2/token" || true)"

  access_token="$(jq -r '.access_token // ""' <<<"${response}")"
}

try_workload_identity() {
  local client_id="$1"
  local tenant_id="$2"
  local oidc_token="${ARM_OIDC_TOKEN:-}"

  if [[ -z "${oidc_token}" && -n "${ARM_OIDC_TOKEN_FILE:-}" && -f "${ARM_OIDC_TOKEN_FILE}" ]]; then
    oidc_token="$(cat "${ARM_OIDC_TOKEN_FILE}")"
  fi

  if [[ -z "${oidc_token}" || -z "${tenant_id}" || -z "${client_id}" ]]; then
    return 0
  fi

  local data="client_id=$(urlencode "${client_id}")"
  data="${data}&scope=$(urlencode "${management_scope}")"
  data="${data}&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
  data="${data}&client_assertion=$(urlencode "${oidc_token}")"
  data="${data}&grant_type=client_credentials"

  local response
  response="$(curl -sS -X POST -H "Content-Type: application/x-www-form-urlencoded" \
    -d "${data}" \
    "https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token" || true)"

  access_token="$(jq -r '.access_token // ""' <<<"${response}")"
}

try_app_service_msi() {
  local client_id="$1"
  local endpoint="${IDENTITY_ENDPOINT:-${MSI_ENDPOINT:-}}"
  local header="${IDENTITY_HEADER:-}"
  local secret="${MSI_SECRET:-}"

  if [[ -z "${endpoint}" ]]; then
    return 0
  fi

  local query="resource=$(urlencode "${management_resource}")"
  query="${query}&api-version=2019-08-01"
  if [[ -n "${client_id}" ]]; then
    query="${query}&client_id=$(urlencode "${client_id}")"
  fi

  local headers=(-H "Metadata: true")
  if [[ -n "${header}" ]]; then
    headers+=(-H "X-IDENTITY-HEADER: ${header}")
  fi
  if [[ -n "${secret}" ]]; then
    headers+=(-H "secret: ${secret}")
  fi

  local response
  response="$(curl -sS "${headers[@]}" "${endpoint}?${query}" || true)"

  access_token="$(jq -r '.access_token // ""' <<<"${response}")"
}

try_imds_msi() {
  local client_id="$1"
  local resource
  resource="resource=$(urlencode "${management_resource}")"
  resource="${resource}&api-version=2018-02-01"
  if [[ -n "${client_id}" ]]; then
    resource="${resource}&client_id=$(urlencode "${client_id}")"
  fi

  local response
  response="$(curl -sS -H "Metadata: true" \
    "http://169.254.169.254/metadata/identity/oauth2/token?${resource}" || true)"

  access_token="$(jq -r '.access_token // ""' <<<"${response}")"
}

fetch_properties_with_token() {
  local token="$1"
  local tmp_response
  tmp_response="$(mktemp)"
  local http_code
  http_code="$(curl -sS -o "${tmp_response}" -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    "https://management.azure.com/subscriptions/${subscription_id}/resourceGroups/${resource_group_name}/providers/Microsoft.Web/sites/${function_app_name}/config/appsettings/list?api-version=2023-01-01" || echo "000")"

  if [[ "${http_code}" == "200" ]]; then
    properties_json="$(jq -c '.properties // {}' "${tmp_response}" 2>/dev/null || echo '{}')"
  fi
  rm -f "${tmp_response}"
}

client_id="${ARM_CLIENT_ID:-${AZURE_CLIENT_ID:-}}"
client_secret="${ARM_CLIENT_SECRET:-}"
tenant_id="${ARM_TENANT_ID:-${AZURE_TENANT_ID:-}}"

# Attempt credential flows in order of likelihood.
try_sp_secret "${client_id}" "${client_secret}" "${tenant_id}"

if [[ -z "${access_token}" && "${ARM_USE_OIDC:-}" == "true" ]]; then
  try_workload_identity "${client_id}" "${tenant_id}"
fi

if [[ -z "${access_token}" && ( "${ARM_USE_MSI:-}" == "true" || -n "${IDENTITY_ENDPOINT:-}" || -n "${MSI_ENDPOINT:-}" ) ]]; then
  try_app_service_msi "${client_id}"
fi

if [[ -z "${access_token}" && "${ARM_USE_MSI:-}" == "true" ]]; then
  try_imds_msi "${client_id}"
fi

if [[ -n "${access_token}" ]]; then
  fetch_properties_with_token "${access_token}"
fi

# Fallback to Azure CLI when REST path is unavailable.
if [[ -z "${properties_json}" || "${properties_json}" == "" || "${properties_json}" == "null" ]]; then
  if command -v az >/dev/null 2>&1; then
    if raw_json="$(az functionapp config appsettings list \
      --name "${function_app_name}" \
      --resource-group "${resource_group_name}" \
      --only-show-errors \
      -o json 2>/dev/null)"; then
      properties_json="$(jq -c 'if type=="array" then reduce .[] as $item ({}; . + { ($item.name): ($item.value // "") }) else {} end' <<<"${raw_json}" 2>/dev/null || echo '{}')"
    fi
  fi
fi

if [[ -z "${properties_json}" || "${properties_json}" == "" || "${properties_json}" == "null" ]]; then
  >&2 echo "Unable to retrieve Function App app settings; returning empty map."
  output_empty
fi

jq -n --argjson keys "${keys_json}" --argjson props "${properties_json}" '
  reduce $keys[] as $key ({};
    if ($props | has($key)) then
      . + { ($key): ($props[$key] // "") }
    else
      .
    end
  )
'
