# PUB-2 — Publicación libre (override del expediente + publicar sin tasar)

| Campo               | Valor                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Estado**          | EN PRODUCCIÓN ✅ (PRs #158 y #159, fusionados a `main` y desplegados el 2026-07-29)                      |
| **Migración**       | Ninguna (sin cambios de schema)                                                                          |
| **Owner**           | Engineering                                                                                              |
| **Decisión**        | Del dueño (Joel), 2026-07-29                                                                             |
| **Alcance**         | Flujo de publicación de un `Vehicle` a la web pública desde la ficha del vendedor.                       |
| **Fuera de alcance**| Web pública, generación de anuncios (Wallapop/Coches.net), retirada de anuncio (PUB-1, ya existente).    |

## 1. Qué se pidió (decisión de negocio)

Dirección (ADMIN) y comerciales (AGENTE) querían **libertad para publicar/retirar un vehículo cuando quieran**, sin que los bloqueen los requisitos del expediente legal ni la tasación previa. Decisión tomada de forma explícita, asumiendo el riesgo de compliance.

**Riesgo aceptado:** se pueden publicar al público vehículos **sin ITV vigente, sin documentación completa y sin tasación**. Además, un vehículo publicado sin `salePrice` aparece en la web como **"Precio a consultar"** y sin galería si no tiene fotos. Cada publicación forzada queda **auditada**.

Se eligió la variante **"avisos + publicar igual"**: la tarjeta que indica qué falta se conserva; se añade una salida de escape explícita.

## 2. Qué se implementó

### PUB-2a — "Publicar de todas formas" (override del gate legal) · PR #158

- Botones **"Publicar"** (normal) y **"Publicar de todas formas"** (forzado) en la tarjeta del expediente legal de la ficha del vendedor.
- Nueva server action `forcePublishVehicle` (junto a `publishVehicle`), guard `requireAgente` (ADMIN/AGENTE).
- La forzada **salta únicamente** la comprobación `isReadyForStatus` del expediente legal (ITV, 7 documentos, cargas DGT, VIN, precios).

### PUB-2b — Publicar sin tasar (`NUEVO → PUBLICADO`) · PR #159

- El botón aparece también cuando el vehículo está en **`NUEVO`** (antes solo `TASADO`).
- La publicación forzada admite el origen `NUEVO`, publicando directamente sin pasar por la tasación oficial.
- La transición `NUEVO → PUBLICADO` es una **excepción contenida**: se activa con un opt-in explícito `allowDirectPublicationFromNuevo` que **solo** pasa la acción dedicada de publicación. La edición manual genérica (`updateVehicle`) mantiene `VEHICLE_TRANSITIONS` cerrado — `NUEVO` sigue **sin salidas manuales** por otras vías (no se reabren las transiciones que I3 retiró).

## 3. Qué se conserva (invariantes de seguridad)

El override afecta **solo** a las reglas de negocio (expediente + tasación). Todo lo demás se mantiene idéntico a la publicación normal:

- **Concurrencia:** lock de raíces (`withLockedRoots` sobre `Vehicle → SellerLead`) + **CAS** sobre el estado releído (`where: { id, status: fromStatus }`). Sin dobles publicaciones ni carreras.
- **Autorización:** `requireAgente` (ADMIN/AGENTE). Un rol no autorizado (TALLER/ENTREGAS/MARKETING) se rechaza antes de tocar datos.
- **Guards de integridad:** vendedor archivado (`LEAD_ARCHIVED`), raíz cambiada (`VEHICLE_ROOT_CHANGED`) y `OFFICIAL_VALUATION_REQUIRED` (este último solo protege la vía a `TASADO`, no afecta a `→ PUBLICADO`).
- **Auditoría:** cada publicación forzada crea una `Activity` de tipo existente `CAMBIO_ESTADO` con contenido **"Publicación forzada: … → PUBLICADO. Requisitos pendientes: …"** (lista de lo que faltaba) y el actor. Sin nuevo enum → sin migración.
- **Efectos posteriores:** `publishedAt` (primera publicación, no se sobreescribe), recálculo de matches y revalidación del catálogo público.

## 4. Dónde está en la UI

- **Ficha del vendedor** (`/vendedores/[id]`) → sección **"Expediente legal"** (tras "Datos legales" y "Documentos del expediente").
- La tarjeta y los botones **solo se muestran a ADMIN/AGENTE** (`{isAgente && ...}` en `page.tsx`) y cuando el vehículo está en **`NUEVO` o `TASADO`**.
- Estado en regla → **"Publicar"**; faltan requisitos → **"Publicar de todas formas"** (con confirmación).
- **"Retirar anuncio"** (PUB-1) aparece cuando el vehículo está `PUBLICADO`.

## 5. Cara al público

El vehículo publicado aparece en `campersnova.com/comprar/vehiculos` (catálogo) y en su ficha `/comprar/{marca-modelo-año-id}`. **Precio público = `salePrice`** (nunca compra/margen/valoraciones). Caché ISR ~10 min. Ver el flujo público en `lib/public-catalog.ts`.

## 6. Archivos clave

- `app/(backoffice)/vendedores/[id]/actions.ts` — `publishVehicleInternal`, `publishVehicle`, `forcePublishVehicle`.
- `lib/vehicle-status.ts` — `applyManualVehicleUpdateTx` + opt-in `allowDirectPublicationFromNuevo` (excepción contenida).
- `components/vehicle-legal/missing-for-publish-card.tsx` — tarjeta + botones.
- `components/vehicle-legal/publish-vehicle-button.tsx` — botón cliente (`publishVehicle` / `forcePublishVehicle`).
- Tests: `app/(backoffice)/vendedores/[id]/actions.test.ts`.

## 7. Deuda / validación pendiente

- **Validación autenticada en producción:** pendiente de que el equipo confirme en vivo el botón sobre un vehículo `NUEVO` y `TASADO` (no verificable en headless por el gate de auth del backoffice).
- **Calidad de las fichas públicas:** publicar sin `salePrice`/fotos produce fichas "peladas" ("Precio a consultar", galería vacía). Es comportamiento aceptado; la mejora sería un aviso de UX al forzar sin precio/fotos.
