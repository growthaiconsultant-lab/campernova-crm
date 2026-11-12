# COM-41 — Presupuesto de reparaciones desde la inspección

| Campo      | Valor                                                         |
| ---------- | ------------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                                   |
| Owner      | Equipo CRM                                                    |
| Ruta       | Reforzada por importes, datos privados y correo transaccional |

## Problema

La inspección muestra las reparaciones marcadas, pero el equipo carece de un documento con importes y de una respuesta del propietario vinculada a esos trabajos.

## Resultado esperado

COM-40 permite marcar reparaciones durante la inspección. Taller y Administración necesitan preparar su importe final, enviarlo al correo del vendedor asociado y consultar su decisión. El presupuesto puede prepararse también tras completar el diagnóstico.

## Criterios de aceptación

- Sólo las partidas marcadas de la inspección forman el borrador. Se pueden guardar importes parciales. El documento para el propietario incluye el trabajo propuesto y los importes en euros con IVA. Las notas internas quedan en taller.
- Revisar el destinatario antes de enviar. Avisar si cambian las partidas o el destinatario entre revisión y envío. Conservar versiones enviadas y respuestas, incluso tras cambiar la inspección.
- El enlace privado permite consultar, aceptar o rechazar una versión. Abrir el correo no implica responder. La primera respuesta es definitiva. Una nueva versión enviada sustituye a la pendiente.
- La aprobación interna de taller, costes, presupuestos de mejoras del comprador y órdenes de ejecución siguen su propio flujo.

## Plan y verificación

Tabla aditiva privada con RLS. Guardar el contenido revisado, el destinatario y la respuesta por versión. Serializar escrituras de inspección y presupuesto usando el vehículo. El envío externo ocurre después de confirmar la versión en base de datos, con clave de idempotencia y reintento explícito. Usar un enlace firmado con un secreto de servidor y fragmento fuera de las peticiones GET. Validar concurrentemente guardados, envíos, respuesta única, enlace inválido y versión sustituida en PostgreSQL local. Revisar permisos, pantalla pública y fallo del correo.

## Verificación local

Compilación de producción, análisis de tipos, lint y 2031 pruebas unitarias correctas. Las 499 pruebas de integración pasaron en PostgreSQL local (el grupo histórico de 9 migraciones se repitió con psql en el PATH). Se aplicaron las 28 migraciones desde cero y se comprobó la paridad con el esquema Prisma. Chrome y WebKit móvil recorrieron la preparación y el envío con correo simulado. Sobre la compilación local, el enlace privado registró la aceptación en escritorio y el rechazo con motivo en móvil. La entrega a un buzón real se comprobará durante la publicación.

## Rollout y recuperación

Autorizada la implementación local. Antes de publicar configurar remitente, origen HTTPS y OWNER_QUOTE_LINK_SECRET persistente (32 bytes aleatorios como mínimo), verificar copia y migración, y probar con un buzón del equipo. Detener ante deriva de esquema, acceso indebido o atribución de respuesta a otra versión. Revertir la aplicación conservando la tabla y las respuestas. La rotación del secreto invalida enlaces enviados.
