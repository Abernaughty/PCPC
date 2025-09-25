import { CosmosClient } from "@azure/cosmos";

// Disable SSL verification for local emulator (development only)
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const endpoint = "https://cosmosdb-emulator:8081";
// Fallback to localhost for debugging outside container
// const endpoint = "https://localhost:8081";
const key =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

console.log(`🔍 [DEBUG] Starting Cosmos DB readiness check...`);
console.log(`🔍 [DEBUG] Endpoint: ${endpoint}`);
console.log(
  `🔍 [DEBUG] SSL Verification Disabled: ${
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
  }`
);

const client = new CosmosClient({
  endpoint,
  key,
  connectionPolicy: {
    disableSSLVerification: true,
    requestTimeout: 30000, // 30 second timeout per request
    retryOptions: {
      maxRetryAttemptCount: 3,
      fixedRetryIntervalInMilliseconds: 1000,
    },
  },
});

const maxAttempts = 60; // 5 minutes (5 second intervals)
let attempt = 1;

async function testBasicConnectivity() {
  console.log(`🔍 [DEBUG] Testing basic HTTP connectivity...`);
  try {
    // Use GET request to a simpler endpoint that should always work
    const response = await fetch(`${endpoint}/`, {
      method: "GET",
      headers: { Accept: "*/*" },
    });
    console.log(
      `🔍 [DEBUG] HTTP connectivity test: ${response.status} ${response.statusText}`
    );
    // Accept any response that isn't a network error (even 4xx/5xx means server is responding)
    return response.status > 0;
  } catch (error) {
    console.log(`🔍 [DEBUG] HTTP connectivity failed: ${error.message}`);
    return false;
  }
}

async function testCosmosConnection() {
  console.log(`🔍 [DEBUG] Testing Cosmos DB data plane connection...`);
  try {
    const startTime = Date.now();
    const account = await client.getDatabaseAccount();
    const duration = Date.now() - startTime;
    console.log(`🔍 [DEBUG] Connection successful in ${duration}ms`);
    console.log(
      `🔍 [DEBUG] Account info: ${JSON.stringify({
        id: account.id,
        writableLocations: account.writableLocations?.length || 0,
        readableLocations: account.readableLocations?.length || 0,
      })}`
    );
    return true;
  } catch (error) {
    console.log(
      `🔍 [DEBUG] Connection failed - Error type: ${error.constructor.name}`
    );
    console.log(`🔍 [DEBUG] Error code: ${error.code || "N/A"}`);
    console.log(`🔍 [DEBUG] Error message: ${error.message}`);
    console.log(
      `🔍 [DEBUG] Error stack: ${error.stack?.split("\n")[0] || "N/A"}`
    );

    // Log additional error details if available
    if (error.body) {
      console.log(`🔍 [DEBUG] Error body: ${JSON.stringify(error.body)}`);
    }
    if (error.headers) {
      console.log(`🔍 [DEBUG] Error headers: ${JSON.stringify(error.headers)}`);
    }

    return false;
  }
}

async function checkReadiness() {
  console.log(
    `🚀 Starting readiness check with ${maxAttempts} attempts (${
      maxAttempts * 5
    } seconds max)`
  );

  while (attempt <= maxAttempts) {
    console.log(
      `\n⏳ Attempt ${attempt}/${maxAttempts} (${attempt * 5}s elapsed)`
    );

    // First test basic HTTP connectivity
    const httpOk = await testBasicConnectivity();
    if (!httpOk) {
      console.log(`❌ HTTP connectivity failed on attempt ${attempt}`);
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    // Then test Cosmos DB data plane
    const cosmosOk = await testCosmosConnection();
    if (cosmosOk) {
      console.log(`✅ Cosmos DB ready after ${attempt * 5} seconds`);
      process.exit(0);
    }

    // Show progress every 10 attempts
    if (attempt % 10 === 0) {
      console.log(
        `📊 Progress: ${attempt}/${maxAttempts} attempts (${Math.round(
          (attempt / maxAttempts) * 100
        )}%)`
      );
    }

    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.error(`\n❌ Cosmos DB not ready after ${maxAttempts * 5} seconds`);
  console.error(`💡 Troubleshooting suggestions:`);
  console.error(
    `   - Check if CosmosDB emulator container has sufficient memory (4GB+)`
  );
  console.error(
    `   - Verify container logs: docker logs <cosmosdb-container-name>`
  );
  console.error(`   - Try increasing timeout or restarting the emulator`);
  process.exit(1);
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log(`\n🛑 Readiness check interrupted after ${attempt * 5} seconds`);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log(`\n🛑 Readiness check terminated after ${attempt * 5} seconds`);
  process.exit(1);
});

checkReadiness();
