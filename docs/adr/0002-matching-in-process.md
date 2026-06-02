# ADR 0002 — Matching in-process (no edge function ni cron)

**Estado**: Aceptado

## Contexto

El recálculo de matches comprador↔vehículo debe dispararse al crear/editar leads o vehículos. Opciones: edge function dedicada, cron periódico, o llamada in-process desde los Server Actions.

## Decisión

Recalcular **in-process** desde los Server Actions (`lib/matching/recalculate.ts`), tras tasar o editar. El diff es idempotente (`computeRecalcDiff`): respeta los estados avanzados por el agente y solo toca los `SUGERIDO`.

## Consecuencias

- Para un equipo de 3 agentes el coste es despreciable y la latencia aceptable.
- Errores no bloqueantes (try/catch envolvente) — nunca rompen el flujo principal del action.
- Si el volumen crece, se migra a edge function (futuro ADR) sin cambiar la lógica pura de `lib/matching/`.
