#!/bin/bash

# -----------------------------------------------------------------------------
# PCPC API Management Testing Script
# -----------------------------------------------------------------------------
# This script tests API endpoints for the specified environment
# Usage: ./test-apis.sh <environment>
# Example: ./test-apis.sh dev

set -e  # Exit on any error

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_DIR="$PROJECT_ROOT/environments"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=2

# -----------------------------------------------------------------------------
# FUNCTIONS
# -----------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_usage() {
    echo "Usage: $0 <environment>"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev, staging, prod)"
    echo ""
    echo "Examples:"
    echo "  $0 dev         # Test development API endpoints"
    echo "  $0 prod        # Test production API endpoints"
    echo ""
    echo "Environment Variables:"
    echo "  APIM_SUBSCRIPTION_KEY    API Management subscription key for testing"
}

get_api_base_url() {
    local environment="$1"
    local env_dir="$ENVIRONMENTS_DIR/$environment"
    
    if [ ! -d "$env_dir" ]; then
        log_error "Environment directory not found: $env_dir"
        return 1
    fi
    
    cd "$env_dir"
    
    # Try to get base URL from Terraform output
    local base_url=""
    if terraform output api_endpoints &>/dev/null; then
        base_url=$(terraform output -json api_endpoints 2>/dev/null | jq -r '.base_url' 2>/dev/null || echo "")
    fi
    
    # Fallback to environment-specific URLs
    if [ -z "$base_url" ]; then
        case "$environment" in
            "dev")
                base_url="https://maber-apim-test.azure-api.net/pokedata-api/api/v1"
                ;;
            "staging")
                base_url="https://maber-apim-staging.azure-api.net/pokedata-api/api/v1"
                ;;
            "prod")
                base_url="https://maber-apim-prod.azure-api.net/pokedata-api/api/v1"
                ;;
            *)
                log_error "Unknown environment: $environment"
                return 1
                ;;
        esac
        log_warning "Using fallback base URL: $base_url"
    fi
    
    echo "$base_url"
}

test_endpoint() {
    local url="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    log_info "Testing: $description"
    log_info "URL: $url"
    
    local headers=()
    if [ -n "$APIM_SUBSCRIPTION_KEY" ]; then
        headers+=("-H" "Ocp-Apim-Subscription-Key: $APIM_SUBSCRIPTION_KEY")
    fi
    
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
                            --max-time $TIMEOUT \
                            "${headers[@]}" \
                            "$url" 2>/dev/null || echo -e "\n000\n0")
        
        local body=$(echo "$response" | head -n -2)
        local status_code=$(echo "$response" | tail -n 2 | head -n 1)
        local response_time=$(echo "$response" | tail -n 1)
        
        if [ "$status_code" = "$expected_status" ]; then
            log_success "✅ $description (${response_time}s)"
            if [ -n "$body" ] && command -v jq &>/dev/null; then
                local record_count=$(echo "$body" | jq -r '.data.pagination.totalCount // .data.sets // .data.cards // empty | length // empty' 2>/dev/null || echo "")
                if [ -n "$record_count" ]; then
                    log_info "   Records returned: $record_count"
                fi
            fi
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                log_warning "   Attempt $retry_count failed (HTTP $status_code), retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            else
                log_error "❌ $description (HTTP $status_code after $MAX_RETRIES attempts)"
                if [ -n "$body" ]; then
                    log_error "   Response: $body"
                fi
                return 1
            fi
        fi
    done
}

test_api_endpoints() {
    local base_url="$1"
    local environment="$2"
    
    log_info "🧪 Testing API endpoints for environment: $environment"
    log_info "Base URL: $base_url"
    
    local failed_tests=0
    local total_tests=0
    
    # Test 1: Get Sets (basic)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets?pageSize=5" "Get Sets (basic)"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 2: Get Sets (with language filter)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets?language=ENGLISH&pageSize=3" "Get Sets (language filter)"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 3: Get Sets (all sets)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets?all=true" "Get Sets (all sets)"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 4: Get Cards by Set (if we have a known set)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets/sv8/cards?pageSize=5" "Get Cards by Set (sv8)"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 5: Get Card Info (if we have a known card)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets/sv8/cards/001" "Get Card Info (sv8-001)"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 6: Error handling (invalid set)
    total_tests=$((total_tests + 1))
    if ! test_endpoint "$base_url/sets/invalid-set/cards" "Error handling (invalid set)" "404"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Test 7: Rate limiting (if subscription key provided)
    if [ -n "$APIM_SUBSCRIPTION_KEY" ]; then
        total_tests=$((total_tests + 1))
        log_info "Testing: Rate limiting behavior"
        local rate_limit_header=""
        for i in {1..5}; do
            local response=$(curl -s -I --max-time $TIMEOUT \
                                -H "Ocp-Apim-Subscription-Key: $APIM_SUBSCRIPTION_KEY" \
                                "$base_url/sets?pageSize=1" 2>/dev/null || echo "")
            rate_limit_header=$(echo "$response" | grep -i "x-ratelimit-remaining" || echo "")
            if [ -n "$rate_limit_header" ]; then
                break
            fi
            sleep 1
        done
        
        if [ -n "$rate_limit_header" ]; then
            log_success "✅ Rate limiting headers present: $rate_limit_header"
        else
            log_warning "⚠️  Rate limiting headers not found"
            failed_tests=$((failed_tests + 1))
        fi
    else
        log_warning "APIM_SUBSCRIPTION_KEY not set, skipping authenticated tests"
    fi
    
    # Summary
    echo ""
    log_info "📊 Test Summary"
    log_info "Total tests: $total_tests"
    log_info "Passed: $((total_tests - failed_tests))"
    log_info "Failed: $failed_tests"
    
    if [ $failed_tests -eq 0 ]; then
        log_success "🎉 All tests passed!"
        return 0
    else
        log_error "💥 $failed_tests test(s) failed"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# MAIN SCRIPT
# -----------------------------------------------------------------------------

main() {
    local environment="$1"
    
    # Validate arguments
    if [ -z "$environment" ]; then
        log_error "Environment argument is required"
        print_usage
        exit 1
    fi
    
    if [ "$environment" != "dev" ] && [ "$environment" != "staging" ] && [ "$environment" != "prod" ]; then
        log_error "Invalid environment: $environment"
        log_error "Valid environments: dev, staging, prod"
        exit 1
    fi
    
    log_info "🚀 Starting API endpoint testing for environment: $environment"
    
    # Get API base URL
    local base_url
    base_url=$(get_api_base_url "$environment")
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    # Run tests
    if test_api_endpoints "$base_url" "$environment"; then
        log_success "✅ API testing completed successfully!"
        exit 0
    else
        log_error "❌ API testing failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
