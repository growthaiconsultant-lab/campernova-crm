# LANDING-3 — Origen de las campañas visible en el CRM

| Campo           | Valor                                                      |
| --------------- | ---------------------------------------------------------- |
| **Estado**      | IMPLEMENTED                                                |
| Owner           | Campers Nova / Codex                                       |
| Ticket          | Petición del usuario: distinguir leads de Instagram y Meta |
| Rama / PR       | codex/landing-campaign-attribution                         |
| Categorías      | C1, C2, C4, C6                                             |
| Riesgo          | Medio                                                      |
| Ruta SDD        | Reforzada                                                  |
| Última revisión | 2026-10-09                                                 |

## Problema y evidencia

Las dos landings guardan las etiquetas de campaña dentro de una nota. El listado de compradores muestra «Formulario web» y el de vendedores solo el canal. El navegador recupera cada UTM por separado y puede mezclar una campaña anterior con un nuevo enlace.

## Resultado esperado

El listado y la ficha muestran la landing, el origen indicado por el enlace y la campaña. Los parámetros adicionales permiten identificar conjunto y anuncio. Un enlace sin etiquetas no se atribuye automáticamente a Instagram ni a una campaña de pago.

## Reglas e invariantes

- La ruta validada por el servidor identifica la landing. Las UTM son información declarada por el enlace, no identidad verificada del visitante.
- El CRM recibe un snapshot estructurado acotado; Nira conserva su contrato de respuestas de texto.
- El snapshot se conserva en la actividad de captación creada por el sistema, sin duplicar campos canónicos ni incorporar parámetros libres a KPIs.
- Un nuevo enlace etiquetado sustituye todo el snapshot; navegación sin etiquetas lo conserva solo durante la sesión de la pestaña.
- Consentimiento, cuotas por IP, ausencia de email, concurrencia e idempotencia siguen funcionando. La cuota de compradores incluye los nuevos orígenes.
- Las notas históricas se leen sin reescribirlas. No se envían nuevas solicitudes reales a Nira.

## Fuera de alcance

Píxel, Conversion API, configuración de la cuenta publicitaria, atribución multicanal, migraciones y cambios en avisos externos.

## Decisiones

| Decisión         | Alternativas                             | Resolución y motivo                                                           |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Persistencia     | Nuevas columnas / actividad de captación | Actividad existente: datos adicionales de captación sin cambiar el esquema    |
| Origen comprador | Siempre PRO / categorías según UTM       | Instagram → INSTAGRAM; Facebook y Meta → META; desconocido → PRO              |
| Origen vendedor  | Cambiar source / conservarlo             | Conservar la landing canónica y mostrar el canal del enlace desde el snapshot |
| Enlace nuevo     | Completar UTM con memoria / sustituir    | Sustituir para evitar mezclas de campañas                                     |

## Plan técnico

1. Validador, serializador y lector común con compatibilidad histórica.
2. Captura coherente en ambas landings y persistencia transaccional.
3. Presentación en listados, fichas y actividad; lectura limitada a una nota de captación en listados.
4. Pruebas unitarias, PostgreSQL en CI y navegador con destinos simulados; publicación estándar.

### Impacto

- **Código y consumidores:** ambos formularios, CRM privado y opciones de origen comprador.
- **Datos/migraciones:** sin migraciones ni actualización histórica; source es String existente.
- **Permisos/seguridad:** Zod estricto, límites, texto escapado por React; acceso privado existente.
- **Concurrencia/idempotencia:** mismos locks y transacciones; snapshot estable durante reintentos.
- **Integraciones/efectos externos:** Nira sin objeto nuevo; pruebas externas solo lecturas.
- **Observabilidad/KPIs:** valores fijos del origen; ningún UTM libre ni ID publicitario en KPIs.

## Criterios de aceptación

- [x] Landing, canal y campaña visibles en listado y ficha de compradores y vendedores.
- [x] Enlaces Instagram/Meta registrados correctamente; sin etiquetas, origen desconocido.
- [x] Parámetros de anuncio conservados; nuevas campañas no heredan parámetros anteriores.
- [x] Reintentos conservan payload; Nira sigue recibiendo respuestas de texto.
- [ ] Cuota entre orígenes, persistencia e idempotencia verificadas en PostgreSQL.
- [ ] CI y despliegue públicos correctos.

## Verificación

| Criterio              | Evidencia prevista                              | Resultado      |
| --------------------- | ----------------------------------------------- | -------------- |
| Lectura y validación  | Vitest                                          | Pendiente      |
| Persistencia y cuota  | Suite PostgreSQL de CI                          | Pendiente      |
| Captura y reintentos  | Playwright escritorio/móvil, destinos simulados | 32 tests, PASS |
| Calidad y publicación | Typecheck, lint, CI y smoke HTTP                | Pendiente      |

## Rollout, rollback y stop conditions

- **Rollout:** PR revisable, CI verde, squash a main y Vercel.
- **Rollback/mitigación:** revertir commit; snapshots permanecen legibles como notas, sin pérdida de datos.
- **Detener si:** contratos de Nira alterados, mezcla de campañas, cuota evadible o CI fallida.
- **Validación post-despliegue:** HTML/JS públicos actualizados, recursos accesibles; sin enviar leads reales.

## Revisión adversarial

| Riesgo intentado                        | Mitigación o riesgo pendiente                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| UTM manipulada o plantilla sin resolver | Solo evidencia declarada; límites y valores vacíos/plantillas no atribuyen plataforma   |
| Cambiar plataforma para evadir cuota    | Cuota conjunta PRO/INSTAGRAM/META con lock por IP                                       |
| Mezclar campañas al navegar             | Snapshot completo y reemplazo ante cualquier parámetro nuevo                            |
| Borrar captación desde notas            | Actividad de sistema sin agentId; permisos existentes impiden borrarla como nota propia |

## Cierre

- **Commit / PR / CI / Deployment / Validación:** pendientes.
- **Deuda restante:** las campañas deben usar enlaces etiquetados; la landing no puede conocer la campaña sin ellos.
