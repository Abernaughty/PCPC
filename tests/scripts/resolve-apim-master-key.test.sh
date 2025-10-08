#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$PROJECT_ROOT/.ado/scripts/lib/apim.sh"

failures=0

run_test() {
  local name="$1"
  local func="$2"

  if ( "$func" ); then
    echo "[PASS] $name"
  else
    echo "[FAIL] $name" >&2
    failures=$((failures + 1))
  fi
}

test_resolves_key_when_apim_configured() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  cat >"$tmp_dir/az" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" = "account" && "${2:-}" = "show" ]]; then
  echo "00000000-1111-2222-3333-444444444444"
elif [[ "${1:-}" = "rest" ]]; then
  echo "super-secret-key"
else
  echo "unexpected az invocation: $*" >&2
  exit 1
fi
EOF
  chmod +x "$tmp_dir/az"

  PATH="$tmp_dir:$PATH"
  unset APIM_SUBSCRIPTION_KEY

  if ! resolve_apim_master_key "pcpc-apim" "pcpc-rg"; then
    echo "resolve_apim_master_key returned failure" >&2
    return 1
  fi

  if [[ "${APIM_SUBSCRIPTION_KEY:-}" != "super-secret-key" ]]; then
    echo "APIM_SUBSCRIPTION_KEY was not exported correctly" >&2
    return 1
  fi
}

test_skips_lookup_when_apim_not_set() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  cat >"$tmp_dir/az" <<'EOF'
#!/usr/bin/env bash
echo "az should not have been invoked" >&2
exit 1
EOF
  chmod +x "$tmp_dir/az"

  PATH="$tmp_dir:$PATH"
  unset APIM_SUBSCRIPTION_KEY

  if ! resolve_apim_master_key "" "pcpc-rg"; then
    echo "resolve_apim_master_key should succeed when APIM name is absent" >&2
    return 1
  fi

  if [[ -n "${APIM_SUBSCRIPTION_KEY:-}" ]]; then
    echo "APIM_SUBSCRIPTION_KEY should remain unset" >&2
    return 1
  fi
}

test_fails_when_subscription_id_missing() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  cat >"$tmp_dir/az" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" = "account" && "${2:-}" = "show" ]]; then
  # Simulate failure to resolve subscription id
  exit 0
elif [[ "${1:-}" = "rest" ]]; then
  echo "rest should not have been invoked" >&2
  exit 1
else
  echo "unexpected az invocation: $*" >&2
  exit 1
fi
EOF
  chmod +x "$tmp_dir/az"

  PATH="$tmp_dir:$PATH"
  unset APIM_SUBSCRIPTION_KEY

  if resolve_apim_master_key "pcpc-apim" "pcpc-rg"; then
    echo "resolve_apim_master_key should fail when subscription id cannot be resolved" >&2
    return 1
  fi
}

run_test "resolves APIM key when configured" test_resolves_key_when_apim_configured
run_test "skips lookup when APIM is not set" test_skips_lookup_when_apim_not_set
run_test "fails when subscription id is missing" test_fails_when_subscription_id_missing

if [[ $failures -ne 0 ]]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
