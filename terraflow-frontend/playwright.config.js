import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "qa-report" }]
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "ui",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "node server.js",
    url: `${BASE_URL}/api/jobs`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      TERRAFLOW_ALLOW_MULTIPLE: "1"
    }
  }
});
