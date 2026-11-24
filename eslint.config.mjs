import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Il service worker compilato da `next build` (scripts/build-sw.mjs, #233):
    // minificato, generato, e letto da `audit:pwa-cache`, non dal lint.
    "public/sw.js",
    "public/sw.js.map",
  ]),
]);

export default eslintConfig;
