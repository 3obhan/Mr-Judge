import base44 from "@base44/vite-plugin"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const isCloudflarePages = process.env.CF_PAGES === "1";
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isCloudflarePages ? "/" : (isGitHubPages ? "/Mr-Judge/" : (process.env.BASE_PATH || "/Mr-Judge/"));

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  logLevel: "error", // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === "true",
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true,
    }),
    react(),
  ],
});
