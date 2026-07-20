-- Clasificación del compromiso de un evento de calendario.
--
-- Motivo: `CalendarEventType` no permite distinguir un compromiso acordado con un cliente
-- (que no debe romperse) de una tarea interna. Esa distinción es requisito previo para que el
-- archivado de leads pueda bloquear compromisos externos futuros sin bloquear recordatorios.
--
-- El histórico NO se clasifica por conveniencia: solo `CITA` y `LIMPIEZA` tienen semántica
-- inequívoca. `LLAMADA`, `OTRO` y `SEGUIMIENTO` quedan `INDETERMINADO` para que un humano los
-- clasifique; asumirlos internos podría ocultar un compromiso real con un cliente.
--
-- Seguridad de la migración:
--   · additiva — no altera columnas, tipos, estados, fechas ni vínculos existentes;
--   · `ADD COLUMN` nullable: metadata-only, sin reescritura de tabla;
--   · el backfill es un UPDATE acotado a `calendar_events`;
--   · `SET DEFAULT` antes de `SET NOT NULL` para que el código ANTERIOR al despliegue siga
--     insertando sin conocer la columna (los inserts omiten `commitment` → default);
--   · `SET NOT NULL` toma ACCESS EXCLUSIVE y valida con un scan de la tabla.
-- Volumen en producción al preparar esta migración: 2 filas (ambas `CITA`). Duración estimada:
-- milisegundos. Reversible con `DROP COLUMN` + `DROP TYPE` (no hay pérdida de datos previos).

-- CreateEnum
CREATE TYPE "EventCommitment" AS ENUM ('EXTERNO', 'INTERNO', 'INDETERMINADO');

-- AlterTable: se añade nullable para poder hacer el backfill explícito antes de fijar el default.
ALTER TABLE "calendar_events" ADD COLUMN     "commitment" "EventCommitment";

-- Backfill explícito por tipo. Sin cláusula ELSE implícita: cada tipo se decide a propósito.
UPDATE "calendar_events" SET "commitment" = 'EXTERNO'       WHERE "type" = 'CITA';
UPDATE "calendar_events" SET "commitment" = 'INTERNO'       WHERE "type" = 'LIMPIEZA';
UPDATE "calendar_events" SET "commitment" = 'INDETERMINADO' WHERE "type" IN ('LLAMADA', 'OTRO', 'SEGUIMIENTO');

-- Red de seguridad: cualquier fila no cubierta arriba queda INDETERMINADO, nunca clasificada
-- automáticamente como interna.
UPDATE "calendar_events" SET "commitment" = 'INDETERMINADO' WHERE "commitment" IS NULL;

-- Default para el código anterior al despliegue y para cualquier inserción futura sin valor.
ALTER TABLE "calendar_events" ALTER COLUMN "commitment" SET DEFAULT 'INDETERMINADO';

-- Ya no quedan nulos: se fija la obligatoriedad.
ALTER TABLE "calendar_events" ALTER COLUMN "commitment" SET NOT NULL;
