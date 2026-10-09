# LANDING-2 — Publicar las campañas de compradores y vendedores

| Campo               | Valor                                |
| ------------------- | ------------------------------------ |
| **Estado**          | IMPLEMENTED                          |
| **Owner**           | Engineering                          |
| **Ticket**          | LANDING-2 (solicitud en este chat)   |
| **Rama / PR**       | `codex/two-campaign-landings` / #192 |
| **Categorías**      | C0, C1, C3, C5, C6, C8               |
| **Riesgo**          | Alto                                 |
| **Ruta SDD**        | Reforzada                            |
| **Última revisión** | 2026-10-09                           |

## Problema y evidencia

El usuario solicita subir ambos ZIP. La campaña de vendedores ya está publicada por PR #191.
El ZIP de compradores comparte recursos con ella, pero solo envía a Nira. El CRM exige email
en BuyerLead y el formulario original no lo captura. El usuario autoriza adaptar el CRM para aceptar compradores sin email.

## Resultado esperado

Ambas URLs públicas funcionan sin sesión, con el diseño recibido y recursos locales.
Cada formulario envía a su endpoint específico de Nira y al CRM. Compradores crean BuyerLead
NUEVO con source PRO (Formulario web); vendedores conservan su entrada pendiente actual.

## Reglas e invariantes

- No inventar email, plazas exactas, presupuesto máximo abierto ni zona de uso.
- Validación Zod, consentimiento explícito, honeypot y límite real de 16 KiB.
- Reintentos en CRM sin duplicar lead, nota o KPI, incluidos envíos concurrentes.
- Éxito completo solo cuando ambos destinos confirman; reintento únicamente de lo pendiente.
- No publicar datos privados ni abrir otras APIs. No nuevos píxeles o dependencias.
- No crear chats artificiales para guardar entradas de un formulario estático.
- Registrar consentimiento e IP en nuevos campos canónicos nullable de BuyerLead.
- Cuota de 10 entradas por IP/hora en cada campaña con lock PostgreSQL.

## Fuera de alcance

Matching automático, cambios de datos existentes, nuevos chats y nuevos proveedores.
No reenvíos en segundo plano ni garantías de deduplicación externa de Nira.
La prueba real autorizada de vendedores ya se ejecutó; no repetir avisos externos sin autorización.

## Decisiones

| Decisión             | Alternativas                            | Resolución y motivo                                                    |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| Email compradores    | Campo requerido / CRM nullable          | CRM nullable, autorizado expresamente por el usuario                   |
| Plazas y presupuesto | Inferir números / conservar rango       | Guardar respuestas sin inventar precisión; maxBudget solo si hay techo |
| Consentimiento       | Chat artificial / campos propios        | Nuevos campos de consentimiento en BuyerLead; sin alterar chats        |
| Recursos             | Sobrescribir JS / compartir integración | Mantener doble envío y elegir endpoint por slug                        |

## Plan técnico

1. Importar recursos nuevos verificando hashes de los compartidos.
2. Implementar entrada comprador validada y atómica; adaptar ambos HTML y script común.
3. Verificar API, middleware, desktop/móvil y concurrencia PostgreSQL efímera en CI.
4. PR y CI, merge, deployment y smoke público de ambas URLs.

### Impacto

- **Código y consumidores:** nueva landing/API, shared JS, allowlist concreta.
- **Datos/migraciones:** migración aditiva de consentimiento y email nullable; sin modificar valores históricos.
- **Permisos/seguridad:** escritura pública acotada, sin lectura de contactos.
- **Concurrencia/idempotencia:** ID ligado al payload, lock por solicitud e IP, transacción.
- **Integraciones/efectos externos:** CRM y Nira independientes con timeout/retry.
- **Observabilidad/KPIs:** BUYER_CREATED transaccional sin PII; errores genéricos.

## Criterios de aceptación

- [ ] Ambas páginas y recursos accesibles; CRM interno sigue protegido.
- [ ] Ambos formularios envían al endpoint correcto y validan consentimiento.
- [ ] BuyerLead, nota y KPI atómicos e idempotentes en PostgreSQL real.
- [ ] Fallos parciales y totales permiten retry solo del destino pendiente.
- [ ] API rechaza origen externo, payload inválido/grande y honeypot.
- [ ] CI verde y deployment identificado; no confundir mocks con entrega real.

## Verificación

| Criterio    | Evidencia prevista                              | Resultado                                 |
| ----------- | ----------------------------------------------- | ----------------------------------------- |
| API/datos   | Vitest y PostgreSQL efímero en CI               | 1677 unit locales y 413 integration CI OK |
| Formularios | Playwright desktop/móvil con destinos simulados | 22 OK                                     |
| Publicación | HTTP/recursos y deployment de main              | Pendiente                                 |

## Rollout, rollback y stop conditions

- **Rollout:** PR/CI verde; preflight, migración staging y producción verificados; merge; Vercel Ready y smoke.
- **Rollback/mitigación:** desactivar la API de compradores si falla; conservar soporte de email nullable. No volver a un cliente Prisma que exige email tras crear contactos null. Mantener expansión del schema, sin borrar datos.
- **Detener si:** CI falla, preflight de migración incompatible o recursos/destinos incorrectos.
- **Validación post-despliegue:** páginas, recursos y rechazo de API inválida sin nuevos contactos.

## Revisión adversarial

| Riesgo intentado           | Mitigación o riesgo pendiente                                           |
| -------------------------- | ----------------------------------------------------------------------- |
| Doble click/retry/race     | Payload estable y lock transaccional                                    |
| Payload falso/PII expuesta | Zod estricto, límite de bytes, respuesta sin IDs, logs sin datos        |
| Regresión vendedor         | Pruebas de ambas páginas sobre el mismo script                          |
| Timeout Nira ambiguo       | Riesgo documentado: event_id estable sin prometer deduplicación externa |

## Cierre

- **Commit:** implementación `01f4ca9`; rollout y replay `b53360f`.
- **PR:** [#192](https://github.com/growthaiconsultant-lab/campernova-crm/pull/192).
- **CI:** run `37943172054` PASS: quality, integration (413 tests / 40 files), migration-replay y supabase-storage. Local: 1677 unit, typecheck, lint, Prisma validate y 22 E2E OK.
- **Deployment:** Preview `dpl_3e68MN1jAi7bby6Lgu4KdD98RDSD` Ready. Migración staging y producción aplicada/verificada mediante operaciones Vercel aisladas; dominio público pendiente del merge.
- **Validación:** Playwright Chrome desktop/móvil 22 OK (destinos simulados). Entrada sintética NO CONTACTAR solo CRM staging aceptada HTTP 200 / ok:true, sin email y sin Nira. No nuevos contactos ni avisos enviados a Nira en esta fase.
- **Deuda restante:** Sin cola de reenvíos.

### Operación alternativa preparada

El comando scripts/deploy-buyer-landing-migration.ts es de solo lectura por defecto.
Comprueba identidad, checksums, única migración pendiente y schema antes de cualquier aplicación.
Una configuración temporal de despliegue Vercel permite usar las credenciales existentes
sin descargarlas. La decisión expresa del usuario de adaptar el CRM sin email autoriza esta migración necesaria. La operación temporal se ejecuta antes del build normal; no se incorpora a pnpm build ni se modifica su guard de solo lectura.
Production usa --skip-domain para mantener los dominios en la versión anterior hasta el merge.
El build ordinario y su guard de solo lectura permanecen intactos.

### Evidencia de migración y autorización

- Solicitud: publicar las dos landings y enviar los contactos a CRM y Nira. Decisión literal: «Aceptar compradores sin email en el CRM».
- Staging confirmado: iatuhydsfwoeprpbklod; operación dpl_HUhm4G113J6a6ZteXaYGCF4jwEBg, aplicada y verificada el 2026-10-09 14:26 UTC. El Preview aprobado aceptó la solicitud sintética sin email.
- Producción confirmada: bbmglaatlyilxutzomxd; operación dpl_6z8PJ9ETBY1jjYx6FsWpppbY9QAF con --skip-domain, aplicada y verificada el 2026-10-09 14:29 UTC. Guard posterior: 18 migraciones locales coherentes.
- Preflights: único pendiente LANDING-2, checksums previos correctos, email NOT NULL, sin intentos fallidos. Registro del schema previo y conteos agregados en logs de operación; sin exportar contactos ni secretos.
- Postflights: email y ambos campos de consentimiento nullable; historial completo y checksums verificados. Migración sin DML: los valores históricos permanecen intactos.
- La descarga amplia de secretos fue rechazada por revisión automática. No se repitió: acceso mínimo de metadatos y ejecución con credenciales dentro del entorno conectado.
- Las operaciones preparatorias se cancelan tras completar sus comprobaciones cuando su build adicional es redundante; sus logs mantienen la evidencia. No afectan al dominio público.
