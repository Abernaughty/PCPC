import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: undefined,
  },

  // Jest/testing configuration
  compilerOptions: {
    dev: process.env.NODE_ENV === "development",
    hydratable: true,
  },

  // For svelte-jester
  jest: {
    transform: [[".*\\.svelte$", "svelte-jester"]],
    moduleFileExtensions: ["js", "ts", "svelte"],
    setupFilesAfterEnv: ["<rootDir>/tests/config/test-setup.js"],
  },
};

export default config;
