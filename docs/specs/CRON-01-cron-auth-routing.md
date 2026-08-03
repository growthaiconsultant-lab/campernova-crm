# CRON-01 — Garantizar que Vercel Cron alcanza las rutas protegidas

| Campo               | Valor                    |
| ------------------- | ------------------------ |
| **Estado**          | DRAFT                    |
| **Owner**           | Engineering / Operations |
| **Ticket**          | CRON-01                  |
| **Rama / PR**       | Pendiente                |
| **Categorías**      | C5, C8, C9               |
| **Riesgo**          | Alto                     |
| **Ruta SDD**        | Reforzada                |
| **Última revisión** | 2026-08-03               |

## Problema y evidencia

`vercel.json` programa `/api/cron/postventa-followups` y `/api/cron/calendar-reminders`. Ambas rutas
validan `Authorization: Bearer <CRON_SECRET>`, pero el matcher global incluye `/api/cron/*` y el
middleware redirige cualquier ruta no pública sin sesión Supabase a `/login` antes de ejecutar el
Route Handler.

La incompatibilidad está demostrada estáticamente en `middleware.ts`, `vercel.json` y ambos Route
Handlers. Todavía no existe evidencia de una invocación real controlada; por eso la spec permanece
`DRAFT` y no autoriza modificar producción.

## Resultado esperado

- Vercel Cron puede alcanzar exclusivamente las rutas cron configuradas.
- Las rutas siguen rechazando llamadas sin un `CRON_SECRET` válido.
- El middleware no convierte una petición cron autorizada en redirect HTML.
- Cada job es idempotente y registra una señal segura de éxito o fallo.
- Existe una prueba repetible que cubre middleware y autorización del handler.

## Reglas e invariantes

- Nunca hacer pública una ruta cron sin autenticación equivalente o superior.
- No registrar el secreto ni la cabecera Authorization.
- Comparar credenciales en el servidor y fallar cerrado en producción.
- Reintentos de Vercel no deben duplicar emails, follow-ups o Activities.
- Una ruta cron desconocida bajo `/api/cron/` no debe quedar autorizada por prefijo accidental.

## Fuera de alcance

- Cambiar horarios de ejecución.
- Rediseñar follow-ups o recordatorios.
- Ejecutar manualmente los jobs en producción durante la implementación.
- Introducir una cola o proveedor nuevo.

## Decisiones pendientes

| Decisión                  | Alternativas                                                        | Recomendación                                                                                 |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Boundary de autenticación | Excluir rutas exactas del middleware / validar Bearer en middleware | Excluir únicamente las dos rutas exactas y mantener auth en cada handler; menor acoplamiento. |
| Señal operativa           | Log estructurado / tabla de ejecuciones / monitor externo           | Empezar con log estructurado sin PII y alerta; tabla sólo si existe necesidad de historial.   |
| Prueba de staging         | Cron real / petición controlada equivalente                         | Petición controlada con secreto de staging; no usar producción para probar.                   |

## Plan técnico preliminar

1. Extraer una decisión explícita de routing para las dos rutas cron exactas.
2. Añadir tests de middleware: cron exacto, cron desconocido, público y backoffice.
3. Añadir tests de handlers para secreto válido, ausente e inválido.
4. Verificar idempotencia de cada job bajo doble invocación.
5. Configurar staging y ejecutar una petición controlada.
6. Desplegar con observación y comprobar logs/efectos sin PII.

## Criterios de aceptación

- [ ] Sin sesión Supabase y con Bearer válido, cada ruta cron llega al handler.
- [ ] Sin Bearer o con Bearer inválido, responde 401 y no ejecuta efectos.
- [ ] `/api/cron/cualquier-otra-ruta` no obtiene bypass.
- [ ] Dos invocaciones equivalentes no duplican efectos.
- [ ] El response es JSON, nunca redirect a `/login`.
- [ ] Staging registra una ejecución controlada verificable.
- [ ] Producción sólo se toca tras aprobación independiente del plan reforzado.

## Rollout, rollback y stop conditions

- **Rollout:** test local → CI → staging → revisión → producción supervisada.
- **Rollback:** revertir routing; mantener handlers fail-closed.
- **Detener si:** aparece cualquier bypass genérico de `/api/cron`, se expone el secreto, se duplican
  efectos o staging no reproduce las cabeceras de Vercel.
- **Validación post-despliegue:** confirmar status, duración, registros procesados y ausencia de
  duplicados durante al menos dos ventanas programadas.

## Estado de autorización

`PLAN REQUIRES TARGETED CORRECTION`

Faltan el inventario completo de efectos de ambos jobs, la estrategia de test de middleware y la
evidencia de configuración de staging. Esta spec autoriza investigación y planificación, no cambios
de producción.
