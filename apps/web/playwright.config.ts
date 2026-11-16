import { apiURL, webURL, mobileURL, webPort, mobilePort, sessionPort } from '../../tests/environment';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: webURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:web',
      env: { API_URL:apiURL, APP_ORIGIN:webURL, PORT:String(sessionPort), QSALE_WEB_PORT:String(webPort), QSALE_SESSION_PORT:String(sessionPort) },
      cwd: '../..',
      url: webURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: `npx expo start --web --port ${mobilePort}`,
      cwd: '../mobile',
      url: mobileURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        EXPO_PUBLIC_API_URL: apiURL,
        EXPO_PUBLIC_WEB_URL: webURL,
      },
    },
  ],
});
