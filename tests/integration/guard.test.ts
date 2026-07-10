/**
 * Tests del guard de integración (PR0). Puros: NO abren ninguna conexión ni requieren
 * una base de datos. Prueban la función de validación con strings controlados.
 */
import { describe, it, expect } from 'vitest'
import {
  findUnsafeReason,
  isSafeTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  requireTestDatabaseUrl,
  UnsafeTestDatabaseError,
  FORBIDDEN_DB_REFS,
} from './guard'

const SAFE_URL = 'postgresql://postgres:postgres@localhost:5432/campernova_test?schema=public'
const TEST_ENV = { nodeEnv: 'test', allowReset: 'true' }

describe('integration guard', () => {
  it('acepta una URL local de test con NODE_ENV=test', () => {
    expect(isSafeTestDatabaseUrl(SAFE_URL, TEST_ENV)).toBe(true)
    expect(findUnsafeReason(SAFE_URL, TEST_ENV)).toBeNull()
    expect(() => assertSafeTestDatabaseUrl(SAFE_URL, TEST_ENV)).not.toThrow()
  })

  it('rechaza la ref de STAGING (iatuhydsfwoeprpbklod)', () => {
    const url =
      'postgresql://postgres.iatuhydsfwoeprpbklod:pw@aws-1-eu-central-1.pooler.supabase.com:5432/postgres'
    expect(isSafeTestDatabaseUrl(url, TEST_ENV)).toBe(false)
    expect(() => assertSafeTestDatabaseUrl(url, TEST_ENV)).toThrow(UnsafeTestDatabaseError)
  })

  it('rechaza la ref de PRODUCCIÓN (bbmglaatlyilxutzomxd)', () => {
    const url = 'postgresql://postgres:pw@db.bbmglaatlyilxutzomxd.supabase.co:5432/postgres'
    expect(isSafeTestDatabaseUrl(url, TEST_ENV)).toBe(false)
    expect(() => assertSafeTestDatabaseUrl(url, TEST_ENV)).toThrow(UnsafeTestDatabaseError)
  })

  it('rechaza cualquier host de Supabase gestionado', () => {
    const url = 'postgresql://postgres:pw@db.someotherref.supabase.co:5432/postgres'
    expect(isSafeTestDatabaseUrl(url, TEST_ENV)).toBe(false)
  })

  it('rechaza URL vacía o ausente', () => {
    expect(isSafeTestDatabaseUrl(undefined, TEST_ENV)).toBe(false)
    expect(isSafeTestDatabaseUrl('', TEST_ENV)).toBe(false)
    expect(isSafeTestDatabaseUrl('   ', TEST_ENV)).toBe(false)
  })

  it('rechaza si NODE_ENV no es test', () => {
    expect(isSafeTestDatabaseUrl(SAFE_URL, { nodeEnv: 'development', allowReset: 'true' })).toBe(
      false
    )
    expect(isSafeTestDatabaseUrl(SAFE_URL, { nodeEnv: 'production', allowReset: 'true' })).toBe(
      false
    )
  })

  it('exige ALLOW_INTEGRATION_DB_RESET=true solo para operaciones destructivas', () => {
    // Sin la señal: conexión permitida, reset bloqueado.
    expect(isSafeTestDatabaseUrl(SAFE_URL, { nodeEnv: 'test' })).toBe(true)
    expect(isSafeTestDatabaseUrl(SAFE_URL, { nodeEnv: 'test' }, { requireReset: true })).toBe(false)
    // Con la señal: reset permitido.
    expect(
      isSafeTestDatabaseUrl(
        SAFE_URL,
        { nodeEnv: 'test', allowReset: 'true' },
        { requireReset: true }
      )
    ).toBe(true)
  })

  it('el mensaje de error nunca contiene la URL ni credenciales', () => {
    const url =
      'postgresql://secretuser:secretpass@db.bbmglaatlyilxutzomxd.supabase.co:5432/postgres'
    try {
      assertSafeTestDatabaseUrl(url, TEST_ENV)
      expect.unreachable('debería haber lanzado')
    } catch (err) {
      const message = (err as Error).message
      expect(message).not.toContain('secretpass')
      expect(message).not.toContain('secretuser')
      expect(message).not.toContain(url)
    }
  })

  it('requireTestDatabaseUrl lee TEST_DATABASE_URL del entorno y valida', () => {
    const goodEnv = {
      TEST_DATABASE_URL: SAFE_URL,
      NODE_ENV: 'test',
      ALLOW_INTEGRATION_DB_RESET: 'true',
    } as unknown as NodeJS.ProcessEnv
    expect(requireTestDatabaseUrl(goodEnv, { requireReset: true })).toBe(SAFE_URL)

    const forbiddenEnv = {
      TEST_DATABASE_URL: 'postgresql://x@db.iatuhydsfwoeprpbklod.supabase.co:5432/postgres',
      NODE_ENV: 'test',
    } as unknown as NodeJS.ProcessEnv
    expect(() => requireTestDatabaseUrl(forbiddenEnv)).toThrow(UnsafeTestDatabaseError)
  })

  it('las refs prohibidas están declaradas explícitamente', () => {
    expect(FORBIDDEN_DB_REFS).toContain('iatuhydsfwoeprpbklod')
    expect(FORBIDDEN_DB_REFS).toContain('bbmglaatlyilxutzomxd')
  })
})
