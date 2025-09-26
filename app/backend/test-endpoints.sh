#!/bin/bash

# Test script for local Azure Functions endpoints
# Run this after starting the function app with 'func start'

BASE_URL="http://localhost:7071/api"
FUNCTION_KEY=""  # Add function key if needed

echo "🧪 Testing Azure Functions Endpoints Locally"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_status=${4:-200}
    
    echo -e "${BLUE}Testing: ${description}${NC}"
    echo -e "${YELLOW}${method} ${BASE_URL}${endpoint}${NC}"
    
    # Make the request and capture response
    response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        ${FUNCTION_KEY:+-H "x-functions-key: ${FUNCTION_KEY}"})
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract body (all but last line)
    body=$(echo "$response" | head -n -1)
    
    echo -e "Status: ${status_code}"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ SUCCESS${NC}"
        # Pretty print JSON if it's JSON
        if echo "$body" | jq . >/dev/null 2>&1; then
            echo "$body" | jq . | head -50
            if [ $(echo "$body" | jq . | wc -l) -gt 20 ]; then
                echo "... (truncated)"
            fi
        else
            echo "$body" | head -10
        fi
    else
        echo -e "${RED}❌ FAILED (expected ${expected_status}, got ${status_code})${NC}"
        echo "$body"
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Test endpoints
echo "Starting endpoint tests..."
echo ""

# Test 1: Get all sets
test_endpoint "GET" "/sets?all=true" "Get all Pokemon sets" 200

# Test 2: Get specific set (you may need to adjust the setId)
test_endpoint "GET" "/sets/557/cards" "Get all cards from set 557" 200

# Test 3: Get specific card from a set (adjust the setId and cardId as needed)
test_endpoint "GET" "/sets/557/cards/73121" "Get card with id 73121 from set 557" 200

# Test 4: Get specific card and check image URLs only
echo -e "${BLUE}Testing: Check image URLs for card 73121${NC}"
echo -e "${YELLOW}GET ${BASE_URL}/sets/557/cards/73121 (image URLs only)${NC}"

response=$(curl -s "${BASE_URL}/sets/557/cards/73121" \
    -H "Content-Type: application/json" \
    ${FUNCTION_KEY:+-H "x-functions-key: ${FUNCTION_KEY}"})

if echo "$response" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SUCCESS - Image URL Check${NC}"
    echo "$response" | jq '.data | {cardName, cardNumber, imageUrl, imageUrlHiRes, images}'
else
    echo -e "${RED}❌ FAILED - Invalid JSON response${NC}"
    echo "$response"
fi

echo ""
echo "----------------------------------------"
echo ""

echo ""
echo "🏁 Testing completed!"
echo ""
echo "💡 Tips:"
echo "- If you see 500 errors, check the function logs in your terminal"
echo "- If you see 401/403 errors, check your API keys in .env"
echo "- If you see connection errors, make sure 'func start' is running"
echo ""
