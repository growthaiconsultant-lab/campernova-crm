import { defineConfig } from '@playwright/test'

// Component HTML + real Tailwind CSS; no Next server, credentials or database.
export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'table-navigation.spec.tsx',
  tsconfig: './tests/ui/tsconfig.json',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { hasTouch: true },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: process.env.TABLE_TEST_CHROMIUM_PATH },
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
