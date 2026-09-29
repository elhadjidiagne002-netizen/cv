// Tests d'interface (Playwright). Lancer : npx playwright test
import { defineConfig, devices } from '@playwright/test';

const PORT = 5611;

export default defineConfig({
  testDir: 'tests/ui',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
  ],
  webServer: {
    command: `node tests/ui/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
