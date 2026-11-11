# COM-28 — Encontrar los vehículos que cumplen los criterios del equipo

| Campo      | Valor                    |
| ---------- | ------------------------ |
| **Estado** | IMPLEMENTED              |
| Owner      | Equipo CRM               |
| Ruta       | Estándar                 |
| Rama       | codex/filtros-inventario |

## Problema

La búsqueda completa de una marca y su modelo puede perder el vehículo. Limpiar deja texto visible y el presupuesto consulta cifras distintas de las mostradas.

## Resultado esperado

Aplicar juntos los criterios elegidos sobre el inventario admitido y ver sus coincidencias en las tarjetas habituales.

## Criterios de aceptación

- Buscar palabras en marca, modelo y matrícula. Combinar con tipo, estado, origen, años, kilómetros y presupuesto. Límites inclusivos, importes en céntimos y datos desconocidos excluidos cuando se exige ese dato.
- Emplear el precio de venta para filtrar, ordenar por precio y mostrar el importe principal. Identificar por separado las referencias de tasación o del vendedor.
- Aplicación explícita, resumen de filtros activos, retirada individual, limpieza completa y navegación coherente al volver o cambiar de página. Distinguir un inventario vacío de una búsqueda sin coincidencias.
- Mantener permisos, visibilidad, fotos, matrícula, datos de la tarjeta, compradores compatibles y enlace a la ficha.

## Verificación

Pasaron 2.016 pruebas unitarias y cinco pruebas del inventario sobre PostgreSQL 17 local. Chrome de escritorio y WebKit móvil verificaron la aplicación conjunta, los filtros activos, volver atrás, el orden y la limpieza del texto. Se inspeccionaron las tarjetas con fotos de ejemplo y el estado sin precio de venta. Compilación optimizada, tipos y lint correctos.

## Rollout y recuperación

Cambio local de consulta y presentación. Conserva la estructura de datos. Ante diferencias entre contador, filtros y tarjetas, detener la publicación y revisar el conjunto de resultados.
