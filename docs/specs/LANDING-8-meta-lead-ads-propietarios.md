# LANDING-8 — Recibir propietarios de Meta Lead Ads

| Campo               | Valor                   |
| ------------------- | ----------------------- |
| **Estado**          | IMPLEMENTED             |
| **Owner**           | Campers Nova            |
| **Ticket**          | LANDING-8               |
| **Rama / PR**       | codex/meta-propietarios |
| **Categorías**      | C1, C3, C4, C6, C7      |
| **Riesgo**          | Alto                    |
| **Ruta SDD**        | Reforzada               |
| **Última revisión** | 2026-11-23              |

## Problema y evidencia

El formulario instantáneo «Vende tu camper», ID `29053317371003989`, recibe solicitudes en Meta. Campers Nova informa de seis solicitudes previas que deben importarse a partir de su exportación. El reenvío actual de [Compradores](../operations/meta-lead-ads-buyer.md) tiene su propio contrato.

## Resultado esperado

Cada envío confirmado aparece en **Vendedores → Solicitudes web**, con origen **Meta Lead Ads · Vende tu camper**. La ficha recoge nombre, teléfono, tipo, modelo, zona, kilómetros y precio esperado. La nota inicial recoge plazo de venta, interés por otro vehículo y respuestas de kilometraje o precio que no se puedan convertir a número.

## Reglas e invariantes

- La credencial de propietario y el ID de formulario son obligatorios en envíos de servidor.
- La identidad es el ID de Meta, conservado como cadena dentro del formulario. Confirmar un reintento sin crear otra ficha, aunque cambien las respuestas. Cada ID distinto representa otra solicitud.
- Mantener los datos ausentes vacíos. Registrar fecha de consentimiento solo si el emisor acredita el consentimiento explícito y su fecha. El servidor no representa al propietario en la IP de consentimiento.
- El circuito de admisión existente decide cuándo la solicitud pasa a ser operativa. No se publica stock ni se envían mensajes al propietario desde esta entrada.

## Decisiones e impacto

| Tema           | Resolución                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Destino        | Usar el flujo de admisión de solicitudes entrantes, que ya reúne propietario y vehículo en una ficha.                 |
| Datos          | Reutilizar SellerLead, Vehicle, Activity y KpiEvent. Sin cambios de base de datos.                                    |
| Seguridad      | Clave de servidor separada, validación en la entrada, límite de 16 KiB y errores sin información de contacto.         |
| Concurrencia   | Identidad determinista y bloqueo transaccional por solicitud. Cuota independiente de 300 altas por hora bajo bloqueo. |
| Observabilidad | Conteo por origen y KPI con integración Meta. Confirmación HTTP sin datos del contacto.                               |

## Contrato del reenvío e importación

Enviar `POST https://campersnova.com/api/landing/vende-tu-camper` con `Content-Type: application/json` y `Authorization: Bearer <clave de propietarios>`.

| Clave                                                             | Valor                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `form_id`                                                         | Cadena `29053317371003989`.                                                                                                        |
| `lead_id`                                                         | ID original de Meta en una cadena de dígitos. Conservarlo también en la importación histórica.                                     |
| `nombre`, `telefono`                                              | Nombre y teléfono del propietario. Teléfono de 9 a 15 dígitos, con prefijo y separadores habituales admitidos.                     |
| `tipo`                                                            | `CAMPER` o `AUTOCARAVANA`.                                                                                                         |
| `zona`, `modelo`, `km`, `precio_esperado`, `cuando`, `busca_otra` | Respuestas como cadenas. Omitir las ausentes. El precio numérico admite punto o espacio para miles, coma decimal y sufijo € o EUR. |
| `gdpr_consent`, `created_time`                                    | Opcionales. Booleano de consentimiento explícito y fecha ISO 8601 de Meta.                                                         |

El emisor debe filtrar por página y por este formulario, normalizar el tipo y esperar `200 {"ok":true}`. Conservar los envíos pendientes ante timeout, 429 o 503 y reintentar con espera progresiva. Revisar 400 por mapeo y 401 por credencial. El ID original permite que la importación histórica y el reenvío coincidan sin duplicar la ficha.

## Criterios de aceptación

- Probar un envío autenticado y los rechazos por formulario, credencial y formato.
- Verificar con PostgreSQL el mapeo, la cuota web existente y la carrera de dos emisores con el mismo ID.

## Rollout

- Configurar `META_SELLER_INTAKE_KEY` como secreto de producción de al menos 32 caracteres. Mantener la clave en el CRM y el servidor emisor.
- Habilitar el reenvío y verificar un lead real o una prueba autorizada en la vista de solicitudes. Comparar la confirmación del emisor con la ficha antes de importar los envíos previos.
- Para detener el flujo, pausar solo la regla de propietarios y retener el pendiente en el emisor. Retirar el secreto y redesplegar si es necesario revocar el acceso.
- Detener el rollout si se pierde el ID original, faltan datos en la ficha o aparecen solicitudes duplicadas.

## Cierre

La activación, la entrega real y la importación histórica requieren acceso al emisor y al entorno de producción. La exportación histórica está pendiente.
