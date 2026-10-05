import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// Server-rendered output: pages render per request so they can read the
// database, and `astro build` emits the Node server the Dockerfile runs.
// No `base`/Pages `site` here --- this deploys to Fly at the bare root, which
// is what spec/invariants.test.ts checks ("/" and "/readme/", no prefix).
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    allowedDomains: [
      // Fly's proxy terminates TLS, so naming the deploy domain is what lets
      // Astro trust x-forwarded-proto and accept same-origin form POSTs.
      { hostname: "**.fly.dev", protocol: "https" },
      // Without this, any request whose Host header doesn't match an
      // allowed pattern gets silently downgraded to a bare "localhost"
      // origin (port dropped) --- which 403s every same-origin POST during
      // local dev and in CI's pre-deploy `docker run` test, since neither
      // goes through Fly's proxy (no x-forwarded-* headers to validate
      // against the fly.dev pattern above).
      { hostname: "localhost", protocol: "http" },
    ],
  },
});
