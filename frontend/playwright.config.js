import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests for the SPA.
 *
 * These exist to catch what `vite build` structurally cannot: shaders that fail
 * to compile, components that throw on mount, and routes that white-screen. A
 * build only proves imports resolve — it never renders anything.
 *
 * Reuses an already-running dev server when there is one, otherwise starts its
 * own. The API on :5000 is NOT managed here: the tests stub the one network
 * call they depend on, so the suite passes with the backend up or down.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  /**
   * Headless Chromium renders WebGL through SwiftShader (software). Running one
   * browser per core makes the landing scene take longer to mount than its own
   * timeout allows, so the suite fails on machine load rather than on defects.
   * Capping workers keeps it deterministic; the whole run is well under a minute.
   */
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  /**
   * One retry everywhere, not just in CI. Software-rendered WebGL on a busy
   * machine occasionally overruns a timeout; a genuine defect still fails both
   * attempts, so this absorbs load noise without hiding regressions.
   */
  retries: 1,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
