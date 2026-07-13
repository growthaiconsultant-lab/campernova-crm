/**
 * Tests REALES de Supabase Storage (PR5B2) — buckets, políticas de `storage.objects`,
 * acceso no autorizado, flujo server-side autorizado, MIME/tamaño, signed URLs, aislamiento.
 *
 * Se ejecutan contra un Supabase LOCAL efímero (Docker), levantado por el job `supabase-storage`
 * con `supabase start` + `supabase db reset` (aplica supabase/migrations). NO se mockea Storage,
 * NO se toca remoto. Las credenciales locales (URL/anon/service_role) las inyecta el job desde
 * `supabase status`. Cada test usa paths únicos y limpia lo que crea.
 *
 * Modelo (Opción B): `vehicle-documents` es DENY-ALL para anon/authenticated; solo `service_role`
 * (servidor) opera el bucket privado tras la autorización de Prisma. `vehicle-photos` es media
 * pública (lectura pública, escritura autenticada).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const DOCS = 'vehicle-documents'
const PHOTOS = 'vehicle-photos'
const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i

let admin: SupabaseClient
let anon: SupabaseClient

/** Objetos creados por los tests (bucket, path) para limpiar con el cliente service_role. */
const createdObjects: Array<{ bucket: string; path: string }> = []
const createdUserIds: string[] = []

function track(bucket: string, path: string) {
  createdObjects.push({ bucket, path })
  return path
}

function pdfBytes(sizeBytes = 64): Buffer {
  // Cabecera PDF mínima + relleno hasta el tamaño pedido.
  const head = Buffer.from('%PDF-1.4\n%test\n')
  if (sizeBytes <= head.length) return head
  return Buffer.concat([head, Buffer.alloc(sizeBytes - head.length, 0x20)])
}

beforeAll(() => {
  // Guard de seguridad: exige Supabase LOCAL. Nunca contra staging/producción.
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      'Faltan credenciales locales de Supabase (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).'
    )
  }
  if (!LOCAL_URL.test(SUPABASE_URL)) {
    throw new Error(`SUPABASE_URL no es local: ${SUPABASE_URL}. Abortando por seguridad.`)
  }
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
})

afterEach(async () => {
  // Limpieza best-effort de los objetos creados (con el cliente privilegiado).
  for (const { bucket, path } of createdObjects.splice(0)) {
    await admin.storage
      .from(bucket)
      .remove([path])
      .catch(() => {})
  }
})

afterAll(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
})

// ─── Buckets ─────────────────────────────────────────────────────────────────

describe('buckets', () => {
  it('vehicle-documents existe, es privado, 10 MiB y allowlist MIME de documentos', async () => {
    const { data, error } = await admin.storage.getBucket(DOCS)
    expect(error).toBeNull()
    expect(data?.public).toBe(false)
    expect(data?.file_size_limit).toBe(10485760)
    const mimes = data?.allowed_mime_types ?? []
    expect(mimes).toEqual(
      expect.arrayContaining([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ])
    )
    // Sin tipos peligrosos.
    expect(mimes).not.toContain('text/html')
    expect(mimes).not.toContain('image/svg+xml')
    expect(mimes).not.toContain('application/javascript')
  })

  it('vehicle-photos existe, es público, 2 MiB y solo imágenes', async () => {
    const { data, error } = await admin.storage.getBucket(PHOTOS)
    expect(error).toBeNull()
    expect(data?.public).toBe(true)
    expect(data?.file_size_limit).toBe(2097152)
    expect(data?.allowed_mime_types ?? []).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp'])
    )
  })

  it('lead-documents NO existe en un entorno nuevo (deprecado)', async () => {
    const { data, error } = await admin.storage.getBucket('lead-documents')
    // getBucket devuelve error (o data null) si el bucket no existe.
    expect(error || !data).toBeTruthy()
  })
})

// ─── Acceso no autorizado (anon) ──────────────────────────────────────────────

describe('acceso anon denegado en vehicle-documents', () => {
  it('anon no puede subir', async () => {
    const path = `docs/anon/${randomUUID()}.pdf`
    const { error } = await anon.storage
      .from(DOCS)
      .upload(path, pdfBytes(), { contentType: 'application/pdf', upsert: false })
    expect(error).not.toBeNull()
  })

  it('anon no puede descargar un objeto privado existente', async () => {
    const path = track(DOCS, `docs/seed/${randomUUID()}.pdf`)
    const up = await admin.storage
      .from(DOCS)
      .upload(path, pdfBytes(), { contentType: 'application/pdf', upsert: false })
    expect(up.error).toBeNull()
    const { data, error } = await anon.storage.from(DOCS).download(path)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('anon no puede firmar una URL de un objeto privado', async () => {
    const path = track(DOCS, `docs/seed/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(path, pdfBytes(), { contentType: 'application/pdf' })
    const { data, error } = await anon.storage.from(DOCS).createSignedUrl(path, 300)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('anon no puede listar el bucket privado (con un objeto real presente)', async () => {
    // Se siembra un objeto (con service_role) bajo un prefijo único para que el test distinga
    // "deny-all" de "permitido pero vacío": anon debe ver 0 mientras que service_role ve ≥1.
    const prefix = `docs/list-${randomUUID()}`
    track(DOCS, `${prefix}/a.pdf`)
    await admin.storage
      .from(DOCS)
      .upload(`${prefix}/a.pdf`, pdfBytes(), { contentType: 'application/pdf', upsert: false })

    const anonList = await anon.storage.from(DOCS).list(prefix)
    expect(anonList.data ?? []).toHaveLength(0) // RLS deny-all → nunca ve objetos ajenos

    const adminList = await admin.storage.from(DOCS).list(prefix)
    expect((adminList.data ?? []).length).toBeGreaterThanOrEqual(1) // el objeto sí existe
  })

  it('anon no puede borrar', async () => {
    const path = track(DOCS, `docs/seed/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(path, pdfBytes(), { contentType: 'application/pdf' })
    await anon.storage.from(DOCS).remove([path])
    // El objeto sigue existiendo (el borrado anon no surtió efecto).
    const { data } = await admin.storage.from(DOCS).createSignedUrl(path, 60)
    expect(data?.signedUrl).toBeTruthy()
  })
})

// ─── Acceso authenticated (usuario sin autorización de dominio) ────────────────

describe('acceso authenticated denegado en vehicle-documents (Opción B)', () => {
  it('un usuario autenticado NO puede acceder directamente al bucket privado', async () => {
    const email = `authtest_${randomUUID()}@integ.test`
    const password = `Pw-${randomUUID()}`
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    expect(created.error).toBeNull()
    if (created.data.user) createdUserIds.push(created.data.user.id)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await userClient.auth.signInWithPassword({ email, password })
    expect(signIn.error).toBeNull()
    expect(signIn.data.session?.access_token).toBeTruthy()

    // Con sesión authenticated: subir/descargar/firmar en vehicle-documents debe denegarse
    // (no hay política para authenticated en ese bucket).
    const path = `docs/authuser/${randomUUID()}.pdf`
    const up = await userClient.storage
      .from(DOCS)
      .upload(path, pdfBytes(), { contentType: 'application/pdf', upsert: false })
    expect(up.error).not.toBeNull()

    // Y no puede firmar un objeto que el servidor sí creó.
    const seeded = track(DOCS, `docs/seed/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(seeded, pdfBytes(), { contentType: 'application/pdf' })
    const signed = await userClient.storage.from(DOCS).createSignedUrl(seeded, 300)
    expect(signed.error).not.toBeNull()
  })
})

// ─── Flujo server-side autorizado (service_role) ──────────────────────────────

describe('flujo server-side autorizado (service_role)', () => {
  it('sube un PDF permitido y respeta upsert:false (no sobrescribe)', async () => {
    const path = track(DOCS, `docs/ok/${randomUUID()}.pdf`)
    const first = await admin.storage
      .from(DOCS)
      .upload(path, pdfBytes(), { contentType: 'application/pdf', upsert: false })
    expect(first.error).toBeNull()
    // Segundo upload al MISMO path con upsert:false → rechazado (objeto inmutable).
    const second = await admin.storage
      .from(DOCS)
      .upload(path, pdfBytes(128), { contentType: 'application/pdf', upsert: false })
    expect(second.error).not.toBeNull()
  })

  it('rechaza un MIME no permitido a nivel de bucket (text/html)', async () => {
    const path = `docs/bad/${randomUUID()}.html`
    const { error } = await admin.storage
      .from(DOCS)
      .upload(path, Buffer.from('<h1>x</h1>'), { contentType: 'text/html', upsert: false })
    expect(error).not.toBeNull()
  })

  it('acepta un archivo < 10 MB y rechaza uno > 10 MB (límite de bucket)', async () => {
    const okPath = track(DOCS, `docs/size/${randomUUID()}.pdf`)
    const ok = await admin.storage
      .from(DOCS)
      .upload(okPath, pdfBytes(1024), { contentType: 'application/pdf', upsert: false })
    expect(ok.error).toBeNull()

    const bigPath = `docs/size/${randomUUID()}.pdf`
    const big = await admin.storage.from(DOCS).upload(bigPath, pdfBytes(11 * 1024 * 1024), {
      contentType: 'application/pdf',
      upsert: false,
    })
    expect(big.error).not.toBeNull()
  })

  it('firma una URL temporal (300 s) que permite descargar el objeto', async () => {
    const path = track(DOCS, `docs/signed/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(path, pdfBytes(200), { contentType: 'application/pdf' })
    const { data, error } = await admin.storage.from(DOCS).createSignedUrl(path, 300)
    expect(error).toBeNull()
    expect(data?.signedUrl).toContain('/object/sign/')
    const res = await fetch(data!.signedUrl)
    expect(res.status).toBe(200)
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.length).toBeGreaterThan(0)
  })

  it('el objeto privado NO es accesible por URL pública', async () => {
    const path = track(DOCS, `docs/nopub/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(path, pdfBytes(), { contentType: 'application/pdf' })
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${DOCS}/${path}`
    const res = await fetch(publicUrl)
    expect(res.ok).toBe(false) // 400/404 — el bucket no es público
  })

  it('borra un objeto autorizado y deja de ser accesible', async () => {
    const path = `docs/del/${randomUUID()}.pdf`
    await admin.storage.from(DOCS).upload(path, pdfBytes(), { contentType: 'application/pdf' })
    const del = await admin.storage.from(DOCS).remove([path])
    expect(del.error).toBeNull()
    const after = await admin.storage.from(DOCS).createSignedUrl(path, 60)
    expect(after.error).not.toBeNull() // ya no existe
  })
})

// ─── Aislamiento entre buckets ────────────────────────────────────────────────

describe('aislamiento fotos ↔ documentos', () => {
  it('una foto pública es accesible por URL pública, pero un documento privado no', async () => {
    // Foto pública (subida por service_role, respeta MIME de imagen).
    const photoPath = track(PHOTOS, `veh/${randomUUID()}.png`)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
    const upPhoto = await admin.storage
      .from(PHOTOS)
      .upload(photoPath, png, { contentType: 'image/png', upsert: false })
    expect(upPhoto.error).toBeNull()

    const docPath = track(DOCS, `docs/iso/${randomUUID()}.pdf`)
    await admin.storage.from(DOCS).upload(docPath, pdfBytes(), { contentType: 'application/pdf' })

    // La foto SÍ por URL pública…
    const photoPublic = `${SUPABASE_URL}/storage/v1/object/public/${PHOTOS}/${photoPath}`
    const photoRes = await fetch(photoPublic)
    expect(photoRes.ok).toBe(true)

    // …el documento NO por URL pública ni por anon.
    const docPublic = `${SUPABASE_URL}/storage/v1/object/public/${DOCS}/${docPath}`
    const docRes = await fetch(docPublic)
    expect(docRes.ok).toBe(false)
    const anonDl = await anon.storage.from(DOCS).download(docPath)
    expect(anonDl.error).not.toBeNull()
  })
})
