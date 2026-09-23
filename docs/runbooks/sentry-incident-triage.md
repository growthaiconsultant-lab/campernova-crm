# Diagnóstico y cierre de incidencias Sentry

| Campo           | Valor                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Estado          | ACTIVE                                                                      |
| Owner           | Engineering                                                                 |
| Última revisión | 2026-09-23                                                                  |
| Alcance         | Investigar, verificar y cerrar errores sin ocultar señales ni exponer datos |
| Caso de origen  | [OBS-1](../specs/OBS-1-sentry-errors.md)                                    |

Este procedimiento complementa [el proceso de cambios](../governance/engineering-change-process.md)
y [testing](../governance/testing-strategy.md). No autoriza cambios remotos ni sustituye la aprobación
de producción. Los estados y resultados concretos se mantienen en la spec y PR, no en este runbook.

## 1. Identificar la muestra correcta

1. Registrar enlace de issue, evento, timestamp UTC, entorno, release y ruta sin parámetros privados.
2. Contrastar Latest con Recommended; el evento recomendado puede pertenecer a un release antiguo.
3. Separar excepciones, hidratación y avisos de rendimiento. Recuento de eventos no equivale a usuarios.
4. Leer stack y breadcrumbs sin copiar payloads, URLs firmadas, tokens, contactos o sesiones a Git.
5. Clasificar: reproducido en código propio, mitigado, externo probable o pendiente de evidencia.
   Un frame «In App» o un título de issue no bastan para atribuir la causa.

## 2. Verificar observabilidad antes de interpretar ausencia de errores

- Confirmar SHA desplegado y entorno; NODE_ENV=production también ocurre en Preview.
- Comprobar nombres y ámbitos de variables, sin imprimir secretos. Nunca seleccionar Production
  para reparar Preview. La introducción de credenciales la realiza el usuario cuando la herramienta
  exige handoff; no guardar secretos en archivos, comentarios o historial de comandos.
- Confirmar upload y paquetes privados del mismo release en Sentry, no sólo build READY.
- Comprobar que los mapas no se publican en el artefacto estático. Una petición bloqueada por el
  navegador no prueba 404 ni permite sortear la barrera.
- Verificar recepción runtime de telemetría del entorno/release. Cero errores sin esta señal puede
  significar falta de captura, bloqueo de red o muestreo, no salud demostrada.

## 3. Corregir y probar con alcance acotado

- Reproducir y añadir regresión proporcional antes de cambiar comportamiento.
- Para persistencia/concurrencia, ejecutar PostgreSQL efímero real; mocks no demuestran atomicidad.
- Antes de escribir en Preview, verificar tanto Auth como DATABASE_URL/DIRECT_URL de staging.
  El nombre de la rama o un login correcto no demuestran aislamiento de datos.
- Usar fixtures identificadas y autorizadas; si faltan, registrar prueba pendiente en vez de usar
  vehículos reales. Un emulador de viewport no equivale a un dispositivo iOS/Android real.
- No añadir filtros globales, suppressHydrationWarning, catch silenciosos o recargas automáticas
  para dejar de recibir alertas. Una mitigación debe seguir etiquetada como tal.

## 4. Cierre verificable

Registrar en spec y PR: commit, CI ejecutado, deployment, checks manuales, limitaciones, rollback,
responsable y siguiente evidencia. Conservar como histórico los fallos ya superados, identificando
su fecha y la comprobación que los sustituyó.

Antes de resolver una incidencia: corrección desplegada en el entorno afectado con autorización,
criterio de reproducción verificado y ventana de observación explícita. Cero muestras puntuales no
equivale a una ventana completada. Incidencias externas o no reproducidas conservan esa clasificación;
archivar/filtrar requiere decisión explícita, no es una corrección técnica.

Detener promoción ante nueva regresión, aislamiento desconocido, secreto expuesto, mapas públicos,
fallo de integración o falta de autorización. Mantener monitorización existente; no desactivarla ni
crear ruido sintético en producción para probar el sistema.
