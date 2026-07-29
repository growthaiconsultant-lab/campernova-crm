/**
 * Fase de arranque (decisión del dueño, 2026-07-29) — La validación de la ENTRADA OFICIAL del
 * vehículo NO exige, de momento, ninguna precondición de NEGOCIO: ni llegada física, ni comercial
 * responsable, ni ubicación de aparcamiento, ni llaves, ni contrato de gestión, ni checklist
 * documental, ni matrícula/expediente. La comercial puede validar la entrada aunque el vehículo esté
 * incompleto. Se re-endurecerá poniendo este flag a `true` cuando el proceso lo requiera.
 *
 * IMPORTANTE: los guards de INTEGRIDAD e IDEMPOTENCIA (raíz cambiada, lead archivado, entrada ya
 * validada, entrada anulada terminal, unicidad de la orden de inspección, CAS) se mantienen SIEMPRE,
 * con o sin este flag. Este flag solo desactiva las precondiciones de datos de negocio.
 *
 * Vive en su propio módulo (sin dependencias de Prisma) para poder importarse tanto desde el núcleo
 * de servidor como desde el panel cliente.
 */
export const ENTRY_REQUIRE_PRECONDITIONS = false
