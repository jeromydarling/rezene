import { defineConfig } from "vitest/config";

// Unit tests for the pure, high-stakes logic — money math, tenant resolution,
// session expiry, FK ordering, id/token helpers. These run in Node (they touch
// only globalThis.crypto and plain functions), so no Workers pool is needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // Workers-runtime module; tests only exercise pure functions from files
      // that import it, so a stub keeps Node's resolver happy.
      "cloudflare:email": new URL("./src/worker/test/cloudflare-email-stub.ts", import.meta.url).pathname,
    },
  },
});
