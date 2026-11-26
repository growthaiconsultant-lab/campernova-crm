# ENC-1 — Consultar y enviar encuestas de satisfacción desde el CRM

| Campo               | Valor                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                 |
| **Owner**           | CampersNova, Comercial y Engineering                        |
| **Ticket**          | ENC-1, petición directa en el chat                          |
| **Rama / PR**       | `codex/encuestas-satisfaccion`                              |
| **Categorías**      | C1, C3, C4, C5, C7, C8, C9                                  |
| **Riesgo**          | Alto por la vinculación de respuestas y los envíos externos |
| **Ruta SDD**        | Reforzada                                                   |
| **Última revisión** | 2026-11-26                                                  |

## Resultado esperado (A)

El equipo puede abrir **Encuestas** en el CRM, filtrar por compra, venta o venta no cerrada y consultar las valoraciones y los comentarios. Desde una ficha de comprador o vendedor puede enviar una invitación individual. Una respuesta a esa invitación aparece en la ficha correspondiente.

## Problema y baseline verificado (B)

- [VERIFICADO] El CRM en `origin/main` (`6c3820c`) autoriza fichas de compra y venta con `requireAgente()`. Las dos ofrecen WhatsApp y `mailto:`. `lib/email/send.ts` integra Resend y tiene un precedente de clave de idempotencia y errores sin datos personales.
- [VERIFICADO] La encuesta pública sirve `https://encuesta.campersnova.com/`. La consulta privada de Sites confirma la tabla D1 `respuestas`, los campos específicos de cada experiencia y la existencia de respuestas. El POST público guarda por ID de envío y admite el contacto voluntario. El schema carece de vínculo CRM.
- [INFERIDO] Mantener D1 como fuente de respuestas permite mostrar datos anteriores y nuevos sin replicarlos a PostgreSQL.
- [RECOMENDADO] Reutilizar los permisos del módulo comercial y el patrón de WhatsApp con texto preparado.
- [DESCONOCIDO] Configuración de los secretos compartidos en producción. La consulta no comprobó credenciales ni envíos reales de producción.

## C. Alcance

Bandeja privada, acceso a respuestas en fichas, enlaces personales, preparación de WhatsApp, y correo individual desde el CRM con confirmación de quien lo envía. Incluye compatibilidad con el formulario y las respuestas existentes. Dos repositorios de trabajo, CRM y encuesta de Sites.

## D. Exclusiones

Envíos masivos, campañas, recordatorios, autoenvío por cambios de estado, inferencia de identidad por correo o teléfono, cambios en el CRM comercial o en la ficha pública de vehículos y sincronización de PII con hojas de cálculo. La atribución por enlace se conserva como tal y no constituye una verificación de identidad del respondiente.

## E. Decisiones de negocio

- El usuario confirmó el acceso de **Administración y Comercial**, incluidos comentarios y los datos facilitados al solicitar contacto, siguiendo los permisos de ambas fichas.
- Los datos de contacto siguen siendo voluntarios. Los datos del cliente que ya existen en el CRM se usan únicamente para dirigir la invitación que prepara un miembro del equipo.
- Se invita desde fichas no archivadas. La venta no cerrada puede seguir siendo una ficha operativa descartada. Las respuestas ya vinculadas se pueden consultar en fichas archivadas.
- El enlace habitual conserva su uso sin cuenta. Una respuesta que llegue por ese enlace queda sin ficha vinculada.

## F. Flujo funcional

1. En la ficha, **Enviar encuesta** muestra WhatsApp cuando existe teléfono y correo cuando existe una dirección utilizable. WhatsApp abre el chat con el texto listo. Correo muestra destinatario y texto para confirmación individual y envía por Resend.
2. El destinatario elige su experiencia en el mismo formulario. Un enlace de comprador asocia respuestas de compra. Uno de vendedor asocia venta y venta no cerrada. Ante un enlace no válido o una experiencia ajena a su ficha, la persona puede seguir con el formulario general.
3. El CRM muestra fecha, experiencia, valoraciones, motivo cuando corresponda, comentario y ficha vinculada. Las personas que pidieron contacto aparecen como tales según los permisos acordados.

## G. Estados e invariantes

La respuesta se guarda con o sin vínculo. Un enlace válido se puede canjear una vez y una nueva invitación permite otro envío. Un reintento de red con el mismo ID conserva el resultado del primer guardado. Los envíos externos dependen de una acción humana y el CRM distingue preparar un WhatsApp de confirmación de correo por el proveedor. Las pantallas han de explicar la vinculación mediante enlace antes de enviar la respuesta.

## H. Permisos

Usuario anónimo puede abrir y enviar la encuesta. Solo el servidor del CRM puede leer respuestas de Sites usando una credencial de lectura independiente. El CRM vuelve a comprobar el rol en cada página y acción, y comprueba ficha y canal al tramitar un envío. Taller, Entregas, Marketing, cuentas inactivas y personas sin sesión quedan fuera. No se necesitan cambios de RLS en PostgreSQL.

## I. Modelo de datos y migraciones

Añadir a D1 columnas anulables para tipo e ID de ficha y un ID de invitación con índice único cuando exista. Añadir índices para experiencia y para ficha, ambos con fecha e ID de respuesta para una paginación estable. Revisar la migración en una copia de schema local con filas antiguas. Omitir backfill por falta de una señal previa de vinculación. Mantener intactas las columnas actuales. Sin migración Prisma ni tabla de respuestas duplicada en el CRM.

## J. Writers y readers

El POST existente de Sites es el único escritor de respuestas. Validará un enlace opaco autenticado y con caducidad que incluye el tipo de ficha, su ID y una invitación aleatoria. D1 conserva su lectura administrativa. Un endpoint de lectura interno de Sites recibe filtros validados y páginas limitadas, exige autenticación servidor a servidor y responde sin caché. Lo consume el CRM desde la bandeja y las fichas. Para compradores unificados, el CRM resuelve el destino vigente con `mergedIntoId` y consulta sus identificadores anteriores; si una ficha ya no existe, conserva la respuesta con un estado visible de vínculo no disponible.

## K. Concurrencia e idempotencia

El ID de respuesta resuelve reintentos de la misma solicitud. La unicidad del ID de invitación en D1 evita canje concurrente en sesiones distintas; el servidor distingue ese conflicto de un reintento. Para correo, reutilizar la misma invitación, destinatario y clave de idempotencia de Resend en reintentos de una misma confirmación. Una respuesta incierta del proveedor no equivale a entrega. No cambiar estado de negocio ni crear automatizaciones a partir de una invitación.

## L. Efectos secundarios e integraciones

Usar `buildWhatsAppUrl` y el transporte Resend existente. La acción de correo relee la ficha y valida remitente y destinatario. Preparar WhatsApp no se registra como entrega y el nombre del cliente no es necesario en el texto. Los enlaces usan el dominio CampersNova y no contienen la ficha ni datos de contacto legibles. Credenciales de lectura y firma se configuran por entorno, solo en servidor.

## M. UX y fallos

Mostrar Todos, Compra, Venta y Venta no cerrada, con estados de carga, sin resultados y error recuperable. Ordenar de reciente a antigua. Filtrar en servidor y paginar. Si Sites no responde, el equipo puede seguir trabajando en las fichas. Mostrar canal no disponible si falta el contacto. Informar de enlace caducado o usado con opción de continuar por el enlace general. El texto de invitación es editable en WhatsApp.

## N. Pruebas

- Unitarias de link válido, alterado, caducado, tipo incompatible y reintento idempotente.
- D1 local para migración sobre respuestas existentes, índices, tres filtros, dos envíos concurrentes y legado sin referencia. PostgreSQL de integración para resolver ficha, ficha archivada, falta de datos y comprador unificado.
- Casos de autorización para Admin y Agente, y rechazo por rol, ausencia o falsificación de credenciales, con ausencia de PII en logs.
- Prueba de ambos flujos de CRM y formulario en equipo aislado. Mock de Resend, sin mensajes a clientes durante desarrollo. Verificación visual en móvil de la encuesta y de las acciones de ficha.

## Rollout (O)

Implementación local en la rama aislada; el alcance de Administración y Comercial fue aprobado en el chat. Con autorización del entorno, configurar secretos y publicar primero la ampliación compatible de Sites. Comprobar formulario general, lectura autenticada y rechazo de lectura anónima. A continuación desplegar el CRM con configuración verificada. Usar destinatario de prueba autorizado para verificar correo y WhatsApp. Revisar errores y respuestas en la primera jornada de uso.

## P. Rollback y condiciones de parada

Desactivar el módulo del CRM y revocar la credencial de lectura si aparece acceso indebido. El formulario general sigue operativo. Preservar respuestas y columnas aditivas al revertir código. Detener el rollout si falla la asociación correcta, el guest read devuelve datos, el sitio deja de aceptar respuestas por el enlace general o falla la idempotencia de correo.

## Q. Observabilidad

Medir errores y latencia de la lectura privada y resultados de envío por códigos, sin nombres, contactos, comentarios, identificadores de cliente, cabeceras ni URLs personales. Evitar caché pública y analítica de enlaces individuales. Observar tras despliegue rechazos inesperados y errores de envío, además de una respuesta de prueba que se vea en la ficha correcta.

## R. Documentación y cierre

Actualizar este brief con evidencia, commit, PR, CI y los despliegues verificados de ambas aplicaciones. Documentar nombres de variables y orden de activación, sin valores. La infraestructura y la configuración de los proveedores solo se modifican tras autorización para el entorno correspondiente.

## S. Riesgos y deuda

- Enlace reenviado. Impacto de atribución errónea. Mitigación mediante aviso explícito, caducidad, canje único y soporte del enlace general. Responsable Comercial, antes de publicar.
- Interrupción entre sistemas. Impacto en consulta. Estado de error, timeouts y degradación local de la sección. Responsable Engineering, antes del rollout.
- Acceso interno demasiado amplio. Impacto de privacidad. Acordar roles y comprobar casos negativos y alcance de campos. Responsables Comercial y Engineering, antes de implementar.
- Sin histórico de invitaciones en la primera versión. Se distingue al mostrar la respuesta y al confirmar cada canal. Revisar solo si el equipo necesita seguimiento de envíos.

## Criterios de aceptación (T)

| Resultado                                                                                       | Evidencia prevista                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Las respuestas nuevas e históricas aparecen en la bandeja y cada filtro devuelve su experiencia | Integración D1 y prueba de navegación                                   |
| Una invitación desde ficha vincula la respuesta correcta y aparece en la ficha                  | E2E de comprador y vendedor, incluidas ventas no cerradas y unificación |
| Ausencia de sesión o de rol no da acceso a respuestas ni envío                                  | Pruebas negativas                                                       |
| Correo individual entrega a proveedor y WhatsApp abre el texto con enlace                       | Mock de proveedor y smoke controlado                                    |
| El enlace general sigue operativo con contacto voluntario                                       | E2E regresión y smoke público                                           |

## Verificación local

- CRM: compilación local, typecheck y 2.076 pruebas Vitest aprobadas, incluidas las acciones de correo con Resend simulado, autorización, resolución de compradores unificados y renderizado de las acciones de ficha.
- Sites: compilación, migración de D1 sobre una fila anterior, consulta privada, filtros, enlace inválido, envío general, canje concurrente, reintento y paginación probados en local. El entorno de pruebas usa datos sintéticos. El navegador confirmó el aviso de vinculación y el envío sin vincular después de usar un enlace personal.
- Pendiente una ejecución autenticada con PostgreSQL real y pruebas de producción. El entorno actual no dispone de PostgreSQL ni Docker. El panel de correo valida el envío mediante un proveedor simulado. Se comprobó el rechazo 401 en local sin cuerpo. Una secuencia rápida de POST no autorizados con cuerpo provocó una respuesta 503 del emulador sin entregar datos. Queda por verificar esa secuencia en el entorno publicado.

## U. Estado de autorización

`PLAN READY FOR INDEPENDENT REVIEW`

El usuario autorizó la implementación de la integración y el acceso de Administración y Comercial. Se ha completado el trabajo local. La configuración de secretos en producción, publicación de la encuesta ampliada, PR y publicación del CRM quedan para el alcance de rollout autorizado. No se enviaron mensajes a clientes.
