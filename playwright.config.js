import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --workspace=backend',
      port: 3001,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npm run dev --workspace=frontend',
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
