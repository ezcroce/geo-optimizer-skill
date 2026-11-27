import { defineConfig } from "@playwright/test";
import webConfig from "./playwright.config.js";
export default defineConfig({
  ...webConfig,
  testDir: "./e2e-offline",
  webServer: undefined,
  timeout: 90000,
  use: { ...webConfig.use, baseURL: undefined },
});
