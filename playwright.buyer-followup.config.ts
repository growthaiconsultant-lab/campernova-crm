import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'buyer-followup.spec.ts',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: { timezoneId: 'Europe/Madrid' },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        channel: process.env.CI ? undefined : 'chrome',
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile-webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
