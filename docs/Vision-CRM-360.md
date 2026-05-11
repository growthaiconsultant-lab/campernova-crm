# Vision CRM 360º — Campers Nova

> **Documento de visión / spec de referencia para los sprints post-launch (6-10).**
>
> Origen: presentación directiva interna `presentacion_crm_campersnova.pdf` + sesión de clarificación de modelo de negocio (Joel, mayo 2026).
>
> Estado: aprobado conceptualmente. Roadmap de implementación pendiente de priorizar tras el lanzamiento del MVP.

---

## 1. Modelo de negocio real

Campers Nova opera como **intermediario con custodia física y margen propio**, NO como broker puro (Wallapop-style) ni como dealer puro (concesionario tradicional). El flujo es:

1. **Captación.** Un vendedor contacta a Campers Nova para que le vendamos su camper o autocaravana.
2. **Filtro de aceptación.** Aceptamos si encaja por antigüedad, estado, kilómetros y precio que pide el vendedor.
3. **Acuerdo con vendedor.** Se acuerda un `purchasePrice` (lo que pagaremos al vendedor cuando se venda). El vendedor sigue siendo titular legal hasta el cierre, o se transmite a Campers Nova en el momento de la entrada (a definir caso a caso).
4. **Custodia física.** El vehículo entra a la nave de Parets del Vallès. Campers Nova asume gastos de custodia, exposición, marketing y preparación.
5. **Preparación.** Limpieza, fotos profesionales, ficha comercial. Opcionalmente: paso por taller (Manolo) para mejoras y reparaciones.
6. **Publicación.** Web propia, portales (Wallapop, Coches.net), Instagram.
7. **Venta.** Captación de comprador, visitas, negociación, reserva, financiación, cierre.
8. **Entrega y postventa.** Pre-entrega + explicación + firma + 12 meses de garantía + seguimiento 7/30 días.

**Margen.** Aproximadamente **4% sobre el precio acordado con el vendedor**, **variable por vehículo**. Se guarda como `Vehicle.marginPercent` (con default 4.0). Los servicios añadidos (taller, financiación, parte de pago) generan margen extra.

**Lo que se cobra al cliente comprador.** Precio público que incluye el margen + servicios. **El 4% nunca se muestra al cliente** — es información interna.

**Servicios añadidos que diferencian a Campers Nova:**

- Garantía propia 12 meses (ampliable a 36)
- Financiación hasta 15 años (4,99%)
- Aceptación de vehículo como parte de pago
- Cambio de nombre incluido
- Impuestos incluidos
- Envíos a toda la península
- Posibilidad de prueba mecánica externa
- Asistente IA Nova (QR único en cada vehículo entregado)

---

## 2. Equipo y roles

| Persona     | Rol funcional            | Rol técnico CRM (objetivo) | Estado actual                  |
| ----------- | ------------------------ | -------------------------- | ------------------------------ |
| **Joel**    | Admin técnico / operador | `ADMIN` (super-admin)      | Ya en seed                     |
| **Esteban** | CEO / cara comercial     | `ADMIN` (super-admin)      | En seed como AGENTE — corregir |
| **Desirée** | Agente comercial         | `AGENTE`                   | Falta dar de alta              |
| **Joui**    | Agente comercial         | `AGENTE`                   | Ya en seed                     |
| **Manolo**  | Taller                   | `TALLER` (sprint 9)        | Falta dar de alta              |
| **Javi**    | Pre-entregas             | `ENTREGAS` (sprint 9)      | Falta dar de alta              |
| **Ari**     | Marketing                | `MARKETING` (sprint 9)     | Falta dar de alta              |

Hasta el sprint 9 (módulo de permisos diferenciados), Manolo/Javi/Ari pueden mantenerse fuera del seed para no contaminar las notificaciones de leads (que hoy se envían a todos los `active = true`).

---

## 3. Objetos principales del dominio

El CRM se organiza en torno a 6 objetos:

1. **Cliente** — comprador, vendedor o ambos. Fuente, presupuesto, preferencias, historial, estado.
2. **Vehículo** — matrícula, VIN, ficha técnica, estado legal, estado técnico, costes acumulados, ubicación física en nave.
3. **Operación** — compra o venta vinculada a cliente y vehículo, con pipeline, responsable y margen.
4. **Tarea** — acción asignada a una persona, con fecha límite, prioridad, evidencias y bloqueo.
5. **Documento** — contrato, DNI, ficha técnica, ITV, garantía, facturas, financiación, firmas.
6. **Incidencia** — ticket postventa o interno, con causa, coste, responsable y solución.

**Estado actual del modelo Prisma**: cubre `Vehicle`, `SellerLead`, `BuyerLead`, `Match`, `Activity`, `Note`, `Valuation`, `Document`, `BuyerChatSession`, `VehicleAd`. **Falta**: concepto explícito de "Operación" (hoy se infiere del match cerrado), tabla de costes imputados, tabla de incidencias postventa, expediente legal con matrícula/VIN.

---

## 4. Flujo maestro — 8 fases

Cada fase tiene: datos obligatorios, responsable, checklist, evidencias, reglas de bloqueo.

### Fase 1 — Entrada lead / oportunidad

**Objetivo:** decidir rápido si interesa comprar y a qué precio.

**Datos obligatorios del lead vendedor:**

- Nombre y teléfono
- Marca, modelo, año, km, matrícula
- Fotos exteriores, interiores y daños
- ITV, historial, libro y facturas
- Precio pedido y urgencia de venta

**Tasación interna:**

- Consulta DGT / cargas
- Estimación precio compra (`purchasePrice` propuesto)
- Estimación precio venta público
- Coste preparación previsto
- Margen mínimo aceptado

**Estado actual:** cubierto parcialmente. El algoritmo de tasación existe. **Falta**: campos de matrícula obligatoria, consulta DGT, gestión documental (ITV, libro, facturas como `Document` adjunto).

### Fase 2 — Compra, pagos y documentación

**Objetivo:** que ningún vehículo entre al stock vendible sin expediente legal completo.

**Documentación obligatoria:**

- DNI / NIE del titular vendedor
- Permiso de circulación
- Ficha técnica
- Contrato compraventa firmado
- Justificante de pago

**Gestión administrativa:**

- Cambio de titularidad iniciado
- Comprobación de cargas
- Factura / recibo interno
- Seguro / traslado si aplica
- Fecha de entrada a stock

**Regla de bloqueo:** no se puede crear stock vendible si falta contrato, identificación del titular, ficha técnica o estado de titularidad.

**Alertas automáticas:** cambio de nombre pendiente más de 72h, documento faltante, pago sin justificar, vehículo sin ubicación.

**Estado actual:** no existe. **Sprint 6 / 10.**

### Fase 3 — Taller y diagnóstico técnico

**Objetivo:** saber el coste real antes de publicar y evitar sorpresas en garantía.

**Checklist técnico (orden de trabajo de Manolo):**

- **Mecánica:** motor, caja de cambios, frenos, suspensión, neumáticos, batería motor
- **Camper:** agua, gas, calefacción, boiler, nevera, placas solares
- **Electricidad:** centralita, inversor, baterías auxiliares, luces, tomas 230V, cargadores
- **Evidencias:** fotos de fallos, vídeo de prueba, presupuesto, horas previstas, decisión reparar/no reparar

**Estado actual:** no existe. **Sprint 7.**

### Fase 4 — Reparación, instalaciones y limpieza

**Objetivo:** poner el vehículo en estado vendible controlando coste y tiempo.

**Sub-fases:**

- **Reparaciones** — piezas, mano de obra, proveedor, fechas, garantía interna
- **Instalaciones** — placas solares, litio, inversores, seguridad, aire, accesorios
- **Limpieza** — interior, baño, cocina, tapicerías, olores, exterior, desinfección
- **Validación** — checklist final con fotos antes/después y firma del responsable

**Control económico obligatorio:**

- Coste de piezas imputado al vehículo
- Horas de taller imputadas por trabajador
- Horas de limpieza imputadas
- Fotos antes y después de fallos importantes
- Aprobación de CEO si el coste supera un límite definido

**Estado actual:** no existe imputación de costes. **Sprint 6 (costes) + 7 (taller).**

### Fase 5 — Fotos, ficha comercial y publicación

**Objetivo:** publicar solo vehículos listos, con información completa y profesional.

**Pack visual mínimo:**

- Fotos exteriores 360
- Fotos interiores
- Detalle cocina, baño y cama
- Fotos extras y accesorios
- Vídeo corto vertical

**Ficha comercial:**

- Precio venta
- Precio financiado si aplica
- Descripción IA revisada
- Extras principales
- Garantía incluida

**Canales:**

- Web Campers Nova
- Instagram / Reels
- Portales venta (Wallapop, Coches.net)
- Google Business si aplica
- Estado publicado

**Bloqueo de publicación:** no se puede publicar si falta revisión técnica OK, limpieza validada, precio aprobado, fotos completas o ficha comercial.

**Estado actual:** parcial. La generación de anuncios (Wallapop + Coches.net) está construyéndose como **P0-E pre-launch**. **Falta**: pack visual estructurado (categorías de fotos), bloqueo de publicación con guardrails.

### Fase 6 — Venta y seguimiento comercial

**Objetivo:** que cada lead comprador tenga respuesta, seguimiento y próxima acción.

**Pipeline:**

```
Lead comprador → Contacto <24h → Filtro presupuesto → Visita agendada
→ Prueba / dudas → Reserva → Financiación → Cierre
```

**Ficha lead comprador:**

- Perfil (presupuesto, tipo vehículo, uso previsto, familia/plazas)
- Seguimiento (último contacto, próxima acción, objeciones, comercial)
- Conversión (visita, reserva, financiación, cierre)

**Estado actual:** cubierto en buena medida por `BuyerLead` + `Match` + estados. **Falta**: estado intermedio "Reserva" (hoy salta de OFERTA a CERRADO), gestión de financiación, recordatorios automáticos de "próxima acción".

### Fase 7 — Pre-entrega y entrega al cliente

**Objetivo:** entregar perfecto, explicado y firmado.

**Pre-entrega (responsable: Javi):**

- Limpieza final OK
- Niveles revisados
- Documentación preparada
- Garantía preparada
- Cita confirmada

**Explicación al vehículo:**

- Explicar agua, gas y luz
- Explicar boiler / calefacción
- Explicar placas / baterías
- Prueba de cierres y accesorios
- Resolver dudas del cliente

**Firma y salida:**

- Contrato final
- Factura
- Documento de entrega
- Fotos de entrega
- Estado `VENDIDO`

**Bloqueo de salida:** no se puede marcar como entregado sin firma de entrega, checklist final, documentación y responsable de explicación asignado.

**Estado actual:** no existe. **Sprint 8.**

### Fase 8 — Postventa, reseñas e incidencias

**Objetivo:** convertir la postventa en reputación y control de costes.

**Seguimiento automático:**

- A los 7 días: mensaje automático para comprobar experiencia y detectar problemas
- A los 30 días: revisión de satisfacción, pedir reseña, registrar oportunidades

**Tickets de incidencia:**

- Datos: cliente, vehículo, fecha entrega, garantía
- Problema: descripción, fotos, prioridad, coste estimado
- Resolución: responsable, fecha límite, solución, cerrado

Cada incidencia tiene coste que **afecta retroactivamente al margen del vehículo**.

**Estado actual:** no existe. **Sprint 8.**

---

## 5. Reglas de bloqueo inteligentes

El CRM debe empujar al equipo y proteger la operación:

1. **Lead sin contactar** — alerta al comercial y CEO si pasan 24h sin contacto.
2. **Documento faltante** — no permite avanzar de fase hasta subir y validar.
3. **Coste excesivo** — requiere aprobación del CEO si la preparación supera límite.
4. **Vehículo parado** — alerta si supera X días sin avance o sin visitas.
5. **Entrega incompleta** — bloquea estado entregado sin firmas y checklist.
6. **Postventa abierta** — escala tickets vencidos o con coste alto.

**Estado actual:** máquina de estados básica sin guardrails. **Sprint 10.**

---

## 6. KPIs del panel de dirección

Indicadores que el CRM debe calcular en tiempo real:

1. **Margen por vehículo** = `salePrice - purchasePrice - preparationCosts - postventaCosts`
2. **Días en stock** — alerta si supera límite
3. **Coste taller** — piezas + horas
4. **Ratio de cierre** — leads a ventas
5. **Tiempo de respuesta** — lead a primer contacto
6. **Incidencias postventa** — coste y causa raíz
7. **Ranking de vehículos por rentabilidad** — Top N por margen

**Estado actual:** dashboard mide leads/operaciones/funnel, no rentabilidad real por vehículo. **Sprint 6.**

---

## 7. Roadmap post-launch propuesto

Orden por dolor operativo del equipo real (Esteban, Desirée, Joui, Manolo, Javi, Ari):

| Sprint | Módulo                                      | Por qué duele                                                 | Coste estimado |
| ------ | ------------------------------------------- | ------------------------------------------------------------- | -------------- |
| 6      | **Coste y margen por vehículo**             | Hoy no se sabe cuánto se gana por unidad                      | 5-7 días       |
| 7      | **Taller (Manolo)**                         | Manolo acaba de empezar, sin sistema lleva horas en Excel     | 5-7 días       |
| 8      | **Entrega + Postventa con garantía**        | Riesgo de reclamaciones; mide reputación                      | 6-8 días       |
| 9      | **Roles y permisos diferenciados**          | Alta de Manolo/Javi/Ari sin contaminar notificaciones         | 2-3 días       |
| 10     | **Documentación legal + reglas de bloqueo** | Cierra el círculo: no se publica nada sin expediente completo | 4-5 días       |

Total estimado: ~6-8 semanas post-launch.

Esta planificación no contempla mejoras menores ni iteración basada en feedback real de uso, que probablemente añadan otro 30-40% de scope orgánico.
