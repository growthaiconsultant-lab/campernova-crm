# HOME-5 — Cinco publicaciones de Instagram en la portada

| Campo      | Valor                                            |
| ---------- | ------------------------------------------------ |
| **Estado** | IMPLEMENTED                                      |
| Alcance    | Vista previa. Publicación con el próximo diseño. |

## Problema

Los cinco vídeos de archivo son fijos. La marca quiere mostrar las últimas publicaciones de su cuenta profesional.

## Resultado esperado

Lectura en servidor mediante el inicio de sesión unificado de Meta y permiso `instagram_basic`. Verificar el titular @campersnova, seleccionar las cinco publicaciones más recientes y enlazar cada tarjeta a su original. Fotos y carruseles utilizan su portada, los vídeos su miniatura. La caché de Next se revalida con tráfico una vez por hora. Una revalidación fallida no reemplaza la respuesta correcta con una lista vacía. Si no hay token o instantánea utilizable, la sección muestra los vídeos locales identificados como archivo.

## Criterios de aceptación

- Comprobar orden, límite, cuenta equivocada, formato de enlaces y fallos de Meta. Validar la vista previa en móvil y escritorio.
- Guardar `INSTAGRAM_ACCESS_TOKEN` como variable sensible de servidor en Vercel Preview, limitada a la rama `codex/instagram-home-feed`. Volver a desplegar la vista previa después de autorizar. Guardar la credencial en Production al publicar el nuevo diseño.
- Usar el ajuste «Mosaico web de CampersNova» con la cuenta de Instagram como único activo. Rotar la credencial en Meta y Vercel si se revoca el acceso. Los permisos de publicación y mensajería no son necesarios.
- La primera lectura de la cuenta real se verifica después de la autorización del titular.

## Rollout

Preparar en rama aislada. Activar en producción al aprobar el nuevo diseño. Para desactivar el feed, retirar la variable y volver a desplegar. Sin cambios en la base de datos.
