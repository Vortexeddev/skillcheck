import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  // Keep the bundle self-contained so `npx skillcheck` never needs a network install
  // beyond the package itself. Zero runtime dependencies by design.
  treeshake: true,
  banner: { js: "#!/usr/bin/env node" },
});
