import type { NextConfig } from "next";

export default {
  // PGlite ships WASM; load it from node_modules rather than bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
} satisfies NextConfig;
