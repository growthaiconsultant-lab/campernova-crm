/**
 * PR5B2 — Guard anti-remoto para el job `supabase-storage`.
 *
 * Aborta (exit 1) si el entorno apunta a un Supabase que NO sea local, o si hay indicios de un
 * proyecto remoto enlazado. Se ejecuta ANTES de `supabase db reset` y de la suite de Storage,
 * para que NUNCA se aplique una migración ni un test contra staging/producción.
 */
const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i

function fail(msg: string): never {
  console.error(`[assert-local-supabase] ABORTA: ${msg}`)
  process.exit(1)
}

const urls = [
  ['SUPABASE_URL', process.env.SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
  ['SUPABASE_DB_URL', process.env.SUPABASE_DB_URL],
].filter(([, v]) => !!v) as Array<[string, string]>

if (urls.length === 0) {
  fail('no hay ninguna URL de Supabase local definida (SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL).')
}

for (const [name, value] of urls) {
  // Para URLs de base de datos (postgres://host:port), extrae el host; para HTTP, valida el prefijo.
  if (value.startsWith('postgres')) {
    const host = value.replace(/^postgres(?:ql)?:\/\/[^@]*@?/, '').split(/[:/]/)[0]
    if (!/^(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|::1)$/i.test(host)) {
      fail(`${name} apunta a un host NO local: ${host}`)
    }
  } else if (!LOCAL_URL.test(value)) {
    fail(`${name} apunta a un endpoint NO local: ${value}`)
  }
}

// Indicios de proyecto remoto enlazado → abortar (nunca operar contra remoto en este job).
for (const remoteVar of ['SUPABASE_PROJECT_ID', 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']) {
  if (process.env[remoteVar]) {
    fail(`variable de proyecto remoto presente (${remoteVar}); este job solo opera en local.`)
  }
}

console.log('[assert-local-supabase] OK — Supabase local verificado; sin enlace remoto.')
