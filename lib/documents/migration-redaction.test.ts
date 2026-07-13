import { describe, it, expect } from 'vitest'
import {
  stripQueryString,
  redactId,
  redactObjectPath,
  redactReference,
  redactSecretsInText,
} from './migration-redaction'

describe('stripQueryString', () => {
  it('elimina la query string (donde va el token de firma)', () => {
    expect(stripQueryString('docs/v/a.pdf?token=SECRET&x=1')).toBe('docs/v/a.pdf')
    expect(stripQueryString('docs/v/a.pdf')).toBe('docs/v/a.pdf')
  })
})

describe('redactId', () => {
  it('es determinista y no revela el id original', () => {
    const a = redactId('vehicledoc-123')
    expect(a).toBe(redactId('vehicledoc-123'))
    expect(a).not.toContain('vehicledoc-123')
    expect(a.startsWith('id:')).toBe(true)
  })
  it('maneja null', () => {
    expect(redactId(null)).toBe('id:none')
  })
})

describe('redactObjectPath', () => {
  it('conserva prefijo y extensión, oculta id y uuid', () => {
    expect(redactObjectPath('docs/veh123/abcuuid.pdf')).toBe('docs/***/***.pdf')
    expect(redactObjectPath('deliveries/del9/xyz.jpg')).toBe('deliveries/***/***.jpg')
  })
  it('descarta la query string antes de redactar', () => {
    expect(redactObjectPath('docs/v/a.pdf?token=SECRET')).toBe('docs/***/***.pdf')
    expect(redactObjectPath('docs/v/a.pdf?token=SECRET')).not.toContain('SECRET')
  })
})

describe('redactReference', () => {
  it('una URL http nunca revela host ni path, y marca que tenía query', () => {
    const r = redactReference(
      'https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v/a.pdf?token=SECRET'
    )
    expect(r.isHttp).toBe(true)
    expect(r.hadQueryString).toBe(true)
    expect(r.redactedPath).toBe('(url)')
    expect(JSON.stringify(r)).not.toContain('SECRET')
    expect(JSON.stringify(r)).not.toContain('proj.supabase.co')
  })
  it('un path interno se redacta a prefijo+ext', () => {
    const r = redactReference('docs/veh/uuid.pdf')
    expect(r.isHttp).toBe(false)
    expect(r.redactedPath).toBe('docs/***/***.pdf')
  })
  it('ausente', () => {
    expect(redactReference(null).present).toBe(false)
  })
})

describe('redactSecretsInText', () => {
  it('sustituye valores literales de secretos conocidos', () => {
    const env = {
      SUPABASE_SERVICE_ROLE_KEY: 'sk_super_secret_value_1234',
      DATABASE_URL: 'postgres://u:p@h/db',
    }
    const text = 'error con clave sk_super_secret_value_1234 y url postgres://u:p@h/db'
    const out = redactSecretsInText(text, env)
    expect(out).not.toContain('sk_super_secret_value_1234')
    expect(out).not.toContain('postgres://u:p@h/db')
    expect(out).toContain('[REDACTED:SUPABASE_SERVICE_ROLE_KEY]')
    expect(out).toContain('[REDACTED:DATABASE_URL]')
  })
  it('ignora valores demasiado cortos o ausentes', () => {
    expect(redactSecretsInText('hola', { DATABASE_URL: '' })).toBe('hola')
  })
})
