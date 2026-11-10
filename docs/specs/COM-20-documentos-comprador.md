# COM-20 — Encontrar y descargar los documentos del comprador

| Campo      | Valor                                                      |
| ---------- | ---------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                                |
| Owner      | Equipo CRM                                                 |
| Rama       | codex/documentos-comprador                                 |
| Ruta SDD   | Estándar de interfaz con comprobaciones de lectura privada |

## Problema

El formulario ocupa la primera pantalla y los presupuestos se mezclan con el resto de archivos.

## Resultado esperado

El equipo accede al presupuesto más reciente y puede recuperar los anteriores desde la ficha. El formulario se abre al pulsar Subir documento.

## Criterios de aceptación

- Presupuestos primero y otros documentos operativos debajo, cada lista paginada y ordenada desde el más reciente. Mostrar nombre, fecha y descarga directa.
- Mostrar el estado vacío sólo después de consultar ambos grupos. Mostrar la navegación únicamente cuando haya varias páginas.
- Mantener nombre sugerido, tipos, límite de tamaño, avisos de privacidad, guardado, reintentos y descarga privada.
- Leer los mismos registros, incluidas las versiones anteriores del CRM. Mantener las restricciones por comprador, categoría y rol y las demás vistas existentes.
- Verificar con PostgreSQL local, datos de prueba y navegador en escritorio y móvil.

## Verificación local

Pasaron 1985 pruebas unitarias, 18 pruebas con PostgreSQL local sobre listado, acceso privado y versiones, y 6 pruebas de interfaz en Chrome y WebKit móvil. Se comprobó con datos de prueba la recuperación de presupuestos antiguos, la descarga desde la fila y el reintento de una subida.

## Rollout y recuperación

Implementación local. Reversión de la presentación y del filtro opcional de consulta. El cambio no migra, mueve ni elimina archivos. Detener ante un archivo omitido, acceso fuera de destino o variación en el proceso de descarga.
