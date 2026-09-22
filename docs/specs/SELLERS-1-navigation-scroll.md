# SELLERS-1 — Vendedores con navegación verificable y desplazamiento acotado

| Campo               | Valor                                                 |
| ------------------- | ----------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                           |
| **Owner**           | Engineering                                           |
| **Ticket**          | SELLERS-1; solicitud del usuario en esta conversación |
| **Rama / PR**       | codex/sellers-1-navigation-scroll; PR pendiente       |
| **Categorías**      | C0, C1                                                |
| **Riesgo**          | Bajo                                                  |
| **Ruta SDD**        | Estándar                                              |
| **Última revisión** | 2026-09-22                                            |

## Problema y evidencia

El usuario informa de fichas aparentemente repetidas y desplazamiento que no termina.
En producción se comprobaron tres destinos distintos, con contenido distinto; no se reprodujo
el vendedor incorrecto. La lista muestra 50 filas, con 4.154 px de contenido en 660 px visibles.
La paginación sólo aparece al final. El scroll sí alcanza un final: no hay evidencia de carga infinita.
El shell usa altura de viewport tradicional y contenedores internos desplazables.

## Resultado esperado

25 vendedores por página, controles de página arriba y abajo, rango y total claros incluso sin
resultados. Cada fila conserva su enlace propio. El shell se adapta al viewport dinámico móvil y
contiene el desplazamiento al llegar a sus límites.

## Reglas e invariantes

- Conservar filtros y orden al paginar; desempatar el orden por ID para evitar saltos entre páginas.
- Normalizar páginas inválidas y acotar páginas que ya no existen al último resultado disponible.
- Mantener enlaces nativos, accesibilidad de teclado, permisos y separación web/backoffice.
- Autorización actual: implementación, commit, push, PR, CI y Preview (confirmada el 2026-09-22).
  Merge y producción requieren autorización propia.

## Fuera de alcance

Datos, migraciones, autenticación, buscador global, cambios comerciales y despliegues.
No se afirma corregido un vendedor incorrecto sin reproducirlo.

## Decisiones

| Decisión   | Alternativas                       | Resolución y motivo                                                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| Tamaño     | 20, 25, 50                         | 25 reduce a la mitad el recorrido sin introducir virtualización              |
| Paginación | Sólo abajo, sticky, arriba y abajo | Arriba y abajo sin tapar contenido ni foco                                   |
| Scroll     | Window, scroll interno             | Conservar arquitectura; altura dinámica, mínimos flex y overscroll contenido |

## Plan técnico

1. Extraer paginación de vendedores con parámetros seguros y controles accesibles.
2. Acotar consulta a 25 filas y mantener orden determinista y filtros.
3. Ajustar límites del shell y validar enlaces en tabla/tarjetas.
4. Tests de límites, render de página y comprobación de navegador con datos sintéticos.

### Impacto

- Código: listado de vendedores, helper puro, controles de paginación, clases del shell.
- Datos/migraciones, permisos, concurrencia y efectos externos: sin cambios.
- Consumidores: ajuste de viewport del shell compartido; revisar escritorio y móvil.
- Observabilidad: sin nuevos eventos ni PII.

## Criterios de aceptación

- [x] Máximo 25 registros por página y controles arriba y abajo cuando hay varias páginas.
- [x] Primera, intermedia, última, vacía y página inválida muestran rangos válidos (tests locales).
- [x] Paginación conserva filtros; filas distintas enlazan destinos distintos.
- [x] Scroll finito en escritorio y móvil, sin desbordamiento del body (fixture local).
- [ ] Integración PostgreSQL y smoke autenticado de Preview pendientes antes de publicar.

## Verificación

2026-09-22, base `ebfde833253c3eea8605dabc4385d97798bd9899`:

- Suite local: 119 archivos / 1.507 tests PASS; incluye 18 casos nuevos de paginación y render.
- Typecheck, lint, check:sdd y diff --check: PASS.
- Build: exit 0 con configuración ficticia local. Las páginas públicas usan su fallback ante la
  ausencia de PostgreSQL local; esto NO valida consultas reales. Avisos existentes de Prisma/Sentry/Webpack.
- Navegador: render real del listado y layout, datos sintéticos y cabeceras/filtros sustituidos en
  fixture local. Escritorio 1280×720: 25 filas, body 720 px, scroll se detiene en 1.351 px aun
  insistiendo. Clic en columna vehículo de fila 2 abre `qa-2`.
- Móvil 390×844: body 390×844 sin overflow externo; scroll se detiene en 2.377,5 px (redondeo
  máximo 2.378). Tarjeta 27 abre `qa-27`. Páginas 1, 2 y 3 muestran 1–25, 26–50, 51–61.
- Esta vista estática NO sustituye E2E autenticado/hidratación Next. Preview sigue pendiente.
- Test PostgreSQL real preparado en `tests/integration/seller-pagination.test.ts`: 26 vendedores
  con igual nombre y fecha, sin duplicados entre páginas, última página y página obsoleta.
  No ejecutado localmente: no hay Docker/PostgreSQL ni TEST_DATABASE_URL de test disponible.

## Rollout, rollback y stop conditions

- Rollout: revisión del diff, autorización de commit/push/PR, CI y Preview, aprobación de producción.
- Rollback: revertir el cambio de interfaz; no necesita rollback de datos.
- Detener si el shell recorta contenido, los enlaces mezclan IDs o se altera autorización.
- Post-despliegue: comprobar dos fichas, filtros, páginas y límites del scroll con sesión real.

## Revisión adversarial

Comprobar valores inválidos/huge de página, cero resultados, última página incompleta,
filtros con espacios, registros con mismo nombre, teclado y viewport móvil.

## Cierre

Implementación publicada en [PR #182](https://github.com/growthaiconsultant-lab/campernova-crm/pull/182),
commit funcional `746837d06c8af23f5652e83490fbabe834c7a366`.
CI y Preview en curso: consultar los checks de la PR para su estado vivo.
Próximo gate: integración PostgreSQL y smoke autenticado de Preview antes de solicitar merge.
El flujo de autorización proviene de AGENTS.md §7. Producción no está modificada.
