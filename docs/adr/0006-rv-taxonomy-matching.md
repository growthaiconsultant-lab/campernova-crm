# ADR 0006 — Taxonomía RV en el matching (distribución, camas, plazas, peso)

**Estado**: Aceptado

## Contexto

El matching v1 solo usaba tipo / plazas / presupuesto / equipamiento (5 flags) / zona / antigüedad / km. Ignoraba lo que de verdad decide la compra de una autocaravana: **distribución** (capuchina/perfilada/integral/camper), **tipo de cama**, **plazas homologadas vs para dormir** y **carnet/peso**. El % de match no era fiable.

La taxonomía se basa en el glosario experto del dueño (ver `docs/taxonomia-rv-glosario.md`).

## Decisión

- **Campos additivos** (migración no destructiva, nullable) en `Vehicle` (categoría, `bedLayout`, `sleepingPlaces`, `bathroomType`, `maxMassKg`, `heightM`, `winterized`, `hasGarage`, `offGrid`) y `BuyerLead` (preferencias espejo + excluyentes). `seats` = plazas **homologadas**; `sleepingPlaces` = para dormir.
- **Excluyente (filtro duro) vs preferencia (puntúa):**
  - Excluyentes: tipo, presupuesto (+10%), plazas homologadas (`minSeats`), plazas para dormir, baño obligatorio, **carnet/MMA** (> 3.500 kg descarta con carnet B), medidas de parking (largo/alto).
  - Preferencias: **distribución**, **tipo de cama**, equipamiento, antigüedad/km, zona.
- **Pesos v1** (`lib/matching/types.ts`, suman 100): categoría 22 · cama 18 · precio 20 · equipo 15 · antigüedad/km 15 · zona 10.
- **Fail-open:** si el vehículo no tiene un dato (stock **sin etiquetar**) NO se descarta — para no ocultar inventario; los ejes sin dato puntúan neutral (60). A medida que se etiqueta, el match se afina.
- **Baño = dimensión única**: `bathroomType` (vehículo) / `bathroomRequired` (comprador). Fuera de los flags de equipamiento; `equipment.bathroom` se **deriva** de `bathroomType` en las acciones (coherencia con tasación y anuncios).
- **Fuente única de opciones/etiquetas**: `lib/rv-taxonomy.ts`, usada por el formulario público `/vender` y las fichas del backoffice (sin duplicar labels).
- **v1 reducido a propósito** (no los ~80 campos del glosario): no sobre-modelar ~13 vehículos ni cargar al equipo de etiquetado. Diferidos: autonomía eléctrica detallada, materiales, estilo interior, off-road.

## Consecuencias

- El % de match refleja distribución + cama + restricciones legales → fiable.
- Requiere que el **agente etiquete el stock** (inspección física en la nave). El alta web captura lo que el vendedor sepa (opcional).
- Lógica pura testeable en `lib/matching` (+12 tests). Migración additiva validada en staging antes de prod.
- La **Fase B (chat)** usará el glosario como conocimiento para mapear el lenguaje del cliente a esta taxonomía.
