# COM-40 — Inspección de taller al confirmar la llegada

| Campo      | Valor                                  |
| ---------- | -------------------------------------- |
| **Estado** | IMPLEMENTED                            |
| Owner      | Equipo CRM                             |
| Ruta       | Reforzada, persistencia y concurrencia |

## Problema

La llegada física no asigna trabajo y la inspección posterior no distingue presencia de equipamiento, estado técnico y partidas para el propietario.

## Resultado esperado

Confirmar la llegada genera una única inspección asignada a la cuenta de coordinación de Nerea. La orden aparece en Por hacer aunque no tenga cita y la entrada oficial reutiliza la inspección existente. Taller puede guardar por elemento y consultar lo marcado para presupuestar al propietario.

## Criterios de aceptación

- Registrar llegada, orden y asignación en la misma transacción bajo los bloqueos existentes. Un reintento conserva los avances y una inspección terminada no vuelve a abrirse.
- Inicializar la coordinación a partir de la única cuenta activa de Nerea con acceso a edición de taller. Conservar su identidad por cuenta. Hacer visible una asignación pendiente si falta coordinación.
- Mantener resultados, notas y fotos históricos. Distinguir dato desconocido y ausencia confirmada. Guardar cambios parciales y detectar ediciones concurrentes.
- No generar importes, enviar presupuestos ni activar garantías en esta fase.

## Verificación

La prueba de PostgreSQL recorre llegada, tarea personal, avería, partida, conservación de fotos, edición simultánea y validación con la inspección ya completada. La prueba de interfaz recorre el guardado parcial y la incorporación de elementos en escritorio y móvil.

En local pasaron 65 pruebas de integración de entrada, dashboard, tasación y catálogo, y 10 recorridos de interfaz en Chrome y WebKit móvil. Se verificaron la aplicación de la migración con una cuenta de coordinación existente y la paridad del esquema en PostgreSQL aislado.

## Rollout y recuperación

Publicación autorizada en el CRM del equipo. Verificar en staging la migración aditiva y comprobar la copia previa, la identidad del entorno y la cuenta activa de coordinación antes de aplicarla en producción. Contrastar la asignación tras migrar y verificar la interfaz publicada. La recuperación consiste en revertir el código manteniendo los datos guardados.
