# WEB-13 — Identificar y leer las solicitudes bajo pedido

| Campo         | Valor                                                         |
| ------------- | ------------------------------------------------------------- |
| **Estado**    | IMPLEMENTED                                                   |
| Owner         | Comercial / Engineering                                       |
| Ticket        | Corrección solicitada por el usuario con capturas, 2026-10-21 |
| Rama          | codex/ficha-bajo-pedido-clara                                 |
| Categorías    | C1, C2, C5, C9                                                |
| Riesgo / ruta | Medio / estándar                                              |

## Problema y evidencia

VERIFICADO en main 260b999 y en las capturas: la solicitud aparece como Web/Nuevo
sin identificar el formulario de búsqueda bajo pedido. Las respuestas se presentan
en un párrafo plano, incluyendo todos los campos vacíos y metadatos técnicos.

## Resultado esperado

Etiqueta «Solicitud bajo pedido» en lista, tarjetas móviles, pipeline y cabecera.
Ficha legible en apartados, respuestas destacadas, presupuestos y fechas formateados,
e imprescindibles fáciles de localizar. Aplicable a solicitudes ya recibidas.

Ampliación solicitada el 22 de octubre: comprobar acceso público anónimo al formulario.
VERIFICADO en navegador limpio: la URL canónica abre sin login. Se reproduce el login
con la variante `.html`; redirigirla a la canónica conservando parámetros. Añadir
regresión del middleware (página/API públicas; compradores sigue protegido).
El fallo de CI del 21 fue una carrera del test: comprobaba una sola vez si el aviso de
cookies estaba visible antes de hidratar; el aviso tardío cubría el botón Continuar.
Esperar y cerrar el aviso explícitamente, sin forzar clicks ni aumentar el timeout global.

## Reglas, decisiones y alcance

- La identidad del intake WEB-12 es el ID `search_request_` con SHA hexadecimal de
  40 caracteres. Se reutiliza como discriminador de presentación, independiente del
  origen editable y del estado comercial. No consulta Activities adicionales en lista.
- No cambiar automáticamente el estado comercial, responsable ni datos guardados.
- Mantener pública la página y el envío de solicitudes; no ampliar el acceso al CRM.
- Parser de presentación para el formato existente, basado en preguntas y secciones
  conocidas y ordenadas. Si hay ambigüedad o formato desconocido se muestra el original
  íntegro. Siempre se puede desplegar el texto original; no reescribir históricos.
- Campos sin respuesta agrupados y plegados; no ocultar respuestas con valor cero.
- Texto del cliente escapado por React; sin enlaces ejecutables ni HTML interpolado.
- No migraciones, backfill, nuevos permisos, efectos externos, eventos ni dependencias.

## Plan e impacto

1. Helper puro de identificación, lectura y formato del snapshot existente.
2. Badge compartido para lista, móvil, pipeline y detalle; mismo acceso autenticado.
3. Componente de lectura con resumen, apartados y originales accesibles.
4. Tests de compatibilidad, formatos ambiguos, multilinea y UI móvil/escritorio.

Las lecturas Prisma existentes se conservan: el listado usa el ID ya seleccionado y
el detalle ya obtiene el snapshot exacto, independiente del historial paginado.
No se usa texto para KPIs ni reglas de dominio; la interpretación es sólo visual.
No datos personales en logs, capturas de prueba ni analítica. Concurrencia N/A:
no se introduce ninguna escritura. Se mantiene `requireAgente` antes de leer datos.

## Criterios de aceptación

- [x] Solicitudes anteriores y nuevas muestran etiqueta en las cuatro superficies.
- [x] Origen Web o estado Nuevo por sí solos no etiquetan otros compradores.
- [x] Respuestas, fechas, importes, imprescindibles y multilineas se leen con claridad.
- [x] Vacíos plegados; original completo disponible, también ante formato no reconocido.
- [x] Pruebas de parser y UI, typecheck, lint, SDD y diff revisados.

## Verificación

Vitest con snapshots generados por el serializador real; casos incompletos,
ambiguos y caracteres especiales. Fixture UI con datos ficticios en Chromium y
WebKit móvil; verificar expansión, lectura, navegación por teclado y desbordamiento.
No integración de escritura: no hay cambios en persistencia ni consultas.

## Rollout y recuperación

Petición de corrección sobre el flujo publicado: autoriza implementar y publicar
esta mejora tras revisión y CI. Desplegar el mismo árbol verificado. No mutar leads
reales para comprobarlo. Si hay problemas, revertir presentación; el snapshot original
se conserva. Detener si una respuesta no puede recuperarse o se identifica un lead ajeno.

## Cierre

Verificación local: 5 tests Vitest de presentación y 6 tests UI en Chromium y WebKit móvil correctos. Typecheck, lint y SDD correctos; capturas revisadas. Observación de producción sólo después
del despliegue, sin presentar la prueba local como una lectura de datos reales.
