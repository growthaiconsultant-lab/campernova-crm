# ENC-2 — Identificar cada respuesta y aplicar la imagen de CampersNova

| Campo               | Valor                                   |
| ------------------- | --------------------------------------- |
| **Estado**          | IMPLEMENTED                             |
| **Owner**           | CampersNova                             |
| **Ticket**          | ENC-2, corrección solicitada en el chat |
| **Rama / PR**       | `codex/encuestas-identificadas`         |
| **Categorías**      | C1, C3, C4, C5, C7                      |
| **Riesgo**          | Alto                                    |
| **Ruta SDD**        | Reforzada                               |
| **Última revisión** | 2026-11-26                              |

## Resultado esperado (A)

Cada respuesta nueva tiene una ficha con nombre y un dato de contacto del CRM confirmado antes de mostrar las preguntas. El formulario adopta la fotografía propia, la paleta y la tipografía de CampersNova. Sigue sin exigir crear una cuenta.

## Problema y baseline (B)

ENC-1 está en producción. Un link personal vincula a la ficha, pero el enlace general y la recuperación de un enlace usado o inválido admiten respuestas sin vincular. Se verificó contra el código de ambos repositorios. Aprobar la confirmación de un dato ya registrado es una decisión de implementación para cubrir también a las fichas que solo tienen teléfono. Compara un dato conocido y reduce errores y reenvíos casuales, sin verificar la posesión del canal mediante un código.

## Alcance (C) y exclusiones (D)

Flujo público identificado, activación obligatoria en servidor, diseño adaptado a móvil, etiqueta de identificación en CRM y avisos para fichas incompletas. Quedan fuera login de clientes, OTP por correo o SMS, verificación documental, solicitudes automáticas de datos, y atribución automática del histórico.

## Decisiones y flujo (E–G)

- Invitación exclusiva, actual o emitida con ENC-1, más coincidencia exacta de email o teléfono normalizado en su ficha vigente. Los compradores unificados usan la ficha canónica.
- El formulario pide un solo dato de contacto y muestra el nombre de pila tras confirmar. La ficha necesita un nombre y al menos un canal utilizable. Un comprador solo entra a Compra y un vendedor elige entre Venta y Venta no cerrada.
- Un enlace ausente, caducado, usado o de una ficha incompleta no abre una vía anónima. La persona puede pedir ayuda al equipo. Un comprobante cifrado de 30 minutos conserva el flujo entre pantallas y se valida al guardar. No se guardan valores introducidos para la comparación.
- La confirmación de contacto es conocimiento de un dato registrado. Una persona que recibe el enlace reenviado y conoce ese dato puede superar la confirmación.

## Permisos, datos y consumidores (H–J)

Administración y Comercial conservan los permisos aprobados en ENC-1. El CRM ofrece una ruta de identificación entre servidores con autenticación frente a la encuesta, valida la invitación y consulta solo la ficha vinculada. Al visitante nunca se le devuelve un email, teléfono o identificador de CRM. La tabla de respuestas D1 añade el método de confirmación y la solicitud voluntaria de seguimiento como columnas compatibles. Otra tabla conserva contadores por invitación. Los registros históricos permanecen y se distinguen en el CRM por su estado. Sin cambios a Prisma ni RLS.

## Concurrencia e integraciones (K–L)

Una operación atómica reserva cada intento por invitación, con cinco intentos por 15 minutos. La restricción de uso único y el ID de envío existentes protegen el guardado concurrente. El canal de envío permanece manual. El comprobante distingue criptográficamente su propósito del de una invitación original. No hay anuncios ni datos de contacto en logs.

## UX y verificación (M–N)

Mostrar estados de enlace ausente, confirmación, error de contacto, pausa por intentos, formulario y agradecimiento. Diseño con la tipografía Inter, crema, arena y tinta de la web de marca. Probar desktop y móvil, ambos canales de identificación, invitación inválida o ya utilizada, error del CRM, reintentos y todos los recorridos. La verificación usa datos sintéticos.

Verificación local completada el 26 de noviembre de 2026:

- CRM: 2.080 tests en 171 archivos y comprobación de tipos. La ruta de identificación se probó sin autorización, con dato incorrecto y con ficha canónica.
- Encuesta: compilación Vinext, comprobación de tipos y migración de D1 local con una respuesta histórica. La API rechazó intentos sin identificación, con otro comprobante o recorrido, con enlace caducado o utilizado y al superar el límite. Se guardaron respuestas sintéticas en los tres recorridos. El reenvío de la misma solicitud fue idempotente.
- Navegador: entrada directa sin formulario, aviso de correo incorrecto y envío de una compra por correo. En móvil a 390 px se verificó el acceso por teléfono y el recorrido de venta no cerrada, sin desbordamiento horizontal. Ante un CRM inaccesible se mostró un aviso y el formulario quedó bloqueado.

## Rollout, reversión y observación (O–Q)

Validar localmente. En rollout publicar primero el CRM de forma compatible con la encuesta actual. Probar su ruta interna. A continuación desplegar Sites con la migración aditiva y comprobar que una URL sin invitación ya no admite envíos. Si falla la comprobación del CRM, mantener la nueva web cerrada al guardado mientras se recupera el servicio. Independientemente del rollback, no volver a permitir respuestas anónimas una vez activada la política. Verificar la latencia, el estado de la ruta privada y la ausencia de PII en errores.

## Documentación, riesgos y deuda (R–S)

Los detalles de operación y verificación se registran aquí. El enlace puede reenviarse. Confirmar un dato reduce cruces accidentales, pero no verifica posesión ni identidad documental. Las respuestas históricas sin identificación permanecen en el CRM como tales. No se modifican los datos de clientes.

## Criterios de aceptación (T)

- La API rechaza cualquier envío sin invitación válida y confirmación vigente.
- Confirmar un dato perteneciente a otra ficha no da acceso. Los intentos son limitados.
- Nuevas respuestas guardadas llevan una ficha real con nombre, método de confirmación y el recorrido correcto.
- El histórico se puede leer y su estado de identificación es visible.
- La interfaz mantiene el logo, la paleta y las fotos de la marca y se puede usar en móvil.

## Estado de autorización (U)

`PLAN READY FOR INDEPENDENT REVIEW`

El usuario autorizó expresamente en el chat la publicación coordinada de ENC-2 en el CRM y en encuesta.campersnova.com el 26 de noviembre de 2026. La comprobación se limita a la ficha técnica existente y a datos ficticios, sin envíos a clientes.
