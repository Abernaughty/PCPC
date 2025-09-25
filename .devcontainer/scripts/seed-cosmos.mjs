import { CosmosClient } from "@azure/cosmos";

// Disable SSL verification for local emulator (development only)
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// Emulator defaults (override with env vars if you want)
const endpoint =
  process.env.COSMOS_ENDPOINT || "https://cosmosdb-emulator:8081";
const key =
  process.env.COSMOS_KEY ||
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

const dbId = "PokemonCards";
const setsContainerId = "Sets";
const cardsContainerId = "Cards";

const setsDocs = [
  {
    id: "557",
    name: "Prismatic Evolutions",
    code: "PRE",
    series: "PokeData",
    cardCount: 0,
    releaseDate: "Fri, 17 Jan 2025 00:00:00 GMT",
    isCurrent: true,
    lastUpdated: "2025-09-21T00:00:00.598Z",
    // System properties (_rid, _self, etc.) omitted — Cosmos will generate them
  },
];

const cardsDocs = [
  {
    id: "73121",
    source: "pokedata",
    pokeDataId: 73121,
    setId: 557,
    setName: "Prismatic Evolutions",
    setCode: "PRE",
    cardName: "Umbreon ex",
    cardNumber: "161",
    secret: true,
    language: "ENGLISH",
    releaseDate: "2025-01-17",
    pricing: {},
    lastUpdated: "2025-09-20T23:30:53.366Z",
  },
];

async function main() {
  console.log(`[seed] Connecting to Cosmos at ${endpoint}`);
  const client = new CosmosClient({
    endpoint,
    key,
    connectionPolicy: {
      disableSSLVerification: true,
    },
  });

  // Create database if missing
  const { database } = await client.databases.createIfNotExists({ id: dbId });

  // Create containers with the correct partition keys
  await database.containers.createIfNotExists({
    id: setsContainerId,
    partitionKey: { paths: ["/series"] },
  });
  await database.containers.createIfNotExists({
    id: cardsContainerId,
    partitionKey: { paths: ["/setId"] },
  });

  const setsContainer = database.container(setsContainerId);
  const cardsContainer = database.container(cardsContainerId);

  // Seed Sets
  await setsContainer.items.bulk(
    setsDocs.map((doc) => ({ operationType: "Upsert", resourceBody: doc }))
  );

  // Seed Cards
  await cardsContainer.items.bulk(
    cardsDocs.map((doc) => ({ operationType: "Upsert", resourceBody: doc }))
  );

  console.log(
    `[seed] Inserted ${setsDocs.length} doc(s) into ${setsContainerId} and ${cardsDocs.length} doc(s) into ${cardsContainerId}`
  );
}

main().catch((err) => {
  console.error("[seed] Error seeding Cosmos DB:", err);
  process.exit(1);
});
