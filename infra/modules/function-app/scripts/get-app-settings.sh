#!/usr/bin/env bash

# Fetch selected Function App app settings using Azure REST APIs.
# Designed to help Terraform preserve externally-managed settings (e.g. deployment hashes)
# so that plans remain clean even when other systems mutate those values.

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

properties_json=""

# Try direct REST call using ARM_* service principal credentials when available.
client_id="${ARM_CLIENT_ID:-}"
client_secret="${ARM_CLIENT_SECRET:-}"
tenant_id="${ARM_TENANT_ID:-}"

if [[ -z "${properties_json}" && -n "${client_id}" && -n "${client_secret}" && -n "${tenant_id}" ]]; then
  token_response="$(curl -sS -X POST \
    -d "grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}&resource=https://management.azure.com/" \
    "https://login.microsoftonline.com/${tenant_id}/oauth2/token" || true)"

  access_token="$(jq -r '.access_token // ""' <<<"${token_response}")"

  if [[ -n "${access_token}" ]]; then
    tmp_response="$(mktemp)"
    http_code="$(curl -sS -o "${tmp_response}" -w '%{http_code}' \
      -X POST \
      -H "Authorization: Bearer ${access_token}" \
      -H "Content-Type: application/json" \
      "https://management.azure.com/subscriptions/${subscription_id}/resourceGroups/${resource_group_name}/providers/Microsoft.Web/sites/${function_app_name}/config/appsettings/list?api-version=2023-01-01" || echo "000")"

    if [[ "${http_code}" == "200" ]]; then
      properties_json="$(jq -c '.properties // {}' "${tmp_response}" 2>/dev/null || echo '{}')"
    fi
    rm -f "${tmp_response}"
  fi
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
