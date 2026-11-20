# CAP-2 — Seguimiento de captaciones y entradas por comercial

| Campo | Valor |
| --- | --- |
| **Estado** | IMPLEMENTED |

## Problema

Los comerciales necesitan visualizar siete etapas y consultar la recepción por periodo y responsable.

Ruta reforzada por ampliación de esquema. Rama codex/captacion-etapas.

## Resultado esperado

El equipo puede distinguir el intento sin respuesta, el propietario sin interés, el seguimiento, la visita de valoración y la entrega. Cada cita conserva su fecha independiente. El calendario muestra la cita de la etapa vigente.

En stock lista captaciones vinculadas con llegada física registrada. El periodo usa días inclusivos de Madrid y el informe desglosa los vehículos por responsable asignado a la captación. El conjunto incluye vehículos vendidos posteriormente. Las fichas convertidas pendientes de recepción se consultan en Convertidas.

## Criterios de aceptación

- Siete columnas visibles aunque no haya tarjetas.
- Fechas de visita y entrega independientes.
- Recepciones por comercial y día de Madrid; conservación de las captaciones históricas.

## Verificación

Cuatro recorridos en Chrome y 35 pruebas unitarias. En PostgreSQL 17 se aplicaron las 30 migraciones y se comparó el contenido anterior de seis captaciones representativas.

## Rollout

El commit de publicación en main puede solicitar esta migración concreta mediante la línea Apply-Migration. El operador comprueba el proyecto de producción y exige que sea la única migración pendiente antes de ejecutar Prisma.

La migración añade tres valores al enum y una fecha opcional. Las lecturas y los filtros no escriben en la base de datos. Contactado y los rechazos anteriores conservan su significado. Se mantienen los permisos de agente y la protección de las captaciones vinculadas.

Validar primero la migración y las consultas en PostgreSQL de pruebas, comprobar históricos y probar las dos citas en la interfaz. Aplicar la ampliación antes de publicar el cliente. Si hay que detener la activación, conservar los valores escritos y utilizar una versión compatible con los nuevos estados.

## Recepción desde Captaciones

Desde Entrega agendada, Convertidas o al soltar una tarjeta en En stock, el comercial confirma la llegada física. Para captaciones sin vínculo, la confirmación explica y ejecuta la creación de ficha mediante la conversión existente. Un fallo posterior permite reintentar desde Convertidas. La llegada reutiliza la operación idempotente de Entrada, con su usuario, fecha e inspección. Cancelar cierra el diálogo sin escrituras. No requiere migración. La reversión consiste en restaurar la interfaz anterior, conservando las recepciones registradas.
