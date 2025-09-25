#!/bin/bash

# DevContainer Startup Performance Test Script
# Tests the optimized container configuration and measures startup times

set -euo pipefail

echo "🚀 DevContainer Startup Performance Test"
echo "========================================"
echo "Date: $(date)"
echo "Testing optimized configuration with reduced timeouts"
echo ""

# Configuration
COMPOSE_FILE=".devcontainer/docker-compose.yml"
PROJECT_NAME="pcpc_devcontainer_test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to measure time
measure_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo $duration
}

# Cleanup function
cleanup() {
    print_status $YELLOW "🧹 Cleaning up test containers..."
    docker compose -p $PROJECT_NAME -f $COMPOSE_FILE down --remove-orphans --volumes 2>/dev/null || true
    docker system prune -f >/dev/null 2>&1 || true
}

# Trap cleanup on exit
trap cleanup EXIT

# Start timing
TOTAL_START_TIME=$(date +%s)

print_status $BLUE "📋 Pre-flight checks..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_status $RED "❌ Docker is not running or accessible"
    exit 1
fi

# Check available resources
print_status $BLUE "💾 System Resources:"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $2 " total, " $7 " available"}')"
echo "Disk: $(df -h . | tail -1 | awk '{print $4 " available"}')"
echo ""

# Clean up any existing containers
cleanup

print_status $BLUE "🏗️  Starting container build and startup..."
BUILD_START_TIME=$(date +%s)

# Start containers with timing
docker compose -p $PROJECT_NAME -f $COMPOSE_FILE up -d

BUILD_END_TIME=$(date +%s)
BUILD_DURATION=$(measure_time $BUILD_START_TIME)

print_status $GREEN "✅ Containers started in ${BUILD_DURATION} seconds"
echo ""

# Monitor health check progress
print_status $BLUE "🔍 Monitoring health check progress..."
HEALTH_START_TIME=$(date +%s)

# Function to check service health
check_service_health() {
    local service=$1
    local status=$(docker compose -p $PROJECT_NAME -f $COMPOSE_FILE ps --format json | jq -r ".[] | select(.Service == \"$service\") | .Health")
    echo $status
}

# Monitor Azurite health
print_status $YELLOW "⏳ Waiting for Azurite to become healthy..."
AZURITE_START_TIME=$(date +%s)
while true; do
    AZURITE_HEALTH=$(check_service_health "azurite")
    if [ "$AZURITE_HEALTH" = "healthy" ]; then
        AZURITE_DURATION=$(measure_time $AZURITE_START_TIME)
        print_status $GREEN "✅ Azurite healthy after ${AZURITE_DURATION} seconds"
        break
    elif [ "$AZURITE_HEALTH" = "unhealthy" ]; then
        print_status $RED "❌ Azurite failed health check"
        docker compose -p $PROJECT_NAME -f $COMPOSE_FILE logs azurite
        exit 1
    fi
    
    # Check timeout (should be under 60s with new config)
    CURRENT_DURATION=$(measure_time $AZURITE_START_TIME)
    if [ $CURRENT_DURATION -gt 90 ]; then
        print_status $RED "❌ Azurite health check timeout after ${CURRENT_DURATION}s"
        exit 1
    fi
    
    sleep 2
done

# Monitor Cosmos DB health
print_status $YELLOW "⏳ Waiting for Cosmos DB to become healthy..."
COSMOS_START_TIME=$(date +%s)
while true; do
    COSMOS_HEALTH=$(check_service_health "cosmosdb-emulator")
    if [ "$COSMOS_HEALTH" = "healthy" ]; then
        COSMOS_DURATION=$(measure_time $COSMOS_START_TIME)
        print_status $GREEN "✅ Cosmos DB healthy after ${COSMOS_DURATION} seconds"
        break
    elif [ "$COSMOS_HEALTH" = "unhealthy" ]; then
        print_status $RED "❌ Cosmos DB failed health check"
        docker compose -p $PROJECT_NAME -f $COMPOSE_FILE logs cosmosdb-emulator
        exit 1
    fi
    
    # Check timeout (should be under 120s with new config)
    CURRENT_DURATION=$(measure_time $COSMOS_START_TIME)
    if [ $CURRENT_DURATION -gt 180 ]; then
        print_status $RED "❌ Cosmos DB health check timeout after ${CURRENT_DURATION}s"
        exit 1
    fi
    
    sleep 5
done

HEALTH_END_TIME=$(date +%s)
HEALTH_DURATION=$(measure_time $HEALTH_START_TIME)

# Test connectivity
print_status $BLUE "🔗 Testing service connectivity..."

# Test Azurite
if curl -s -o /dev/null http://localhost:10000/devstoreaccount1/; then
    print_status $GREEN "✅ Azurite connectivity test passed"
else
    print_status $RED "❌ Azurite connectivity test failed"
fi

# Test Cosmos DB
if curl -k -s -o /dev/null https://localhost:8081/_explorer/emulator.pem; then
    print_status $GREEN "✅ Cosmos DB connectivity test passed"
else
    print_status $RED "❌ Cosmos DB connectivity test failed"
fi

# Calculate total time
TOTAL_END_TIME=$(date +%s)
TOTAL_DURATION=$(measure_time $TOTAL_START_TIME)

# Performance Summary
echo ""
print_status $BLUE "📊 Performance Summary"
print_status $BLUE "====================="
echo "Container Build & Start: ${BUILD_DURATION}s"
echo "Azurite Health Check:    ${AZURITE_DURATION}s"
echo "Cosmos DB Health Check:  ${COSMOS_DURATION}s"
echo "Total Health Checks:     ${HEALTH_DURATION}s"
echo "Total Startup Time:      ${TOTAL_DURATION}s"
echo ""

# Performance Analysis
print_status $BLUE "📈 Performance Analysis"
print_status $BLUE "======================"

if [ $TOTAL_DURATION -lt 180 ]; then
    print_status $GREEN "🎉 EXCELLENT: Total startup under 3 minutes"
elif [ $TOTAL_DURATION -lt 300 ]; then
    print_status $GREEN "✅ GOOD: Total startup under 5 minutes"
elif [ $TOTAL_DURATION -lt 600 ]; then
    print_status $YELLOW "⚠️  ACCEPTABLE: Total startup under 10 minutes"
else
    print_status $RED "❌ POOR: Total startup over 10 minutes - needs investigation"
fi

# Optimization effectiveness
echo ""
print_status $BLUE "🎯 Optimization Effectiveness"
print_status $BLUE "============================"

if [ $AZURITE_DURATION -lt 60 ]; then
    print_status $GREEN "✅ Azurite: Within optimized target (60s)"
else
    print_status $YELLOW "⚠️  Azurite: Exceeded target, consider further optimization"
fi

if [ $COSMOS_DURATION -lt 120 ]; then
    print_status $GREEN "✅ Cosmos DB: Within optimized target (120s)"
else
    print_status $YELLOW "⚠️  Cosmos DB: Exceeded target, may need resource tuning"
fi

# Resource usage
echo ""
print_status $BLUE "💻 Resource Usage"
print_status $BLUE "================"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $(docker compose -p $PROJECT_NAME -f $COMPOSE_FILE ps -q)

echo ""
print_status $GREEN "🏁 Performance test completed successfully!"
print_status $BLUE "💡 Compare these results with the previous 45-minute startup time"

# Save results to file
RESULTS_FILE=".devcontainer/docs/performance-test-results.txt"
{
    echo "DevContainer Performance Test Results"
    echo "Date: $(date)"
    echo "====================================="
    echo "Container Build & Start: ${BUILD_DURATION}s"
    echo "Azurite Health Check:    ${AZURITE_DURATION}s"
    echo "Cosmos DB Health Check:  ${COSMOS_DURATION}s"
    echo "Total Health Checks:     ${HEALTH_DURATION}s"
    echo "Total Startup Time:      ${TOTAL_DURATION}s"
    echo ""
    echo "System Resources:"
    echo "Memory: $(free -h | grep '^Mem:' | awk '{print $2 " total, " $7 " available"}')"
    echo "Disk: $(df -h . | tail -1 | awk '{print $4 " available"}')"
} > $RESULTS_FILE

print_status $BLUE "📄 Results saved to: $RESULTS_FILE"
