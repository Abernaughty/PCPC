#!/usr/bin/env node

/**
 * Migration Script: JSON to Cosmos DB
 *
 * This script migrates set mapping data from the legacy JSON file format
 * to the new Cosmos DB storage system.
 *
 * Usage:
 *   node migrate-json-to-cosmos.js [options]
 *
 * Options:
 *   --dry-run    Preview changes without writing to database
 *   --force      Overwrite existing mappings in Cosmos DB
 *   --json-path  Path to JSON file (default: ../data/set-mapping.json)
 *
 * Environment Variables Required:
 *   COSMOS_DB_CONNECTION_STRING - Cosmos DB connection string
 *   COSMOS_DB_DATABASE_NAME     - Database name (default: PokemonCards)
 *   COSMOS_DB_SET_MAPPINGS_CONTAINER_NAME - Container name (default: SetMappings)
 */

const fs = require("fs");
const path = require("path");
const { CosmosClient } = require("@azure/cosmos");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const jsonPathIndex = args.indexOf("--json-path");
const jsonPath =
  jsonPathIndex >= 0 && args[jsonPathIndex + 1]
    ? args[jsonPathIndex + 1]
    : path.join(__dirname, "../data/set-mapping.json");

// Configuration
const config = {
  connectionString: process.env.COSMOS_DB_CONNECTION_STRING,
  databaseName: process.env.COSMOS_DB_DATABASE_NAME || "PokemonCards",
  containerName:
    process.env.COSMOS_DB_SET_MAPPINGS_CONTAINER_NAME || "SetMappings",
};

// Validate configuration
if (!config.connectionString) {
  console.error(
    "ERROR: COSMOS_DB_CONNECTION_STRING environment variable is required"
  );
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`ERROR: JSON file not found at ${jsonPath}`);
  process.exit(1);
}

console.log("=".repeat(80));
console.log("Set Mapping Migration: JSON to Cosmos DB");
console.log("=".repeat(80));
console.log(`Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`);
console.log(
  `Force: ${
    isForce ? "Yes (will overwrite existing)" : "No (will skip existing)"
  }`
);
console.log(`JSON File: ${jsonPath}`);
console.log(`Database: ${config.databaseName}`);
console.log(`Container: ${config.containerName}`);
console.log("=".repeat(80));
console.log();

/**
 * Load and parse JSON file
 */
function loadJsonData() {
  console.log("Loading JSON data...");
  const jsonContent = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(jsonContent);

  console.log(
    `✓ Loaded ${Object.keys(data.mappings || {}).length} mappings from JSON`
  );
  console.log(
    `  - Unmapped TCG sets: ${data.unmapped?.pokemonTcg?.length || 0}`
  );
  console.log(
    `  - Unmapped PokeData sets: ${data.unmapped?.pokeData?.length || 0}`
  );
  console.log();

  return data;
}

/**
 * Convert JSON mapping to Cosmos DB document format
 */
function convertMapping(tcgSetCode, jsonMapping) {
  const now = new Date().toISOString();

  return {
    id: String(jsonMapping.pokeDataId),
    documentType: "setMapping",
    pokeDataSetId: jsonMapping.pokeDataId,
    pokeDataSetCode: jsonMapping.pokeDataCode,
    pokeDataSetName: jsonMapping.pokeDataName,
    tcgSetId: tcgSetCode,
    tcgSetName: jsonMapping.tcgName,
    matchType: jsonMapping.matchType || "automatic",
    confidence: 0.95, // Default confidence for migrated data
    status: "active",
    createdAt: now,
    updatedAt: now,
    metadata: {
      migratedFrom: "json",
      migrationDate: now,
      originalTcgCode: tcgSetCode,
    },
  };
}

/**
 * Convert unmapped PokeData set to Cosmos DB document format
 */
function convertUnmappedPokeData(unmappedSet) {
  const now = new Date().toISOString();

  return {
    id: String(unmappedSet.id),
    documentType: "setMapping",
    pokeDataSetId: unmappedSet.id,
    pokeDataSetCode: unmappedSet.code,
    pokeDataSetName: unmappedSet.name,
    tcgSetId: null,
    tcgSetName: null,
    matchType: "unmatched",
    confidence: 0,
    status: "unmatched",
    createdAt: now,
    updatedAt: now,
    metadata: {
      migratedFrom: "json",
      migrationDate: now,
    },
  };
}

/**
 * Create metadata document
 */
function createMetadataDocument(jsonData) {
  const now = new Date().toISOString();

  return {
    id: "__metadata__",
    documentType: "metadata",
    lastPokeDataSetCount: jsonData.metadata?.totalMappings || 0,
    lastTcgSetCount: Object.keys(jsonData.mappings || {}).length,
    lastRunAt: jsonData.metadata?.generated || now,
    lastDiffDetectedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    // Load JSON data
    const jsonData = loadJsonData();

    // Initialize Cosmos DB client
    console.log("Connecting to Cosmos DB...");
    const client = new CosmosClient(config.connectionString);
    const database = client.database(config.databaseName);
    const container = database.container(config.containerName);
    console.log("✓ Connected to Cosmos DB");
    console.log();

    // Prepare documents to migrate
    const documents = [];

    // Convert mapped sets
    for (const [tcgSetCode, mapping] of Object.entries(
      jsonData.mappings || {}
    )) {
      documents.push(convertMapping(tcgSetCode, mapping));
    }

    // Convert unmapped PokeData sets
    for (const unmappedSet of jsonData.unmapped?.pokeData || []) {
      documents.push(convertUnmappedPokeData(unmappedSet));
    }

    // Add metadata document
    const metadataDoc = createMetadataDocument(jsonData);

    console.log(
      `Prepared ${documents.length} set mappings + 1 metadata document for migration`
    );
    console.log();

    if (isDryRun) {
      console.log("DRY RUN - Would migrate the following:");
      console.log(
        `  - ${documents.filter((d) => d.tcgSetId).length} mapped sets`
      );
      console.log(
        `  - ${documents.filter((d) => !d.tcgSetId).length} unmapped sets`
      );
      console.log(`  - 1 metadata document`);
      console.log();
      console.log("Sample documents:");
      console.log(JSON.stringify(documents.slice(0, 2), null, 2));
      console.log("...");
      console.log(JSON.stringify(metadataDoc, null, 2));
      return;
    }

    // Migrate documents
    console.log("Migrating documents to Cosmos DB...");
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        // Check if document exists
        let exists = false;
        try {
          await container.item(doc.id, doc.id).read();
          exists = true;
        } catch (error) {
          if (error.code !== 404) {
            throw error;
          }
        }

        if (exists && !isForce) {
          skipped++;
          process.stdout.write(".");
        } else {
          await container.items.upsert(doc);
          if (exists) {
            updated++;
            process.stdout.write("U");
          } else {
            created++;
            process.stdout.write("+");
          }
        }
      } catch (error) {
        errors++;
        process.stdout.write("E");
        console.error(`\nError migrating document ${doc.id}:`, error.message);
      }
    }

    console.log("\n");

    // Migrate metadata
    try {
      await container.items.upsert(metadataDoc);
      console.log("✓ Metadata document migrated");
    } catch (error) {
      console.error("✗ Error migrating metadata:", error.message);
    }

    console.log();
    console.log("=".repeat(80));
    console.log("Migration Summary");
    console.log("=".repeat(80));
    console.log(`Created:  ${created}`);
    console.log(`Updated:  ${updated}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Errors:   ${errors}`);
    console.log("=".repeat(80));

    if (errors > 0) {
      console.log(
        "\n⚠️  Migration completed with errors. Please review the logs above."
      );
      process.exit(1);
    } else {
      console.log("\n✓ Migration completed successfully!");
    }
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrate().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
