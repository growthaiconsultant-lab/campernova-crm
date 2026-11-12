# HOME-6 — Portada y navegación para revisión

| Campo      | Valor                                     |
| ---------- | ----------------------------------------- |
| **Estado** | IMPLEMENTED                               |
| Alcance    | Web pública y las dos landings de campaña |

## Problema

La maqueta aprobada incluye nueve marcas y las condiciones de compra. En la versión anterior, los enlaces del menú dependían de la página desde la que se accedía.

## Resultado esperado

La primera pantalla reúne el menú, la imagen principal y la franja de marcas. Le siguen la garantía de dos años en vehículo y vivienda, el taller propio, las opciones de financiación y el cambio de nombre gratuito en cualquier compra. Los enlaces de Comprar y Vender abren sus formularios en todos los tamaños de pantalla.

## Criterios de aceptación

- Verificar distribución, legibilidad, nueve imágenes de marca, enlaces de consulta y los cuatro beneficios en escritorio y móvil.
- Las páginas públicas y las landings usan el mismo menú. Para regenerar sus dos copias HTML se ejecuta `pnpm exec tsx scripts/sync-public-menu.tsx`. La prueba de paridad detecta cambios pendientes.
- Mantener las rutas, el catálogo del CRM, el mosaico de Instagram y los destinos de los formularios del rediseño. Revisar los textos del catálogo y de Comprar para que la garantía coincida con la portada.

## Rollout

Publicación autorizada por el titular con el ajuste de posventa y la activación de Instagram en producción.

Las nuevas entregas de venta crean una garantía de 24 meses en vehículo y vivienda desde el cierre. Para un cierre el 29 de febrero se usa el último día de febrero del año de vencimiento. Se mantiene el registro en la transacción de entrega. Las garantías existentes conservan las fechas que tienen guardadas. El despliegue no requiere una migración de datos.
