# COM-4 — Asociar intereses entre compradores y vehículos desde ambas fichas

| Campo               | Valor                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Estado**          | IMPLEMENTED                                                  |
| **Owner**           | Engineering                                                  |
| **Ticket**          | Petición directa del usuario: «pues hazlo y que se vea bien» |
| **Rama / PR**       | codex/manual-buyer-vehicle-links; PR pendiente               |
| **Categorías**      | C0, C1, C3, C6                                               |
| **Riesgo**          | Medio                                                        |
| **Ruta SDD**        | Reforzada                                                    |
| **Última revisión** | 2026-10-07                                                   |

## Problema y evidencia

VERIFICADO EN CÓDIGO (main 73cf6fe): las fichas muestran sugerencias automáticas y sólo permiten ofertas sobre esos candidatos. No existe acción para elegir una contraparte manualmente. Match.generatedBy ya admite manual y el par vehicleId/buyerLeadId es único; recalculate.ts borra SUGERIDO fuera del top sin distinguir origen. Ambas fichas limitan a 10 y pueden esconder una asociación manual. COM-3 muestra la compra definitiva desde Delivery VENTA/COMPLETADA.

## Resultado esperado

Desde cualquier pestaña de un comprador activo: bloque Vehículos de interés y botón Asociar vehículo. Desde vendedor con vehículo comercializable: bloque Compradores interesados y botón Asociar comprador. Diálogo con buscador, lista paginada, selección visible y guardado con feedback. La misma asociación aparece en ambas fichas, señalada como Manual, y permite registrar una oferta. No exige coincidencia de preferencias.

## Reglas e invariantes

- Interés comercial = Match manual, inicialmente SUGERIDO; no venta, reserva, garantía ni cambio de estado de vehículo/comprador.
- Reutilizar elegibilidad canónica M1/A2: comprador activo/no archivado; vehículo TASADO/PUBLICADO con entrada activa y vendedor no archivado. Explicar indisponibilidad sin relajar reglas existentes.
- Buscar por matrícula/marca/modelo o nombre, respuestas mínimas sin teléfono/email. Guard requireAgente antes de toda lectura/escritura.
- No duplicados: unique existente, raíces coordinadas Vehicle/SellerLead/BuyerLead, upsert atómico y Activities en ambas fichas sólo al pasar a manual. Reintento manual es no-op. Convertir sugerencia existente a manual conserva estado/score; no reabre rechazo/trato cerrado.
- Recalcular no borra ni altera manuales; filtros condicionales en escrituras protegen carreras aunque el snapshot fuese auto.
- Todos los manuales visibles, fuera del top 10; contraparte no elegible sigue fuera del flujo comercial. Historial y compra definitiva siguen COM-3.

## Fuera de alcance

Venta histórica manual, reapertura, reserva/precios/garantía, cambiar elegibilidad, borrar asociaciones, migraciones/backfill, envío de emails o nuevos roles. Rechazar sigue disponible como estado comercial existente.

## Decisiones

Usar Match existente evita duplicar intereses y desbloquea ofertas. Separar interés manual de sugerencia automática en copy/badges. Score usa algoritmo actual, sin filtros de preferencias para elegir el par. No notificar por email ni inventar un score alto. Sidebar común y diálogo accesible consistente con colores/radios del CRM, adaptable a móvil. Suposición: volumen de manuales por ficha pequeño; sólo 3 resúmenes y enlace a lista completa en el lateral.

## Plan técnico

1. Servicio transaccional manual y buscador server-side validado Zod; mismos guards y políticas. Adaptador de scoring compatible con TransactionClient.
2. Preservar manuales en computeRecalcDiff y CAS de borrado/score; cubrir ambos recalculadores.
3. Sidebar compartido con buscador/selección, estados loading/error/empty/success. Ambos readers incluyen manuales sin take 10; cards con badge Manual y matrícula.
4. Unitarios de validación/auth/query/plan de recálculo; PostgreSQL real de asociación, retry, conversión, concurrencia, aislamiento y supervivencia al recálculo. Revisión Chrome del flujo completo con datos ficticios y móvil.
5. Typecheck/lint/SDD, CI/Preview, squash/deploy y smoke sólo lectura en producción.

### Impacto (A–U)

| Componente           | Actual                | Cambio                              | Riesgo                     | Validación                  |
| -------------------- | --------------------- | ----------------------------------- | -------------------------- | --------------------------- |
| Match/Activities     | auto/estado comercial | writer manual auditado              | duplicado/retry            | PostgreSQL carrera y retry  |
| matching/recalculate | SUGERIDO eliminable   | proteger manual en plan y CAS       | borrado por snapshot viejo | unit + DB ambos lados       |
| fichas/ofertas       | top 10                | incluir manuales, compartir vínculo | invisibilidad/cross-entity | DB, UI y enlaces            |
| UI/buscador          | sin control manual    | modal mínimo/paginado               | selección obsoleta/error   | auth/queries y flujo visual |

- Actores/permisos: ADMIN/AGENTE existentes; sin superficie pública; búsquedas y mutación autenticadas antes de DB.
- Datos/migraciones/histórico: schema y unique existentes, sin migración ni backfill; no alterar asociaciones previas ni estados. ID de contraparte confirmado en servidor, sin unión por nombre.
- Estados/concurrencia/idempotencia: locks ordenados canónicos coordinan archivado/venta; releer elegibilidad bajo locks; unique/upsert protege auto/manual. Manuales protegidos de recálculo incluso concurrente. StatusButtons muestra errores del guard existente (incluido cerrar sin entrega completada); no nuevas transiciones.
- Integraciones/Storage/contratos/dinero: N/A; no emails, Storage, oferta automática ni venta. Registra sólo interés y actividades de auditoría sin nombres/contactos.
- Caché: revalidar ambas fichas, matches y listados de compradores/vendedores/vehículos tras commit.
- KPIs/Sentry/PostHog: Match manual participa en contadores existentes con score real y elegibilidad actual; no cambiar fórmulas ni añadir tracking sin pregunta. Fallos esperados con mensaje recuperable; sin logs con PII. No flags/config/deps nuevas.
- Performance: búsquedas limitadas/paginadas y selección mínima, sin N+1 nuevo; manuales por ficha sin truncamiento silencioso. Responsable Engineering.
- Autorización: usuario aprobó asociación de interés en ambos sentidos y presentación; publicación dentro del alcance ya autorizado en esta conversación. Ninguna asociación real/remota se fabricará en las pruebas.

## Criterios de aceptación

- [x] Elegir manualmente desde ambos lados, buscar/discriminar/confirmar y navegar a contraparte.
- [x] Visible con badge Manual en ambas fichas y ofertas, aunque fuera de preferencias/top 10; recálculos preservan.
- [x] Doble envío/retry no duplica Match ni Activities; convertir auto conserva estados.
- [x] Auth, entradas inválidas, entidades ausentes/no elegibles rechazadas; selección obsoleta no se guarda.
- [x] Estados vacío/loading/error y móvil verificados; compra/venta/reserva intactas.

## Verificación

- Suite unitaria: 1634 tests / 128 archivos PASS; validación, autorización, consulta mínima y recálculo incluidos.
- PostgreSQL local real: 13 tests PASS; doble envío, conversión/retry, archivado concurrente con espera real de lock, raíz cambiada, elegibilidad, búsqueda paginada y snapshots viejos de ambos recálculos.
- Typecheck, lint de archivos afectados y check:sdd PASS; diff sin whitespace inválido.
- Chrome: componentes reales con acciones y datos sintéticos. Guardado en ambos sentidos y actualización de ambas tarjetas, selector en escritorio y 390×740, paginación, ya asociado, loading, vacío, error de búsqueda/reintento y error de guardado conservando selección PASS. Mensaje del guard de cierre visible. No equivale a E2E autenticado de toda la aplicación.
- CI/Preview y producción se registrarán en PR; smoke remoto sólo lectura. No se ejecutan escrituras sobre contactos de producción.

## Rollout, rollback y stop conditions

- Rollout: checks y Preview antes de squash, deploy automático main, sin config ni migraciones.
- Rollback: revertir UI/acción, conservar protección de manuales en recálculo para no perder intereses ya creados; no borrar datos.
- Stop: asociaciones entre IDs distintos, manuales borrados por recálculo, cambio de venta/reserva/garantía, exposición pública o pruebas contra DB remota.
- Validación: inmediata postdeploy, controles visibles y ausencia de error; flujo con escritura cubierto por DB y UI sintética, sin inventar relación real. No declarar observación prolongada.

## Revisión adversarial

Snapshot auto seguido de conversión manual: CAS generatedBy protege delete/update. Doble envío de ambas fichas: locks comunes y unique evitan duplicado; auditoría sólo una vez. Archivar/vender antes de guardar: relectura bajo locks rechaza. Buscar rápido/cambiar página: ignorar respuesta obsoleta, selección explícita y botón deshabilitado mientras guarda; servidor valida de nuevo. Auto rechazado conservado, no reabrirlo silenciosamente.

## Cierre

Implementación y validación local completadas; PR registrará CI, Preview y evidencia de despliegue. No incluye asociación retroactiva de ventas sin entrega canónica.
