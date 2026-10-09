# LANDING-1 — Publicar la campaña con entrada en CRM y Nira

| Campo               | Valor                               |
| ------------------- | ----------------------------------- |
| **Estado**          | APPROVED                            |
| **Owner**           | Engineering                         |
| **Ticket**          | LANDING-1 (solicitud en este chat)  |
| **Rama / PR**       | `codex/vende-tu-camper-dual-intake` |
| **Categorías**      | C0, C1, C3, C5, C6, C8              |
| **Riesgo**          | Alto                                |
| **Ruta SDD**        | Reforzada                           |
| **Última revisión** | 2026-10-09                          |

## Problema y evidencia

El ZIP suministrado contiene una landing estática, recursos locales y un formulario que envía
exclusivamente a Nira. El middleware de main protege por defecto HTML, JS, CSS, WOFF2 y MP4.
El usuario solicita publicarla y que los contactos entren «a los dos»: CRM y Nira.

## Resultado esperado

`https://campersnova.com/vende-tu-camper.html` conserva el diseño recibido y funciona sin login.
Cada envío crea una solicitud web pendiente con vehículo en el CRM y envía el contrato original
a Nira. Solo se muestra éxito completo cuando ambos destinos confirman `{ ok: true }`.

## Reglas e invariantes

- Crear `SellerLead` PRO/PENDIENTE/NUEVO y `Vehicle` NUEVO; no admitir ni publicar automáticamente.
- Nombre, teléfono, tipo, marca/modelo libre, año y km son datos reales; email y marca separada
  quedan null porque el formulario no los captura. La marca/modelo libre se conserva completa.
- Prioridad, búsqueda de otro vehículo y atribución quedan como respuestas originales en una nota.
- Consentimiento explícito obligatorio en cliente y servidor; registrar fecha e IP en el CRM.
- Los reintentos idénticos en el CRM no duplican lead, vehículo, nota ni KPI, incluso en carrera.
- Origen same-origin, JSON acotado, Zod, honeypot y cuota de 10 nuevos contactos por IP/hora.
- No exponer fichas, IDs ni payloads en la API pública, logs, analytics o mensajes de error.
- Ambos envíos se inician de forma independiente; fallo en uno no impide guardar en el otro.
- Reintento manual solo para destinos no confirmados, con el mismo event_id y payload.
- Nira recibe el mismo formato y endpoint del ZIP. No se promete deduplicación externa sin
  evidencia de su contrato: un timeout puede ser ambiguo aunque el cliente conserve event_id.
- La página no incorpora píxeles nuevos; conserva noindex y enlaces legales existentes.

## Fuera de alcance

Migraciones, modificaciones de datos históricos, tasación automática con datos insuficientes,
matching, admisión de solicitudes, nuevos proveedores/dependencias y cambio de la página `/vender`.
No hay cola de reenvío en segundo plano: si el usuario cierra la página tras un fallo parcial,
el envío pendiente requiere intervención. WhatsApp mantiene los datos preparados.

## Decisiones

| Decisión          | Alternativas                                     | Resolución y motivo                                                                                      |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Destinos          | Solo Nira; solo CRM; ambos                       | Ambos, autorizado expresamente por el usuario.                                                           |
| Integración       | Fan-out cliente; servidor con outbox y migración | Fan-out cliente con estados explícitos y reintento manual; aprovecha CORS de Nira y evita una migración. |
| Duplicados CRM    | Check previo; constraint + lock                  | ID derivado de payload normalizado y event_id; lock PostgreSQL y PK dentro de transacción.               |
| Datos incompletos | Inferir marca; inventar email                    | Conservar texto de marca/modelo y ausencia real en campos no capturados.                                 |
| Publicación       | Sitio independiente; web existente               | Integrar en el proyecto Vercel actual, vía PR/CI y main.                                                 |

## Plan técnico

1. Baseline: main sincronizado, rama limpia, extracción restringida a `public` sin sobrescribir.
2. Abrir únicamente la landing, sus recursos y el endpoint concreto; preservar guards internos.
3. Añadir endpoint y persistencia atómica, consentimiento, cuota e idempotencia.
4. Adaptar cliente a doble envío, timeouts de 15s, errores parciales, reintento y WhatsApp.
5. Verificar middleware/API, formulario desktop/móvil y carreras en PostgreSQL efímero en CI.
6. Revisar diff, publicar PR, esperar CI, merge y verificar deployment de Vercel.

### Impacto

- **Código y consumidores:** middleware, host-routing, nueva API y recursos aislados.
- **Datos/migraciones:** nuevas solicitudes; schema y migraciones existentes intactos.
- **Permisos/seguridad:** API de escritura pública exacta; ningún endpoint de lectura nuevo.
- **Concurrencia/idempotencia:** locks por solicitud e IP, constraint PK, transacción lead/nota/KPI.
- **Integraciones/efectos externos:** Nira desde navegador; WhatsApp solo por acción del visitante.
- **Observabilidad/KPIs:** SELLER_CREATED transaccional una vez; errores sin PII.

## Criterios de aceptación

- [ ] HTML y todos los recursos responden sin sesión; rutas privadas siguen protegidas.
- [ ] Formulario desktop y móvil valida pasos, consentimiento y datos numéricos.
- [ ] Envía a ambos destinos con atribución/event_id; éxito solo tras ambas confirmaciones.
- [ ] Fallo total/parcial conserva WhatsApp y permite reintentar solo lo pendiente.
- [ ] Persistencia atómica, datos ausentes null, solicitud pendiente, KPI/nota sin duplicados.
- [ ] La API rechaza origen distinto, consentimiento ausente, JSON inválido/grande y honeypot.
- [ ] CI y deployment identificables; distinguir pruebas simuladas de entrega real a Nira.

## Verificación

| Criterio                    | Evidencia prevista                                             | Resultado                                                                        |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Routing y API               | Vitest con sesión/Prisma mockeados                             | 41 tests dirigidos pasan                                                         |
| Persistencia/carreras/cuota | PostgreSQL efímero en GitHub CI                                | Pendiente                                                                        |
| Formulario y recursos       | Playwright local, desktop/móvil, respuestas interceptadas      | 12 tests desktop/móvil pasan                                                     |
| Calidad                     | typecheck, lint, unit, check:sdd                               | Tipos y lint correctos; 1661 unitarios pasan; SDD correcto                       |
| Producción                  | GET recursos, rechazos API sin mutación, deployment            | Pendiente                                                                        |
| Nira real                   | OPTIONS/CORS y, con autorización específica, solicitud técnica | OPTIONS 200, CORS abierto y POST/Content-Type permitidos; entrega real pendiente |

## Rollout, rollback y stop conditions

- **Autorización:** integrar/publicar esta landing y enviar los contactos a CRM+Nira según el chat.
- **Rollout:** PR desde main; merge con quality e integración verdes; deployment automático Vercel.
- **Rollback:** revertir el commit o restaurar el deployment anterior; conservar solicitudes recibidas.
- **Detener si:** CI falla, cambia main fuera de alcance, CORS Nira bloquea, routing privado se abre,
  se necesita una migración o el entorno de prueba apunta a producción.
- **Validación post-despliegue:** GET de landing, CSS/JS/fonts/vídeos y API negativa. Entrega real
  de un contacto a Nira requiere prueba autorizada; confirmar también su recepción operativa.

## Revisión adversarial

| Riesgo intentado                   | Mitigación o riesgo pendiente                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Abrir rutas internas por extensión | Allowlist solo `/cn-landing` y rutas exactas.                                        |
| Abuso/cross-origin o JSON gigante  | Origin, límites de stream, validación, honeypot y cuota DB.                          |
| Dos instancias/reintentos          | Locks ordenados y PK; integración real con dos clientes.                             |
| Fallo Nira tras guardar CRM        | Estado parcial, reintento selectivo y WhatsApp; sin promesa de exactly-once externo. |
| Fuga de contacto                   | Respuesta booleana y logs genéricos; campos internos nunca en analytics.             |

## Cierre

- **Commit/PR/CI/Deployment:** pendientes.
- **Validación:** pendiente; no hay envíos de prueba a producción en esta fase.
- **Deuda restante:** recepción operativa Nira y tratamiento de timeouts ambiguos del proveedor.
