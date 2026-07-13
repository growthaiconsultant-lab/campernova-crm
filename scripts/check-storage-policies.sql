-- PR5B2 — Invariantes de catálogo de Storage (se ejecuta con psql -v ON_ERROR_STOP=1 contra el
-- Supabase LOCAL, tras aplicar supabase/migrations). RAISE EXCEPTION en cualquier violación →
-- psql sale con código != 0 y el job de CI falla. Verifica semántica, no SQL literal frágil.

-- 1. vehicle-documents privado; vehicle-photos público.
DO $$
DECLARE p boolean;
BEGIN
  SELECT public INTO p FROM storage.buckets WHERE id = 'vehicle-documents';
  IF p IS NULL THEN RAISE EXCEPTION 'bucket vehicle-documents no existe'; END IF;
  IF p IS DISTINCT FROM false THEN RAISE EXCEPTION 'vehicle-documents debe ser privado (public=false)'; END IF;

  SELECT public INTO p FROM storage.buckets WHERE id = 'vehicle-photos';
  IF p IS NULL THEN RAISE EXCEPTION 'bucket vehicle-photos no existe'; END IF;
  IF p IS DISTINCT FROM true THEN RAISE EXCEPTION 'vehicle-photos debe ser público (public=true)'; END IF;
END $$;

-- 2. Límites del bucket privado coinciden con la aplicación (10 MiB + allowlist MIME).
DO $$
DECLARE lim bigint; mimes text[];
BEGIN
  SELECT file_size_limit, allowed_mime_types INTO lim, mimes
  FROM storage.buckets WHERE id = 'vehicle-documents';
  IF lim IS DISTINCT FROM 10485760 THEN RAISE EXCEPTION 'vehicle-documents file_size_limit inesperado: %', lim; END IF;
  IF NOT (mimes @> ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]) THEN
    RAISE EXCEPTION 'vehicle-documents allowlist MIME incompleta: %', mimes;
  END IF;
  IF mimes && ARRAY['text/html','image/svg+xml','application/javascript']::text[] THEN
    RAISE EXCEPTION 'vehicle-documents permite MIME peligroso: %', mimes;
  END IF;
END $$;

-- 3. lead-documents NO existe en entornos nuevos (deprecado).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'lead-documents') THEN
    RAISE EXCEPTION 'lead-documents no debe crearse en entornos nuevos (deprecado, PR5B3)';
  END IF;
END $$;

-- 4. vehicle-documents = DENY-ALL: NINGUNA política de storage.objects lo referencia.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) LIKE '%vehicle-documents%';
  IF n <> 0 THEN RAISE EXCEPTION 'vehicle-documents debe ser deny-all (0 políticas), encontradas %', n; END IF;
END $$;

-- 5. Ninguna política "abierta" (USING/WITH CHECK = true) para anon/authenticated/public: eso
--    concedería acceso indiscriminado a TODOS los buckets, incluido el privado.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (btrim(coalesce(qual, '')) = 'true' OR btrim(coalesce(with_check, '')) = 'true')
    AND (roles && ARRAY['anon','authenticated','public']::name[]);
  IF n <> 0 THEN RAISE EXCEPTION 'política demasiado permisiva (true) para anon/authenticated/public: %', n; END IF;
END $$;

-- 6. vehicle-photos tiene exactamente las 4 políticas esperadas (public read + auth write/upd/del),
--    todas filtradas por bucket_id (nunca acceso cruzado a documentos).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) LIKE '%vehicle-photos%';
  IF n <> 4 THEN RAISE EXCEPTION 'vehicle-photos debe tener 4 políticas, encontradas %', n; END IF;

  -- Todas las políticas que mencionan vehicle-photos filtran por bucket_id (no acceso cruzado).
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) LIKE '%vehicle-photos%'
    AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT LIKE '%bucket_id%';
  IF n <> 0 THEN RAISE EXCEPTION 'políticas de vehicle-photos sin filtro bucket_id: %', n; END IF;
END $$;

\echo 'check-storage-policies: OK'
