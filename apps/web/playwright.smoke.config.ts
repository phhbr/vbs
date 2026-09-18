import { defineConfig, devices } from "@playwright/test";

// Runs against a real deployed URL (staging or production), not the local
// dev server — no webServer block, and SMOKE_BASE_URL is required rather
// than defaulted, so this can never silently fall back to localhost and
// report a false green.
const baseURL = process.env["SMOKE_BASE_URL"];
if (!baseURL) {
  throw new Error("SMOKE_BASE_URL must be set, e.g. https://vbs.bruchner.dev");
}

export default defineConfig({
  testDir: "./e2e-smoke",
  fullyParallel: false,
  retries: 1,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
