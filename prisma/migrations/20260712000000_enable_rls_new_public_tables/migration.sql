-- PR1 (Fase 0 · SEG-01): activar Row Level Security en las tablas de `public`
-- creadas DESPUÉS de la migración deny-all `20260603000000_enable_rls_deny_all_public`,
-- que se aplicó una sola vez sobre las tablas existentes entonces y NO cubre tablas futuras.
--
-- Sin RLS + grants por defecto de Supabase (anon/authenticated con DML) + 0 políticas,
-- estas tablas quedaban expuestas a la API PostgREST con la clave anónima (pública).
--
-- Se activa RLS SIN crear políticas de forma DELIBERADA: eso deja las tablas en modo
-- deny-all para los roles PostgREST (anon/authenticated), mientras Prisma sigue accediendo
-- con normalidad mediante su rol con el atributo BYPASSRLS.
--
-- `ENABLE ROW LEVEL SECURITY` es idempotente (re-ejecutarlo es un no-op inofensivo) y
-- metadata-only (sin reescritura de tabla, sin bloqueo de escrituras).
--
-- NO se modifican: grants, roles, otras tablas, políticas existentes, storage, buckets,
-- el esquema Prisma, datos, funciones, triggers ni extensiones. No se usa event trigger.

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_events ENABLE ROW LEVEL SECURITY;
