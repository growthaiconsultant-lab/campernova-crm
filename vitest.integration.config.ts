import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Configuración de Vitest para tests de INTEGRACIÓN (PR0).
 *
 * Separada de `vitest.config.ts` (tests unitarios). Los tests unitarios (`pnpm test`)
 * NO incluyen `tests/integration/**` y no se ven afectados.
 *
 * Los tests de integración usan una base de datos PostgreSQL real y se ejecutan en
 * SERIE (comparten la misma base) con timeouts amplios.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Serialización: una sola base de datos compartida → sin paralelismo entre archivos.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
