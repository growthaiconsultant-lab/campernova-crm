import { defineConfig, devices } from '@playwright/test'
import { requireTestDatabaseUrl } from './tests/integration/guard'

// Same guard as integration: never point browser tests at a real CRM database.
const database = requireTestDatabaseUrl(process.env, { requireReset: true })
export default defineConfig({
  testDir: './e2e',
  testMatch: 'search-request.spec.ts',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3021', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.LANDING_BROWSER_CHANNEL,
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: process.env.LANDING_BROWSER_CHANNEL },
    },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm exec next dev -p 3021',
    url: 'http://localhost:3021/busqueda-bajo-pedido',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      DATABASE_URL: database,
      DIRECT_URL: database,
      NODE_ENV: 'development',
      NEXT_PUBLIC_GTM_ID: '',
      NEXT_PUBLIC_POSTHOG_KEY: '',
    },
  },
})
