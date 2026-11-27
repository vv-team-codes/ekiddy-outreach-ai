import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true
  },
  webServer: [
    {
      command: 'node ../backend/dist/server.js',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});
