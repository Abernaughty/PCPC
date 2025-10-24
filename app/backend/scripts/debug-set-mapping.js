#!/usr/bin/env node

/**
 * Debug utility to trace the dynamic set mapping pipeline.
 *
 * Usage:
 *    node scripts/debug-set-mapping.js <pokeDataSetId|setCode> [--force-sync]
 *
 * The script walks through each dependency used by the orchestrator:
 *  1. Reads the current Cosmos DB mapping (if credentials are available).
 *  2. Fetches PokeData set metadata.
 *  3. Fetches Pokemon TCG API sets and checks for direct matches.
 *  4. Runs SetMatchingEngine to show the automatic match decision.
 *  5. Reports cache state from PokeDataToTcgMappingService.
 *  6. Shows orchestrator metadata to explain skip conditions.
 *
 * Each step is recorded with a status so that the failure point is obvious.
 */

const path = require("path");
process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT ||
  path.join(__dirname, "../tsconfig.json");
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  JSON.stringify({
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
  });

require("ts-node/register/transpile-only");

const fs = require("fs");

const dotenvPath = path.join(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  require("dotenv").config({ path: dotenvPath });
}

const {
  PokeDataApiService,
} = require("../src/services/PokeDataApiService");
const {
  PokemonTcgApiService,
} = require("../src/services/PokemonTcgApiService");
const {
  SetMatchingEngine,
} = require("../src/services/SetMatchingEngine");
const {
  SetMappingRepository,
} = require("../src/services/SetMappingRepository");
const {
  PokeDataToTcgMappingService,
} = require("../src/services/PokeDataToTcgMappingService");

const results = [];

function record(stage, status, details) {
  results.push({ stage, status, details });
  const statusLabel = status === "OK" ? "✅" : status === "WARN" ? "⚠️ " : "❌";
  if (details) {
    console.log(`${statusLabel} [${stage}] ${status} - ${details}`);
  } else {
    console.log(`${statusLabel} [${stage}] ${status}`);
  }
}

function showSummary() {
  console.log("\n==================== Debug Summary ====================");
  for (const entry of results) {
    const statusLabel =
      entry.status === "OK" ? "✅" : entry.status === "WARN" ? "⚠️" : "❌";
    console.log(
      `${statusLabel} ${entry.stage}: ${entry.status}${
        entry.details ? ` - ${entry.details}` : ""
      }`
    );
  }
  console.log("=======================================================\n");
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  let identifier = null;
  let forceSync = false;

  for (const arg of rawArgs) {
    if (arg === "--force-sync" || arg === "-f") {
      forceSync = true;
      continue;
    }
    if (!identifier && !arg.startsWith("-")) {
      identifier = arg;
      continue;
    }
  }

  if (!identifier) {
    console.error(
      "Usage: node scripts/debug-set-mapping.js <pokeDataSetId|setCode> [--force-sync]"
    );
    process.exit(1);
  }

  return { identifier: String(identifier), forceSync };
}

async function getCosmosRepository() {
  const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connectionString) {
    record(
      "Cosmos",
      "WARN",
      "COSMOS_DB_CONNECTION_STRING not set. Skipping repository checks."
    );
    return null;
  }

  try {
    return new SetMappingRepository(connectionString);
  } catch (error) {
    record(
      "Cosmos",
      "FAIL",
      `Failed to initialize SetMappingRepository: ${error.message}`
    );
    return null;
  }
}

async function fetchPokeDataSet(api, identifier, allSetsCache) {
  try {
    const sets =
      allSetsCache ||
      (await api.getAllSets().catch((error) => {
        throw new Error(
          `Failed to fetch PokeData sets: ${error.message || error}`
        );
      }));

    const numericId =
      /^\d+$/.test(identifier) ? Number.parseInt(identifier, 10) : null;
    const target = numericId
      ? sets.find((set) => set.id === numericId)
      : sets.find(
          (set) =>
            set.code &&
            set.code.toUpperCase() === identifier.toUpperCase()
        );

    if (!target) {
      throw new Error(
        `No PokeData set found for identifier "${identifier}".`
      );
    }

    record(
      "PokeData API",
      "OK",
      `Found set ${target.name} (ID: ${target.id}, Code: ${
        target.code || "N/A"
      })`
    );

    return { target, sets };
  } catch (error) {
    record("PokeData API", "FAIL", error.message);
    return { target: null, sets: allSetsCache || [] };
  }
}

async function fetchPokemonTcgSets(api) {
  try {
    const sets = await api.getAllSets();
    if (!Array.isArray(sets) || sets.length === 0) {
      throw new Error("Pokemon TCG API returned no sets.");
    }

    record(
      "Pokemon TCG API",
      "OK",
      `Retrieved ${sets.length} sets from Pokemon TCG API`
    );
    return sets;
  } catch (error) {
    record(
      "Pokemon TCG API",
      "FAIL",
      `Failed to retrieve sets: ${error.message || error}`
    );
    return [];
  }
}

function inspectTcgCoverage(tcgSets, pokeDataSet) {
  if (!pokeDataSet) {
    record(
      "TCG Coverage",
      "WARN",
      "Skipping coverage check (PokeData set not resolved)."
    );
    return { direct: null, byCode: null };
  }

  if (tcgSets.length === 0) {
    record(
      "TCG Coverage",
      "WARN",
      "Skipping coverage check (Pokemon TCG catalog unavailable)."
    );
    return { direct: null, byCode: null };
  }

  const byCode =
    pokeDataSet.code &&
    tcgSets.find(
      (set) =>
        set.code && set.code.toUpperCase() === pokeDataSet.code.toUpperCase()
    );

  if (byCode) {
    record(
      "TCG Coverage",
      "OK",
      `TCG set found via code match: ${byCode.name} (${byCode.code})`
    );
    return { direct: byCode, byCode };
  }

  record(
    "TCG Coverage",
    "WARN",
    `No direct TCG set match for code "${pokeDataSet.code || "N/A"}"`
  );
  return { direct: null, byCode: null };
}

async function runMatchingEngine(pokeDataSet, tcgSets) {
  if (!pokeDataSet || tcgSets.length === 0) {
    record(
      "SetMatchingEngine",
      "WARN",
      "Skipping automatic match (missing inputs)."
    );
    return null;
  }

  try {
    const engine = new SetMatchingEngine();
    const match = engine.match(pokeDataSet, tcgSets);
    if (match?.tcgSet) {
      record(
        "SetMatchingEngine",
        "OK",
        `Matched to ${match.tcgSet.name} (${match.tcgSet.code}) with confidence ${match.confidence.toFixed(
          2
        )} - ${match.reason}`
      );
    } else {
      record(
        "SetMatchingEngine",
        "WARN",
        "No automatic match produced. Check engine logs above for details."
      );
    }
    return match;
  } catch (error) {
    record(
      "SetMatchingEngine",
      "FAIL",
      `Matching engine threw error: ${error.message}`
    );
    return null;
  }
}

async function inspectRepositoryState(repository, pokeDataSetId) {
  if (!repository) {
    return { mapping: null, metadata: null };
  }

  try {
    const mapping = await repository.getMappingByPokeDataSetId(
      pokeDataSetId
    );
    if (mapping) {
      record(
        "Cosmos Mapping",
        "OK",
        `Mapping status: ${mapping.status}, tcgSetId: ${
          mapping.tcgSetId || "null"
        }, matchType: ${mapping.matchType}, updatedAt: ${mapping.updatedAt}`
      );
    } else {
      record(
        "Cosmos Mapping",
        "WARN",
        `No mapping document found for PokeData set ID ${pokeDataSetId}`
      );
    }

    const metadata = await repository.getMetadata();
    if (metadata) {
      record(
        "Cosmos Metadata",
        "OK",
        `Last run: ${metadata.lastRunAt || "never"}, PokeData sets: ${
          metadata.lastPokeDataSetCount
        }, TCG sets: ${metadata.lastTcgSetCount}`
      );
    } else {
      record("Cosmos Metadata", "WARN", "No metadata document found.");
    }

    return { mapping, metadata };
  } catch (error) {
    record(
      "Cosmos Mapping",
      "FAIL",
      `Failed to query repository: ${error.message}`
    );
    return { mapping: null, metadata: null };
  }
}

async function inspectMappingCache(repository, pokeDataSetId) {
  if (!repository) {
    record(
      "Mapping Cache",
      "WARN",
      "Skipping cache inspection (repository unavailable)."
    );
    return;
  }

  try {
    const ttlSeconds = Number.parseInt(
      process.env.SET_MAPPING_CACHE_TTL_SECONDS || "900",
      10
    );
    const mappingService = new PokeDataToTcgMappingService(
      repository,
      ttlSeconds
    );

    const tcgSetId = await mappingService.getTcgSetId(pokeDataSetId);
    if (tcgSetId) {
      record(
        "Mapping Cache",
        "OK",
        `Cache lookup returned tcgSetId="${tcgSetId}"`
      );
    } else {
      record(
        "Mapping Cache",
        "WARN",
        "Cache lookup returned null. Enhancement will skip images until mapping exists."
      );
    }

    const stats = mappingService.getCacheStats();
    record(
      "Mapping Cache Stats",
      "OK",
      `Entries: ${stats.size}, valid: ${stats.isValid}, ageMs: ${
        stats.ageMs ?? "n/a"
      }, ttlMs: ${stats.ttlMs}`
    );
  } catch (error) {
    record(
      "Mapping Cache",
      "FAIL",
      `Failed to inspect cache: ${error.message}`
    );
  }
}

async function evaluateSkipCondition(
  metadata,
  pokeDataSets,
  tcgSets
) {
  if (!metadata || pokeDataSets.length === 0 || tcgSets.length === 0) {
    record(
      "Sync Skip Check",
      "WARN",
      "Insufficient data to evaluate skip conditions."
    );
    return;
  }

  const countsChanged =
    metadata.lastPokeDataSetCount !== pokeDataSets.length ||
    metadata.lastTcgSetCount !== tcgSets.length;

  if (!countsChanged) {
    record(
      "Sync Skip Check",
      "WARN",
      "Orchestrator will skip because catalog counts match the last run."
    );
  } else {
    record(
      "Sync Skip Check",
      "OK",
      "Catalog counts changed. Orchestrator should process sets."
    );
  }
}

async function maybeForceSync(force, repository, orchestrator) {
  if (!force) {
    return;
  }

  if (!orchestrator) {
    record(
      "Force Sync",
      "WARN",
      "Orchestrator not available in this context."
    );
    return;
  }

  try {
    record(
      "Force Sync",
      "OK",
      "Triggering orchestrator.synchronize({ force: true })"
    );
    const summary = await orchestrator.synchronize({
      correlationId: `debug-${Date.now()}`,
      force: true,
    });
    record(
      "Force Sync Result",
      "OK",
      `New mappings: ${summary.newMappings}, updated: ${summary.updatedMappings}, unmatched: ${summary.unmatchedPokeDataSets}`
    );
  } catch (error) {
    record(
      "Force Sync",
      "FAIL",
      `Force synchronize failed: ${error.message}`
    );
  }
}

async function main() {
  const { identifier, forceSync } = parseArgs();

  console.log("=======================================================");
  console.log("  Dynamic Set Mapping Debugger");
  console.log("=======================================================");
  console.log(`Identifier: ${identifier}`);
  if (forceSync) {
    console.log("Force sync: ENABLED (will attempt orchestrator run)");
  }
  console.log("");

  const pokeDataApiKey = process.env.POKEDATA_API_KEY;
  const pokemonTcgApiKey = process.env.POKEMON_TCG_API_KEY;

  if (!pokeDataApiKey) {
    record(
      "Environment",
      "WARN",
      "POKEDATA_API_KEY not set. PokeData API calls may fail."
    );
  }

  if (!pokemonTcgApiKey) {
    record(
      "Environment",
      "WARN",
      "POKEMON_TCG_API_KEY not set. Pokemon TCG API calls may fail."
    );
  }

  let repository = await getCosmosRepository();

  const pokeDataApi = new PokeDataApiService(
    pokeDataApiKey || "",
    process.env.POKEDATA_API_BASE_URL
  );
  const pokemonTcgApi = new PokemonTcgApiService(
    pokemonTcgApiKey || "",
    process.env.POKEMON_TCG_API_BASE_URL
  );

  const { target: pokeDataSet, sets: allPokeDataSets } =
    await fetchPokeDataSet(pokeDataApi, identifier);

  let resolvedPokeDataSetId =
    pokeDataSet?.id ??
    (/^\d+$/.test(identifier) ? Number.parseInt(identifier, 10) : null);

  if (!resolvedPokeDataSetId) {
    record(
      "Identifier",
      "FAIL",
      "Could not resolve PokeData set ID from identifier. Exiting."
    );
    showSummary();
    process.exit(1);
  }

  if (!repository && process.env.COSMOS_DB_CONNECTION_STRING) {
    // Retry once now that we have confirmed the ID (helps with transient init errors).
    repository = await getCosmosRepository();
  }

  const { mapping, metadata } = await inspectRepositoryState(
    repository,
    resolvedPokeDataSetId
  );

  const tcgSets = await fetchPokemonTcgSets(pokemonTcgApi);
  inspectTcgCoverage(tcgSets, pokeDataSet);

  await runMatchingEngine(pokeDataSet, tcgSets);

  await inspectMappingCache(repository, resolvedPokeDataSetId);

  await evaluateSkipCondition(metadata, allPokeDataSets, tcgSets);

  if (forceSync) {
    try {
      const {
        setMappingOrchestrator,
      } = require("../src/index");
      await maybeForceSync(forceSync, repository, setMappingOrchestrator);
    } catch (error) {
      record(
        "Force Sync",
        "FAIL",
        `Unable to load orchestrator: ${error.message}`
      );
    }
  }

  if (mapping && mapping.tcgSetId) {
    record(
      "Conclusion",
      "OK",
      `Mapping exists with tcgSetId=${mapping.tcgSetId}`
    );
  } else {
    record(
      "Conclusion",
      "WARN",
      "Mapping is missing a tcgSetId. Check the WARN/FAIL stages above."
    );
  }

  showSummary();
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  showSummary();
  process.exit(1);
});
