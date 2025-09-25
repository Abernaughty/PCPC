#!/usr/bin/env node

/**
 * Simple test runner for Azure Functions endpoints
 * Usage: node test-runner.js
 */

const axios = require("axios");

const BASE_URL = "http://localhost:7071/api";
const TIMEOUT = 30000; // 30 seconds

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, color = "reset") {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async testEndpoint(method, endpoint, description, expectedStatus = 200) {
    const testStart = Date.now();
    this.log(`\n🧪 Testing: ${description}`, "blue");
    this.log(`${method} ${BASE_URL}${endpoint}`, "yellow");

    try {
      const config = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${endpoint}`,
        timeout: TIMEOUT,
        headers: {
          "Content-Type": "application/json",
        },
        validateStatus: () => true, // Don't throw on non-2xx status codes
      };

      const response = await axios(config);
      const duration = Date.now() - testStart;

      this.log(
        `Status: ${response.status}`,
        response.status === expectedStatus ? "green" : "red"
      );
      this.log(`Duration: ${duration}ms`, "cyan");

      if (response.status === expectedStatus) {
        this.log("✅ SUCCESS", "green");

        // Pretty print response data (truncated)
        if (response.data) {
          const dataStr = JSON.stringify(response.data, null, 2);
          const lines = dataStr.split("\n");
          if (lines.length > 20) {
            console.log(lines.slice(0, 20).join("\n"));
            this.log("... (truncated)", "yellow");
          } else {
            console.log(dataStr);
          }
        }

        this.results.push({
          test: description,
          status: "PASS",
          duration,
          responseStatus: response.status,
        });
      } else {
        this.log(
          `❌ FAILED (expected ${expectedStatus}, got ${response.status})`,
          "red"
        );

        // Show error response
        if (response.data) {
          console.log(JSON.stringify(response.data, null, 2));
        }

        this.results.push({
          test: description,
          status: "FAIL",
          duration,
          responseStatus: response.status,
          expectedStatus,
          error: response.data,
        });
      }
    } catch (error) {
      const duration = Date.now() - testStart;
      this.log(`❌ ERROR: ${error.message}`, "red");

      if (error.code === "ECONNREFUSED") {
        this.log(
          '💡 Make sure the Azure Functions runtime is running with "func start"',
          "yellow"
        );
      }

      this.results.push({
        test: description,
        status: "ERROR",
        duration,
        error: error.message,
      });
    }

    this.log("─".repeat(50), "cyan");
  }

  async runTests() {
    this.log("🚀 Starting Azure Functions Local Tests", "magenta");
    this.log("=".repeat(50), "cyan");

    // Test 1: Basic sets endpoint
    await this.testEndpoint("GET", "/sets", "Get all Pokemon sets");

    // Test 2: Sets with language filter
    await this.testEndpoint(
      "GET",
      "/sets?language=ENGLISH",
      "Get English sets only"
    );

    // Test 3: Sets with pagination
    await this.testEndpoint(
      "GET",
      "/sets?page=1&pageSize=5",
      "Get sets with pagination"
    );

    // Test 4: Sets with all parameter
    await this.testEndpoint(
      "GET",
      "/sets?all=true",
      "Get all sets (no pagination)"
    );

    // Test 5: Sets with multiple parameters
    await this.testEndpoint(
      "GET",
      "/sets?language=ENGLISH&all=true",
      "Get all English sets"
    );

    // Test 6: Invalid endpoint (should return 404)
    await this.testEndpoint(
      "GET",
      "/invalid-endpoint",
      "Invalid endpoint test",
      404
    );

    this.printSummary();
  }

  printSummary() {
    const totalTime = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const errors = this.results.filter((r) => r.status === "ERROR").length;

    this.log("\n🏁 Test Summary", "magenta");
    this.log("=".repeat(50), "cyan");
    this.log(`Total Tests: ${this.results.length}`, "blue");
    this.log(`Passed: ${passed}`, "green");
    this.log(`Failed: ${failed}`, failed > 0 ? "red" : "green");
    this.log(`Errors: ${errors}`, errors > 0 ? "red" : "green");
    this.log(`Total Time: ${totalTime}ms`, "cyan");

    if (failed > 0 || errors > 0) {
      this.log(
        "\n❌ Some tests failed. Check the logs above for details.",
        "red"
      );
      this.log("\n💡 Troubleshooting tips:", "yellow");
      this.log(
        "- Ensure Azure Functions runtime is running: func start",
        "yellow"
      );
      this.log("- Check your .env file has the correct API keys", "yellow");
      this.log("- Verify Cosmos DB emulator is running", "yellow");
      this.log(
        "- Check function logs for detailed error information",
        "yellow"
      );
    } else {
      this.log("\n✅ All tests passed!", "green");
    }
  }
}

// Run the tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.runTests().catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });
}

module.exports = TestRunner;
