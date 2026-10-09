import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'landing-*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    contextOptions: { reducedMotion: 'reduce' },
    baseURL: 'http://localhost:3016',
    channel: process.env.LANDING_BROWSER_CHANNEL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm exec next dev -p 3016',
    url: 'http://localhost:3016/vende-tu-camper.html',
    reuseExistingServer: false,
    env: {
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/landing_test',
      DIRECT_URL: 'postgresql://test:test@127.0.0.1:5432/landing_test',
      NEXT_PUBLIC_GTM_ID: 'GTM-NK5ZBX8P',
    },
    timeout: 120000,
  },
})
