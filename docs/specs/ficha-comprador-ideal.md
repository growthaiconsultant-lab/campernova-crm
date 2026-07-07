# CampersNova CRM — Ficha de Comprador Ideal

Documento de especificación funcional y técnica para implementar la ficha de comprador en el CRM de **campersnova.com**.

## 1. Objetivo del módulo

La ficha de comprador debe ser el núcleo comercial del CRM de CampersNova. No debe limitarse a guardar datos de contacto; debe permitir:

1. Calificar compradores.
2. Entender necesidades reales.
3. Hacer matching con vehículos disponibles o futuros.
4. Priorizar leads con mayor probabilidad de cierre.
5. Gestionar seguimiento comercial.
6. Registrar interacciones, objeciones, documentación y ofertas.
7. Alimentar inteligencia de negocio para pricing, adquisición, stock y estrategia comercial.
8. Permitir automatización con IA: resumen de llamadas, extracción de campos, recomendación de vehículos y próximas acciones.

La ficha debe estar pensada para un negocio de intermediación, compraventa y captación de demanda de campers, autocaravanas y vehículos vivienda.

---

# 2. Principios de diseño

## 2.1. No diseñar solo para MVP

Este documento no busca una versión mínima. Busca una ficha robusta, escalable y preparada para:

- CRM interno.
- Automatización de llamadas.
- Matching comprador-vehículo.
- Scoring comercial.
- Reporting.
- Seguimiento multicanal.
- Captura de demanda.
- Inteligencia de mercado.
- Operaciones con financiación.
- Gestión documental.
- Futuro marketplace.

La implementación puede hacerse por fases, pero el modelo mental y de datos debe nacer bien diseñado.

## 2.2. Campo estructurado + resumen humano

La ficha debe combinar:

- Campos estructurados: útiles para filtros, scoring, automatizaciones y reporting.
- Campos de texto libre: útiles para contexto comercial.
- Resúmenes generados por IA: útiles para leer rápido el estado del comprador.

Ejemplo:

```text
Busca una camper gran volumen para viajar en pareja y ocasionalmente con un niño.
Presupuesto máximo 45.000 €. Quiere financiar parte de la operación con entrada de 4.000 €.
Necesita baño, ducha interior y cama fija. Valora autonomía eléctrica porque quiere dormir fuera de camping.
Está en Barcelona, pero se desplazaría si el vehículo encaja. Compra prevista en 1-2 meses.
```

Debajo, los mismos datos deben existir como campos estructurados:

```json
{
  "vehicle_type": "gran_volumen",
  "max_budget": 45000,
  "financing_required": true,
  "available_down_payment": 4000,
  "needs_bathroom": true,
  "needs_indoor_shower": true,
  "needs_fixed_bed": true,
  "high_electrical_autonomy": true,
  "location_province": "Barcelona",
  "purchase_timeline": "1_2_months"
}
```

---

# 3. Estructura principal de la ficha

La ficha de comprador debe dividirse en las siguientes secciones:

1. Vista resumen.
2. Datos básicos.
3. Estado comercial.
4. Perfil y contexto del comprador.
5. Necesidad de compra.
6. Preferencias del vehículo.
7. Presupuesto y financiación.
8. Vehículo actual / entrega como parte de pago.
9. Interacciones comerciales.
10. Matching con vehículos.
11. Ofertas, visitas y reservas.
12. Documentación y operación.
13. Inteligencia comercial.
14. Automatizaciones e IA.
15. Historial y auditoría.

---

# 4. Vista resumen

La vista resumen es la parte superior de la ficha. Debe permitir a un comercial entender el caso en menos de 20 segundos.

## 4.1. Campos visibles en resumen

| Campo                  | Tipo             | Descripción                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------------ |
| Nombre comprador       | text             | Nombre completo                                                    |
| Teléfono               | phone            | Teléfono principal                                                 |
| Email                  | email            | Email principal                                                    |
| Ciudad / provincia     | text             | Ubicación principal                                                |
| Estado comercial       | enum             | Nuevo, contactado, cualificado, etc.                               |
| Temperatura            | enum             | Caliente, templado, frío                                           |
| Score comprador        | number           | Puntuación de calidad del lead                                     |
| Probabilidad de cierre | percentage       | Estimación comercial                                               |
| Presupuesto máximo     | money            | Importe máximo declarado                                           |
| Tipo buscado           | enum/multiselect | Camper, autocaravana, gran volumen, perfilada, integral, capuchina |
| Plazas viaje           | number           | Plazas homologadas necesarias                                      |
| Plazas dormir          | number           | Plazas de pernocta necesarias                                      |
| Financiación           | enum             | Sí, no, no sabe                                                    |
| Urgencia               | enum             | Inmediata, este mes, 1-3 meses, 3-6 meses, sin prisa               |
| Próxima acción         | enum/text        | Llamar, enviar opciones, pedir docs, agendar visita                |
| Fecha próxima acción   | datetime         | Fecha y hora                                                       |
| Comercial asignado     | relation/user    | Responsable interno                                                |
| Última interacción     | datetime         | Último contacto registrado                                         |
| Vehículos recomendados | relation/list    | Top matches                                                        |
| Estado documentación   | enum             | Pendiente, parcial, completa                                       |

## 4.2. Resumen IA

Campo destacado:

```text
ai_buyer_summary
```

Debe generarse o actualizarse tras:

- Llamadas.
- WhatsApps importantes.
- Emails relevantes.
- Cambios manuales importantes.
- Nueva valoración financiera.
- Nuevo matching con vehículos.

Debe ser breve, comercial y accionable.

Ejemplo:

```text
Comprador con intención alta. Busca gran volumen de 4 plazas para familia con dos niños.
Presupuesto máximo 55.000 €, ideal 48.000 €. Necesita financiación con entrada aproximada de 8.000 €.
Prioriza baño completo, literas o cama fija, calefacción y buen maletero.
Está comparando con dos concesionarios. Objeción principal: precio y garantía.
Próxima acción recomendada: enviar 2 opciones ajustadas y una alternativa ligeramente superior justificando valor.
```

---

# 5. Datos básicos del comprador

## 5.1. Campos

| Campo                     |          Tipo | Obligatorio | Descripción                                                                                             |
| ------------------------- | ------------: | ----------: | ------------------------------------------------------------------------------------------------------- |
| id                        |          uuid |          sí | Identificador interno                                                                                   |
| first_name                |          text |          sí | Nombre                                                                                                  |
| last_name                 |          text |          no | Apellidos                                                                                               |
| full_name                 | computed/text |          sí | Nombre completo                                                                                         |
| phone_primary             |         phone |          sí | Teléfono principal                                                                                      |
| phone_secondary           |         phone |          no | Teléfono secundario                                                                                     |
| email_primary             |         email | recomendado | Email principal                                                                                         |
| email_secondary           |         email |          no | Email secundario                                                                                        |
| preferred_contact_channel |          enum |          sí | Teléfono, WhatsApp, email                                                                               |
| preferred_language        |          enum |          no | Español, catalán, inglés, francés, alemán, otro                                                         |
| country                   |          text |          sí | País                                                                                                    |
| region                    |          text |          no | Comunidad autónoma                                                                                      |
| province                  |          text |          sí | Provincia                                                                                               |
| city                      |          text |          no | Ciudad                                                                                                  |
| postal_code               |          text |          no | Código postal                                                                                           |
| source_channel            |          enum |          sí | Web, WhatsApp, llamada, Google Ads, Meta Ads, SEO, referido, Wallapop, Milanuncios, concesionario, otro |
| source_campaign           |          text |          no | Campaña de captación                                                                                    |
| source_medium             |          text |          no | Medio UTM                                                                                               |
| source_content            |          text |          no | Contenido UTM                                                                                           |
| referrer_url              |           url |          no | URL de origen                                                                                           |
| landing_page              |           url |          no | Página de aterrizaje                                                                                    |
| created_at                |      datetime |          sí | Fecha de creación                                                                                       |
| updated_at                |      datetime |          sí | Fecha de actualización                                                                                  |
| assigned_salesperson_id   | relation/user |          sí | Comercial asignado                                                                                      |
| duplicate_status          |          enum |          no | Único, posible duplicado, duplicado confirmado                                                          |

## 5.2. Reglas de deduplicación

El CRM debe detectar duplicados por:

1. Teléfono normalizado.
2. Email normalizado.
3. Combinación nombre + teléfono parcial.
4. Combinación nombre + provincia + email similar.
5. WhatsApp ID si existe integración futura.

Regla recomendada:

```text
El teléfono principal es el identificador comercial más importante.
El email es segundo identificador.
Nunca crear automáticamente un nuevo comprador si el teléfono ya existe.
```

---

# 6. Estado comercial del lead

## 6.1. Pipeline recomendado

Estados:

1. `new` — Nuevo lead.
2. `pending_first_contact` — Pendiente primer contacto.
3. `contacted` — Contactado.
4. `qualified` — Cualificado.
5. `needs_discovery` — Falta discovery.
6. `actively_searching` — En búsqueda activa.
7. `vehicles_proposed` — Vehículos enviados.
8. `visit_scheduled` — Visita agendada.
9. `visited` — Visita realizada.
10. `offer_sent` — Oferta enviada.
11. `negotiation` — Negociación.
12. `financing_review` — Estudio de financiación.
13. `reservation_pending` — Pendiente reserva.
14. `reserved` — Reservado.
15. `sale_closed` — Venta cerrada.
16. `lost` — Perdido.
17. `nurturing` — Nutrición futura.
18. `unresponsive` — No responde.
19. `invalid` — Lead inválido.

## 6.2. Campos comerciales

| Campo                | Tipo          | Descripción                                                                                                |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| lead_status          | enum          | Estado principal                                                                                           |
| lead_temperature     | enum          | hot, warm, cold                                                                                            |
| lead_priority        | enum          | high, medium, low                                                                                          |
| close_probability    | integer 0-100 | Probabilidad estimada                                                                                      |
| buyer_score          | integer 0-100 | Score global                                                                                               |
| qualification_status | enum          | pendiente, parcial, cualificado, no cualificado                                                            |
| lost_reason          | enum          | Precio, financiación, compró a otro, no responde, aplaza compra, no hay stock, expectativas irreales, otro |
| lost_reason_notes    | text          | Detalle del motivo                                                                                         |
| next_action_type     | enum          | llamar, whatsapp, email, enviar vehículos, pedir docs, agendar visita, seguimiento, cerrar                 |
| next_action_due_at   | datetime      | Fecha de próxima acción                                                                                    |
| last_contacted_at    | datetime      | Último contacto                                                                                            |
| first_response_at    | datetime      | Primera respuesta del lead                                                                                 |
| sales_owner_notes    | text          | Notas internas del comercial                                                                               |

## 6.3. Reglas de calidad

Un lead no debería pasar a `qualified` si no tiene, como mínimo:

- Presupuesto máximo.
- Tipo de vehículo buscado.
- Plazas necesarias.
- Forma de pago o necesidad de financiación.
- Ubicación.
- Urgencia estimada.
- Teléfono válido.
- Próxima acción definida.

---

# 7. Perfil y contexto del comprador

Esta sección ayuda a entender el “por qué” de la compra.

## 7.1. Campos

| Campo                      | Tipo             | Descripción                                                                                     |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| buyer_type                 | enum             | particular, autónomo, empresa, pareja, familia, jubilado                                        |
| main_purchase_motivation   | enum             | ocio, familia, teletrabajo, vivir viajando, jubilación, alquiler, negocio, sustitución vehículo |
| experience_level           | enum             | principiante, medio, experto                                                                    |
| has_owned_camper_before    | boolean          | Ha tenido camper/autocaravana                                                                   |
| current_vehicle_experience | text             | Experiencia previa                                                                              |
| travel_style               | enum/multiselect | camping, libre, montaña, playa, internacional, fines de semana, largas rutas                    |
| trips_per_year_estimate    | integer          | Viajes estimados al año                                                                         |
| average_trip_duration      | enum             | fin de semana, 1 semana, 2-3 semanas, meses                                                     |
| remote_work_use            | boolean          | Usará para teletrabajo                                                                          |
| winter_use                 | boolean          | Uso en invierno                                                                                 |
| off_grid_use               | enum             | bajo, medio, alto                                                                               |
| travels_with_children      | boolean          | Viaja con niños                                                                                 |
| number_of_children         | integer          | Número de niños                                                                                 |
| children_ages              | text             | Edades aproximadas                                                                              |
| travels_with_pets          | boolean          | Viaja con mascotas                                                                              |
| pet_type                   | text             | Perro, gato, etc.                                                                               |
| accessibility_needs        | text             | Necesidades especiales                                                                          |
| parking_constraints        | text             | Altura, longitud, garaje, calle estrecha                                                        |
| buyer_context_notes        | text             | Notas cualitativas                                                                              |

---

# 8. Necesidad de compra

Esta es una de las secciones más importantes para el matching.

## 8.1. Tipo de vehículo buscado

| Campo                         | Tipo        |
| ----------------------------- | ----------- |
| desired_vehicle_categories    | multiselect |
| primary_vehicle_category      | enum        |
| acceptable_vehicle_categories | multiselect |
| rejected_vehicle_categories   | multiselect |

Opciones recomendadas:

- Camper pequeña.
- Camper mediana.
- Gran volumen.
- Autocaravana perfilada.
- Autocaravana integral.
- Autocaravana capuchina.
- Camper 4x4.
- Furgón camperizado.
- Vehículo vivienda artesanal.
- Indiferente si encaja.

## 8.2. Plazas y distribución

| Campo                         | Tipo             | Descripción                                                                     |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------- |
| required_travel_seats         | integer          | Plazas homologadas mínimas                                                      |
| ideal_travel_seats            | integer          | Plazas ideales                                                                  |
| required_sleeping_places      | integer          | Plazas dormir mínimas                                                           |
| ideal_sleeping_places         | integer          | Plazas dormir ideales                                                           |
| requires_isofix               | boolean          | Necesita Isofix                                                                 |
| bed_preference                | enum/multiselect | transversal, longitudinal, isla, francesa, elevable, literas, salón convertible |
| fixed_bed_required            | enum             | sí, no, indiferente                                                             |
| separate_beds_required        | boolean          | Camas separadas                                                                 |
| bunk_beds_required            | boolean          | Literas                                                                         |
| convertible_lounge_acceptable | boolean          | Salón convertible aceptable                                                     |

## 8.3. Baño, cocina y confort

| Campo                                 | Tipo                  |
| ------------------------------------- | --------------------- |
| bathroom_required                     | enum: yes/no/flexible |
| indoor_shower_required                | enum: yes/no/flexible |
| toilet_required                       | enum: yes/no/flexible |
| hot_water_required                    | enum: yes/no/flexible |
| fixed_kitchen_required                | enum: yes/no/flexible |
| fridge_required                       | enum: yes/no/flexible |
| heating_required                      | enum: yes/no/flexible |
| air_conditioning_living_area_required | enum: yes/no/flexible |
| roof_fan_required                     | enum: yes/no/flexible |
| awning_required                       | enum: yes/no/flexible |
| bike_rack_required                    | enum: yes/no/flexible |
| large_garage_required                 | enum: yes/no/flexible |
| tow_bar_required                      | enum: yes/no/flexible |

## 8.4. Autonomía y energía

| Campo                             | Tipo                  |
| --------------------------------- | --------------------- |
| high_electrical_autonomy_required | enum: yes/no/flexible |
| solar_panel_required              | enum: yes/no/flexible |
| lithium_battery_required          | enum: yes/no/flexible |
| inverter_required                 | enum: yes/no/flexible |
| desired_battery_capacity_ah       | integer               |
| desired_inverter_power_w          | integer               |
| water_capacity_importance         | enum: low/medium/high |
| gas_system_preference             | enum/text             |
| wants_off_grid_capability         | enum: low/medium/high |

## 8.5. Requisitos imprescindibles, deseables y descartables

Debe existir una estructura explícita para distinguir:

- `must_have_requirements`
- `nice_to_have_requirements`
- `deal_breakers`

Ejemplo:

```json
{
  "must_have": ["4 plazas homologadas", "baño", "presupuesto máximo 50.000 €"],
  "nice_to_have": ["placa solar", "cama fija", "garaje grande"],
  "deal_breakers": ["más de 7 metros", "sin garantía", "más de 150.000 km"]
}
```

Esto es crítico para el matching.

---

# 9. Preferencias del vehículo

## 9.1. Presupuesto y rango económico

| Campo                             | Tipo                       |
| --------------------------------- | -------------------------- |
| ideal_budget                      | money                      |
| max_budget                        | money                      |
| stretch_budget                    | money                      |
| budget_flexibility                | enum: none/low/medium/high |
| price_sensitivity                 | enum: low/medium/high      |
| accepts_higher_price_if_justified | boolean                    |
| price_notes                       | text                       |

## 9.2. Características del vehículo

| Campo                               | Tipo                                              |
| ----------------------------------- | ------------------------------------------------- |
| min_year                            | integer                                           |
| max_year                            | integer                                           |
| max_km                              | integer                                           |
| preferred_brands                    | multiselect/text                                  |
| rejected_brands                     | multiselect/text                                  |
| preferred_base_vehicle              | multiselect/text                                  |
| transmission_preference             | enum: manual/automatic/indifferent                |
| fuel_preference                     | enum: diesel/gasoline/hybrid/electric/indifferent |
| environmental_label_required        | enum/multiselect                                  |
| max_length_meters                   | decimal                                           |
| max_height_meters                   | decimal                                           |
| max_width_meters                    | decimal                                           |
| preferred_layouts                   | multiselect/text                                  |
| rejected_layouts                    | multiselect/text                                  |
| exterior_condition_importance       | enum                                              |
| interior_condition_importance       | enum                                              |
| mechanical_condition_importance     | enum                                              |
| warranty_importance                 | enum                                              |
| accepts_private_seller_vehicle      | boolean                                           |
| accepts_professional_seller_vehicle | boolean                                           |

## 9.3. Ubicación y desplazamiento

| Campo                       | Tipo                                |
| --------------------------- | ----------------------------------- |
| preferred_purchase_location | text                                |
| search_radius_km            | integer                             |
| willing_to_travel           | boolean                             |
| max_travel_distance_km      | integer                             |
| needs_delivery              | boolean                             |
| delivery_location           | text                                |
| visit_preference            | enum: presencial/videollamada/ambas |
| availability_for_visits     | text                                |

## 9.4. Urgencia

| Campo                 | Tipo    |
| --------------------- | ------- |
| purchase_timeline     | enum    |
| desired_purchase_date | date    |
| urgency_reason        | text    |
| has_deadline          | boolean |
| deadline_date         | date    |
| deadline_notes        | text    |

Opciones `purchase_timeline`:

- inmediata.
- esta semana.
- este mes.
- 1-2 meses.
- 3-6 meses.
- más de 6 meses.
- explorando.
- sin prisa.

---

# 10. Presupuesto y financiación

Esta sección debe ayudar a identificar pronto si la operación es viable.

## 10.1. Campos financieros

| Campo                            | Tipo                               |
| -------------------------------- | ---------------------------------- |
| payment_method                   | enum: cash/financing/mixed/unknown |
| financing_required               | boolean                            |
| financing_amount_needed          | money                              |
| available_down_payment           | money                              |
| desired_monthly_payment          | money                              |
| max_monthly_payment              | money                              |
| financing_term_preference_months | integer                            |
| employment_status                | enum                               |
| approximate_monthly_income       | money                              |
| has_other_loans                  | enum: yes/no/unknown               |
| other_loans_notes                | text                               |
| financing_preapproval_status     | enum                               |
| financing_provider               | text                               |
| financing_notes                  | text                               |
| financial_viability_score        | integer 0-100                      |

## 10.2. Estados de financiación

Opciones `financing_preapproval_status`:

- no_aplica.
- pendiente.
- datos_incompletos.
- viable_preliminar.
- enviado_a_financiera.
- preaprobado.
- aprobado.
- rechazado.
- requiere_mas_entrada.
- pendiente_documentacion.

## 10.3. Documentación financiera

Campos:

| Campo                        | Tipo    |
| ---------------------------- | ------- |
| dni_received                 | boolean |
| payslip_received             | boolean |
| tax_return_received          | boolean |
| bank_statement_received      | boolean |
| employment_contract_received | boolean |
| self_employed_docs_received  | boolean |
| financing_docs_notes         | text    |

## 10.4. Consideración legal / privacidad

Los datos financieros son sensibles. Deben tratarse con especial cuidado:

- Evitar mostrar ingresos a usuarios no autorizados.
- Registrar consentimiento cuando aplique.
- No guardar documentación financiera sin necesidad.
- Separar metadatos de documentos reales.
- Controlar permisos por rol.

---

# 11. Vehículo actual del comprador

Útil para entregas como parte de pago o captación de stock.

## 11.1. Campos

| Campo                        | Tipo    |
| ---------------------------- | ------- |
| has_trade_in_vehicle         | boolean |
| trade_in_vehicle_type        | enum    |
| trade_in_brand               | text    |
| trade_in_model               | text    |
| trade_in_year                | integer |
| trade_in_km                  | integer |
| trade_in_engine              | text    |
| trade_in_transmission        | enum    |
| trade_in_condition           | enum    |
| trade_in_mechanical_issues   | text    |
| trade_in_body_issues         | text    |
| trade_in_interior_condition  | text    |
| trade_in_has_finance_pending | boolean |
| trade_in_pending_amount      | money   |
| trade_in_estimated_value     | money   |
| trade_in_expected_value      | money   |
| trade_in_photos_received     | boolean |
| trade_in_documents_received  | boolean |
| wants_trade_in_valuation     | boolean |
| trade_in_notes               | text    |

## 11.2. Tipos de vehículo entregado

- coche.
- camper.
- autocaravana.
- furgoneta.
- moto.
- otro.

---

# 12. Interacciones comerciales

Todas las interacciones importantes deben quedar asociadas al comprador.

## 12.1. Tipos de interacción

- llamada entrante.
- llamada saliente.
- WhatsApp entrante.
- WhatsApp saliente.
- email entrante.
- email saliente.
- formulario web.
- visita presencial.
- videollamada.
- nota interna.
- oferta enviada.
- documentación recibida.
- vehículo enviado.
- reserva.
- incidencia.
- seguimiento automático.

## 12.2. Tabla `buyer_interactions`

Campos recomendados:

| Campo                 | Tipo                            |
| --------------------- | ------------------------------- |
| id                    | uuid                            |
| buyer_id              | relation                        |
| interaction_type      | enum                            |
| direction             | enum: inbound/outbound/internal |
| channel               | enum                            |
| occurred_at           | datetime                        |
| salesperson_id        | relation/user                   |
| summary               | text                            |
| transcript            | text                            |
| ai_summary            | text                            |
| sentiment             | enum                            |
| buyer_intent          | enum                            |
| objections_detected   | array                           |
| requirements_detected | array                           |
| next_action_suggested | text                            |
| next_action_due_at    | datetime                        |
| related_vehicle_ids   | relation/list                   |
| attachments           | relation/list                   |
| created_at            | datetime                        |

## 12.3. Resumen de interacción

Cada interacción importante debería poder generar:

```text
Resumen:
Cliente confirma que busca una camper de 4 plazas para viajar con familia.
Presupuesto máximo 50.000 €. Tiene entrada de 6.000 € y quiere financiar el resto.
Le preocupa la garantía y el consumo. Se le proponen dos opciones: CN-021 y CN-034.

Objeciones:
- Precio.
- Garantía.
- Distancia para visita.

Próxima acción:
Enviar vídeo detallado de CN-021 y simulación financiera.
```

---

# 13. Matching comprador-vehículo

Esta sección es estratégica. Debe convertir la ficha del comprador en un motor de recomendación.

## 13.1. Entidades necesarias

Para hacer matching real hacen falta al menos:

- `buyers`
- `buyer_requirements`
- `vehicles`
- `vehicle_features`
- `buyer_vehicle_matches`
- `match_explanations`

## 13.2. Tabla `buyer_vehicle_matches`

| Campo                      | Tipo          |
| -------------------------- | ------------- |
| id                         | uuid          |
| buyer_id                   | relation      |
| vehicle_id                 | relation      |
| match_score                | integer 0-100 |
| hard_requirements_passed   | boolean       |
| budget_fit_score           | integer 0-100 |
| layout_fit_score           | integer 0-100 |
| feature_fit_score          | integer 0-100 |
| location_fit_score         | integer 0-100 |
| financing_fit_score        | integer 0-100 |
| commercial_priority_score  | integer 0-100 |
| match_status               | enum          |
| match_summary              | text          |
| match_reasons              | array         |
| mismatch_reasons           | array         |
| suggested_commercial_angle | text          |
| created_at                 | datetime      |
| updated_at                 | datetime      |

## 13.3. Estados del match

- recommended.
- sent_to_buyer.
- buyer_interested.
- buyer_rejected.
- visited.
- offer_sent.
- reserved.
- sold.
- discarded_by_sales.
- not_eligible.

## 13.4. Fórmula inicial de scoring

Propuesta base:

```text
match_score =
  25% requisitos imprescindibles
+ 20% presupuesto
+ 15% tipo/distribución
+ 15% plazas y uso familiar
+ 10% estado/km/año
+ 5% ubicación/desplazamiento
+ 5% financiación
+ 5% extras deseables
```

Regla crítica:

```text
Si falla un requisito imprescindible marcado como deal breaker,
el match_score máximo debe quedar limitado a 40,
aunque el resto de variables encajen.
```

Ejemplos de deal breakers:

- Necesita 4 plazas homologadas y el vehículo tiene 2.
- Presupuesto máximo 45.000 € y vehículo cuesta 65.000 €, sin flexibilidad.
- Necesita baño y el vehículo no tiene baño.
- No acepta vehículos de más de 6 metros y el vehículo mide 7,4 m.
- No puede desplazarse y el vehículo está demasiado lejos sin opción de entrega.

## 13.5. Explicación del match

La ficha debe mostrar no solo el score, sino el porqué.

Ejemplo:

```text
Score: 87/100

Encaja porque:
- Está dentro del presupuesto máximo declarado.
- Tiene 4 plazas homologadas y 4 para dormir.
- Incluye baño completo y ducha interior.
- Tiene cama fija y calefacción.
- Está en Cataluña, dentro del rango de desplazamiento.

Riesgos:
- No tiene aire acondicionado en vivienda.
- Tiene 112.000 km, cerca del máximo indicado.
- El precio está 3.000 € por encima del presupuesto ideal.

Ángulo comercial:
Presentarla como opción familiar equilibrada, lista para viajar y con buena relación precio/equipamiento.
```

---

# 14. Ofertas, visitas y reservas

## 14.1. Vehículos enviados

Debe registrarse cada vehículo enviado al comprador.

Tabla `buyer_vehicle_proposals`:

| Campo            | Tipo     |
| ---------------- | -------- |
| id               | uuid     |
| buyer_id         | relation |
| vehicle_id       | relation |
| sent_at          | datetime |
| sent_by          | user     |
| channel          | enum     |
| message          | text     |
| buyer_response   | enum     |
| response_notes   | text     |
| follow_up_due_at | datetime |
| status           | enum     |

Estados:

- enviado.
- visto.
- interesado.
- descartado.
- pendiente_respuesta.
- visita_agendada.
- oferta_solicitada.

## 14.2. Visitas

Tabla `buyer_visits`:

| Campo          | Tipo                          |
| -------------- | ----------------------------- |
| id             | uuid                          |
| buyer_id       | relation                      |
| vehicle_id     | relation                      |
| visit_type     | enum: presencial/videollamada |
| scheduled_at   | datetime                      |
| completed_at   | datetime                      |
| location       | text                          |
| salesperson_id | relation                      |
| visit_status   | enum                          |
| buyer_feedback | text                          |
| sales_notes    | text                          |
| next_action    | text                          |

Estados:

- agendada.
- confirmada.
- realizada.
- cancelada.
- no_show.
- reprogramada.

## 14.3. Ofertas

Tabla `buyer_offers`:

| Campo                   | Tipo     |
| ----------------------- | -------- |
| id                      | uuid     |
| buyer_id                | relation |
| vehicle_id              | relation |
| offer_amount            | money    |
| asking_price            | money    |
| discount_amount         | money    |
| included_services       | array    |
| warranty_terms          | text     |
| financing_simulation_id | relation |
| valid_until             | date     |
| status                  | enum     |
| sent_at                 | datetime |
| accepted_at             | datetime |
| rejected_at             | datetime |
| rejection_reason        | text     |
| notes                   | text     |

Estados:

- borrador.
- enviada.
- en_negociacion.
- aceptada.
- rechazada.
- caducada.
- sustituida.

## 14.4. Reservas

Tabla `buyer_reservations`:

| Campo               | Tipo     |
| ------------------- | -------- |
| id                  | uuid     |
| buyer_id            | relation |
| vehicle_id          | relation |
| reservation_amount  | money    |
| reservation_paid_at | datetime |
| payment_method      | enum     |
| reservation_status  | enum     |
| expires_at          | datetime |
| contract_signed     | boolean  |
| refund_conditions   | text     |
| notes               | text     |

Estados:

- pendiente_pago.
- pagada.
- confirmada.
- cancelada.
- caducada.
- convertida_a_venta.

---

# 15. Documentación y operación

## 15.1. Documentos del comprador

Tabla `buyer_documents`:

| Campo               | Tipo        |
| ------------------- | ----------- |
| id                  | uuid        |
| buyer_id            | relation    |
| document_type       | enum        |
| file_url            | url/storage |
| uploaded_at         | datetime    |
| uploaded_by         | user        |
| verification_status | enum        |
| verified_by         | user        |
| verified_at         | datetime    |
| expiration_date     | date        |
| notes               | text        |

Tipos:

- DNI/NIE.
- Permiso de conducir.
- Justificante bancario.
- Nómina.
- Declaración de renta.
- Vida laboral.
- Contrato laboral.
- Documento autónomo.
- Justificante reserva.
- Contrato compraventa.
- Presupuesto firmado.
- Documento financiación.
- Otros.

## 15.2. Estado operativo

Campos en ficha:

| Campo                      | Tipo |
| -------------------------- | ---- |
| operation_status           | enum |
| contract_status            | enum |
| payment_status             | enum |
| transfer_status            | enum |
| invoice_status             | enum |
| warranty_status            | enum |
| delivery_status            | enum |
| delivery_date              | date |
| post_sale_follow_up_status | enum |

Estados `operation_status`:

- no_iniciada.
- pre_reserva.
- reservada.
- pendiente_financiacion.
- pendiente_contrato.
- pendiente_pago.
- pendiente_transferencia.
- pendiente_entrega.
- entregada.
- postventa.
- cancelada.

---

# 16. Inteligencia comercial

La ficha debe servir para vender mejor, pero también para aprender del mercado.

## 16.1. Campos de inteligencia

| Campo                      | Tipo        |
| -------------------------- | ----------- |
| competitors_considered     | text/array  |
| alternative_platforms_used | multiselect |
| main_objection             | enum        |
| secondary_objections       | array       |
| perceived_price_position   | enum        |
| trust_level                | enum        |
| urgency_driver             | text        |
| decision_maker             | enum/text   |
| decision_process_notes     | text        |
| comparison_notes           | text        |
| content_needs              | array       |
| lead_quality_notes         | text        |
| ideal_customer_profile_fit | enum        |
| future_potential           | enum        |
| referral_potential         | enum        |

## 16.2. Objeciones

Opciones recomendadas:

- precio.
- financiación.
- garantía.
- kilómetros.
- antigüedad.
- distribución.
- distancia.
- dudas mecánicas.
- miedo a comprar usado.
- falta de confianza.
- necesita vender vehículo actual.
- pareja/familia no convencida.
- no encuentra modelo ideal.
- compara con concesionarios.
- compara con particulares.
- timing.
- documentación.
- otro.

## 16.3. Competidores / fuentes alternativas

Opciones:

- Wallapop.
- Milanuncios.
- AutoScout24.
- Coches.net.
- Yescapa.
- Mundovan.
- Mundimoto / modelo similar aplicado a campers.
- Concesionario local.
- Particular.
- Facebook Marketplace.
- Grupos de camper.
- Referidos.
- Otro.

---

# 17. Scoring del comprador

Además del matching con vehículos, el comprador debe tener un score propio.

## 17.1. Buyer score

El `buyer_score` debe medir calidad y probabilidad de conversión.

Propuesta:

```text
buyer_score =
  20% urgencia
+ 20% presupuesto realista
+ 15% financiación viable
+ 15% claridad de necesidad
+ 10% disponibilidad para visita/desplazamiento
+ 10% engagement/respuesta
+ 5% encaje con stock
+ 5% confianza / ausencia de riesgos
```

## 17.2. Criterios

### Urgencia

| Caso             | Puntos |
| ---------------- | -----: |
| Compra inmediata |    100 |
| Este mes         |     85 |
| 1-2 meses        |     70 |
| 3-6 meses        |     45 |
| Explorando       |     25 |
| Sin prisa        |     10 |

### Presupuesto realista

Evaluar si el presupuesto encaja con el mercado y stock disponible.

| Caso                                  | Puntos |
| ------------------------------------- | -----: |
| Presupuesto suficiente para necesidad |    100 |
| Algo ajustado pero viable             |     70 |
| Muy ajustado                          |     40 |
| Irrealista                            |     10 |

### Financiación

| Caso                           | Puntos |
| ------------------------------ | -----: |
| Contado                        |    100 |
| Financiación preaprobada       |     90 |
| Financiación viable preliminar |     75 |
| Datos incompletos              |     45 |
| Riesgo alto                    |     20 |
| Rechazada                      |      0 |

### Engagement

| Caso                           | Puntos |
| ------------------------------ | -----: |
| Responde rápido y aporta datos |    100 |
| Responde normal                |     70 |
| Responde poco                  |     40 |
| No responde                    |      0 |

---

# 18. Automatizaciones e IA

## 18.1. Casos de uso IA

La ficha debe prepararse para:

1. Transcribir llamadas.
2. Resumir conversaciones.
3. Extraer campos estructurados.
4. Detectar objeciones.
5. Detectar requisitos imprescindibles.
6. Sugerir próxima acción.
7. Actualizar temperatura del lead.
8. Recomendar vehículos.
9. Explicar matches.
10. Detectar riesgo de pérdida.
11. Generar mensajes comerciales.
12. Preparar follow-ups.
13. Crear eventos de calendario.
14. Alertar si un lead caliente no tiene próxima acción.
15. Identificar leads similares a operaciones cerradas.

## 18.2. Campo `ai_extracted_data`

Guardar extracción previa antes de confirmar cambios:

```json
{
  "extracted_from_interaction_id": "uuid",
  "confidence": 0.87,
  "fields": {
    "max_budget": 50000,
    "required_travel_seats": 4,
    "bathroom_required": "yes",
    "purchase_timeline": "1_2_months"
  },
  "suggested_updates": [
    {
      "field": "lead_temperature",
      "old_value": "warm",
      "new_value": "hot",
      "reason": "Cliente quiere comprar este mes y ha pedido financiación"
    }
  ]
}
```

## 18.3. Flujo recomendado tras llamada

1. Se graba llamada.
2. Se transcribe.
3. IA genera resumen.
4. IA extrae campos.
5. IA detecta objeciones.
6. IA propone próxima acción.
7. Comercial revisa cambios.
8. Comercial acepta/rechaza actualizaciones.
9. CRM actualiza ficha.
10. CRM crea tarea o evento si procede.

## 18.4. Guardrails

La IA no debe:

- Aprobar financiación automáticamente.
- Cambiar estado a venta cerrada.
- Marcar documentación como verificada.
- Eliminar datos históricos.
- Sobrescribir campos críticos sin revisión.
- Enviar mensajes comerciales sin aprobación salvo automatizaciones muy controladas.

---

# 19. Tareas y seguimiento

## 19.1. Tabla `buyer_tasks`

| Campo                  | Tipo           |
| ---------------------- | -------------- |
| id                     | uuid           |
| buyer_id               | relation       |
| assigned_to            | user           |
| task_type              | enum           |
| title                  | text           |
| description            | text           |
| due_at                 | datetime       |
| priority               | enum           |
| status                 | enum           |
| completed_at           | datetime       |
| related_vehicle_id     | relation       |
| related_interaction_id | relation       |
| created_by             | user/system/ai |
| created_at             | datetime       |

Tipos:

- llamada.
- WhatsApp.
- email.
- enviar vehículos.
- pedir documentación.
- revisar financiación.
- agendar visita.
- enviar oferta.
- seguimiento.
- postventa.
- interno.

Estados:

- pendiente.
- en_progreso.
- completada.
- cancelada.
- vencida.

## 19.2. Alertas importantes

El sistema debe alertar cuando:

- Lead caliente sin próxima acción.
- Próxima acción vencida.
- Lead nuevo sin contactar tras X horas.
- Oferta enviada sin seguimiento.
- Reserva pendiente de pago cerca de caducar.
- Financiación pendiente demasiado tiempo.
- Match alto disponible y no enviado.
- Vehículo bajó de precio y encaja con comprador.
- Nuevo vehículo entra y encaja con comprador caliente.

---

# 20. Modelo de datos recomendado

A continuación, propuesta orientativa de entidades.

## 20.1. `buyers`

Tabla principal.

Campos principales:

```sql
id uuid primary key
first_name text
last_name text
full_name text
phone_primary text
phone_secondary text
email_primary text
email_secondary text
preferred_contact_channel text
preferred_language text
country text
region text
province text
city text
postal_code text
source_channel text
source_campaign text
source_medium text
source_content text
referrer_url text
landing_page text
assigned_salesperson_id uuid
lead_status text
lead_temperature text
lead_priority text
close_probability integer
buyer_score integer
qualification_status text
lost_reason text
lost_reason_notes text
next_action_type text
next_action_due_at timestamptz
last_contacted_at timestamptz
ai_buyer_summary text
sales_owner_notes text
created_at timestamptz
updated_at timestamptz
```

## 20.2. `buyer_profiles`

Perfil/contexto.

```sql
id uuid primary key
buyer_id uuid references buyers(id)
buyer_type text
main_purchase_motivation text
experience_level text
has_owned_camper_before boolean
current_vehicle_experience text
travel_style text[]
trips_per_year_estimate integer
average_trip_duration text
remote_work_use boolean
winter_use boolean
off_grid_use text
travels_with_children boolean
number_of_children integer
children_ages text
travels_with_pets boolean
pet_type text
accessibility_needs text
parking_constraints text
buyer_context_notes text
created_at timestamptz
updated_at timestamptz
```

## 20.3. `buyer_requirements`

Necesidad y preferencias.

```sql
id uuid primary key
buyer_id uuid references buyers(id)
primary_vehicle_category text
desired_vehicle_categories text[]
acceptable_vehicle_categories text[]
rejected_vehicle_categories text[]
required_travel_seats integer
ideal_travel_seats integer
required_sleeping_places integer
ideal_sleeping_places integer
requires_isofix boolean
bed_preference text[]
fixed_bed_required text
separate_beds_required boolean
bunk_beds_required boolean
convertible_lounge_acceptable boolean
bathroom_required text
indoor_shower_required text
toilet_required text
hot_water_required text
fixed_kitchen_required text
fridge_required text
heating_required text
air_conditioning_living_area_required text
roof_fan_required text
awning_required text
bike_rack_required text
large_garage_required text
tow_bar_required text
high_electrical_autonomy_required text
solar_panel_required text
lithium_battery_required text
inverter_required text
desired_battery_capacity_ah integer
desired_inverter_power_w integer
water_capacity_importance text
wants_off_grid_capability text
must_have_requirements text[]
nice_to_have_requirements text[]
deal_breakers text[]
created_at timestamptz
updated_at timestamptz
```

## 20.4. `buyer_budget_preferences`

```sql
id uuid primary key
buyer_id uuid references buyers(id)
ideal_budget numeric
max_budget numeric
stretch_budget numeric
budget_flexibility text
price_sensitivity text
accepts_higher_price_if_justified boolean
price_notes text
payment_method text
financing_required boolean
financing_amount_needed numeric
available_down_payment numeric
desired_monthly_payment numeric
max_monthly_payment numeric
financing_term_preference_months integer
employment_status text
approximate_monthly_income numeric
has_other_loans text
other_loans_notes text
financing_preapproval_status text
financing_provider text
financing_notes text
financial_viability_score integer
created_at timestamptz
updated_at timestamptz
```

## 20.5. `buyer_vehicle_preferences`

```sql
id uuid primary key
buyer_id uuid references buyers(id)
min_year integer
max_year integer
max_km integer
preferred_brands text[]
rejected_brands text[]
preferred_base_vehicle text[]
transmission_preference text
fuel_preference text
environmental_label_required text[]
max_length_meters numeric
max_height_meters numeric
max_width_meters numeric
preferred_layouts text[]
rejected_layouts text[]
exterior_condition_importance text
interior_condition_importance text
mechanical_condition_importance text
warranty_importance text
accepts_private_seller_vehicle boolean
accepts_professional_seller_vehicle boolean
preferred_purchase_location text
search_radius_km integer
willing_to_travel boolean
max_travel_distance_km integer
needs_delivery boolean
delivery_location text
visit_preference text
availability_for_visits text
purchase_timeline text
desired_purchase_date date
urgency_reason text
has_deadline boolean
deadline_date date
deadline_notes text
created_at timestamptz
updated_at timestamptz
```

## 20.6. `buyer_trade_in_vehicles`

```sql
id uuid primary key
buyer_id uuid references buyers(id)
has_trade_in_vehicle boolean
trade_in_vehicle_type text
trade_in_brand text
trade_in_model text
trade_in_year integer
trade_in_km integer
trade_in_engine text
trade_in_transmission text
trade_in_condition text
trade_in_mechanical_issues text
trade_in_body_issues text
trade_in_interior_condition text
trade_in_has_finance_pending boolean
trade_in_pending_amount numeric
trade_in_estimated_value numeric
trade_in_expected_value numeric
trade_in_photos_received boolean
trade_in_documents_received boolean
wants_trade_in_valuation boolean
trade_in_notes text
created_at timestamptz
updated_at timestamptz
```

## 20.7. Tablas relacionales importantes

Además de las anteriores:

- `buyer_interactions`
- `buyer_tasks`
- `buyer_vehicle_matches`
- `buyer_vehicle_proposals`
- `buyer_visits`
- `buyer_offers`
- `buyer_reservations`
- `buyer_documents`
- `buyer_ai_extractions`
- `buyer_audit_log`

---

# 21. Eventos y tracking

El CRM debería registrar eventos internos para reporting y automatización.

## 21.1. Eventos recomendados

- `buyer_created`
- `buyer_contacted`
- `buyer_qualified`
- `buyer_status_changed`
- `buyer_requirement_updated`
- `buyer_budget_updated`
- `buyer_financing_status_changed`
- `buyer_vehicle_matched`
- `vehicle_proposal_sent`
- `buyer_vehicle_interested`
- `buyer_vehicle_rejected`
- `visit_scheduled`
- `visit_completed`
- `offer_sent`
- `offer_accepted`
- `offer_rejected`
- `reservation_created`
- `reservation_paid`
- `sale_closed`
- `buyer_lost`
- `task_created`
- `task_completed`
- `ai_summary_generated`
- `ai_fields_extracted`

## 21.2. Auditoría

Cualquier cambio importante debe registrar:

- usuario que cambia.
- fecha/hora.
- campo anterior.
- campo nuevo.
- fuente del cambio: manual, IA, integración, sistema.
- motivo si aplica.

---

# 22. Permisos y roles

## 22.1. Roles sugeridos

- Admin.
- Manager comercial.
- Comercial.
- Operaciones.
- Finanzas.
- Marketing.
- Solo lectura.

## 22.2. Restricciones recomendadas

| Información               | Quién puede verla                                       |
| ------------------------- | ------------------------------------------------------- |
| Datos básicos             | Comercial, manager, admin                               |
| Notas comerciales         | Comercial, manager, admin                               |
| Datos financieros         | Finanzas, manager, admin, comercial asignado si procede |
| Documentos sensibles      | Finanzas, operaciones, admin                            |
| Scoring                   | Comercial, manager, admin                               |
| Auditoría                 | Manager, admin                                          |
| Datos marketing agregados | Marketing, manager, admin                               |

---

# 23. UX recomendada

## 23.1. Layout

La ficha debería tener:

1. Header fijo con nombre, teléfono, estado, temperatura y próxima acción.
2. Sidebar derecho con score, próximos pasos y alertas.
3. Tabs o secciones:
   - Resumen.
   - Necesidades.
   - Preferencias.
   - Finanzas.
   - Matching.
   - Interacciones.
   - Ofertas/visitas.
   - Documentos.
   - Historial.

## 23.2. Acciones rápidas

Botones recomendados:

- Llamar.
- Enviar WhatsApp.
- Enviar email.
- Crear tarea.
- Agendar visita.
- Enviar vehículo.
- Generar matching.
- Crear oferta.
- Pedir documentación.
- Marcar como perdido.
- Convertir a reserva.
- Actualizar con IA.

## 23.3. Indicadores visuales

- Lead caliente sin próxima acción: alerta roja.
- Lead con presupuesto viable: indicador positivo.
- Financiación pendiente: alerta amarilla.
- Match > 85: destacado.
- Documento pendiente: aviso.
- Oferta sin seguimiento: aviso.

---

# 24. Reporting que debe permitir

La estructura debe permitir responder preguntas como:

## 24.1. Ventas

- ¿Cuántos leads nuevos entran por semana?
- ¿Cuántos se cualifican?
- ¿Cuántos llegan a visita?
- ¿Cuántos reciben oferta?
- ¿Cuántos reservan?
- ¿Cuántos cierran?
- ¿Cuál es la conversión por canal?
- ¿Cuál es el tiempo medio de cierre?
- ¿Qué comerciales convierten mejor?

## 24.2. Demanda

- ¿Qué tipo de vehículo busca más la gente?
- ¿Qué presupuesto medio tiene el comprador?
- ¿Qué extras son más demandados?
- ¿Cuántos compradores buscan 4 plazas?
- ¿Cuántos necesitan financiación?
- ¿Qué zonas geográficas generan más demanda?
- ¿Qué objeciones se repiten más?

## 24.3. Stock y pricing

- ¿Qué vehículos tienen más demanda que oferta?
- ¿Qué rango de precio tiene más liquidez?
- ¿Qué características elevan el match?
- ¿Qué vehículos se rechazan más y por qué?
- ¿Qué modelos deberíamos captar?
- ¿Qué vehículos tienen leads esperando?

## 24.4. Marketing

- ¿Qué campañas generan leads con mayor buyer_score?
- ¿Qué canales generan compradores financiables?
- ¿Qué landing pages atraen compradores de mayor presupuesto?
- ¿Qué mensajes comerciales reducen objeciones?
- ¿Qué contenidos deberíamos crear según dudas repetidas?

---

# 25. Implementación por fases

Aunque el diseño sea completo, conviene implementar en fases.

## Fase 1 — Base CRM robusta

Objetivo: poder crear y gestionar compradores correctamente.

Incluye:

- Tabla `buyers`.
- Datos básicos.
- Estado comercial.
- Próxima acción.
- Asignación comercial.
- Vista resumen.
- Notas internas.
- Búsqueda y filtros.
- Detección básica de duplicados.

## Fase 2 — Necesidades y preferencias

Objetivo: entender qué busca el comprador.

Incluye:

- `buyer_profiles`.
- `buyer_requirements`.
- `buyer_vehicle_preferences`.
- `buyer_budget_preferences`.
- Campos must-have, nice-to-have y deal-breakers.
- Vista estructurada de necesidades.

## Fase 3 — Interacciones y tareas

Objetivo: seguimiento comercial profesional.

Incluye:

- `buyer_interactions`.
- `buyer_tasks`.
- Timeline de actividad.
- Alertas de próxima acción.
- Registro de llamadas, WhatsApps, emails y visitas.

## Fase 4 — Matching

Objetivo: recomendar vehículos con explicación.

Incluye:

- `buyer_vehicle_matches`.
- Score de match.
- Explicación de encaje.
- Motivos de descarte.
- Envío de vehículos.
- Registro de respuesta del comprador.

## Fase 5 — Ofertas, visitas y reservas

Objetivo: gestionar operación comercial.

Incluye:

- `buyer_vehicle_proposals`.
- `buyer_visits`.
- `buyer_offers`.
- `buyer_reservations`.
- Estados de operación.

## Fase 6 — Documentos y financiación

Objetivo: cerrar operaciones con control.

Incluye:

- `buyer_documents`.
- Estado financiación.
- Estado contrato.
- Estado pago.
- Estado transferencia.
- Permisos específicos.

## Fase 7 — IA y automatización

Objetivo: reducir carga manual y mejorar seguimiento.

Incluye:

- Transcripción de llamadas.
- Resumen automático.
- Extracción de campos.
- Sugerencia de próxima acción.
- Actualización asistida.
- Generación de mensajes.
- Alertas inteligentes.

## Fase 8 — Reporting e inteligencia de negocio

Objetivo: convertir el CRM en fuente estratégica.

Incluye:

- Dashboard comercial.
- Dashboard demanda.
- Dashboard matching.
- Dashboard objeciones.
- Dashboard canales.
- Exportaciones.
- Métricas por cohorte.

---

# 26. Criterios de aceptación

## 26.1. Ficha de comprador

Se considera bien implementada cuando:

- Un comercial puede entender el caso en menos de 20 segundos.
- Se puede saber qué busca, cuánto puede pagar y cuándo quiere comprar.
- Toda ficha tiene próxima acción o motivo claro para no tenerla.
- Se puede filtrar por presupuesto, tipo de vehículo, plazas, financiación y urgencia.
- Se pueden registrar interacciones y ver timeline.
- Se puede saber qué vehículos se han enviado y qué respondió el comprador.
- Se puede marcar un lead como perdido con motivo estructurado.
- Se pueden extraer informes de demanda.

## 26.2. Matching

Se considera bien implementado cuando:

- El sistema puede proponer vehículos relevantes.
- El comercial entiende por qué se recomienda un vehículo.
- El sistema muestra también riesgos o desajustes.
- Los deal-breakers limitan el score.
- Se registra si el comprador acepta o rechaza cada propuesta.
- Los rechazos alimentan inteligencia futura.

## 26.3. IA

Se considera bien implementada cuando:

- La IA resume llamadas de forma útil.
- Extrae campos con confianza.
- No sobrescribe datos críticos sin revisión.
- Propone próximas acciones concretas.
- Reduce trabajo manual sin perder control comercial.

---

# 27. Prioridades de campos

## 27.1. Campos imprescindibles

Estos campos deberían existir desde el principio:

- Nombre.
- Teléfono.
- Email.
- Provincia.
- Canal de entrada.
- Estado comercial.
- Temperatura.
- Comercial asignado.
- Próxima acción.
- Fecha próxima acción.
- Tipo de vehículo buscado.
- Presupuesto máximo.
- Forma de pago.
- Necesita financiación.
- Plazas viaje.
- Plazas dormir.
- Baño requerido.
- Urgencia de compra.
- Resumen de necesidad.
- Notas comerciales.

## 27.2. Campos muy recomendables

- Uso principal.
- Viaja con niños.
- Viaja con mascotas.
- Cama preferida.
- Ducha interior.
- Calefacción.
- Autonomía eléctrica.
- Año mínimo.
- Km máximos.
- Longitud máxima.
- Ubicación preferida.
- Dispuesto a desplazarse.
- Entrada disponible.
- Cuota mensual máxima.
- Experiencia previa.
- Objeción principal.
- Competidores considerados.
- Vehículo actual para entregar.

## 27.3. Campos avanzados

- Score comprador.
- Score financiero.
- Score de matching.
- Explicación de match.
- Deal-breakers.
- IA extracted data.
- Sentiment.
- Buyer intent.
- Riesgo de pérdida.
- Potencial futuro.
- Propensión a reserva.
- Elasticidad de presupuesto.

---

# 28. Recomendaciones técnicas

## 28.1. Base de datos

Recomendación:

- PostgreSQL.
- UUIDs.
- Timestamps con zona horaria.
- Enums controlados o tablas auxiliares para catálogos.
- JSONB solo para datos flexibles, no para campos centrales.
- Auditoría de cambios.
- Índices en teléfono, email, estado, presupuesto, provincia y próxima acción.

## 28.2. Campos enum

Usar enums o tablas catálogo para:

- Estados de lead.
- Temperaturas.
- Tipos de vehículo.
- Canales.
- Tipos de interacción.
- Estados de financiación.
- Estados de oferta.
- Estados de reserva.
- Motivos de pérdida.
- Objeciones.

## 28.3. Integraciones futuras

Preparar arquitectura para:

- WhatsApp Business API.
- Telefonía / Voice / Twilio.
- Email.
- Google Calendar.
- Herramienta de financiación.
- Almacenamiento documental.
- Sistema de vehículos / stock.
- Web forms.
- Analytics.
- IA para llamadas y resúmenes.

## 28.4. API

Endpoints sugeridos:

```http
GET /buyers
POST /buyers
GET /buyers/:id
PATCH /buyers/:id
GET /buyers/:id/summary
GET /buyers/:id/interactions
POST /buyers/:id/interactions
GET /buyers/:id/tasks
POST /buyers/:id/tasks
GET /buyers/:id/matches
POST /buyers/:id/generate-matches
POST /buyers/:id/proposals
POST /buyers/:id/offers
POST /buyers/:id/reservations
POST /buyers/:id/documents
POST /buyers/:id/ai/extract
POST /buyers/:id/ai/summarize
```

---

# 29. Ejemplo completo de ficha

```json
{
  "buyer": {
    "full_name": "Juan Pérez",
    "phone_primary": "+34600000000",
    "email_primary": "juan@example.com",
    "province": "Barcelona",
    "source_channel": "web",
    "lead_status": "qualified",
    "lead_temperature": "hot",
    "lead_priority": "high",
    "buyer_score": 84,
    "close_probability": 65,
    "next_action_type": "send_vehicle_options",
    "next_action_due_at": "2026-07-09T10:00:00+02:00",
    "ai_buyer_summary": "Busca gran volumen familiar de 4 plazas, presupuesto máximo 52.000 €, quiere financiar con entrada de 7.000 €. Necesita baño, ducha, cama fija o literas y calefacción. Compra prevista este mes."
  },
  "profile": {
    "buyer_type": "family",
    "main_purchase_motivation": "family_leisure",
    "experience_level": "beginner",
    "travels_with_children": true,
    "number_of_children": 2,
    "travels_with_pets": false,
    "winter_use": true,
    "off_grid_use": "medium"
  },
  "requirements": {
    "primary_vehicle_category": "gran_volumen",
    "desired_vehicle_categories": ["gran_volumen", "perfilada"],
    "required_travel_seats": 4,
    "required_sleeping_places": 4,
    "bathroom_required": "yes",
    "indoor_shower_required": "yes",
    "heating_required": "yes",
    "fixed_bed_required": "flexible",
    "bunk_beds_required": true,
    "must_have_requirements": ["4 plazas homologadas", "baño", "presupuesto máximo 52.000 €"],
    "nice_to_have_requirements": ["placa solar", "cama fija", "garaje grande"],
    "deal_breakers": ["menos de 4 plazas", "sin baño", "más de 60.000 €"]
  },
  "budget": {
    "ideal_budget": 47000,
    "max_budget": 52000,
    "stretch_budget": 57000,
    "budget_flexibility": "medium",
    "payment_method": "mixed",
    "financing_required": true,
    "available_down_payment": 7000,
    "desired_monthly_payment": 450,
    "max_monthly_payment": 550,
    "financing_preapproval_status": "pending"
  },
  "vehicle_preferences": {
    "min_year": 2018,
    "max_km": 120000,
    "transmission_preference": "indifferent",
    "fuel_preference": "diesel",
    "max_length_meters": 6.4,
    "willing_to_travel": true,
    "max_travel_distance_km": 500,
    "purchase_timeline": "this_month"
  }
}
```

---

# 30. Recomendación final

La ficha de comprador de CampersNova no debería tratarse como una simple ficha CRM. Debería ser el activo central que conecta:

- captación,
- ventas,
- stock,
- financiación,
- operaciones,
- IA,
- reporting,
- estrategia de mercado.

La gran ventaja competitiva estará en estructurar bien la demanda. Muchos concesionarios solo gestionan contactos y conversaciones; CampersNova puede construir una base de datos de intención de compra muy precisa.

La ficha debe responder siempre a estas preguntas:

1. ¿Quién es el comprador?
2. ¿Qué necesita realmente?
3. ¿Cuánto puede pagar?
4. ¿Cuándo quiere comprar?
5. ¿Qué vehículos encajan?
6. ¿Por qué encajan?
7. ¿Qué objeciones tiene?
8. ¿Cuál es la próxima acción?
9. ¿Qué probabilidad hay de cierre?
10. ¿Qué aprendemos de este comprador para vender mejor en el futuro?
