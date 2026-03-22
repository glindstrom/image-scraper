import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_PORT = parseInt(process.env.PORT || '3001');
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173');

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/globalTeardown.mjs',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
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
      port: BACKEND_PORT,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npm run dev --workspace=frontend',
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
