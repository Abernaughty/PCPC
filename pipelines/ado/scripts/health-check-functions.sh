#!/bin/bash

# Health Check Script for Azure Functions
# Usage: ./health-check-functions.sh <FUNCTION_APP_URL> [FUNCTION_KEY]
# Exit codes: 0 = success, 1 = failure, 2 = warning

set -e

FUNCTION_APP_URL=$1
FUNCTION_KEY=$2

if [ -z "$FUNCTION_APP_URL" ]; then
  echo "Error: Function App URL is required"
  echo "Usage: $0 <FUNCTION_APP_URL> [FUNCTION_KEY]"
  echo ""
  echo "Parameters:"
  echo "  FUNCTION_APP_URL  - The base URL of the Function App (required)"
  echo "  FUNCTION_KEY      - Function key for authenticated endpoints (optional)"
  echo ""
  echo "Note: If FUNCTION_KEY is not provided, only anonymous endpoints will be tested"
  exit 1
fi

echo "=========================================="
echo "Function App Health Check"
echo "=========================================="
echo "URL: $FUNCTION_APP_URL"
echo ""

WARNINGS=0
ERRORS=0

add_warning() {
  WARNINGS=$((WARNINGS + 1))
}

add_error() {
  ERRORS=$((ERRORS + 1))
}

# Test 1: Health endpoint
echo "Test 1: Health Endpoint"
echo "------------------------"
HEALTH_URL="${FUNCTION_APP_URL}/api/health"
echo "Testing: $HEALTH_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ Health endpoint returned 200 OK"
  
  # Parse health check response
  if echo "$BODY" | jq -e '.status' > /dev/null 2>&1; then
    STATUS=$(echo "$BODY" | jq -r '.status')
    echo "  Status: $STATUS"
    
    # Check individual components
    if echo "$BODY" | jq -e '.checks' > /dev/null 2>&1; then
      echo "  Component Health:"

      # Runtime check
      RUNTIME_JSON=$(echo "$BODY" | jq -c '.checks.runtime // empty')
      if [ -n "$RUNTIME_JSON" ]; then
        RUNTIME_STATUS=$(echo "$RUNTIME_JSON" | jq -r 'if type == "object" then (.status // "unknown") else . end')
        RUNTIME_MESSAGE=$(echo "$RUNTIME_JSON" | jq -r 'if type == "object" then (.message // empty) else empty end')
      else
        RUNTIME_STATUS="unknown"
        RUNTIME_MESSAGE=""
      fi
      echo "    - Runtime: $RUNTIME_STATUS"
      if [ -n "$RUNTIME_MESSAGE" ]; then
        echo "      $RUNTIME_MESSAGE"
      fi
      
      # Cosmos DB check
      COSMOS_JSON=$(echo "$BODY" | jq -c '.checks.cosmosdb // empty')
      if [ -n "$COSMOS_JSON" ]; then
        COSMOS_STATUS=$(echo "$COSMOS_JSON" | jq -r 'if type == "object" then (.status // "unknown") else . end')
        COSMOS_MESSAGE=$(echo "$COSMOS_JSON" | jq -r 'if type == "object" then (.message // empty) else empty end')
      else
        COSMOS_STATUS="not configured"
        COSMOS_MESSAGE=""
      fi
      echo "    - Cosmos DB: $COSMOS_STATUS"
      if [ -n "$COSMOS_MESSAGE" ]; then
        echo "      $COSMOS_MESSAGE"
      fi
      if [ "$COSMOS_STATUS" != "healthy" ] && [ "$COSMOS_STATUS" != "not configured" ] && [ "$COSMOS_STATUS" != "unknown" ]; then
        echo "      ⚠ Cosmos DB is not healthy"
        add_warning
      fi
      
      # Scrydex API check
      SCRYDEX_JSON=$(echo "$BODY" | jq -c '.checks.scrydexApi // empty')
      if [ -n "$SCRYDEX_JSON" ]; then
        SCRYDEX_STATUS=$(echo "$SCRYDEX_JSON" | jq -r 'if type == "object" then (.status // "unknown") else . end')
        SCRYDEX_MESSAGE=$(echo "$SCRYDEX_JSON" | jq -r 'if type == "object" then (.message // empty) else empty end')
      else
        SCRYDEX_STATUS="not configured"
        SCRYDEX_MESSAGE=""
      fi
      echo "    - Scrydex API: $SCRYDEX_STATUS"
      if [ -n "$SCRYDEX_MESSAGE" ]; then
        echo "      $SCRYDEX_MESSAGE"
      fi
      if [ "$SCRYDEX_STATUS" != "healthy" ] && [ "$SCRYDEX_STATUS" != "not configured" ] && [ "$SCRYDEX_STATUS" != "unknown" ]; then
        echo "      ⚠ Scrydex API is not healthy"
        add_warning
      fi
      
      # Redis check (optional)
      REDIS_JSON=$(echo "$BODY" | jq -c '.checks.redis // empty')
      if [ -n "$REDIS_JSON" ]; then
        REDIS_STATUS=$(echo "$REDIS_JSON" | jq -r 'if type == "object" then (.status // "unknown") else . end')
        REDIS_MESSAGE=$(echo "$REDIS_JSON" | jq -r 'if type == "object" then (.message // empty) else empty end')
      else
        REDIS_STATUS="not configured"
        REDIS_MESSAGE=""
      fi
      echo "    - Redis: $REDIS_STATUS"
      if [ -n "$REDIS_MESSAGE" ]; then
        echo "      $REDIS_MESSAGE"
      fi
      if [ "$REDIS_STATUS" = "degraded" ]; then
        echo "      ⚠ Redis is degraded"
        add_warning
      elif [ "$REDIS_STATUS" = "unhealthy" ]; then
        echo "      ✗ Redis is unhealthy"
        add_error
      elif [ "$REDIS_STATUS" != "healthy" ] && [ "$REDIS_STATUS" != "disabled" ] && [ "$REDIS_STATUS" != "not configured" ] && [ "$REDIS_STATUS" != "unknown" ]; then
        echo "      ⚠ Redis status: $REDIS_STATUS"
        add_warning
      fi
    fi
  else
    echo "  ⚠ Health response is not valid JSON"
    add_warning
  fi
else
  echo "✗ Health endpoint returned $HTTP_CODE (expected 200)"
  add_error
fi
echo ""

# Test 2: GetSetList endpoint
#
# Blocking. Phase 2 migrated this endpoint to Scrydex; the previous
# non-blocking transition window is closed.
echo "Test 2: GetSetList Endpoint"
echo "----------------------------"

if [ -z "$FUNCTION_KEY" ]; then
  # For ACA's anonymous public ingress (Path C), there is no function-key
  # concept — by design (see ADR-009). Set EXPECT_FUNCTION_KEY=false so the
  # skip doesn't generate a warning (which would otherwise trip the blocking
  # smoke test step). The script still skips the auth-required test; it just
  # treats the skip as expected rather than as a misconfiguration signal.
  if [ "${EXPECT_FUNCTION_KEY:-true}" = "false" ]; then
    echo "ℹ Skipping GetSetList test - anonymous ingress (no function key applicable)"
  else
    echo "⚠ Skipping GetSetList test - no function key provided"
    echo "  (This endpoint requires authentication)"
    add_warning
  fi
else
  SETLIST_URL="${FUNCTION_APP_URL}/api/sets?all=true&code=${FUNCTION_KEY}"
  echo "Testing: ${FUNCTION_APP_URL}/api/sets?all=true&code=***"

  RESPONSE=$(curl -s -w "\n%{http_code}" "$SETLIST_URL" || echo "000")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY_RAW=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ GetSetList endpoint returned 200 OK"

    # Verify response is valid JSON array
    if echo "$BODY_RAW" | jq empty > /dev/null 2>&1; then
      BODY=$(echo "$BODY_RAW" | jq -c '.data.sets // []')
      if echo "$BODY" | jq -e 'type == "array"' > /dev/null 2>&1; then
        SET_COUNT=$(echo "$BODY" | jq 'length')
        echo "  Set count: $SET_COUNT"

        if [ "$SET_COUNT" -gt 0 ]; then
          echo "✓ Response contains sets"

          # Verify first set has required fields
          FIRST_SET=$(echo "$BODY" | jq '.[0]')
          if echo "$FIRST_SET" | jq -e '.id and .language and .name' > /dev/null 2>&1; then
            echo "✓ Set data structure is valid"
          else
            echo "✗ Set data structure may be incomplete"
            add_error
          fi
        else
          echo "✗ No sets returned"
          add_error
        fi
      else
        echo "✗ Response is not a valid JSON array"
        add_error
      fi
    else
      echo "✗ Response is not valid JSON"
      add_error
    fi
  elif [ "$HTTP_CODE" == "401" ]; then
    echo "✗ GetSetList endpoint returned 401 Unauthorized"
    echo "  This likely means the function key is invalid or expired"
    add_error
  else
    echo "✗ GetSetList endpoint returned $HTTP_CODE (expected 200)"
    add_error
  fi
fi
echo ""

# Test 3: Response time check (best of 3, after a warm-up).
# The health endpoint makes Cosmos + external Scrydex calls, and a freshly
# deployed/cold container adds first-request latency, so a SINGLE sample is
# flaky (a transient spike can fail an otherwise-healthy deploy). Discard one
# warm-up request, then take the FASTEST of 3 samples and judge that — a real
# latency problem shows up across all samples; a one-off spike does not.
echo "Test 3: Response Time (best of 3, after warm-up)"
echo "---------------------"
curl -s -o /dev/null --max-time 20 "$HEALTH_URL" || true   # warm-up (discarded)
RESPONSE_TIME=999999
for i in 1 2 3; do
  START_TIME=$(date +%s%N)
  curl -s -o /dev/null --max-time 20 "$HEALTH_URL" || true
  END_TIME=$(date +%s%N)
  SAMPLE=$(( (END_TIME - START_TIME) / 1000000 ))
  echo "  sample $i: ${SAMPLE}ms"
  if [ "$SAMPLE" -lt "$RESPONSE_TIME" ]; then RESPONSE_TIME=$SAMPLE; fi
done

echo "Best response time: ${RESPONSE_TIME}ms"
if [ "$RESPONSE_TIME" -lt 1000 ]; then
  echo "✓ Response time is acceptable (< 1s)"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
  echo "⚠ Response time is slow (1-3s)"
  add_warning
else
  echo "✗ Response time is too slow (> 3s)"
  add_error
fi
echo ""

# Summary
echo "=========================================="
echo "Health Check Summary"
echo "=========================================="
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"
echo "=========================================="
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ Function App health check failed"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  Function App health check passed with warnings"
  exit 2
else
  echo "✅ Function App is healthy"
  exit 0
fi
