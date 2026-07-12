import { defineConfig } from "vitest/config";

// Unit tests for the pure, high-stakes logic — money math, tenant resolution,
// session expiry, FK ordering, id/token helpers. These run in Node (they touch
// only globalThis.crypto and plain functions), so no Workers pool is needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
