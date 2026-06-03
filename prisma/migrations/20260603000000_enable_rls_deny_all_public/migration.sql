-- Seguridad: activar Row Level Security en todas las tablas del esquema public.
--
-- Contexto: en Supabase las tablas del esquema `public` se exponen automáticamente
-- a través de la API REST (PostgREST) usando la clave anónima, que es pública (viaja
-- al navegador). Sin RLS, los roles `anon`/`authenticated` podían leer toda la base de
-- datos del CRM (PII de leads, márgenes internos, tokens de sesión del chat, etc.).
--
-- La aplicación NO usa esa API: accede siempre vía Prisma con el rol `postgres`, que
-- tiene el atributo BYPASSRLS y por tanto ignora estas políticas. Activar RLS sin
-- definir políticas deniega por defecto a los roles SIN BYPASSRLS (anon/authenticated),
-- cerrando la fuga sin afectar a la app.
--
-- No se usa FORCE ROW LEVEL SECURITY: el dueño de las tablas (Prisma) sigue operando
-- con normalidad.
--
-- Aplicada en producción vía Supabase MCP el 2026-06-03.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
