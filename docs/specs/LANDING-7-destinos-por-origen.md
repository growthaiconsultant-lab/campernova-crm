# LANDING-7 — Destinatarios de las solicitudes según la procedencia de la visita

| Campo      | Valor                                             |
| ---------- | ------------------------------------------------- |
| **Estado** | IMPLEMENTED                                       |
| Alcance    | Formularios públicos de Comprar y Vender          |
| Ruta SDD   | Reforzada por el tratamiento de datos de contacto |

## Problema

Las landings publicadas envían todas las solicitudes a CRM y Nira. El cliente pide distinguir los leads que llegan a la landing desde Meta.

## Resultado esperado

El CRM recibe cada solicitud válida. Si la visita procede de Meta, Nira recibe también el formulario con su contrato habitual. La procedencia se reconoce por la fuente de campaña (Meta, Facebook, Instagram y sus alias), una referencia de Facebook, Instagram o Messenger o un identificador de clic de Facebook. Una fuente explícita de otro canal prevalece. Una visita directa nueva o sin origen identificable se envía solo al CRM. La navegación interna y la recarga conservan la procedencia de la visita.

Los reintentos reutilizan el contenido y el identificador del envío y solo alcanzan los destinos pendientes. Si se necesitan ambos, la confirmación final espera a los dos. El evento de conversión requiere confirmación del CRM y consentimiento de analítica. Búsqueda bajo pedido conserva el envío exclusivo al CRM. La captación dentro de Meta mantiene la integración de [LANDING-6](LANDING-6-meta-lead-ads-buyer.md).

## Criterios de aceptación

Pruebas de atribución y pruebas de navegador en escritorio y móvil con los destinos interceptados: origen Meta y otros canales, consentimiento, contratos de ambos servicios, deduplicación y reintentos tras un fallo parcial.

## Rollout

Publicar conjuntamente con el nuevo diseño, según la fecha de activación elegida por el cliente. Las dos páginas apuntan a la versión actualizada del script.
