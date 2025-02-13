import { defineConfig } from "tsup";

export default defineConfig([
  // Main bundle - runtime code only
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    external: ["@babel/*"],
  },
  // Vite plugin bundle - build time only
  {
    entry: ["src/vite.ts"],
    format: ["cjs"],
    dts: true,
    external: ["vite"],
    noExternal: ["@babel/*"],
    platform: "node",
  },
]);
