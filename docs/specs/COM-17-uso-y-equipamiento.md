# COM-17 — Registrar el uso del vehículo durante la llamada

| Campo      | Valor                                                       |
| ---------- | ----------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                                 |
| Owner      | Equipo CRM                                                  |
| Ticket     | Propuesta de uso y equipamiento aprobada por el propietario |
| Rama       | codex/uso-y-equipamiento                                    |
| Ruta SDD   | Reforzada, ampliación de esquema                            |

## Problema

El uso como vivienda no tiene un campo propio. El agente necesita explicar el uso principal de un vistazo y editar un requisito sin recorrer todo el catálogo.

## Resultado esperado

Durante la llamada se puede registrar el uso residencial y añadir un requisito confirmado. La ficha presenta ambos al volver a abrirla.

## Criterios de aceptación

- Mostrar uso junto a las plazas y el presupuesto. Distinguir escapadas, viajes largos, vivienda y otros usos. Para vivienda, admitir todo el año, por temporadas y duración pendiente.
- Registrar el uso como dato comercial opcional. Un comprador anterior sigue pendiente, incluso si tiene requisitos de autonomía. Conservar la zona de uso y las reglas de comparación de vehículos.
- Buscar características por nombre u opción, editar una a la vez y respetar los valores, combinaciones y prioridades existentes.
- Exigir agente, ficha activa y comprobación de valores anteriores al guardar. Mantener el borrador si falla el guardado. En una ficha archivada se pueden consultar los datos.

## Plan y verificación

Ampliación aditiva en PostgreSQL, formulario contextual en Qué busca y editor individual sobre el catálogo existente. Verificar el esquema desde cero, su paridad, las escrituras simultáneas, los datos anteriores, el resumen y las interacciones de pantalla. El formulario público y los datos reales quedan fuera del cambio.

## Rollout y recuperación

Autorización para implementación local. Aplicar la migración antes del código en cada entorno cuando se autorice la publicación. Detener ante divergencias del esquema o pérdida de datos. Se puede volver al código anterior conservando las columnas opcionales.

## Verificación local

Superadas 1980 pruebas unitarias, 468 de integración y 16 pruebas de navegador del editor y del autoguardado. Build completo verificado con copias locales de las fuentes de Google tras un fallo del cargador al interpretar una URL de fuente en el build ordinario. Validar el build ordinario del entorno antes de publicar.

Pruebas de página sobre el resumen residencial y los datos pendientes. Pruebas en Chrome y WebKit móvil sobre duración, búsqueda, prioridad, reintento y conservación de criterios múltiples. En PostgreSQL 17 se comprobó la escritura, el rechazo de datos obsoletos y la independencia del equipamiento. El historial completo se aplicó desde cero y la segunda ejecución quedó sin migraciones pendientes. Comprobadas paridad Prisma, RLS y cifras del catálogo de CI. Producción pendiente.
