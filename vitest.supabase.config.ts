import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Configuración de Vitest para los tests REALES de Supabase Storage (PR5B2).
 *
 * Separada de los tests unitarios (`vitest.config.ts`) y de integración Prisma
 * (`vitest.integration.config.ts`). Se ejecutan contra un Supabase LOCAL efímero
 * (Docker) levantado por el job de CI `supabase-storage`; NO mockean Storage.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['tests/supabase/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Serie: comparten el mismo Storage local.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
