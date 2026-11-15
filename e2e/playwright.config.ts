import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end suite (docs/review/TEST_PLAN.md T0-8). It runs against the app as a player gets
 * it: Django on BACKEND_PORT, Vite proxying /api to it on FRONTEND_PORT, and the database the
 * `seed_e2e` command builds in global-setup.
 *
 * One worker, never parallel: every test shares the one seeded campaign, and a second worker
 * writing to it is the first way an e2e suite turns flaky.
 */
const backendPort = process.env.BACKEND_PORT ?? "8034";
const frontendPort = process.env.FRONTEND_PORT ?? "5207";
const baseURL = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run python manage.py runserver 127.0.0.1:${backendPort}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${backendPort}/api/health/`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { DJANGO_DEBUG: "1", RATE_LIMIT_ENABLED: "false" },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${frontendPort}`,
      cwd: "../frontend",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
    },
  ],
});
