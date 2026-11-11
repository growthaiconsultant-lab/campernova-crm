import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  testMatch: [
    'buyer-followup.spec.ts',
    'buyer-header.spec.ts',
    'buyer-autosave.spec.ts',
    'buyer-usage.spec.ts',
    'buyer-stock.spec.ts',
    'buyer-offers.spec.ts',
    'buyer-documents.spec.ts',
    'buyer-postventa.spec.ts',
    'seller-followup.spec.ts',
    'seller-preparation.spec.ts',
    'search-request.spec.ts',
  ],
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
