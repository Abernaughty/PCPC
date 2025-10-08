#!/bin/bash

# Health Check Script for Azure API Management
# Usage: ./health-check-apim.sh <APIM_GATEWAY_URL> [APIM_SUBSCRIPTION_KEY]
# Exit codes: 0 = success, 1 = failure, 2 = warning

set -e

APIM_URL=$1
SUPPLIED_SUBSCRIPTION_KEY=$2

if [ -z "$APIM_URL" ]; then
  echo "Error: APIM Gateway URL is required"
  echo "Usage: $0 <APIM_GATEWAY_URL> [APIM_SUBSCRIPTION_KEY]"
  exit 1
fi

# Allow optional subscription key to be passed as argument
if [ -n "$SUPPLIED_SUBSCRIPTION_KEY" ]; then
  APIM_SUBSCRIPTION_KEY="$SUPPLIED_SUBSCRIPTION_KEY"
fi

echo "=========================================="
echo "API Management Health Check"
echo "=========================================="
echo "URL: $APIM_URL"
echo ""

WARNINGS=0
ERRORS=0

add_warning() {
  WARNINGS=$((WARNINGS + 1))
}

add_error() {
  ERRORS=$((ERRORS + 1))
}

# Test 1: Gateway accessibility
echo "Test 1: Gateway Accessibility"
echo "------------------------------"
echo "Testing: $APIM_URL/internal-status-0123456789abcdef"

RESPONSE=$(curl -s -w "\n%{http_code}" "$APIM_URL/internal-status-0123456789abcdef" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "404" ]; then
  echo "✓ Gateway is accessible (HTTP $HTTP_CODE)"
  if [ "$HTTP_CODE" == "404" ]; then
    echo "  Note: 404 is expected for gateway root without API path"
  fi
elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
  echo "✓ Gateway is accessible but requires authentication (HTTP $HTTP_CODE)"
  echo "  Note: This is expected behavior for secured APIs"
else
  echo "✗ Gateway returned unexpected status: $HTTP_CODE"
  add_error
fi
echo ""

# Test 2: API endpoint (if configured)
echo "Test 2: API Endpoint"
echo "--------------------"
API_URL="${APIM_URL}/pcpc-api/health"
echo "Testing: $API_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ API endpoint returned 200 OK"
  
  # Try to parse response
  if echo "$BODY" | jq -e '.' > /dev/null 2>&1; then
    echo "✓ Response is valid JSON"
    
    # Check for status field
    if echo "$BODY" | jq -e '.status' > /dev/null 2>&1; then
      STATUS=$(echo "$BODY" | jq -r '.status')
      echo "  API Status: $STATUS"
    fi
  else
    echo "⊘ Response is not JSON (may be HTML or plain text)"
  fi
elif [ "$HTTP_CODE" == "401" ]; then
  echo "⊘ API requires authentication (expected for secured endpoints)"
  echo "  Note: Subscription key or OAuth token required"
elif [ "$HTTP_CODE" == "404" ]; then
  echo "⊘ API endpoint not found (may not be configured yet)"
  echo "  Note: This is acceptable if APIM is newly deployed"
elif [ "$HTTP_CODE" == "000" ]; then
  echo "⚠ Could not connect to API endpoint"
  add_warning
else
  echo "⚠ API endpoint returned unexpected status: $HTTP_CODE"
  add_warning
fi
echo ""

# Test 3: Response time
echo "Test 3: Response Time"
echo "---------------------"
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$APIM_URL/internal-status-0123456789abcdef" 2>/dev/null || true
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Response time: ${RESPONSE_TIME}ms"
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

# Test 4: HTTPS configuration
echo "Test 4: HTTPS Configuration"
echo "---------------------------"

if [[ "$APIM_URL" == https://* ]]; then
  echo "✓ Gateway is using HTTPS"
  
  # Test SSL certificate
  CERT_INFO=$(echo | openssl s_client -servername "${APIM_URL#https://}" -connect "${APIM_URL#https://}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
  
  if [ -n "$CERT_INFO" ]; then
    echo "✓ SSL certificate is valid"
    
    # Check certificate expiration
    EXPIRY=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)
    if [ -n "$EXPIRY" ]; then
      echo "  Certificate expires: $EXPIRY"
    fi
  else
    echo "⚠ Could not verify SSL certificate"
    add_warning
  fi
else
  echo "⚠ Gateway is not using HTTPS"
  add_warning
fi
echo ""

# Test 5: CORS headers (if applicable)
echo "Test 5: CORS Configuration"
echo "--------------------------"
HEADERS=$(curl -s -X OPTIONS -H "Origin: https://pokedata.maber.io" -H "Ocp-Apim-Subscription-Key: $APIM_SUBSCRIPTION_KEY" "$APIM_URL/api/v1/sets" -D - 2>/dev/null || echo "")

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
  CORS_ORIGIN=$(echo "$HEADERS" | grep -i "access-control-allow-origin" | cut -d: -f2- | tr -d '\r\n' | xargs)
  echo "✓ CORS is configured"
  echo "  Allowed origin: $CORS_ORIGIN"
else
  echo "⊘ CORS headers not found (may not be configured)"
  echo "  Note: This is acceptable if CORS is not required"
fi
echo ""

# Test 6: Rate limiting headers
echo "Test 6: Rate Limiting"
echo "---------------------"
HEADERS=$(curl -s -H "Ocp-Apim-Subscription-Key: $APIM_SUBSCRIPTION_KEY" -H "Accept: application/json" -H "Origin: https://pokedata.maber.io" "$APIM_URL/api/v1/sets" -D - 2>/dev/null || echo "")

  if echo "$HEADERS" | grep -qiE "x-rate[-]?limit"; then
    echo "✓ Rate limiting headers present"
    
    RATE_LIMIT=$(echo "$HEADERS" | grep -i -e "x-ratelimit-limit" -e "x-rate-limit-limit" | head -n1 | cut -d: -f2- | tr -d '\r\n' | xargs)
    RATE_REMAINING=$(echo "$HEADERS" | grep -i -e "x-ratelimit-remaining" -e "x-rate-limit-remaining" | head -n1 | cut -d: -f2- | tr -d '\r\n' | xargs)
  
  if [ -n "$RATE_LIMIT" ]; then
    echo "  Rate limit: $RATE_LIMIT"
  fi
  if [ -n "$RATE_REMAINING" ]; then
    echo "  Remaining: $RATE_REMAINING"
  fi
else
  echo "⊘ Rate limiting headers not found"
  echo "  Note: This is acceptable if rate limiting is not configured"
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
  echo "❌ API Management health check failed"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  API Management health check passed with warnings"
  exit 2
else
  echo "✅ API Management is healthy"
  exit 0
fi
