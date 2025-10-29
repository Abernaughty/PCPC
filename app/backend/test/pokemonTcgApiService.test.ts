import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { PokemonTcgApiService } from "../src/services/PokemonTcgApiService";

const originalAxiosGet = axios.get;

test("getAllSets retries once on retryable error and succeeds", async (t) => {
  let callCount = 0;

  (axios as any).get = async () => {
    callCount++;
    if (callCount === 1) {
      const error: any = new Error("Server error");
      error.response = { status: 500 };
      throw error;
    }

    return {
      data: {
        data: [
          {
            id: "base1",
            ptcgoCode: "BASE",
            name: "Base Set",
            series: "Base",
            releaseDate: "1999-01-09",
            total: 102,
          },
        ],
      },
    };
  };

  const originalAttempts = process.env.TCG_RETRY_ATTEMPTS;
  const originalDelay = process.env.TCG_RETRY_BASE_MS;
  process.env.TCG_RETRY_ATTEMPTS = "3";
  process.env.TCG_RETRY_BASE_MS = "1";

  t.after(() => {
    (axios as any).get = originalAxiosGet;
    process.env.TCG_RETRY_ATTEMPTS = originalAttempts;
    process.env.TCG_RETRY_BASE_MS = originalDelay;
  });

  const service = new PokemonTcgApiService("fake-key", "http://example.com");
  const sets = await service.getAllSets();

  assert.equal(callCount, 2);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].code, "BASE");
});

test("getAllSets throws immediately on non-retryable status", async (t) => {
  let callCount = 0;

  (axios as any).get = async () => {
    callCount++;
    const error: any = new Error("Unauthorized");
    error.response = { status: 401 };
    throw error;
  };

  const originalAttempts = process.env.TCG_RETRY_ATTEMPTS;
  const originalDelay = process.env.TCG_RETRY_BASE_MS;
  process.env.TCG_RETRY_ATTEMPTS = "3";
  process.env.TCG_RETRY_BASE_MS = "1";

  t.after(() => {
    (axios as any).get = originalAxiosGet;
    process.env.TCG_RETRY_ATTEMPTS = originalAttempts;
    process.env.TCG_RETRY_BASE_MS = originalDelay;
  });

  const service = new PokemonTcgApiService("fake-key", "http://example.com");

  await assert.rejects(service.getAllSets(), (error: any) => {
    assert.match(error.message, /status 401/);
    return true;
  });

  assert.equal(callCount, 1);
});
