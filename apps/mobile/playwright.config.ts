import { apiURL, webURL, mobileURL, mobilePort } from '../../tests/environment';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: mobileURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  webServer: {
    command: `npx expo start --web --port ${mobilePort}`,
    cwd: '.',
    url: mobileURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EXPO_PUBLIC_API_URL: apiURL,
      EXPO_PUBLIC_WEB_URL: webURL,
    },
  },
});
