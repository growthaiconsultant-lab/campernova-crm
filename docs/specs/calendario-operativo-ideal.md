# CampersNova CRM — Especificación del Módulo de Calendario Operativo

Documento de especificación funcional y técnica para implementar el módulo de **Calendario / Agenda Operativa** dentro del CRM de **campersnova.com**.

Este documento está pensado para Claude Code o cualquier agente de desarrollo que tenga que planificar e implementar el sistema.

---

# 1. Objetivo del módulo

El calendario del CRM de CampersNova no debe ser una agenda genérica. Debe funcionar como un **centro operativo y comercial** que conecte:

- compradores,
- vendedores,
- vehículos,
- comerciales,
- tareas,
- entregas,
- recepciones,
- reparaciones,
- mejoras,
- limpiezas,
- visitas,
- demandas,
- documentación,
- y seguimiento interno.

La idea base es que en el CRM se puedan crear distintos tipos de eventos de calendario, cada uno con campos propios, pero todos compartiendo una estructura común.

El calendario debe responder siempre a estas preguntas:

1. ¿Qué hay que hacer?
2. ¿Cuándo hay que hacerlo?
3. ¿Quién lo ha creado?
4. ¿Quién es responsable?
5. ¿A qué cliente está asociado?
6. ¿A qué vehículo está asociado?
7. ¿Cuánto tiempo aproximado requiere?
8. ¿Qué información mínima necesita ese tipo de evento?
9. ¿Está pendiente, en curso, completado o cancelado?
10. ¿Qué observaciones o resultado se han registrado?

---

# 2. Contexto de negocio

CampersNova trabaja con vehículos tipo camper, autocaravanas y vehículos vivienda. El proceso comercial y operativo puede incluir:

- Entrada de un vehículo ofrecido por un cliente vendedor.
- Revisión de información inicial del vehículo.
- Reparaciones o mejoras antes de venta.
- Limpieza y preparación.
- Publicación en web o portales externos.
- Citas con compradores interesados.
- Seguimiento de demandas de compradores.
- Reserva.
- Gestión documental.
- Entrega final.
- Postventa.

Por eso, el calendario debe estar profundamente integrado con el CRM, no ser una herramienta aislada.

---

# 3. Principio central

Todo evento debe tener siempre, como mínimo:

```text
- Tipo de evento.
- Título.
- Fecha y hora de inicio.
- Duración aproximada.
- Usuario creador.
- Usuario responsable/asignado.
- Estado.
- Observaciones.
```

Además, según el tipo de evento, podrá o deberá asociarse a:

```text
- Cliente comprador.
- Cliente vendedor.
- Vehículo.
- Comercial.
- Tarea.
- Oferta.
- Reserva.
- Documentación.
```

---

# 4. Tipos de eventos que debe soportar el calendario

Los tipos de evento detectados y recomendados son:

1. Entrega.
2. Recepción / Entrada.
3. Reparación.
4. Mejora.
5. Cita.
6. Demanda.
7. Limpieza.
8. Otros.

Además, se proponen algunos tipos adicionales opcionales para mejorar el sistema:

9. Seguimiento comercial.
10. Revisión documental.
11. Publicación de vehículo.
12. Fotografía / vídeo.
13. Tasación.
14. Postventa.

La implementación inicial puede incluir los 8 tipos principales, pero la arquitectura debe permitir añadir nuevos tipos sin romper el sistema.

---

# 5. Modelo conceptual

## 5.1. Entidad principal

La entidad principal debería ser:

```text
calendar_events
```

Cada evento tendrá campos comunes y, adicionalmente, un bloque de datos específico según el tipo de evento.

Hay dos enfoques posibles:

## Opción A — Una tabla principal + JSON específico

```text
calendar_events
- campos comunes
- event_specific_data JSONB
```

Ventaja:

- Más flexible.
- Más rápido de implementar.
- Permite añadir tipos de evento fácilmente.

Desventaja:

- Menos estricto a nivel de base de datos.
- Reporting específico algo más complejo.

## Opción B — Tabla principal + tablas específicas por tipo

```text
calendar_events
delivery_events
reception_events
repair_events
improvement_events
appointment_events
demand_events
cleaning_events
```

Ventaja:

- Más limpio y estricto.
- Mejor para validaciones fuertes.
- Mejor reporting avanzado.

Desventaja:

- Más tiempo de desarrollo.
- Más migraciones.

## Recomendación

Usar un enfoque híbrido:

```text
calendar_events
event_checklist_items
event_related_entities
```

Y añadir `event_specific_data JSONB` para campos propios de cada tipo.

Esto permite empezar rápido, mantener flexibilidad y no bloquear la evolución futura.

---

# 6. Campos comunes de todos los eventos

## 6.1. Tabla `calendar_events`

Campos recomendados:

```sql
id uuid primary key
event_type text not null
title text not null
description text
status text not null
priority text
start_at timestamptz not null
end_at timestamptz
duration_minutes integer
estimated_work_days numeric
created_by_user_id uuid not null
assigned_to_user_id uuid
salesperson_id uuid
buyer_id uuid
seller_id uuid
vehicle_id uuid
task_id uuid
offer_id uuid
reservation_id uuid
location text
is_all_day boolean default false
requires_confirmation boolean default false
confirmed_at timestamptz
completed_at timestamptz
cancelled_at timestamptz
cancellation_reason text
result_notes text
internal_notes text
event_specific_data jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 6.2. Explicación de campos

| Campo                   | Descripción                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `event_type`            | Tipo de evento: entrega, recepción, reparación, mejora, cita, demanda, limpieza, otros |
| `title`                 | Título visible del evento                                                              |
| `description`           | Descripción general                                                                    |
| `status`                | Estado del evento                                                                      |
| `priority`              | Alta, media, baja                                                                      |
| `start_at`              | Día y hora de inicio                                                                   |
| `end_at`                | Día y hora de finalización si se conoce                                                |
| `duration_minutes`      | Duración aproximada                                                                    |
| `estimated_work_days`   | Para trabajos de varios días: reparación, mejora, limpieza larga                       |
| `created_by_user_id`    | Quién creó el evento                                                                   |
| `assigned_to_user_id`   | Quién es responsable                                                                   |
| `salesperson_id`        | Comercial implicado si aplica                                                          |
| `buyer_id`              | Comprador asociado si aplica                                                           |
| `seller_id`             | Vendedor asociado si aplica                                                            |
| `vehicle_id`            | Vehículo asociado si aplica                                                            |
| `task_id`               | Tarea relacionada si aplica                                                            |
| `offer_id`              | Oferta relacionada si aplica                                                           |
| `reservation_id`        | Reserva relacionada si aplica                                                          |
| `location`              | Ubicación física o virtual                                                             |
| `requires_confirmation` | Si la cita/evento requiere confirmación                                                |
| `result_notes`          | Resultado final del evento                                                             |
| `internal_notes`        | Notas internas                                                                         |
| `event_specific_data`   | Datos propios del tipo de evento                                                       |

---

# 7. Estados de evento

Todos los eventos deben compartir un sistema de estados.

## 7.1. Estados recomendados

```text
draft
scheduled
pending_confirmation
confirmed
in_progress
completed
cancelled
rescheduled
no_show
blocked
```

## 7.2. Descripción

| Estado                 | Uso                                          |
| ---------------------- | -------------------------------------------- |
| `draft`                | Evento creado pero incompleto                |
| `scheduled`            | Evento agendado                              |
| `pending_confirmation` | Falta confirmación del cliente o responsable |
| `confirmed`            | Confirmado                                   |
| `in_progress`          | En curso                                     |
| `completed`            | Completado                                   |
| `cancelled`            | Cancelado                                    |
| `rescheduled`          | Reprogramado                                 |
| `no_show`              | Cliente no se presenta                       |
| `blocked`              | Bloqueado por dependencia externa            |

---

# 8. Prioridades

```text
low
medium
high
urgent
```

Uso recomendado:

- `urgent`: entrega, reserva o incidencia crítica.
- `high`: lead caliente, entrega próxima, reparación bloqueante.
- `medium`: evento normal.
- `low`: tarea flexible o administrativa.

---

# 9. Tipo de evento: Entrega

## 9.1. Objetivo

Controlar la entrega final del vehículo al comprador.

Este evento debe tener checklist operativo, documental y de preparación.

## 9.2. Asociaciones obligatorias

```text
- Vehículo.
- Comprador.
- Responsable asignado.
- Fecha y hora.
```

## 9.3. Campos específicos

En `event_specific_data`:

```json
{
  "delivery_type": "final_delivery",
  "buyer_name": "string",
  "vehicle_id": "uuid",
  "documentation_checked": false,
  "keys_checked": false,
  "full_cleaning_done": false,
  "vehicle_review_done": false,
  "payment_confirmed": false,
  "contract_signed": false,
  "warranty_explained": false,
  "handover_explained": false,
  "all_completed": false,
  "delivery_observations": "string"
}
```

## 9.4. Checklist recomendado

Crear checklist dinámico:

```text
- Documentación controlada.
- Llaves controladas.
- Limpieza integral hecha.
- Revisión visual del vehículo.
- Pago confirmado.
- Contrato firmado.
- Garantía explicada.
- Funcionamiento básico explicado al comprador.
- Fotos/vídeo de entrega si aplica.
- Todo completado.
```

## 9.5. Reglas de validación

No se debería poder marcar una entrega como `completed` si no están completados, como mínimo:

- Documentación controlada.
- Llaves controladas.
- Limpieza hecha.
- Pago confirmado.
- Contrato firmado.
- Vehículo asociado.
- Comprador asociado.

Si algo falta, permitir completar solo con justificación manual en `result_notes`.

## 9.6. Mejoras propuestas

Añadir botón:

```text
Preparar entrega
```

Que cree automáticamente tareas relacionadas:

- Revisar documentación.
- Confirmar pago.
- Hacer limpieza integral.
- Preparar llaves.
- Revisar vehículo.
- Confirmar cita con comprador.

---

# 10. Tipo de evento: Recepción / Entrada

## 10.1. Objetivo

Registrar la entrada de un vehículo ofrecido por un cliente vendedor o captado por el equipo.

Puede representar:

- Recepción de vehículo físico.
- Entrada de oportunidad de venta.
- Captación de vehículo para publicar.
- Primera revisión de un vehículo potencial.

## 10.2. Asociaciones recomendadas

```text
- Cliente vendedor.
- Vehículo.
- Comercial asignado.
```

El vehículo puede no existir todavía como ficha completa. En ese caso, el evento debe permitir crear una ficha preliminar.

## 10.3. Campos específicos detectados en la hoja

```text
- Nombre y apellidos.
- Modelo.
- Precio mínimo cliente.
- Web / coches.net / Wallapop.
- Comercial asignado.
- Observaciones.
```

## 10.4. Campos específicos recomendados

```json
{
  "seller_full_name": "string",
  "seller_phone": "string",
  "seller_email": "string",
  "vehicle_model": "string",
  "vehicle_brand": "string",
  "vehicle_year": 2020,
  "vehicle_km": 85000,
  "minimum_seller_price": 45000,
  "expected_sale_price": 52000,
  "source_platform": "web",
  "external_listing_url": "string",
  "assigned_salesperson_id": "uuid",
  "vehicle_photos_received": false,
  "documentation_received": false,
  "physical_reception_required": true,
  "initial_observations": "string"
}
```

## 10.5. Opciones de `source_platform`

```text
web
coches_net
wallapop
milanuncios
autoscout24
facebook
referido
llamada
whatsapp
captacion_manual
otro
```

## 10.6. Resultado esperado

Desde este evento debería poder hacerse:

1. Crear cliente vendedor.
2. Crear ficha preliminar de vehículo.
3. Asignar comercial.
4. Crear tarea de tasación.
5. Crear tarea de solicitud de fotos/documentación.
6. Crear evento de revisión física.
7. Crear evento de publicación.

---

# 11. Tipo de evento: Reparación

## 11.1. Objetivo

Planificar y controlar trabajos de reparación sobre un vehículo.

## 11.2. Asociaciones obligatorias

```text
- Vehículo.
- Responsable.
- Fecha.
- Días de trabajo aproximados o duración.
```

## 11.3. Campos específicos detectados

```text
- Vehículo asociado.
- Días de trabajo aproximados.
```

## 11.4. Campos específicos recomendados

```json
{
  "repair_type": "mechanical",
  "repair_description": "string",
  "estimated_work_days": 3,
  "estimated_cost": 650,
  "approved_budget": false,
  "supplier_or_workshop": "string",
  "parts_needed": ["string"],
  "parts_ordered": false,
  "blocks_sale": true,
  "blocks_delivery": true,
  "expected_completion_date": "date",
  "repair_status": "pending",
  "repair_observations": "string"
}
```

## 11.5. Tipos de reparación

```text
mechanical
electrical
bodywork
interior
water_system
gas_system
heating
air_conditioning
tires
brakes
engine
inspection
other
```

## 11.6. Estados específicos

```text
pending
diagnosis
waiting_approval
approved
waiting_parts
in_progress
completed
cancelled
blocked
```

## 11.7. Reglas de negocio

Si `blocks_sale = true`, el vehículo debería aparecer como:

```text
No disponible para entrega inmediata
```

Si `blocks_delivery = true`, no debería poder crearse una entrega completada hasta cerrar la reparación o justificar excepción.

---

# 12. Tipo de evento: Mejora

## 12.1. Objetivo

Planificar mejoras sobre el vehículo que aumentan su valor comercial o atractivo.

Diferenciar de reparación:

- Reparación = corregir problema.
- Mejora = añadir valor o preparar mejor para venta.

## 12.2. Asociaciones obligatorias

```text
- Vehículo.
- Responsable.
- Fecha.
- Días de trabajo aproximados.
```

## 12.3. Campos detectados

```text
- Vehículo asociado.
- Días de trabajo aproximados.
```

## 12.4. Campos específicos recomendados

```json
{
  "improvement_type": "solar_panel",
  "improvement_description": "string",
  "estimated_work_days": 2,
  "estimated_cost": 800,
  "expected_value_increase": 1500,
  "commercial_reason": "string",
  "approved": false,
  "supplier_or_workshop": "string",
  "blocks_publication": false,
  "blocks_delivery": true,
  "expected_completion_date": "date",
  "improvement_status": "pending",
  "improvement_observations": "string"
}
```

## 12.5. Tipos de mejora

```text
solar_panel
lithium_battery
inverter
cleaning_upgrade
upholstery
paint
bodywork_cosmetic
new_photos
interior_upgrade
bathroom_upgrade
kitchen_upgrade
heating_upgrade
air_conditioning
accessories
other
```

## 12.6. Uso comercial

Una mejora debería poder reflejarse después en la ficha del vehículo:

```text
Mejora realizada: batería de litio + placa solar
```

Y opcionalmente actualizar:

- precio recomendado,
- descripción comercial,
- estado del vehículo,
- argumentos de venta.

---

# 13. Tipo de evento: Cita

## 13.1. Objetivo

Gestionar citas comerciales con compradores interesados.

Puede ser:

- Visita presencial.
- Llamada.
- Videollamada.
- Prueba o revisión del vehículo.
- Presentación de opciones.
- Seguimiento de operación.

## 13.2. Campos detectados

```text
- Nombre y apellidos.
- Teléfono.
- Autocaravana interesada.
- Observaciones.
```

## 13.3. Asociaciones recomendadas

```text
- Comprador.
- Vehículo interesado.
- Comercial asignado.
```

## 13.4. Campos específicos recomendados

```json
{
  "appointment_type": "vehicle_visit",
  "buyer_full_name": "string",
  "buyer_phone": "string",
  "interested_vehicle_id": "uuid",
  "interested_vehicle_name": "string",
  "appointment_channel": "in_person",
  "confirmation_required": true,
  "confirmed_by_buyer": false,
  "buyer_questions": ["string"],
  "appointment_goal": "string",
  "appointment_result": "string",
  "next_step": "string",
  "appointment_observations": "string"
}
```

## 13.5. Tipos de cita

```text
vehicle_visit
phone_call
video_call
test_drive
sales_consultation
financing_review
offer_review
delivery_preparation
post_sale
other
```

## 13.6. Acciones tras completar cita

Al marcar una cita como completada, el sistema debería pedir:

```text
- Resultado de la cita.
- Nivel de interés.
- Objeciones detectadas.
- Próxima acción.
- Fecha próxima acción.
- Si se debe enviar oferta.
- Si se debe reservar.
- Si se debe marcar como perdido.
```

## 13.7. Mejoras propuestas

Añadir plantillas rápidas:

```text
- Cita para ver vehículo.
- Llamada de seguimiento.
- Videollamada para enseñar camper.
- Revisión de financiación.
- Visita para entrega.
```

---

# 14. Tipo de evento: Demanda

## 14.1. Objetivo

Registrar una demanda de comprador, aunque todavía no haya vehículo concreto asociado.

Este tipo de evento es importante porque CampersNova puede funcionar no solo con stock actual, sino también con búsqueda activa de vehículos para compradores.

## 14.2. Campos detectados

```text
- Asociar cliente / vehículo opcional.
- Observaciones.
```

## 14.3. Asociaciones

```text
- Comprador: recomendado.
- Vehículo: opcional.
- Comercial: recomendado.
```

## 14.4. Campos específicos recomendados

```json
{
  "buyer_id": "uuid",
  "vehicle_id": null,
  "demand_summary": "string",
  "desired_vehicle_type": "gran_volumen",
  "max_budget": 50000,
  "required_seats": 4,
  "required_sleeping_places": 4,
  "must_have": ["baño", "4 plazas", "menos de 50.000 €"],
  "nice_to_have": ["placa solar", "cama fija"],
  "deal_breakers": ["más de 7 metros", "sin baño"],
  "search_active": true,
  "search_deadline": "date",
  "demand_observations": "string"
}
```

## 14.5. Casos de uso

Ejemplo:

```text
Cliente busca autocaravana perfilada de 4 plazas, máximo 55.000 €, con baño, ducha y calefacción.
No hay vehículo actual que encaje. Se crea evento de demanda para revisar nuevos vehículos entrantes.
```

## 14.6. Reglas

Un evento de demanda puede:

- crear o actualizar la ficha de comprador,
- activar alertas cuando entre un vehículo compatible,
- generar tareas de búsqueda,
- asociarse posteriormente a un vehículo encontrado.

---

# 15. Tipo de evento: Limpieza

## 15.1. Objetivo

Planificar limpieza de vehículos.

Puede ser:

- Limpieza básica.
- Limpieza integral.
- Limpieza pre-fotos.
- Limpieza pre-visita.
- Limpieza pre-entrega.
- Limpieza post-reparación.

## 15.2. Campos detectados

```text
- Asociar vehículo.
- Observaciones.
```

## 15.3. Asociaciones obligatorias

```text
- Vehículo.
- Responsable.
- Fecha.
```

## 15.4. Campos específicos recomendados

```json
{
  "cleaning_type": "full",
  "cleaning_reason": "pre_delivery",
  "interior_cleaning": false,
  "exterior_cleaning": false,
  "bathroom_cleaning": false,
  "kitchen_cleaning": false,
  "upholstery_cleaning": false,
  "windows_cleaning": false,
  "water_tank_checked": false,
  "waste_tank_checked": false,
  "photos_after_cleaning_required": true,
  "cleaning_observations": "string"
}
```

## 15.5. Tipos de limpieza

```text
basic
full
pre_delivery
pre_photos
pre_visit
post_repair
deep_cleaning
other
```

## 15.6. Checklist recomendado

```text
- Interior.
- Exterior.
- Cabina.
- Baño.
- Cocina.
- Tapicería.
- Cristales.
- Depósitos.
- Maletero/garaje.
- Fotos después de limpieza.
```

---

# 16. Tipo de evento: Otros

## 16.1. Objetivo

Permitir eventos no clasificados.

## 16.2. Campos

```json
{
  "custom_event_reason": "string",
  "observations": "string"
}
```

## 16.3. Regla recomendada

Si se crean muchos eventos de tipo `otros`, el sistema debería permitir analizar los motivos más repetidos para crear nuevos tipos específicos.

Ejemplo de alerta interna:

```text
Se han creado 25 eventos tipo otros este mes. Revisa si hace falta crear una nueva categoría.
```

---

# 17. Tipos adicionales recomendados

Estos no estaban explícitamente en la hoja, pero tienen sentido para CampersNova.

## 17.1. Seguimiento comercial

Para llamadas o acciones de seguimiento sin cita formal.

Campos:

```json
{
  "follow_up_reason": "string",
  "buyer_id": "uuid",
  "vehicle_id": "uuid",
  "expected_action": "call",
  "last_interaction_summary": "string",
  "follow_up_observations": "string"
}
```

## 17.2. Revisión documental

Para controlar documentación pendiente.

Campos:

```json
{
  "document_review_type": "buyer_or_vehicle",
  "buyer_id": "uuid",
  "seller_id": "uuid",
  "vehicle_id": "uuid",
  "pending_documents": ["DNI", "ficha técnica", "contrato"],
  "review_result": "string",
  "document_observations": "string"
}
```

## 17.3. Publicación de vehículo

Para preparar publicación en web/portales.

Campos:

```json
{
  "vehicle_id": "uuid",
  "platforms": ["web", "coches_net", "wallapop"],
  "photos_ready": false,
  "description_ready": false,
  "price_confirmed": false,
  "publication_status": "pending",
  "publication_observations": "string"
}
```

## 17.4. Fotografía / vídeo

Para organizar contenido comercial del vehículo.

Campos:

```json
{
  "vehicle_id": "uuid",
  "content_type": "photos_video",
  "photos_required": true,
  "video_required": true,
  "cleaning_required_before": true,
  "content_observations": "string"
}
```

## 17.5. Tasación

Para valorar vehículos de vendedores o entregas como parte de pago.

Campos:

```json
{
  "seller_id": "uuid",
  "vehicle_id": "uuid",
  "valuation_type": "remote_or_in_person",
  "expected_seller_price": 45000,
  "estimated_market_price": 52000,
  "recommended_offer_price": 43000,
  "valuation_result": "string",
  "valuation_observations": "string"
}
```

---

# 18. Checklists dinámicos

El sistema debe permitir que cada tipo de evento tenga checklist propio.

## 18.1. Tabla `event_checklist_items`

```sql
id uuid primary key
event_id uuid references calendar_events(id)
label text not null
description text
is_required boolean default false
is_completed boolean default false
completed_by_user_id uuid
completed_at timestamptz
sort_order integer
created_at timestamptz
updated_at timestamptz
```

## 18.2. Plantillas de checklist

Debe existir una forma de generar checklists por tipo de evento.

Ejemplo:

### Entrega

```text
- Documentación controlada.
- Llaves controladas.
- Limpieza integral hecha.
- Pago confirmado.
- Contrato firmado.
- Garantía explicada.
- Todo completado.
```

### Limpieza

```text
- Interior limpio.
- Exterior limpio.
- Baño limpio.
- Cocina limpia.
- Tapicería revisada.
- Fotos posteriores realizadas.
```

### Reparación

```text
- Diagnóstico realizado.
- Presupuesto aprobado.
- Piezas pedidas.
- Reparación ejecutada.
- Prueba final realizada.
- Vehículo desbloqueado.
```

---

# 19. Relaciones múltiples

A veces un evento puede estar asociado a más de una entidad.

Ejemplo:

- Una entrega está asociada a comprador + vehículo + reserva.
- Una recepción está asociada a vendedor + vehículo.
- Una demanda puede estar asociada a comprador y, más adelante, a varios vehículos candidatos.
- Una cita puede estar asociada a comprador + uno o varios vehículos.

Para no limitar el sistema, se recomienda una tabla flexible.

## 19.1. Tabla `event_related_entities`

```sql
id uuid primary key
event_id uuid references calendar_events(id)
entity_type text not null
entity_id uuid not null
relationship_type text
created_at timestamptz
```

## 19.2. Ejemplos

```json
[
  {
    "entity_type": "buyer",
    "entity_id": "uuid",
    "relationship_type": "main_buyer"
  },
  {
    "entity_type": "vehicle",
    "entity_id": "uuid",
    "relationship_type": "vehicle_to_deliver"
  },
  {
    "entity_type": "reservation",
    "entity_id": "uuid",
    "relationship_type": "related_reservation"
  }
]
```

---

# 20. Tareas vs eventos

Es importante diferenciar:

## 20.1. Evento

Tiene fecha/hora en calendario.

Ejemplos:

- Entrega el martes a las 17:00.
- Cita con comprador el viernes a las 10:30.
- Reparación prevista del 8 al 10 de julio.

## 20.2. Tarea

Puede o no tener fecha exacta.

Ejemplos:

- Pedir DNI.
- Revisar documentación.
- Enviar tres opciones.
- Confirmar limpieza.
- Llamar al cliente.

## 20.3. Relación recomendada

Un evento puede generar tareas.

Ejemplo entrega:

Evento:

```text
Entrega CN-024 a Juan Pérez — viernes 17:00
```

Tareas generadas:

```text
- Confirmar pago.
- Revisar contrato.
- Preparar llaves.
- Hacer limpieza integral.
- Revisar documentación.
```

---

# 21. Automatizaciones recomendadas

## 21.1. Al crear una entrega

Crear automáticamente checklist y tareas:

- Documentación.
- Llaves.
- Limpieza.
- Revisión final.
- Confirmación con comprador.

Actualizar vehículo:

```text
delivery_scheduled = true
```

Actualizar comprador:

```text
lead_status = delivery_scheduled
```

## 21.2. Al completar una entrega

Actualizar:

```text
vehicle_status = delivered
buyer_status = sale_closed
reservation_status = completed
```

Crear tarea postventa:

```text
Llamar al cliente 7 días después de la entrega.
```

## 21.3. Al crear recepción / entrada

Si no existe vehículo:

- crear ficha preliminar de vehículo,
- crear ficha de vendedor si no existe,
- asignar comercial,
- crear tarea de tasación o revisión.

## 21.4. Al crear reparación

Actualizar vehículo:

```text
vehicle_availability_status = in_repair
```

Si bloquea venta:

```text
is_available_for_sale = false
```

## 21.5. Al completar reparación

Actualizar vehículo:

```text
vehicle_availability_status = available_or_pending_review
```

Crear tarea:

```text
Revisar si el vehículo puede publicarse o entregarse.
```

## 21.6. Al crear mejora

Actualizar vehículo:

```text
vehicle_preparation_status = improvement_planned
```

Al completarse:

- actualizar ficha comercial,
- recalcular precio recomendado si aplica,
- crear tarea de fotos si la mejora es visual o comercialmente relevante.

## 21.7. Al crear limpieza pre-entrega

Asociarla a la entrega si existe.

No permitir completar entrega si limpieza obligatoria no está completada, salvo justificación.

## 21.8. Al crear demanda

Crear o actualizar ficha de comprador.

Si entran vehículos que encajan, generar alerta:

```text
Nuevo vehículo compatible con demanda activa.
```

---

# 22. IA dentro del calendario

El módulo debe estar preparado para IA, aunque no se implemente todo desde el inicio.

## 22.1. Usos IA

- Crear evento desde texto natural.
- Extraer fecha, hora, duración y tipo de evento.
- Asociar automáticamente cliente o vehículo si se detectan.
- Resumir resultado de cita.
- Proponer próxima acción.
- Detectar si una cita debería generar oferta, tarea o seguimiento.
- Detectar si un evento está incompleto.
- Detectar conflicto de calendario.
- Sugerir duración aproximada según tipo.
- Crear checklist automáticamente.

## 22.2. Ejemplos

Entrada natural:

```text
Mañana a las 17:00 entrega de la Challenger a Juan, revisar documentación, llaves y limpieza.
```

Salida esperada:

```json
{
  "event_type": "delivery",
  "title": "Entrega Challenger a Juan",
  "start_at": "2026-07-08T17:00:00+02:00",
  "duration_minutes": 60,
  "buyer_detected": "Juan",
  "vehicle_detected": "Challenger",
  "checklist": ["Documentación controlada", "Llaves controladas", "Limpieza integral hecha"]
}
```

## 22.3. Confirmación humana

La IA puede sugerir, pero no debe:

- completar entregas,
- verificar documentos,
- confirmar pagos,
- cerrar ventas,
- cancelar eventos importantes,
- modificar datos críticos sin revisión.

---

# 23. Vistas del calendario

## 23.1. Vista mensual

Para visión global de actividad.

Debe permitir filtrar por:

- tipo de evento,
- responsable,
- vehículo,
- comprador,
- estado,
- prioridad.

## 23.2. Vista semanal

Principal para operación diaria.

Debe mostrar:

- eventos por día,
- hora,
- responsable,
- tipo,
- estado,
- vehículo/cliente asociado.

## 23.3. Vista diaria

Para gestión operativa.

Debe destacar:

- entregas del día,
- citas del día,
- reparaciones en curso,
- limpiezas pendientes,
- eventos bloqueados,
- tareas vencidas.

## 23.4. Vista por vehículo

En la ficha del vehículo debe verse:

```text
Calendario relacionado con este vehículo
```

Incluye:

- recepción,
- reparación,
- mejora,
- limpieza,
- citas,
- entrega,
- fotografía,
- publicación.

## 23.5. Vista por comprador

En la ficha del comprador debe verse:

```text
Eventos relacionados con este comprador
```

Incluye:

- citas,
- llamadas programadas,
- visitas,
- demandas,
- ofertas,
- entrega si compra.

## 23.6. Vista por vendedor

En la ficha del vendedor debe verse:

- recepción,
- tasación,
- revisión,
- documentación,
- publicación,
- seguimiento.

---

# 24. UX de creación de evento

## 24.1. Flujo recomendado

1. Usuario pulsa "Crear evento".
2. Selecciona tipo de evento.
3. El formulario cambia según el tipo.
4. Rellena fecha, hora y duración.
5. Selecciona responsable.
6. Asocia cliente y/o vehículo.
7. Completa campos específicos.
8. Se genera checklist automáticamente.
9. Guarda evento.
10. El sistema crea tareas asociadas si aplica.

## 24.2. Campos comunes visibles al crear

```text
- Tipo de evento.
- Título.
- Fecha.
- Hora.
- Duración aproximada.
- Responsable.
- Cliente asociado.
- Vehículo asociado.
- Prioridad.
- Observaciones.
```

## 24.3. Campos dinámicos

Según tipo:

- Entrega: checklist documental y operativo.
- Recepción: datos de vendedor, modelo, precio mínimo, canal.
- Reparación: tipo, días, coste, bloquea venta/entrega.
- Mejora: tipo, coste, impacto comercial.
- Cita: teléfono, vehículo interesado, confirmación.
- Demanda: necesidad del comprador.
- Limpieza: tipo y checklist.
- Otros: motivo y observaciones.

---

# 25. Validaciones por tipo

## 25.1. Entrega

Obligatorio:

- comprador,
- vehículo,
- responsable,
- fecha y hora,
- duración,
- checklist generado.

Para completar:

- documentación controlada,
- llaves controladas,
- limpieza hecha,
- contrato firmado,
- pago confirmado.

## 25.2. Recepción / Entrada

Obligatorio:

- nombre vendedor o cliente asociado,
- modelo o vehículo asociado,
- comercial asignado,
- origen/canal,
- fecha.

Recomendado:

- precio mínimo cliente,
- teléfono,
- observaciones.

## 25.3. Reparación

Obligatorio:

- vehículo,
- descripción,
- responsable,
- días aproximados o duración,
- estado.

Recomendado:

- coste estimado,
- si bloquea venta,
- si bloquea entrega.

## 25.4. Mejora

Obligatorio:

- vehículo,
- descripción,
- responsable,
- días aproximados.

Recomendado:

- coste,
- mejora esperada,
- impacto comercial.

## 25.5. Cita

Obligatorio:

- comprador o nombre/teléfono,
- responsable/comercial,
- fecha y hora,
- duración.

Recomendado:

- vehículo interesado,
- objetivo de la cita,
- canal.

## 25.6. Demanda

Obligatorio:

- comprador o nombre/teléfono,
- observaciones/necesidad,
- responsable.

Recomendado:

- presupuesto,
- tipo vehículo,
- plazas,
- fecha de seguimiento.

## 25.7. Limpieza

Obligatorio:

- vehículo,
- responsable,
- fecha,
- tipo de limpieza.

Recomendado:

- motivo,
- checklist.

---

# 26. Notificaciones y recordatorios

## 26.1. Recordatorios básicos

El sistema debe poder recordar:

- 24 h antes.
- 2 h antes.
- 30 min antes.
- Personalizado.

## 26.2. Notificaciones recomendadas

Notificar al responsable cuando:

- se le asigna un evento,
- cambia la hora,
- se cancela,
- se aproxima una entrega,
- una tarea asociada vence,
- un evento está incompleto,
- una entrega tiene checklist pendiente,
- una reparación se retrasa,
- una cita no tiene resultado registrado.

## 26.3. Alertas críticas

- Entrega hoy con documentación pendiente.
- Entrega mañana sin limpieza completada.
- Cita caliente sin seguimiento.
- Reparación bloqueando vehículo más días de los estimados.
- Vehículo reservado sin entrega agendada.
- Demanda activa con vehículo compatible nuevo.

---

# 27. Reporting

El calendario debe permitir medir operación y ventas.

## 27.1. Métricas operativas

- Entregas por semana.
- Entregas completadas vs canceladas.
- Limpiezas pendientes.
- Reparaciones en curso.
- Días medios de reparación.
- Días medios de mejora.
- Eventos por responsable.
- Eventos vencidos.
- Eventos bloqueados.

## 27.2. Métricas comerciales

- Citas agendadas.
- Citas realizadas.
- No-shows.
- Visitas por vehículo.
- Visitas por comprador.
- Citas que terminan en oferta.
- Citas que terminan en reserva.
- Demandas activas.
- Demandas cubiertas.
- Tiempo desde demanda hasta propuesta de vehículo.

## 27.3. Métricas de calidad

- Eventos sin responsable.
- Eventos sin asociación.
- Entregas completadas con checklist incompleto.
- Reparaciones sin fecha prevista.
- Citas sin resultado.
- Leads calientes sin evento próximo.

---

# 28. Integración con fichas existentes

## 28.1. Ficha de comprador

Debe mostrar:

- Próxima cita.
- Próxima acción.
- Eventos pasados.
- Demandas activas.
- Vehículos visitados.
- Entrega si aplica.
- Timeline completo.

## 28.2. Ficha de vendedor

Debe mostrar:

- Recepción / entrada.
- Tasación.
- Revisión documental.
- Publicación.
- Seguimiento.
- Eventos asociados al vehículo ofrecido.

## 28.3. Ficha de vehículo

Debe mostrar:

- Entrada.
- Reparaciones.
- Mejoras.
- Limpiezas.
- Citas de compradores.
- Fotos/vídeos.
- Publicaciones.
- Reserva.
- Entrega.

## 28.4. Dashboard principal

Debe mostrar:

- Eventos de hoy.
- Eventos de mañana.
- Próximas entregas.
- Citas comerciales.
- Reparaciones en curso.
- Limpiezas pendientes.
- Alertas críticas.

---

# 29. Ejemplos de eventos

## 29.1. Entrega

```json
{
  "event_type": "delivery",
  "title": "Entrega Challenger Graphite a Juan Pérez",
  "status": "scheduled",
  "priority": "high",
  "start_at": "2026-07-10T17:00:00+02:00",
  "duration_minutes": 90,
  "created_by_user_id": "uuid",
  "assigned_to_user_id": "uuid",
  "buyer_id": "uuid",
  "vehicle_id": "uuid",
  "event_specific_data": {
    "documentation_checked": false,
    "keys_checked": false,
    "full_cleaning_done": false,
    "payment_confirmed": false,
    "contract_signed": false,
    "warranty_explained": false,
    "all_completed": false,
    "delivery_observations": "Cliente vendrá con su pareja. Explicar calefacción y sistema eléctrico."
  }
}
```

## 29.2. Recepción / Entrada

```json
{
  "event_type": "reception",
  "title": "Entrada vehículo — Benimar Tessoro",
  "status": "scheduled",
  "priority": "medium",
  "start_at": "2026-07-11T10:00:00+02:00",
  "duration_minutes": 60,
  "created_by_user_id": "uuid",
  "assigned_to_user_id": "uuid",
  "seller_id": "uuid",
  "event_specific_data": {
    "seller_full_name": "María López",
    "seller_phone": "+34600000000",
    "vehicle_model": "Benimar Tessoro",
    "minimum_seller_price": 48000,
    "source_platform": "wallapop",
    "external_listing_url": "https://...",
    "assigned_salesperson_id": "uuid",
    "initial_observations": "Quiere vender rápido. Dice que tiene revisión reciente."
  }
}
```

## 29.3. Reparación

```json
{
  "event_type": "repair",
  "title": "Reparación sistema eléctrico — CN-024",
  "status": "scheduled",
  "priority": "high",
  "start_at": "2026-07-12T09:00:00+02:00",
  "estimated_work_days": 2,
  "vehicle_id": "uuid",
  "assigned_to_user_id": "uuid",
  "event_specific_data": {
    "repair_type": "electrical",
    "repair_description": "Revisar inversor y batería auxiliar.",
    "estimated_cost": 350,
    "blocks_delivery": true,
    "expected_completion_date": "2026-07-14",
    "repair_status": "pending"
  }
}
```

## 29.4. Cita

```json
{
  "event_type": "appointment",
  "title": "Cita con comprador — Ver McLouis MC4",
  "status": "confirmed",
  "priority": "high",
  "start_at": "2026-07-09T18:00:00+02:00",
  "duration_minutes": 60,
  "buyer_id": "uuid",
  "vehicle_id": "uuid",
  "assigned_to_user_id": "uuid",
  "event_specific_data": {
    "appointment_type": "vehicle_visit",
    "buyer_full_name": "Carlos Sánchez",
    "buyer_phone": "+34611111111",
    "appointment_channel": "in_person",
    "confirmed_by_buyer": true,
    "appointment_goal": "Ver distribución y revisar opción de financiación.",
    "appointment_observations": "Cliente caliente. Presupuesto máximo 55.000 €."
  }
}
```

## 29.5. Demanda

```json
{
  "event_type": "demand",
  "title": "Demanda activa — Perfilada 4 plazas hasta 55.000 €",
  "status": "scheduled",
  "priority": "medium",
  "start_at": "2026-07-15T10:00:00+02:00",
  "duration_minutes": 30,
  "buyer_id": "uuid",
  "assigned_to_user_id": "uuid",
  "event_specific_data": {
    "desired_vehicle_type": "perfilada",
    "max_budget": 55000,
    "required_seats": 4,
    "required_sleeping_places": 4,
    "must_have": ["baño", "ducha", "calefacción"],
    "nice_to_have": ["garaje grande", "placa solar"],
    "search_active": true,
    "demand_observations": "Revisar nuevos vehículos entrantes cada semana."
  }
}
```

---

# 30. API sugerida

## 30.1. Eventos

```http
GET /calendar/events
POST /calendar/events
GET /calendar/events/:id
PATCH /calendar/events/:id
DELETE /calendar/events/:id
POST /calendar/events/:id/complete
POST /calendar/events/:id/cancel
POST /calendar/events/:id/reschedule
```

## 30.2. Checklists

```http
GET /calendar/events/:id/checklist
POST /calendar/events/:id/checklist
PATCH /calendar/events/:id/checklist/:itemId
POST /calendar/events/:id/checklist/generate
```

## 30.3. Relaciones

```http
GET /calendar/events/:id/related
POST /calendar/events/:id/related
DELETE /calendar/events/:id/related/:relationId
```

## 30.4. Vistas

```http
GET /calendar/events?view=month&from=2026-07-01&to=2026-07-31
GET /calendar/events?view=week&from=2026-07-06&to=2026-07-12
GET /calendar/events?vehicle_id=uuid
GET /calendar/events?buyer_id=uuid
GET /calendar/events?assigned_to_user_id=uuid
GET /calendar/events?event_type=delivery
```

## 30.5. IA

```http
POST /calendar/events/ai/parse
POST /calendar/events/:id/ai/summarize
POST /calendar/events/:id/ai/suggest-next-actions
```

---

# 31. Componentes frontend sugeridos

## 31.1. Componentes principales

```text
CalendarPage
CalendarToolbar
CalendarMonthView
CalendarWeekView
CalendarDayView
CalendarEventCard
CalendarEventModal
CalendarEventForm
EventTypeSelector
EventDynamicFields
EventChecklist
EventRelatedEntities
EventStatusBadge
EventPriorityBadge
EventTimeline
```

## 31.2. Formularios específicos

```text
DeliveryEventFields
ReceptionEventFields
RepairEventFields
ImprovementEventFields
AppointmentEventFields
DemandEventFields
CleaningEventFields
OtherEventFields
```

## 31.3. Componentes reutilizables

```text
BuyerSelect
SellerSelect
VehicleSelect
UserSelect
DateTimePicker
DurationInput
ChecklistEditor
RelatedEntityPicker
StatusSelector
PrioritySelector
```

---

# 32. Criterios de aceptación

El módulo se considera correctamente implementado cuando:

## 32.1. Funcionalidad base

- Se puede crear un evento con tipo, fecha, hora, duración y responsable.
- Se puede asociar a comprador, vendedor y/o vehículo.
- Se pueden ver eventos en vista diaria, semanal y mensual.
- Se pueden filtrar por tipo, responsable, vehículo, cliente y estado.
- Se puede cambiar estado del evento.
- Se puede reprogramar.
- Se puede cancelar con motivo.
- Se puede marcar como completado con resultado.

## 32.2. Tipos específicos

- Entrega tiene checklist documental y operativo.
- Recepción permite datos de vendedor, modelo, precio mínimo y canal.
- Reparación permite vehículo y días de trabajo.
- Mejora permite vehículo y días de trabajo.
- Cita permite nombre, teléfono, vehículo interesado y observaciones.
- Demanda permite cliente/vehículo opcional y observaciones.
- Limpieza permite vehículo y checklist.
- Otros permite observaciones.

## 32.3. Integraciones internas

- En ficha de comprador aparecen sus eventos.
- En ficha de vehículo aparecen sus eventos.
- En ficha de vendedor aparecen sus eventos.
- Los eventos pueden generar tareas.
- Las entregas pueden bloquearse si faltan checks críticos.
- Las reparaciones pueden marcar un vehículo como no disponible.

## 32.4. Calidad operativa

- No hay eventos sin responsable.
- No hay entregas sin vehículo.
- No hay citas sin comprador o teléfono.
- No hay reparaciones sin vehículo.
- El sistema avisa de eventos vencidos.
- El sistema avisa de entregas incompletas.
- El sistema registra quién creó y quién completó cada evento.

---

# 33. Plan de implementación por fases

## Fase 1 — Calendario base

- Crear tabla `calendar_events`.
- Crear CRUD de eventos.
- Implementar tipos principales.
- Implementar fecha, hora, duración, responsable y observaciones.
- Vista semanal y diaria.
- Filtros básicos.

## Fase 2 — Asociaciones CRM

- Asociar eventos a comprador.
- Asociar eventos a vendedor.
- Asociar eventos a vehículo.
- Mostrar eventos en fichas relacionadas.
- Añadir timeline.

## Fase 3 — Formularios dinámicos por tipo

- Entrega.
- Recepción.
- Reparación.
- Mejora.
- Cita.
- Demanda.
- Limpieza.
- Otros.

## Fase 4 — Checklists

- Crear `event_checklist_items`.
- Plantillas por tipo de evento.
- Validaciones para completar entregas.
- Checklists para limpieza, reparación y entrega.

## Fase 5 — Automatizaciones

- Crear tareas automáticas.
- Actualizar estado del vehículo según reparación/mejora/entrega.
- Alertas de eventos vencidos.
- Alertas de entrega incompleta.
- Recordatorios.

## Fase 6 — Reporting

- Métricas de eventos.
- Métricas de entregas.
- Métricas de citas.
- Métricas de reparaciones.
- Métricas por responsable.

## Fase 7 — IA

- Crear evento desde texto natural.
- Extraer cliente/vehículo.
- Sugerir checklist.
- Resumir resultado.
- Proponer próxima acción.

---

# 34. Decisiones importantes para desarrollo

## 34.1. No hacer calendario aislado

El calendario debe integrarse desde el inicio con:

- compradores,
- vendedores,
- vehículos,
- tareas,
- ofertas,
- reservas.

## 34.2. No usar solo texto libre

Aunque todos los eventos tengan observaciones, los campos importantes deben ser estructurados:

- tipo de evento,
- responsable,
- fecha,
- duración,
- estado,
- vehículo,
- cliente,
- precio mínimo,
- días de trabajo,
- checklist.

## 34.3. Permitir eventos sin vehículo solo cuando tenga sentido

Ejemplos:

- Demanda.
- Cita inicial.
- Seguimiento comercial.
- Otros.

Pero no permitirlo en:

- Entrega.
- Reparación.
- Mejora.
- Limpieza.

## 34.4. Separar comprador y vendedor

En CampersNova puede haber:

- cliente comprador,
- cliente vendedor,
- persona que entrega vehículo,
- persona que compra vehículo.

No mezclar todos bajo una única lógica si el CRM ya distingue roles.

## 34.5. Preparar para IA, pero no depender de IA

El sistema debe funcionar manualmente perfecto. La IA debe mejorar velocidad y calidad, no ser imprescindible.

---

# 35. Resumen final

El módulo de calendario de CampersNova debe ser una agenda operativa conectada al CRM.

Debe permitir crear eventos como:

```text
- Entrega
- Recepción / Entrada
- Reparación
- Mejora
- Cita
- Demanda
- Limpieza
- Otros
```

Todos deben tener:

```text
- quién lo crea,
- a quién se asigna,
- día,
- hora,
- duración aproximada,
- estado,
- observaciones,
- asociaciones con cliente y/o vehículo cuando aplique.
```

La mejora clave respecto a una agenda normal es que cada evento debe tener lógica propia:

- entrega con checklist,
- recepción con datos de captación,
- reparación con días de trabajo,
- mejora con impacto comercial,
- cita con comprador y vehículo interesado,
- demanda como necesidad activa,
- limpieza con vehículo y checklist.

Este calendario debe ayudar a que CampersNova tenga control real de la operación comercial y logística, evitando depender de memoria, WhatsApps sueltos o notas desordenadas.
