# COM-10 — Notas comerciales y varias acciones desde la ficha

| Campo           | Valor                                             |
| --------------- | ------------------------------------------------- |
| **Estado**      | IMPLEMENTED                                       |
| Owner           | Engineering                                       |
| Ticket          | Petición del propietario en este chat, 2026-10-21 |
| Rama / PR       | `codex/compradores-seguimiento`; PR pendiente     |
| Categorías      | UI, consultas, seguimiento comercial              |
| Riesgo          | Medio                                             |
| Ruta SDD        | Estándar                                          |
| Última revisión | 2026-10-21                                        |

## Problema y evidencia

VERIFICADO EN CÓDIGO (`origin/main` 249531d): las notas están dentro de Actividad,
mezcladas con 50 entradas de auditoría. Próxima acción tiene un editor pequeño de un
único valor. CalendarEvent ya permite varias acciones con descripción y fecha.
El propietario confirma que necesita varias acciones pendientes simultáneas.

## Resultado esperado

En la ficha inicial aparecen Notas comerciales y Próximas acciones. El comercial
escribe una nota y consulta sólo aportaciones humanas; cada nota conserva autor y
fecha de registro y continúa en Actividad. Puede programar varias acciones con tipo,
fecha, hora y nota opcional sin salir de la ficha, usando el calendario existente.

## Reglas e invariantes

- Reutilizar `addBuyerLeadNote` y `createCalendarEvent`; mismos permisos de agente/admin.
- Las notas se consultan por separado, paginadas, sin depender de las últimas actividades.
- Excluir notas sin autor y las notas automáticas conocidas de reparto y cambios de origen.
- La fecha de una nota es la de registro; la fecha de conversación puede escribirse en el texto.
- Los eventos conservan sus estados y su clasificación de compromiso actual.
- La acción destacada histórica sigue visible y editable; crear eventos no la sobrescribe.
- Las acciones nuevas pertenecen al comercial que las crea, sin avisos a terceros.
- Un fallo mantiene el formulario; desactivar envíos mientras se guarda.

## Decisiones y plan técnico

1. Componentes con formularios accesibles y estados vacío, guardando, éxito y error.
2. Consulta específica de notas y paginación independiente para notas/eventos pendientes.
3. Adaptar tipos comerciales a eventos nativos: llamada a LLAMADA, visita a CITA,
   resto a OTRO con título descriptivo. La nota se guarda en `description`.
4. Pruebas de interfaz con datos ficticios y mutaciones simuladas; consulta real de
   notas en integración si está disponible una base local aislada.

### Impacto

- Código: ficha de comprador, nuevos componentes y adaptación pura de inputs.
- Datos/migraciones: ninguna; las notas y eventos usan entidades existentes.
- Permisos: sin cambios; autorización y validación existentes en servidor.
- Concurrencia: reutilizar el lock de creación de eventos contra archivado; no modificarlo.
- Integraciones: calendario agregado existente, sin llamadas externas nuevas.
- KPIs: sin cambio de significado. Eventos y acción destacada siguen siendo hechos distintos.

## Fuera de alcance

Migraciones, nuevos permisos, notificaciones y modificaciones de vendedores.

## Criterios de aceptación

- [x] Notas visibles desde ficha con autor, fecha y texto, sin entradas automáticas conocidas.
- [x] Notas históricas accesibles aunque haya más de 50 actividades posteriores.
- [x] Varias acciones con tipo, fecha/hora y descripción; aparecen en calendario y ficha.
- [x] Conservar acciones anteriores y permitir acceder a su gestión existente.
- [x] Formularios funcionan con teclado, móvil, errores y guardado pendiente.

## Verificación

Verificación local completada el 2026-10-21:

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, sin advertencias.
- `pnpm check:sdd`: PASS.
- Vitest focalizado (`lib/buyer-followup.test.ts`, `lib/calendar`, acciones de comprador): 77 PASS.
- Integración `tests/integration/buyer-followup.test.ts`: 3 PASS sobre PostgreSQL local
  aislado en 127.0.0.1:55441; replay de las 21 migraciones existentes. Comprueba filtrado,
  paginación, persistencia múltiple, agregación al calendario, completar y rechazos.
- `pnpm test:buyer-followup`: 8 PASS (Chrome escritorio y WebKit móvil). Después se añadió
  y ejecutó el caso de teclado: otros 2 PASS. Total de interfaz: 10 casos.
- Capturas de ambos tamaños revisadas en `.artifacts/buyer-followup/` con datos ficticios.
- `git diff --check` y Prettier: PASS.

El primer intento de integración detectó que el fixture omitía el teléfono obligatorio;
se corrigió el fixture y se repitieron integración y tipos con éxito.
No se ejecutó build (incluye consulta remota), CI ni E2E con autenticación real.

## Rollout, rollback y stop conditions

Autorización expresa del propietario, 2026-10-21: «Vale, publícalo en el CRM para que
los comerciales puedan empezar a usarlo». Autoriza commit, push, PR, merge y despliegue.
Ruta reforzada para publicación: base verificada `origin/main` 249531d; proyecto
Vercel `campernova-crm`, dominio `campersnova.com`. No cambian schema ni variables.
CI debe pasar antes del squash merge; confirmar deployment Production y SHA correspondiente.
Revertir el commit de interfaz deja las notas/eventos accesibles en los módulos previos.
Detener si CI falla, cambia el head revisado o el deployment no corresponde a este cambio.
Los tests siguen exclusivamente en bases locales; smoke autenticado remoto de lectura,
sin crear compradores ni eventos ficticios. Observación con comerciales posterior al despliegue.

## Revisión adversarial

- Separar consultas evita ocultar notas antiguas por actividad automática reciente.
- NOTA histórico no distingue formalmente origen humano: se excluyen writers automáticos
  verificados. Nuevos writers automáticos deben usar tipos propios o actualizar este filtro.
- No prometer idempotencia de red: CalendarEvent existente permite creaciones repetidas;
  se bloquea doble clic en la interfaz y no se reintentan mutaciones automáticamente.
- Mantener accesible la acción destacada evita pérdida silenciosa de trabajo previo.

## Cierre

Implementado y comprobado localmente en `codex/compradores-seguimiento`.
Publicación autorizada; commit, PR, CI, deployment y smoke pendientes de registrar.
