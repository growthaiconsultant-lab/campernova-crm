# LANDING-5 — Venta en depósito y verificación de Meta

| Campo           | Valor                                                     |
| --------------- | --------------------------------------------------------- |
| **Estado**      | IMPLEMENTED                                               |
| Owner           | Campers Nova / Codex                                      |
| Ticket          | Petición del usuario: token Meta y textos Nira corregidos |
| Rama / PR       | codex/landing-deposito-meta-verification                  |
| Categorías      | C1, C2, C5, C8                                            |
| Riesgo          | Bajo                                                      |
| Ruta SDD        | Reforzada proporcional por publicación y boundary público |
| Última revisión | 2026-10-09                                                |

## Problema y evidencia

Main f8bd143 publica una oferta de compra directa que el usuario corrige: Campers Nova vende en depósito. El archivo proporcionado por Nira cambia los textos y dos valores de prioridad, pero conserva assets v67 y no contiene los snippets de GTM ni el consentimiento compartido desplegados después. La API enum actual rechaza las dos prioridades nuevas. Falta el meta de verificación solicitado en el head del layout Next.

## Resultado esperado

Home publica facebook-domain-verification con dkbsd7oht54oe4wqqfc3tji8w7dr2v. La landing de venta usa exactamente el contenido comercial proporcionado, sin oferta de compra directa, y envía correctamente las prioridades nuevas a CRM/Nira manteniendo compatibilidad con clientes anteriores.

## Reglas e invariantes

- Conservar GTM, consentimiento, assets v69, reintentos, límites y action actuales.
- Enum cerrado añade Venderla pronto y Sacar el mejor precio; admite prioridades antiguas para páginas cacheadas. No modificar datos existentes ni lógica de guardado.
- No crear leads reales ni cambiar GTM, cookies, ads o verificación desde el panel de Meta. Añadir el token al HTML no demuestra que Meta haya verificado el dominio.

## Fuera de alcance

Migraciones, nuevos anuncios, comprador, cambios de tracking, verificación administrativa en Meta.

## Decisiones

| Decisión              | Resolución                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Archivo Nira anterior | Usarlo como fuente de copy y conservar las mejoras técnicas de main; la petición declara que solo cambian textos |
| Valores de prioridad  | Extender el boundary para los dos valores del archivo; conservar valores anteriores para compatibilidad          |

## Plan técnico

1. Meta literal en head del layout Next.
2. Aplicar archivo suministrado y restaurar snippets, consentimiento y versiones actuales; añadir valores al schema.
3. Validación de opciones nuevas/legacy y negativas; E2E vendedor/consentimiento con destinos simulados; typecheck/lint/SDD.
4. CI y Vercel preview, squash-merge, validación pública del meta, copy, formularios simulados y capturas móvil/escritorio.

### Impacto

- Código/consumidores: layout, HTML vendedor, boundary Zod. Buyer intacto.
- Datos/migraciones: ninguna; prioridad sigue siendo texto en NOTA y se conserva sin normalización.
- Permisos/seguridad: sin cambios; input estricto y rutas existentes.
- Concurrencia/idempotencia: sin cambios.
- Integraciones/KPIs: CRM/Nira siguen los mismos contratos salvo dos valores permitidos nuevos. Sin eventos o avisos reales en pruebas.

## Criterios de aceptación

- [ ] Token exacto y único en head de home.
- [x] Copy de Nira aplicado y ausencia de ofertas de compra directa en vendedor.
- [x] Prioridades nuevas y legacy válidas, desconocidas rechazadas.
- [x] Tracking, consentimiento, canonical page/UTM y formularios conservados; sin desbordamiento visual.
- [ ] CI/build/producción y lectura pública verificados.

## Verificación

| Criterio       | Evidencia                                                                | Resultado                         |
| -------------- | ------------------------------------------------------------------------ | --------------------------------- |
| Boundary       | 1716 unit tests, nuevas/legacy válidas y prioridad desconocida rechazada | Local PASS; CI pendiente          |
| UI / contratos | 20 E2E seller/tracking, capturas móvil/escritorio revisadas              | Local PASS                        |
| Meta / copy    | Copy normalizado exacto con fuente Nira; meta literal en layout          | Local PASS; SSR público pendiente |
| Publicación    | PR/CI/Vercel y smoke público                                             | Pendiente                         |

## Rollout, rollback y stop conditions

- Publicar conjuntamente HTML y schema compatible después de CI y preview verdes.
- Rollback: revertir commit; sin migraciones ni cambios de contenedor. Los valores anteriores continúan admitidos.
- Parar si desaparece GTM/consentimiento, el formulario nuevo obtiene 400, hay compra directa en copy o build/check falla.
- Ventana proporcional: lectura pública y pruebas interceptadas tras READY; guardar cierre operativo en PR mutable sin commits circulares.

## Revisión adversarial

| Riesgo                                    | Mitigación                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Copia literal elimina cambios posteriores | Diff técnico revisado y restauración de snippets/banner/assets actuales |
| Radio values nuevos rechazados            | Enum compatible y regresiones de validación                             |
| Meta presente fuera de head o duplicado   | Inspección del HTML SSR publicado                                       |

## Cierre

Implementado y validado localmente: typecheck, lint, SDD y 1716 unit tests verdes; 20 E2E vendedor/tracking en móvil y escritorio con destinos simulados y capturas revisadas. Comparación normalizada exacta con el archivo Nira: únicas diferencias son GTM, consentimiento y assets v69 preservados. El primer intento E2E sin limitar workers saturó el equipo y se detuvo; repetición con 2 workers verde. CI, preview y producción pendientes; cierre operativo y evidencia final en la PR.
