# LANDING-7 — Envío exclusivo al CRM desde los formularios web

| Campo      | Valor                                                            |
| ---------- | ---------------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                                      |
| Alcance    | Comprar y Vender en la web pública                               |
| Ruta SDD   | Reforzada por el cambio de destinatario de los datos de contacto |

## Problema

Los formularios públicos enviaban cada solicitud a dos destinatarios.

## Resultado esperado

Los datos introducidos en la web se entregan únicamente al CRM de CampersNova. Un enlace desde un anuncio, un identificador de clic o la atribución de Facebook o Instagram no cambian el destinatario. Esta regla sustituye el envío dual del navegador descrito en LANDING-1 a LANDING-4. Los leads captados dentro de Meta mantienen la integración independiente de [LANDING-6](LANDING-6-meta-lead-ads-buyer.md).

## Criterios de aceptación

- En ambas páginas, con URL limpia o HTML, el navegador envía el consentimiento, las respuestas y la atribución al endpoint del CRM del mismo origen. Solo muestra la confirmación al recibir su respuesta positiva.
- Los reintentos conservan la solicitud y su identificador. El seguimiento de conversión depende de la confirmación del CRM y del consentimiento de analítica.
- Las pruebas de navegador interceptan cualquier conexión a Nira y fallan si la detectan. Búsqueda bajo pedido conserva su envío directo al CRM.

## Rollout

Cambio independiente del rediseño. La referencia versionada al script permite actualizar la caché de las dos páginas. Si falla la recepción, corregir el envío al CRM conservando la regla de destinatario. La verificación en producción puede hacerse leyendo el script y su referencia en ambas páginas.
