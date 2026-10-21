# WEB-12 — Ficha de búsqueda pública conectada al CRM

| Campo        | Valor                            |
| ------------ | -------------------------------- |
| **Estado**   | IMPLEMENTED                      |
| Owner        | Comercial / Engineering          |
| Ticket       | Petición del usuario, 2026-10-21 |
| Rama         | codex/formulario-busqueda-web    |
| Categorías   | C1, C2, C3, C5, C6, C9           |
| Riesgo / SDD | Alto / reforzada                 |

## Problema, evidencia y resultado

VERIFICADO EN CÓDIGO: main 9aa08e7 tiene un formulario corto y un CRM con
compradores, próximas llamadas y reparto mediante trigger COM-9. No hay formulario
web con la ficha revisada. VERIFICADO EN DOCUMENTO: la ficha proporcionada por el
usuario tiene diez secciones tras eliminar las preguntas marcadas en rosa.
DECISIÓN DEL USUARIO: formulario corporativo público, respuestas en CRM y comercial
asignado; firma y encargo quedan fuera de esta fase.

## Resultado esperado

Crear /busqueda-bajo-pedido, enlazado desde la web. Cada envío confirmado crea un
comprador NUEVO de origen WEB, su próxima acción LLAMAR y una ficha íntegra legible
en el CRM. COM-9 asigna el comercial sin cambiar el pool ni su cursor fuera del INSERT.

## Invariantes y decisiones

- El servidor valida la lista cerrada de preguntas, tipos, longitudes y consentimiento.
- Datos de contacto mínimos: nombre y teléfono. Resto opcional; no inventar preferencias.
- No reintroducir preguntas eliminadas, contrato, pago ni firma.
- Una solicitud/reintento conserva el mismo identificador; una transacción y un lock
  evitan altas, notas, eventos y turnos duplicados. Identificador reutilizado con otra
  respuesta se rechaza; el cliente genera otro al modificar respuestas.
- El formulario no actualiza compradores por teléfono: ese dato público no acredita
  identidad. Nuevas solicitudes independientes se conservan para revisión comercial.
- Datos canónicos en BuyerLead; Activity es la foto histórica del envío, identificada
  de forma determinista y accesible en la ficha incluso tras más de 50 actividades.
  No se derivan KPIs desde el texto. Sin nueva entidad ni migración.
- Altura interior no es altura exterior. Localidad no es zona de uso. Presupuesto
  total no es presupuesto exclusivo de vehículo: conservar en ficha, no inferir maxBudget.
- Se reutiliza el reparto configurado; si está desactivado o sin agentes activos se
  conserva la solicitud sin asignar, como COM-9. Go-live exige verificar el pool activo.
- No modificar contratos ni atribución de la landing anterior o Meta/NIRA.

## Plan e impacto

1. Catálogo compartido de preguntas y Zod estricto; formulario accesible de cinco pasos.
2. Route Handler público same-origin, JSON limitado a 32 KiB, honeypot y cuota horaria
   por IP en PostgreSQL. Sin endpoint de lectura pública ni identificadores CRM en respuesta.
3. Persistencia atómica BuyerLead + Activity + KPI, llamada por defecto; trigger existente.
4. Sección autenticada de respuestas originales, independiente de notas paginadas.
5. Enlace desde navegación/entrada de búsqueda; pruebas de API, datos, concurrencia y móvil.

Consumidores: middleware público, host routing, navegación, comprador, seguimiento,
listado de origen WEB y KPI BUYER_CREATED. Estados/permisos/matching existentes se
mantienen. No backfill, nueva dependencia, almacenamiento de archivos, comunicaciones
externas ni efectos asíncronos. Los detalles opcionales quedan en la ficha original.
Las preferencias conocidas se mapean sólo cuando son exactas (plazas viajar/dormir,
tipo, financiación, entrega, longitud, baño). No sobrescribir preferencias de otros leads.

Seguridad: mismo origen obligatorio, sin CORS abierto, sin secretos en cliente; campos
no incluidos en analytics ni logs. Contenedor sensible excluido de autocapture/replay.
Sólo usuarios con requireAgente leen la ficha, con el mismo acceso comercial existente.
Texto escapado por React; enlaces del cliente se muestran como texto. Sin uploads.
Límite compartido de 10 solicitudes por hora/IP de este formulario; ausencia de IP usa
bucket común. El honeypot/cuota no sustituyen protección perimetral ante bots distribuidos.
Locks: solicitud antes de cuota IP antes del trigger; timeout revierte todos los efectos.
Errores devuelven estado genérico, nunca payload ni PII. Ante timeout el cliente conserva
respuestas e identificador para reintento. No persistir PII en localStorage.

## Criterios de aceptación y verificación

- [x] Preguntas revisadas completas, opciones múltiples y campos opcionales sin pérdida.
- [x] Teléfono/nombre/consentimiento validados; errores recuperables y doble envío bloqueado.
- [x] Móvil y escritorio sin desbordamiento, labels, foco y navegación atrás conservados.
- [x] PostgreSQL real: asignación, llamada, snapshot, rollback, carrera y cuota.
- [x] API: origen, MIME, tamaño, entradas desconocidas, errores, no filtrar PII.
- [x] Typecheck, lint, pruebas relevantes y revisión del diff.

Evidencia local: 1.898 unitarios; 5 integraciones nuevas contra PostgreSQL 17 y las
21 migraciones reales; 6 E2E con envío a esa misma DB en Chromium escritorio,
Android y WebKit/iPhone. Pruebas de reintento simulan respuesta perdida después del
commit y verifican un único registro/evento. Se corrigió captura de entrada numérica
en WebKit usando input nativo; el test compara todas las respuestas con la ficha.
Typecheck, lint, formato y SDD correctos. Capturas revisadas localmente, sin PII real.

## Rollout, recuperación y observación

Código aditivo sin migraciones. La petición expresa de crear el formulario en la web
y conectarlo al CRM autoriza poner este flujo en servicio, sujeto a revisión y CI sin
bypass. No autoriza otros cambios de producción, activar configuraciones ni insertar
clientes de prueba. Preflight del 21 de octubre mediante operador sin alias de dominio,
transacción READ ONLY: proyecto verificado, migración COM-9 aplicada, trigger activo,
pool habilitado con 4 comerciales elegibles. Deployment de lectura:
`dpl_2qpzL6U7UpedENMBvMUNvGjMUD1k`; no se modificó la configuración del reparto.
Tras publicar, verificar ruta pública y monitorizar primeras solicitudes reales, su
comercial y llamada, sin generar contactos ficticios en producción. Consultas agregadas
por source WEB/id `search_request_` permiten contar entradas y pendientes sin PII.
Detener si hay errores de persistencia, pérdida de respuestas o reparto no configurado.
Rollback: revertir rutas/enlaces nuevos; conservar compradores y respuestas recibidas.

## Revisión adversarial / cierre

Revisados: colisiones/reintentos, payload distinto con igual ID, arrays maliciosos,
presupuesto total mal mapeado, lectura pública, límite sin IP, historial paginado,
respuesta exitosa antes de commit y exposición en analytics. La nueva navegación se
oculta antes de XL para no desbordar en tablet. Se conserva el CTA en la página de inicio
para móvil. Publicación pendiente de CI y despliegue; no se declara validación de
captación real hasta recibir una solicitud real.
