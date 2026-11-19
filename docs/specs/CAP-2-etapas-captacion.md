# CAP-2 — Seguimiento de captaciones y entradas por comercial

Ruta reforzada por ampliación de esquema. Rama codex/captacion-etapas.

## Resultado y reglas

El equipo puede distinguir el intento sin respuesta, el propietario sin interés, el seguimiento, la visita de valoración y la entrega. Cada cita conserva su fecha independiente. El calendario muestra la cita de la etapa vigente.

En stock lista captaciones vinculadas con llegada física registrada. El periodo usa días inclusivos de Madrid y el informe desglosa los vehículos por responsable asignado a la captación. El conjunto incluye vehículos vendidos posteriormente. Las fichas convertidas pendientes de recepción se consultan en Convertidas.

## Compatibilidad y despliegue

La migración añade tres valores al enum y una fecha opcional. Las lecturas y los filtros no escriben en la base de datos. Contactado y los rechazos anteriores conservan su significado. Se mantienen los permisos de agente y la protección de las captaciones vinculadas.

Validar primero la migración y las consultas en PostgreSQL de pruebas, comprobar históricos y probar las dos citas en la interfaz. Aplicar la ampliación antes de publicar el cliente. Si hay que detener la activación, conservar los valores escritos y utilizar una versión compatible con los nuevos estados.
