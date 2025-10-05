#!/bin/bash

# Health Check Script for Azure Static Web Apps
# Usage: ./health-check-swa.sh <STATIC_WEB_APP_URL>
# Exit codes: 0 = success, 1 = failure, 2 = warning

set -e

SWA_URL=$1

if [ -z "$SWA_URL" ]; then
  echo "Error: Static Web App URL is required"
  echo "Usage: $0 <STATIC_WEB_APP_URL>"
  exit 1
fi

echo "=========================================="
echo "Static Web App Health Check"
echo "=========================================="
echo "URL: $SWA_URL"
echo ""

WARNINGS=0
ERRORS=0

# Test 1: Homepage accessibility
echo "Test 1: Homepage Accessibility"
echo "-------------------------------"
echo "Testing: $SWA_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$SWA_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ Homepage returned 200 OK"
  
  # Verify HTML content
  if echo "$BODY" | grep -q "<!DOCTYPE html>" || echo "$BODY" | grep -q "<html"; then
    echo "✓ Response contains valid HTML"
    
    # Check for key elements
    if echo "$BODY" | grep -q "<title>"; then
      TITLE=$(echo "$BODY" | grep -o "<title>[^<]*" | sed 's/<title>//')
      echo "  Page title: $TITLE"
    fi
    
    # Check for main.js
    if echo "$BODY" | grep -q "main.js"; then
      echo "✓ JavaScript bundle reference found"
    else
      echo "⚠ JavaScript bundle reference not found"
      ((WARNINGS++))
    fi
    
    # Check for bundle.css
    if echo "$BODY" | grep -q "bundle.css"; then
      echo "✓ CSS bundle reference found"
    else
      echo "⚠ CSS bundle reference not found"
      ((WARNINGS++))
    fi
  else
    echo "✗ Response does not contain valid HTML"
    ((ERRORS++))
  fi
else
  echo "✗ Homepage returned $HTTP_CODE (expected 200)"
  ((ERRORS++))
fi
echo ""

# Test 2: JavaScript bundle
echo "Test 2: JavaScript Bundle"
echo "-------------------------"
JS_URL="${SWA_URL}/main.js"
echo "Testing: $JS_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$JS_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ JavaScript bundle returned 200 OK"
  
  # Check bundle size
  BUNDLE_SIZE=$(echo "$BODY" | wc -c)
  BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
  echo "  Bundle size: ${BUNDLE_SIZE_KB}KB"
  
  if [ "$BUNDLE_SIZE" -gt 1000 ]; then
    echo "✓ Bundle size is reasonable"
  else
    echo "⚠ Bundle size seems too small (< 1KB)"
    ((WARNINGS++))
  fi
  
  # Verify it's JavaScript
  if echo "$BODY" | head -c 100 | grep -q "function\|const\|var\|let\|=>"; then
    echo "✓ Content appears to be JavaScript"
  else
    echo "⚠ Content may not be valid JavaScript"
    ((WARNINGS++))
  fi
else
  echo "✗ JavaScript bundle returned $HTTP_CODE (expected 200)"
  ((ERRORS++))
fi
echo ""

# Test 3: CSS bundle
echo "Test 3: CSS Bundle"
echo "------------------"
CSS_URL="${SWA_URL}/bundle.css"
echo "Testing: $CSS_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$CSS_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ CSS bundle returned 200 OK"
  
  # Check bundle size
  BUNDLE_SIZE=$(echo "$BODY" | wc -c)
  BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
  echo "  Bundle size: ${BUNDLE_SIZE_KB}KB"
  
  if [ "$BUNDLE_SIZE" -gt 100 ]; then
    echo "✓ Bundle size is reasonable"
  else
    echo "⚠ Bundle size seems too small (< 100 bytes)"
    ((WARNINGS++))
  fi
  
  # Verify it's CSS
  if echo "$BODY" | head -c 100 | grep -q "{"; then
    echo "✓ Content appears to be CSS"
  else
    echo "⚠ Content may not be valid CSS"
    ((WARNINGS++))
  fi
else
  echo "⚠ CSS bundle returned $HTTP_CODE (expected 200)"
  ((WARNINGS++))
fi
echo ""

# Test 4: Static assets
echo "Test 4: Static Assets"
echo "---------------------"

# Test favicon
FAVICON_URL="${SWA_URL}/favicon.png"
echo "Testing favicon: $FAVICON_URL"
RESPONSE=$(curl -s -w "\n%{http_code}" "$FAVICON_URL" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ]; then
  echo "✓ Favicon is accessible"
elif [ "$HTTP_CODE" == "404" ]; then
  echo "⊘ Favicon not found (optional)"
else
  echo "⚠ Favicon returned unexpected status: $HTTP_CODE"
  ((WARNINGS++))
fi
echo ""

# Test 5: Response time
echo "Test 5: Response Time"
echo "---------------------"
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$SWA_URL"
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Response time: ${RESPONSE_TIME}ms"
if [ "$RESPONSE_TIME" -lt 2000 ]; then
  echo "✓ Response time is acceptable (< 2s)"
elif [ "$RESPONSE_TIME" -lt 5000 ]; then
  echo "⚠ Response time is slow (2-5s)"
  ((WARNINGS++))
else
  echo "✗ Response time is too slow (> 5s)"
  ((ERRORS++))
fi
echo ""

# Test 6: Security headers
echo "Test 6: Security Headers"
echo "------------------------"
HEADERS=$(curl -s -I "$SWA_URL")

# Check for X-Frame-Options
if echo "$HEADERS" | grep -qi "x-frame-options"; then
  echo "✓ X-Frame-Options header present"
else
  echo "⊘ X-Frame-Options header not found (optional)"
fi

# Check for Content-Security-Policy
if echo "$HEADERS" | grep -qi "content-security-policy"; then
  echo "✓ Content-Security-Policy header present"
else
  echo "⊘ Content-Security-Policy header not found (optional)"
fi

# Check for X-Content-Type-Options
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  echo "✓ X-Content-Type-Options header present"
else
  echo "⊘ X-Content-Type-Options header not found (optional)"
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
  echo "❌ Static Web App health check failed"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  Static Web App health check passed with warnings"
  exit 2
else
  echo "✅ Static Web App is healthy"
  exit 0
fi
