#!/bin/bash

# Health Check Script for Azure Functions
# Usage: ./health-check-functions.sh <FUNCTION_APP_URL>
# Exit codes: 0 = success, 1 = failure, 2 = warning

set -e

FUNCTION_APP_URL=$1

if [ -z "$FUNCTION_APP_URL" ]; then
  echo "Error: Function App URL is required"
  echo "Usage: $0 <FUNCTION_APP_URL>"
  exit 1
fi

echo "=========================================="
echo "Function App Health Check"
echo "=========================================="
echo "URL: $FUNCTION_APP_URL"
echo ""

WARNINGS=0
ERRORS=0

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
      RUNTIME=$(echo "$BODY" | jq -r '.checks.runtime // "unknown"')
      echo "    - Runtime: $RUNTIME"
      
      # Cosmos DB check
      COSMOS=$(echo "$BODY" | jq -r '.checks.cosmosDb // "unknown"')
      echo "    - Cosmos DB: $COSMOS"
      if [ "$COSMOS" != "healthy" ] && [ "$COSMOS" != "unknown" ]; then
        echo "      ⚠ Cosmos DB is not healthy"
        ((WARNINGS++))
      fi
      
      # PokeData API check
      POKEDATA=$(echo "$BODY" | jq -r '.checks.pokeDataApi // "unknown"')
      echo "    - PokeData API: $POKEDATA"
      if [ "$POKEDATA" != "healthy" ] && [ "$POKEDATA" != "unknown" ]; then
        echo "      ⚠ PokeData API is not healthy"
        ((WARNINGS++))
      fi
      
      # Redis check (optional)
      REDIS=$(echo "$BODY" | jq -r '.checks.redis // "not configured"')
      echo "    - Redis: $REDIS"
      if [ "$REDIS" != "healthy" ] && [ "$REDIS" != "not configured" ] && [ "$REDIS" != "unknown" ]; then
        echo "      ⚠ Redis is not healthy"
        ((WARNINGS++))
      fi
    fi
  else
    echo "  ⚠ Health response is not valid JSON"
    ((WARNINGS++))
  fi
else
  echo "✗ Health endpoint returned $HTTP_CODE (expected 200)"
  ((ERRORS++))
fi
echo ""

# Test 2: GetSetList endpoint
echo "Test 2: GetSetList Endpoint"
echo "----------------------------"
SETLIST_URL="${FUNCTION_APP_URL}/api/GetSetList?all=true"
echo "Testing: $SETLIST_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$SETLIST_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ GetSetList endpoint returned 200 OK"
  
  # Verify response is valid JSON array
  if echo "$BODY" | jq -e 'type == "array"' > /dev/null 2>&1; then
    SET_COUNT=$(echo "$BODY" | jq 'length')
    echo "  Set count: $SET_COUNT"
    
    if [ "$SET_COUNT" -gt 0 ]; then
      echo "✓ Response contains sets"
      
      # Verify first set has required fields
      FIRST_SET=$(echo "$BODY" | jq '.[0]')
      if echo "$FIRST_SET" | jq -e '.id and .name and .series' > /dev/null 2>&1; then
        echo "✓ Set data structure is valid"
      else
        echo "⚠ Set data structure may be incomplete"
        ((WARNINGS++))
      fi
    else
      echo "⚠ No sets returned"
      ((WARNINGS++))
    fi
  else
    echo "✗ Response is not a valid JSON array"
    ((ERRORS++))
  fi
else
  echo "✗ GetSetList endpoint returned $HTTP_CODE (expected 200)"
  ((ERRORS++))
fi
echo ""

# Test 3: Response time check
echo "Test 3: Response Time"
echo "---------------------"
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$HEALTH_URL"
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Response time: ${RESPONSE_TIME}ms"
if [ "$RESPONSE_TIME" -lt 1000 ]; then
  echo "✓ Response time is acceptable (< 1s)"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
  echo "⚠ Response time is slow (1-3s)"
  ((WARNINGS++))
else
  echo "✗ Response time is too slow (> 3s)"
  ((ERRORS++))
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
