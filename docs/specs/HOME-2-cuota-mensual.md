# HOME-2 — Cuota mensual publicada por vehículo

| Campo              | Valor                                                  |
| ------------------ | ------------------------------------------------------ |
| **Estado**         | IMPLEMENTED                                            |
| Ruta               | Reforzada por dato económico opcional y migración      |
| Alcance autorizado | Campo del CRM, persistencia, tarjetas y despliegue web |

## Problema

La ficha guarda el precio al contado. La web sólo permite pedir financiación.

## Resultado esperado

Administración puede añadir, cambiar o vaciar una cuota mensual en euros junto al precio público. La portada, los listados y la ficha muestran «Desde X €/mes» sólo cuando existe un valor explícito. Se preserva la consulta por WhatsApp.

## Criterios de aceptación

- Importe positivo, hasta ocho enteros y dos decimales, independiente del precio de venta y del presupuesto del comprador.
- Columna nullable sin valor inicial ni backfill. La omisión en formularios antiguos conserva la cuota. Valor, actividad y actualización de caché se coordinan con la edición económica existente.
- Verificar denegación al agente, decimales, cambio, eliminación, ausencia inicial y persistencia en PostgreSQL real. Comprobar migraciones, RLS, compilación y catálogo público.

## Rollout

Cambio aditivo sobre vehículos. Validar el historial y destino, copia previa y paridad en staging antes de aplicar en producción y desplegar el cliente. Detener si hay migraciones pendientes distintas o divergencias. Para revertir la interfaz se puede desplegar la versión anterior conservando la columna y las cuotas guardadas. No se cargan importes de demostración.
