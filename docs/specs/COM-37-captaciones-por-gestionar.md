# COM-37 — Captaciones por gestionar

| Campo      | Valor                           |
| ---------- | ------------------------------- |
| **Estado** | IMPLEMENTED                     |
| Owner      | Equipo CRM                      |
| Ruta       | Estándar                        |
| Rama       | codex/captaciones-por-gestionar |

## Problema

El tablero suma las convertidas al trabajo abierto y las tarjetas no destacan la siguiente acción.

## Resultado esperado

Cabecera verde, alta bajo demanda y tres vistas con filtros por portal y responsable. Destacar contacto, seguimiento, cita o ficha según la etapa.

## Criterios de aceptación

- Mostrar exactamente una vez cada captación existente. Una ficha de vendedor ya vinculada identifica una conversión incluso con un estado histórico incoherente.
- Conservar las notas, el motivo de rechazo, la cita, la asignación y el vínculo al vendedor. No efectuar escrituras al abrir o filtrar.
- Respetar accesos desde el buscador y el calendario, arrastre, alta con aviso de duplicado y conversión explícita.

## Verificación

Pasaron 8 recorridos de interfaz en Chrome y WebKit móvil y 5 pruebas de integración con PostgreSQL aislado. Se comprobó que consultar y clasificar captaciones antiguas conserva sus valores, que los filtros respetan cada vista y que una conversión ya vinculada queda protegida ante un cambio de etapa posterior. La suite unitaria local pasó con 2.022 pruebas.

## Rollout y recuperación

Sin migración ni actualización masiva. La publicación en el CRM se tramita por separado.
