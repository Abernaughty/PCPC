#!/bin/bash
# Frontend Deployment Verification Script
# Performs smoke tests to verify Static Web App deployment

set -e

STATIC_WEB_APP_NAME="${1:-pcpc-swa-dev}"
STATIC_WEB_APP_URL="https://${STATIC_WEB_APP_NAME}.azurestaticapps.net"
MAX_RETRIES=5
RETRY_DELAY=10

echo "=========================================="
echo "Frontend Deployment Verification"
echo "=========================================="
echo "Static Web App: ${STATIC_WEB_APP_NAME}"
echo "URL: ${STATIC_WEB_APP_URL}"
echo "Max Retries: ${MAX_RETRIES}"
echo "=========================================="

# Function to check if site is accessible
check_site_accessibility() {
    local url=$1
    local retry_count=0
    
    echo ""
    echo "Test 1: Site Accessibility"
    echo "----------------------------"
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        echo "Attempt $((retry_count + 1))/$MAX_RETRIES: Checking ${url}"
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${url}" || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✓ Site is accessible (HTTP 200)"
            return 0
        else
            echo "✗ Site returned HTTP ${HTTP_CODE}"
            retry_count=$((retry_count + 1))
            
            if [ $retry_count -lt $MAX_RETRIES ]; then
                echo "Waiting ${RETRY_DELAY} seconds before retry..."
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    echo "✗ FAILED: Site not accessible after ${MAX_RETRIES} attempts"
    return 1
}

# Function to check HTML content
check_html_content() {
    local url=$1
    
    echo ""
    echo "Test 2: HTML Content Validation"
    echo "--------------------------------"
    
    HTML_CONTENT=$(curl -s "${url}")
    
    # Check for essential HTML elements
    if echo "$HTML_CONTENT" | grep -q "<html"; then
        echo "✓ Valid HTML document found"
    else
        echo "✗ FAILED: No HTML document found"
        return 1
    fi
    
    # Check for title tag
    if echo "$HTML_CONTENT" | grep -q "<title>"; then
        TITLE=$(echo "$HTML_CONTENT" | grep -o "<title>[^<]*" | sed 's/<title>//')
        echo "✓ Page title found: ${TITLE}"
    else
        echo "✗ WARNING: No title tag found"
    fi
    
    # Check for Svelte app root element
    if echo "$HTML_CONTENT" | grep -q 'id="app"' || echo "$HTML_CONTENT" | grep -q 'class="app"'; then
        echo "✓ Svelte app root element found"
    else
        echo "✗ WARNING: Svelte app root element not found"
    fi
    
    return 0
}

# Function to check JavaScript bundle
check_javascript_bundle() {
    local url=$1
    
    echo ""
    echo "Test 3: JavaScript Bundle Check"
    echo "--------------------------------"
    
    # Check if main.js exists (Rollup output - now at root level)
    BUNDLE_URL="${url}/main.js"
    BUNDLE_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BUNDLE_URL}" || echo "000")
    
    if [ "$BUNDLE_HTTP_CODE" = "200" ]; then
        echo "✓ JavaScript bundle accessible (${BUNDLE_URL})"
        
        # Get bundle size
        BUNDLE_SIZE=$(curl -s "${BUNDLE_URL}" | wc -c)
        BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
        echo "  Bundle size: ${BUNDLE_SIZE_KB} KB"
        
        # Warn if bundle is suspiciously small
        if [ $BUNDLE_SIZE -lt 1000 ]; then
            echo "✗ WARNING: Bundle size is very small (${BUNDLE_SIZE} bytes)"
        fi
    else
        echo "✗ WARNING: JavaScript bundle not accessible (HTTP ${BUNDLE_HTTP_CODE})"
    fi
    
    return 0
}

# Function to check CSS
check_css() {
    local url=$1
    
    echo ""
    echo "Test 4: CSS Check"
    echo "-----------------"
    
    # Check if bundle.css exists (now at root level)
    BUNDLE_CSS_URL="${url}/bundle.css"
    BUNDLE_CSS_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BUNDLE_CSS_URL}" || echo "000")
    
    if [ "$BUNDLE_CSS_HTTP_CODE" = "200" ]; then
        echo "✓ Bundle CSS accessible (${BUNDLE_CSS_URL})"
    else
        echo "  Bundle CSS not found (may be inlined)"
    fi
    
    return 0
}

# Function to check response headers
check_response_headers() {
    local url=$1
    
    echo ""
    echo "Test 5: Response Headers"
    echo "------------------------"
    
    HEADERS=$(curl -s -I "${url}")
    
    # Check Content-Type
    if echo "$HEADERS" | grep -qi "content-type.*text/html"; then
        echo "✓ Correct Content-Type header"
    else
        echo "✗ WARNING: Unexpected Content-Type"
    fi
    
    # Check for security headers
    if echo "$HEADERS" | grep -qi "x-frame-options"; then
        echo "✓ X-Frame-Options header present"
    else
        echo "  X-Frame-Options header not found"
    fi
    
    if echo "$HEADERS" | grep -qi "x-content-type-options"; then
        echo "✓ X-Content-Type-Options header present"
    else
        echo "  X-Content-Type-Options header not found"
    fi
    
    return 0
}

# Run all tests
echo ""
echo "Starting verification tests..."
echo ""

FAILED=0

check_site_accessibility "${STATIC_WEB_APP_URL}" || FAILED=1
check_html_content "${STATIC_WEB_APP_URL}" || FAILED=1
check_javascript_bundle "${STATIC_WEB_APP_URL}" || FAILED=1
check_css "${STATIC_WEB_APP_URL}" || FAILED=1
check_response_headers "${STATIC_WEB_APP_URL}" || FAILED=1

echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo "✓ All verification tests passed!"
    echo "=========================================="
    echo ""
    echo "Deployment URL: ${STATIC_WEB_APP_URL}"
    echo ""
    exit 0
else
    echo "✗ Some verification tests failed"
    echo "=========================================="
    echo ""
    echo "Please check the logs above for details"
    echo ""
    exit 1
fi
