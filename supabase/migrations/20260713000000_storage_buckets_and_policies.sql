-- PR5B2 — Buckets de Storage y políticas de `storage.objects`, versionados y reproducibles.
--
-- Fuente de verdad para entornos NUEVOS (local / CI). NO accede a objetos, NO borra buckets,
-- NO ejecuta contra remoto. La reconciliación del entorno remoto existente (que hoy pudo
-- crearse desde el panel) es trabajo de PR5B3.
--
-- Modelo de autorización (Opción B): la autorización real del CRM vive en Prisma (rol de
-- usuario + propiedad de la entidad), NO en el JWT de Supabase. Por eso `storage.objects` no
-- puede expresarla y el bucket privado `vehicle-documents` queda DENY-ALL para `anon` y
-- `authenticated` (sin políticas): todas las operaciones privadas (subida, firma, borrado) las
-- realiza el servidor con la clave `service_role` (que ignora RLS) DESPUÉS de autorizar en
-- Prisma. `vehicle-photos` sigue siendo media pública no sensible (lectura pública, escritura
-- autenticada), como hasta ahora.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Buckets
-- ─────────────────────────────────────────────────────────────────────────────

-- Documentos privados (DNI, contratos, ITV, cargas DGT, facturas, entregas, garantías…).
-- Privado + límite 10 MiB + allowlist MIME idéntica a `validateDocumentFile` (PR5A). Sin SVG,
-- HTML, scripts ni ejecutables. `on conflict do update` = actualización controlada idempotente
-- (no recrea, no cambia el id, no toca objetos).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-documents',
  'vehicle-documents',
  false,
  10485760, -- 10 MiB (MAX_PRIVATE_DOCUMENT_BYTES)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Fotos comerciales (media pública no sensible). Público + 2 MiB + solo imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  2097152, -- 2 MiB (el cliente comprime a ≤1.5 MB antes de subir)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Nota: `lead-documents` (bucket original, sin uso en el código) NO se crea en entornos nuevos.
-- No se borra remotamente aquí (posible dependencia histórica) — su deprecación/limpieza es PR5B3.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Políticas de `vehicle-photos` (media pública)
-- ─────────────────────────────────────────────────────────────────────────────
-- Lectura pública; escritura/actualización/borrado solo para usuarios autenticados
-- (las Server Actions ya autorizan con Prisma antes de escribir). `drop if exists` → idempotente.

DROP POLICY IF EXISTS "vehicle-photos: public read" ON storage.objects;
CREATE POLICY "vehicle-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos');

DROP POLICY IF EXISTS "vehicle-photos: authenticated upload" ON storage.objects;
CREATE POLICY "vehicle-photos: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "vehicle-photos: authenticated update" ON storage.objects;
CREATE POLICY "vehicle-photos: authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vehicle-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "vehicle-photos: authenticated delete" ON storage.objects;
CREATE POLICY "vehicle-photos: authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-photos' AND auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. `vehicle-documents` — DENY-ALL para anon/authenticated (SIN políticas)
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS ya está habilitada en `storage.objects` (por Supabase). Al NO crear ninguna política
-- para `bucket_id = 'vehicle-documents'`, ni `anon` ni `authenticated` pueden SELECT/INSERT/
-- UPDATE/DELETE sobre él. Solo `service_role` (servidor, ignora RLS) opera este bucket, tras la
-- autorización de Prisma. Por diseño NO se crean políticas de UPDATE (objetos inmutables,
-- `upsert:false`). Este bloque es documentación: la garantía es la AUSENCIA de políticas.
-- Limpieza defensiva de cualquier política previa homónima (por si un entorno recreado la tuviera):
DROP POLICY IF EXISTS "vehicle-documents: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "vehicle-documents: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "vehicle-documents: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "vehicle-documents: authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "vehicle-documents: public read" ON storage.objects;
