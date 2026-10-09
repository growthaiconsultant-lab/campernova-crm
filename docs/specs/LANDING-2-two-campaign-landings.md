# LANDING-2 — Publicar las campañas de compradores y vendedores

| Campo               | Valor                              |
| ------------------- | ---------------------------------- |
| **Estado**          | IMPLEMENTED                        |
| **Owner**           | Engineering                        |
| **Ticket**          | LANDING-2 (solicitud en este chat) |
| **Rama / PR**       | `codex/two-campaign-landings`      |
| **Categorías**      | C0, C1, C3, C5, C6, C8             |
| **Riesgo**          | Alto                               |
| **Ruta SDD**        | Reforzada                          |
| **Última revisión** | 2026-10-09                         |

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

| Criterio    | Evidencia prevista                              | Resultado                             |
| ----------- | ----------------------------------------------- | ------------------------------------- |
| API/datos   | Vitest y PostgreSQL efímero en CI               | Unit 1677 OK; PostgreSQL pendiente CI |
| Formularios | Playwright desktop/móvil con destinos simulados | 22 OK                                 |
| Publicación | HTTP/recursos y deployment de main              | Pendiente                             |

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

- **Commit:** Pendiente
- **PR:** Pendiente
- **CI:** Unit local 1677 OK; typecheck y lint OK; Prisma validate con URLs locales ficticias OK. CI remota pendiente.
- **Deployment:** Pendiente de CI y migración remota. Vercel marca DIRECT_URL como sensitive y no devuelve su valor por CLI; no descargar otros secretos.
- **Validación:** Playwright Chrome desktop/móvil 22 OK, todos los destinos simulados. No nuevos contactos reales enviados.
- **Deuda restante:** Sin cola de reenvíos.

### Operación alternativa preparada

El comando scripts/deploy-buyer-landing-migration.ts es de solo lectura por defecto.
Comprueba identidad, checksums, única migración pendiente y schema antes de cualquier aplicación.
Una configuración temporal de despliegue Vercel permitiría usar las credenciales existentes
sin descargarlas. Aplicar en ese build requiere autorización específica como excepción al runbook.
Production usa --skip-domain para mantener los dominios en la versión anterior hasta el merge.
El build ordinario y su guard de solo lectura permanecen intactos.
