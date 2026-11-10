# COM-19 — Ver las reservas y sus plazos en la ficha del comprador

| Campo      | Valor                            |
| ---------- | -------------------------------- |
| **Estado** | IMPLEMENTED                      |
| Owner      | Equipo CRM                       |
| Rama       | codex/ofertas-reservas-comprador |
| Ruta SDD   | Estándar, presentación           |

## Problema

La lista mezcla negociaciones abiertas, reservas y operaciones cerradas. La fecha de fin y la señal quedan en segundo plano.

## Resultado esperado

Leer primero las reservas con su vehículo, importe acordado, señal y plazo. Distinguir las ofertas abiertas y consultar las anteriores en el historial.

## Criterios de aceptación

- Usar el estado y la señal originales para clasificar cada operación una vez. Importes con céntimos y fechas completas en la zona de Madrid.
- Ordenar las reservas por fecha, con las vencidas primero y las que carecen de fecha al final. Distinguir vencimiento hoy, plazo vencido y fecha sin acordar. El transcurso del plazo solo cambia el aviso.
- Conservar las asociaciones, las notas, las acciones existentes y el acceso por enlace directo incluso a una operación del historial.
- Validar la lectura de registros anteriores, acciones en navegador y transiciones existentes sobre PostgreSQL local.

## Verificación local

Superadas 1984 pruebas unitarias, 40 de integración de ofertas, reservas y transiciones con PostgreSQL 17 efímero, y 10 de navegador en Chrome y WebKit móvil. Las pruebas cubren clasificación, precisión en céntimos, día de Madrid, vencimientos, historial por enlace y registro y aceptación con reintento. Controles de tipos, lint y SDD correctos. Compilación local de Next con configuración de prueba y fuentes locales.

## Rollout y recuperación

Publicación autorizada por el propietario tras la verificación local. Integrar tras los controles del repositorio y verificar el dominio del equipo. Recuperación mediante reversión de la interfaz. Detener ante pérdida de operaciones o diferencias en importes, fechas o estados.
