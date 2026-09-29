// Tests d'interface (Playwright). Lancer : npx playwright test
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5611;
// Chromium préinstallé (environnements cloud) si la version attendue par Playwright n'est pas téléchargée.
const LOCAL_CHROMIUM = process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, launchOptions: LOCAL_CHROMIUM ? { executablePath: LOCAL_CHROMIUM } : {} } },
  ],
  webServer: {
    command: `node tests/ui/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
