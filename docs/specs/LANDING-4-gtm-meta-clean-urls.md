# LANDING-4 — Medición consentida y URLs de campaña sin extensión

| Campo           | Valor                                            |
| --------------- | ------------------------------------------------ |
| **Estado**      | IMPLEMENTED                                      |
| Owner           | Campers Nova / Codex                             |
| Ticket          | Petición del usuario: GTM, Meta y URLs sin .html |
| Rama / PR       | codex/landing-gtm-meta-clean-urls                |
| Categorías      | C1, C2, C5, C8, C9                               |
| Riesgo          | Medio                                            |
| Ruta SDD        | Reforzada                                        |
| Última revisión | 2026-10-09                                       |

## Problema y evidencia

Las páginas estáticas no pasan por el layout Next ni cargan GTM. Las rutas sin extensión llegan al guard de login. El banner de la web guarda cn_cookie_consent=all/essential, mientras que el código estático usa otro consentimiento que ni se muestra con pixel vacío. GTM-NK5ZBX8P contiene únicamente GA4 - CampersNova (G-WTR0WB8R6R), Initialization - All Pages, y el espacio está limpio (0 cambios).

## Resultado esperado

Ambas versiones de cada URL son públicas, conservan las UTM y envían al CRM la página .html canónica. El mismo consentimiento controla GTM, GA4 y Meta en web y landings. GTM contiene una única etiqueta base Meta 1409201494758945, con PageView. Lead y Contact siguen en la landing, sin etiquetas duplicadas en GTM ni carga directa del píxel.

## Reglas e invariantes

- Modelo básico: GTM y sus scripts de medición solo se cargan tras Aceptar todas. Consentimiento desconocido, esencial o almacenamiento no disponible sin elección no permite medición.
- El snippet oficial del contenedor se ejecuta al aceptar, desde head, con fallback noscript después de body como solicita el usuario. El fallback no ejecuta etiquetas JavaScript de GA4/Meta.
- Consentimiento compartido cn_cookie_consent y evento cn:consent; el aviso explica analítica y publicidad. Cambios entre pestañas actualizan permisos y revocan Meta.
- Píxel base solo en GTM; pixel: '' se conserva. Un PageView por carga; una conversión Lead por solicitud confirmada (también en reintentos). Contact sin duplicados.
- No incorporar datos personales de formularios ni payloads de CRM a la medición. Las pruebas interceptan Meta, GTM, GA4, CRM y Nira cuando prueban envíos.
- Las rutas privadas siguen protegidas. Sin migraciones, dependencias nuevas ni cambios en etiquetas ajenas.

## Fuera de alcance

Conversion API, anuncios, facturación, nuevos eventos de GTM Lead/Contact, cambios de GA4 y solicitudes reales de prueba a Nira.

## Decisiones

| Decisión       | Alternativas                                       | Resolución y motivo                                                                       |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GTM estático   | Cargar sin permiso / cargar al aceptar             | Cargar al aceptar, igual que GA4 en la web existente                                      |
| Consentimiento | Dos banners/keys / común                           | Código común de navegador y una sola preferencia                                          |
| Rutas          | Redirigir / rewrite                                | Rewrite, ambas URL funcionan y conservan parámetros                                       |
| Captación      | Aceptar nuevas páginas en API / normalizar cliente | Mantener el contrato .html canónico y normalizar las dos rutas conocidas                  |
| GTM            | Publicar workspace compartido / cambio aislado     | Workspace inicial limpio; comprobar que la versión solo incorpora la etiqueta Meta propia |

## Plan técnico

1. Consentimiento compartido, snippets en HTML y conexión al layout Next, eventos de Meta condicionados.
2. Rewrites, allowlist middleware y routing por host, normalización de página de formulario.
3. Etiqueta Meta Custom HTML All Pages, comprobación explícita de consentimiento, deduplicación y flush de eventos consentidos si la carga es lenta.
4. Pruebas de rechazo/aceptación, almacenamiento bloqueado, revocación, eventos, rutas y contratos. CI, PR, Vercel y publicación del contenedor, con verificación pública interceptada.

### Impacto

- **Código y consumidores:** HTML de campañas, consentimiento web, cargador GTM y tracking de landings.
- **Datos/migraciones:** ninguna; misma clave de preferencia y contratos CRM/Nira.
- **Permisos/seguridad:** rutas públicas exactas; GTM en modo básico; no PII de formularios en eventos.
- **Concurrencia/idempotencia:** deduplicación del loader y eventos en navegador; no cambios transaccionales.
- **Integraciones/efectos externos:** publicación GTM autorizada por la petición; sin enviar mensajes a Edgar/Joel ni leads reales.
- **Observabilidad/KPIs:** medir PageView, Lead y Contact de Meta existentes; no modificar KPIs internos.

## Criterios de aceptación

- [x] Cuatro URLs públicas con UTM preservadas y assets correctos en local.
- [x] Ningún script GTM/Meta antes de consentimiento o tras rechazar; acepta en misma pestaña y navegación posterior.
- [ ] Una etiqueta Meta base publicada en el contenedor correcto, sin Lead/Contact duplicados.
- [x] Un PageView por carga y un Lead por solicitud, reintentos sin duplicado; Contact condicionado al consentimiento.
- [x] Formulario en rutas limpias conserva pagina canónica y atribución CRM/Nira.
- [ ] CI, despliegue, contenedor y smoke público verificados.

## Verificación

| Criterio                  | Evidencia prevista                                                                                        | Resultado  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| Routing y controles       | pnpm test: 1710 tests / 135 archivos, middleware y rutas privadas                                         | PASS local |
| Consentimiento y tracking | Playwright desktop + mobile, etiqueta GTM exacta simulada, storage bloqueado/revocación                   | PASS local |
| Contratos y no duplicados | pnpm exec playwright test --config playwright.landing.config.ts --workers=3: 50 tests, CRM/Nira simulados | PASS local |
| Publicación               | CI, build Vercel, versión GTM y smoke sin leads reales                                                    | Pendiente  |

## Rollout, rollback y stop conditions

- **Rollout:** preparar etiqueta GTM, publicar código tras CI verde, publicar contenedor solo con cambios propios y comprobar destinos.
- **Rollback:** revertir commit y restaurar versión GTM anterior; la base de datos no cambia.
- **Detener si:** scripts antes de aceptación, doble PageView/Lead, ruta limpia manda a login, cambios ajenos en GTM o CI fallida.
- **Validación post-despliegue:** cuatro URLs 200, código esperado, banner y requests con consentimiento y rechazo, eventos interceptados sin avisos reales.

## Revisión adversarial

| Riesgo                                           | Mitigación                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| GTM antes de consentimiento activa GA4 All Pages | Gate básico antes de cargar contenedor                                               |
| Meta Custom HTML ignora consentimiento nativo    | Guard explícito común en el código de etiqueta, revocación y track condicionado      |
| Píxel tardío pierde conversiones consentidas     | Cola pequeña de eventos sin PII, solo si ya existe consentimiento; vaciar al revocar |
| URL limpia rompe Zod                             | Normalizar únicamente las dos rutas conocidas a .html                                |
| Publicar trabajo ajeno de GTM                    | Baseline limpio y revisión de cambios de la versión                                  |

## Cierre

- Implementación y pruebas locales completas; etiqueta Meta preparada en GTM como único cambio del workspace, sin publicar todavía. Typecheck y lint PASS.
- CI / Deployment / versión GTM: pendientes hasta entrega y rollout.
- Evidencia final posterior a la implementación en la descripción mutable del PR.
