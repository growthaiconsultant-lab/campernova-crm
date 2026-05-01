-- ============================================================
-- Campernova CRM — Supabase one-time setup
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- (supabase.com/dashboard → proyecto → SQL Editor)
-- ============================================================

-- ─── 1. Extensiones ─────────────────────────────────────────
-- pgvector: necesario para embeddings en v2. Activar ahora para
-- no bloquear la migración de schema cuando llegue ese sprint.
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 2. Buckets de Storage ───────────────────────────────────

-- Fotos de vehículos: acceso público de lectura, escritura solo autenticados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  2097152, -- 2 MB por archivo (cliente comprime a ≤1.5 MB antes de subir)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Documentos de leads: privado, solo usuarios autenticados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-documents',
  'lead-documents',
  false,
  10485760, -- 10 MB por archivo (PDFs, fotos ITV, contratos)
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Políticas RLS — vehicle-photos ───────────────────────

-- Lectura pública (el bucket ya es public pero dejamos la policy explícita)
CREATE POLICY "vehicle-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos');

-- Subida solo para usuarios autenticados
CREATE POLICY "vehicle-photos: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND auth.role() = 'authenticated'
  );

-- Actualización solo para usuarios autenticados
CREATE POLICY "vehicle-photos: authenticated update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vehicle-photos'
    AND auth.role() = 'authenticated'
  );

-- Borrado solo para usuarios autenticados
CREATE POLICY "vehicle-photos: authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vehicle-photos'
    AND auth.role() = 'authenticated'
  );

-- ─── 4. Políticas RLS — lead-documents ───────────────────────

-- Lectura solo para usuarios autenticados
CREATE POLICY "lead-documents: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lead-documents'
    AND auth.role() = 'authenticated'
  );

-- Subida solo para usuarios autenticados
CREATE POLICY "lead-documents: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lead-documents'
    AND auth.role() = 'authenticated'
  );

-- Actualización solo para usuarios autenticados
CREATE POLICY "lead-documents: authenticated update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lead-documents'
    AND auth.role() = 'authenticated'
  );

-- Borrado solo para usuarios autenticados
CREATE POLICY "lead-documents: authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lead-documents'
    AND auth.role() = 'authenticated'
  );
