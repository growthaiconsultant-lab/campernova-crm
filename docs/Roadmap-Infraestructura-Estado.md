# Roadmap infraestructura — estado y pendientes

Mapa único del estado de construcción de "CampersNova OS" (de concesionario a infraestructura del caravaning), lo pendiente por capa y las **decisiones que dependen del dueño**. Complementa las secciones "Estado actual/previo" de `CLAUDE.md` y los planes por bloque en `docs/`.

> El documento estratégico fundacional (visión completa, comparables, objetivos de valoración y financieros) es **privado**: NO está en el repo. Vive solo en la memoria local del asistente. Este doc es la vista **arquitectónica/operativa**, sin cifras confidenciales.

_Última actualización: 2026-07-11 (tras B21 — sistema de KPIs/dashboards completo)._

## Estado de las 10 capas

| #   | Capa                    | Estado     | Bloque(s)                                                                           |
| --- | ----------------------- | ---------- | ----------------------------------------------------------------------------------- |
| 1   | Buyer Demand Graph      | 🟢 v1      | Ficha comprador (CAM-60→66) + financiación (B17)                                    |
| 2   | Seller Supply Graph     | 🟢 v1      | Captación (B16) + condiciones de operación (B17)                                    |
| 3   | Vehicle Identity Layer  | 🟢 v1      | Taxonomía RV (B11); falta base/camperizador + catálogo normalizado                  |
| 4   | Vehicle Trust Passport  | 🟢 v1      | Expediente legal (Block 4) + **Trust Passport unificado + sello (B20)**             |
| 5   | Market Valuation Engine | 🟡 parcial | Tasación comparables/referencia; falta tiempo/probabilidad de venta                 |
| 6   | Buyer-Vehicle Matching  | 🟢 v1      | Matching RV + explicación (CAM-64) + alertas de demanda (B19)                       |
| 7   | Operational Workflow    | 🟢 v1      | Máquinas de estado + calendario (B15) + taller                                      |
| 8   | Transaction & Financing | 🟡 parcial | **Ofertas y Reservas (B18)**; faltan contratos/pagos/financiera/gestoría            |
| 9   | Distribution & API      | 🟡 parcial | Generación de anuncios + catálogo público; **API externa NO empezada**              |
| 10  | Market Intelligence     | 🟢 v1      | **7 dashboards KPI (B21)** + scoring (B19); falta 5ª entidad "Mercado" + predicción |

Leyenda: 🟢 v1 en producción · 🟡 parcial · 🔴 no empezado.

**Capa transversal — Observabilidad/KPIs (Block 21, completo):** `kpi_events` + completitud + North Star, y **7 dashboards** (Dirección · CRM · Comercial · Operaciones · Matching · Mercado · Calidad) con umbrales del dueño, drill-down y export CSV. Plan y pendientes en `docs/Dashboards-KPIs-Plan.md`.

## Pendiente técnico por capa (lo que se puede hacer sin decisión externa)

- **Capa 1/2 (datos)** — capturar financiación desde el chat de `/comprar` (hoy solo backoffice). Persistir scores si hace falta ordenar/filtrar listados por score (hoy se calcula en lectura).
- **Capa 3 (identidad)** — distinguir base/carrocería/**camperizador**; catálogo normalizado de modelos; media completeness score.
- **Capa 4 (trust)** — sello externo/URL verificable (QR); checks técnicos dedicados de trust (humedades/gas/agua) como ítems propios si se quieren separar del checklist del taller.
- **Capa 5 (valoración v2)** — añadir tiempo estimado de venta, probabilidad de cierre, demanda activa como input, sensibilidad al precio, recomendación comercial.
- **Capa 6 (matching)** — alertas push/email cuando entra un vehículo que satisface una demanda activa concreta (hoy es _pull_ desde dashboard/ficha).
- **Capa 8 (transacción)** — contratos, pagos, señales formalizadas; "reserva vence" como recordatorio de calendario (patrón de agregación ya disponible); reporting de precios reales de cierre.
- **Capa 10 (inteligencia)** — entidad "Mercado" (patrones: días de venta por modelo, elasticidad estacional, extras que dan margen), previsión de demanda.
- **KPIs (B21) — mejoras opcionales** — enganchar los eventos que faltan (vehículo publicado/vendido/valorado, match, cita, entrega; hoy solo se emiten alta de lead/oferta/reserva/venta/sello y los dashboards ya funcionan leyendo de tablas); validaciones duras (bloquear cita sin outcome, venta sin margen); export PDF + endpoints `/api/kpis/*`; persistir scores/completitud.

## Pendiente de captación (B16) y calendario (B15)

- **B16 F4 (opcional)**: reporting de captaciones por portal / tasa de conversión / por comercial.
- **B15**: vista mensual + reporting avanzado ya hechos; IA "crear evento desde texto natural" pendiente (base lista).
- Fuera de alcance de captación (viven en el flujo del vendedor real): contrato de depósito-venta con el vendedor + cuestionario de recepción del vehículo en la nave.

## Decisiones que dependen del dueño (bloquean fases mayores)

1. **Portal profesional (capa 9, ~2028 en el plan)** — abrir el CRM a terceros como producto: alcance, pricing, qué se expone. No empezar sin definirlo.
2. **Integraciones de partners** — financiera, seguros, taller externo, gestoría: con quién, qué API/flujo, quién asume el desarrollo.
3. **API externa** — es el _destino_, no el inicio; requiere volumen de operaciones y decisión de a quién se abre (valoración, trust, matching, publicación, transaccional).
4. **Persistir scores vs calcular en lectura** — hoy en lectura; si se quiere ordenar/filtrar listados grandes por score, decidir persistencia + recálculo.
5. **Expansión europea (capa 10, 2030+)** — fuera de horizonte inmediato.

## Operativa — lo que el EQUIPO debe empezar a usar (para alimentar las capas)

- Rellenar **financiación** (comprador) y **condiciones de operación** — precio mínimo, modalidad, urgencia, riesgo — (vendedor) → mejora buyer/seller score.
- Registrar **ofertas y reservas** con importe y señal → captura precios reales de cierre + reserva/libera stock automáticamente.
- Etiquetar el **stock RV** (botón "Sugerir con IA") → afina matching y chat.
- Completar **expediente legal + revisión de taller** y **emitir el sello** → aparece el badge "Verificado por CampersNova" público que atrae compradores.

## Pendientes externos/operativos (fuera de código)

Ver también `docs/LAUNCH.md` y `docs/PRODUCTION-READINESS.md`. Principales vivos:

- `NEXT_PUBLIC_APP_URL` → dominio real (sitemap); Supabase Auth Site URL en el dominio.
- Rotar tokens `.codex`; decidir compute de Supabase bajo carga (Micro→Small).
- E2E autenticado contra staging (CAM-42) — handoff en `CLAUDE.md` (Fases 4+7).

## Principios de priorización (filtro del flywheel)

Una feature entra si **aumenta operaciones, captura mejores datos, reduce riesgo o crea dependencia**. Si no, puede esperar. Encajar cada propuesta en su capa antes de construir.
