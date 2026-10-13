# LANDING-6 — Entrada automática de compradores de Meta Lead Ads

| Campo           | Valor                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Estado**      | IMPLEMENTED                                                          |
| Owner           | Campers Nova / Engineering                                           |
| Ticket          | Solicitud en este chat: conectar CN · Encuentra tu camper · oct 2026 |
| Rama / PR       | codex/meta-lead-ads-buyer                                            |
| Categorías      | C0, C1, C3, C5, C6, C8                                               |
| Riesgo          | Alto: nueva credencial de escritura de contactos                     |
| Ruta SDD        | Reforzada proporcional                                               |
| Última revisión | 2026-10-13                                                           |

## Problema y evidencia

**A. Objetivo / B. Baseline.** HECHO VERIFICADO: main 4632729 rechaza POST sin Origin en
`app/api/landing/encuentra-tu-camper/route.ts`. Ya valida el contrato de la landing, persiste
comprador+nota+KPI en transacción y admite source META por atribución facebook. HECHO APORTADO:
el usuario ofrece el relay de su servidor con el mismo contrato y facebook/lead_ads.
DESCONOCIDO: configuración del emisor y entrega de los avisos actuales a info@campersnova.com.
La página Meta es 1321098031095901 y el formulario 3364123057107449, según el usuario.

## Resultado esperado

**C. Alcance.** Habilitar opción B en el endpoint de compradores con Authorization Bearer y
clave server-only. Contactos válidos aparecen automáticamente en Compradores, estado NUEVO,
origen META y atribución de campaña. Éxito únicamente tras commit de la transacción.

**D. Exclusiones.** No aceptar invitación Meta, administrar portfolio, leer Graph API, configurar
el emisor externo, cambiar vendedor, importar contactos históricos ni enviar correos/avisos.
Sin migraciones ni leads técnicos reales durante la verificación de producción.

## Decisiones

**E. Decisiones de negocio.** El usuario autoriza elegir A/B y conectar la campaña; se elige B
por conservar contrato y almacenamiento. Consentimiento real obligatorio; no se inventan respuestas.
**F. Flujo.** Servidor emisor → POST con clave → autenticación → límite JSON y Zod → atribución
facebook/lead_ads → transacción → 200 ok. Sin Authorization continúa el flujo web same-origin.

## Reglas e invariantes

**G. Estados.** BuyerLead NUEVO sin agente; no se modifica admisión de vendedores ni contactos existentes.
**H. Permisos.** Clave exclusiva META_BUYER_INTAKE_KEY, mínimo 32 caracteres, comparación de hashes
con timingSafeEqual. Ausente/desconfigurada = relay cerrado. Credencial inválida = 401 incluso con
Origin válido. Origin sigue obligatorio sin credencial. No CORS ni clave en navegador/URLs/logs/Git.
La credencial sólo permite insertar compradores por el endpoint exacto; no permite lectura ni vendedor.
**I. Datos.** Schema sin cambios. IP de consentimiento null para relay porque IP servidor no es IP
del interesado. Consentimiento true se conserva con timestamp de recepción, igual al contrato actual.
**J. Writers/readers.** Writer route y saveLandingBuyer; readers listado/ficha Compradores,
LandingAttribution y agregadores KPI. Metadata intake=meta_lead_ads es sólo diagnóstico/cuota.
**K. Concurrencia/idempotencia.** Conservar hash del payload parseado como PK y lock de solicitud;
reintentos usan event_id Meta estable y payload sin cambios. Payload diferente tiene identidad distinta:
el proveedor debe congelar la petición original. Lock compartido de relay serializa cuota de 300 nuevos
contactos/hora contada por KPI transaccional. Confirmados se reconocen antes de cuota; web mantiene 10/IP/h.
Orden locks: solicitud → relay o IP; no caminos con orden inverso.
**L. Efectos.** Comprador, nota de atribución y KPI una vez en la misma transacción; sin nuevo envío a Nira,
matching, publicaciones, notificaciones ni cron. Respuestas no exponen IDs ni datos personales.
**M. Errores.** 400 payload/consentimiento/UTM; 401 clave; 403 Origin web; 413 >16 KiB; 415 no JSON;
429 cuota; 503 persistencia. Emisor conserva cola y reintenta 429/503/timeout con backoff y payload idéntico.

## Plan técnico

1. Añadir auth server-only y gate de relay aislado al comprador.
2. Cuota de relay bajo lock y metadata KPI; conservar cuota/browser y contratos actuales.
3. Tests negativos auth, contratos y PostgreSQL real para carrera/cuota/idempotencia.
4. Publicar instrucciones, PR/CI, clave Production sensible y distinta de Preview, merge y smoke negativo.

### Impacto

Código: route comprador, helper auth y persistencia de comprador. Datos: nuevas filas esperadas,
sin DDL/backfill. Permisos: escritura limitada vía credencial. Legacy: clientes web continúan.
Integraciones: relay elegido por el usuario. KPIs actuales mantienen nombres; metadata aditiva.

## Criterios de aceptación

- [ ] Relay válido sin Origin guarda comprador META con atribución facebook/lead_ads.
- [ ] Clave inválida/ausente/config corta rechazada sin escrituras; vendedor permanece aislado.
- [ ] Consentimiento, enums, identidad duplicada, honeypot y límite de cuerpo siguen vigentes.
- [ ] Cuota relay independiente de IP web y serializada; retry confirmado sin duplicados de nota/KPI.
- [ ] Calidad y CI verdes; despliegue exacto comprobado; credencial compartible fuera de Git.

## Verificación

**N. Tests.** Route auth y payload con persistencia mockeada; regresiones comprador/vendedor/atribución.
PostgreSQL efímero CI: dos clientes compiten por solicitud y último hueco de cuota; rollback sin filas
parciales; retry a cuota llena. Typecheck/lint/SDD y suite unit completa. Sin UI nueva, E2E existente
no requerido para esta nueva vía de transporte. Producción: payload inválido autenticado y requests
sin/incorrecta credencial, nunca contactos reales.

| Criterio               | Evidencia                        | Resultado                                |
| ---------------------- | -------------------------------- | ---------------------------------------- |
| Boundary y regresiones | Vitest dirigido                  | 47 tests locales PASS                    |
| Cuota/concurrencia     | PostgreSQL efímero en CI         | Pendiente                                |
| Calidad                | typecheck, lint, unit, SDD       | Local PASS: 1727 unitarios; CI pendiente |
| Producción             | deployment y smoke sin escritura | Pendiente                                |

## Rollout, rollback y stop conditions

**O. Rollout.** Proyecto Vercel campernova-crm prj_BV2RtPKkV54LV3pvbAtiRJGJaoyn, org
team_h9366Ar0TVCBYdwu260oyUXo verificado en .vercel/project.json. Crear clave aleatoria de 32 bytes
en configuración Production sensible; clave Preview distinta si se necesita smoke. CI/preview antes
de squash merge; producción Ready; smoke de autenticación y validación sin mutación. Responsable emisor:
configurar Authorization y arrancar envíos, incluidos pendientes de la campaña si los conserva.
**P. Rollback.** Quitar clave y redeploy deshabilita relay conservando web; revertir cambio por PR
si es necesario. Conservar contactos recibidos. Parar ante CI rojo, clave expuesta, auth bypass,
cuota/carrera defectuosa, cambio de contrato del proveedor o despliegue ajeno.
**Q. Observabilidad.** Log genérico existente para 503 sin payload/credencial; KPI metadata separa relay.
Smoke inmediato confirma gate, no demuestra entrega end-to-end del emisor; primer contacto real y
cola deben confirmarse con el equipo emisor. Sin alertas ni nueva instrumentación de PII.
**R. Documentación.** Este brief, .env.example y docs/operations/meta-lead-ads-buyer.md;
cierre operativo mutable en PR con CI/deploy/smoke para evitar commits circulares.
**S. Riesgos.** Proveedor pendiente de configurar clave; pérdida de cola externa no controlada;
payload cambiado durante retry duplicaría contacto; pérdida de clave requiere rotación y redeploy.
Owner Campers Nova/emisor; se resuelve con primera entrega real confirmada.
**T. Aceptación.** Checklist y evidencia de la sección anterior; no afirmar conexión completa hasta
configuración del emisor y primera entrega real. No confundir fuente META con vendedor.
**U. Autorización.** Petición explícita de conectar campaña y elegir opción B autoriza implementación,
PR/CI, credencial limitada y despliegue necesario. No autoriza aceptar portfolio ni enviar mensajes
al equipo por correo, cambiar formulario Meta ni crear leads técnicos en producción.

## Revisión adversarial y matriz de completitud

| Hallazgo                                             | Materialidad | Corrección                                                |
| ---------------------------------------------------- | ------------ | --------------------------------------------------------- |
| Origin eliminado abre servidor sin credencial        | Alta         | Gate exclusivo Bearer y fallback web intacto (H)          |
| IP de relay parece IP de consentimiento y agota 10/h | Alta         | IP null y cuota separada 300/h bajo lock (I/K)            |
| Reintento cambia payload y duplica lead              | Media        | Emisor congela payload y event_id; límite explícito (K/S) |
| Dos envíos consumen último hueco                     | Alta         | Lock relay y KPI en transacción (K/N)                     |
| Clave prod compartida con previews                   | Alta         | Claves separadas; Production sensible (H/O)               |

| Área                        | Revisada | Evidencia         | Riesgo pendiente           |
| --------------------------- | -------- | ----------------- | -------------------------- |
| Dominio y estados           | Sí       | E/G               | Ninguno                    |
| Permisos                    | Sí       | H, tests route    | Configuración emisor       |
| Concurrencia e idempotencia | Sí       | K/N               | CI PostgreSQL pendiente    |
| Datos, legacy, migración    | Sí       | I/J, sin DDL      | Ninguno                    |
| Compatibilidad y readers    | Sí       | J/L               | CI pendiente               |
| Efectos y caché pública     | Sí       | L, no-store route | Ninguno                    |
| Observabilidad              | Sí       | Q                 | Primera entrega real       |
| Rollout y rollback          | Sí       | O/P               | Deployment pendiente       |
| Documentación               | Sí       | R                 | Cierre operativo pendiente |

PLAN READY FOR INDEPENDENT REVIEW

Alcance autorizado por la solicitud del usuario: opción B descrita en U. Siguiente gate: calidad y
CI antes de merge; entrega y activación del emisor después del smoke de producción.
