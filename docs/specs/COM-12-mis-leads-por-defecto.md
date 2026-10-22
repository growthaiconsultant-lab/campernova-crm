# COM-12 — Abrir los leads del comercial por defecto

| Campo               | Valor                                    |
| ------------------- | ---------------------------------------- |
| **Estado**          | IMPLEMENTED                              |
| **Owner**           | Engineering / Comercial                  |
| **Ticket**          | Petición del usuario en chat, 2026-10-22 |
| **Rama / PR**       | codex/mis-leads-duplicados               |
| **Categorías**      | C0, C1, C4                                   |
| **Riesgo**          | Medio                                     |
| **Ruta SDD**        | Reforzada                                 |
| **Última revisión** | 2026-10-22                               |

## Problema y evidencia

Compradores y Vendedores abren la vista general. Los comerciales pueden interpretar
que todos los leads visibles les corresponden y llamar a clientes de otros responsables.
El usuario solicita abrir Mis leads y revisar duplicados entre responsables en producción.

## Resultado esperado

Ambos listados abren Mis leads al entrar sin vista ni filtro de comercial explícitos.
El equipo puede elegir la vista general y las demás vistas existentes.

## Reglas e invariantes

- Mis leads filtra por el usuario autenticado, incluidos administradores con cartera.
- Una vista explícita prevalece; los enlaces generales llevan view=todos.
- Un enlace con agentId explícito conserva ese filtro sin añadir el usuario actual.
- Elegir Mis leads elimina un filtro anterior de otro responsable.
- Los permisos y las notas compartidas no cambian.

## Fuera de alcance

Fusión, borrado o reasignación de fichas; cambios del reparto automático o del intake.
La consulta de producción no autoriza modificar clientes.

## Decisiones

| Decisión        | Alternativas         | Resolución y motivo                              |
| --------------- | -------------------- | ------------------------------------------------ |
| Vista inicial   | General o personal   | Personal, solicitado por el usuario              |
| Admin comercial | General o personal   | Personal también: puede tener leads asignados    |
| Duplicados      | Modificar o informar | Consulta de solo lectura; preservar el historial |

## Plan técnico

1. Resolver la vista inicial con una función compartida y tests.
2. Añadir Mis leads a los listados y enlaces explícitos a las vistas generales.
3. Consultar coincidencias por teléfono normalizado o email entre responsables distintos.

### Impacto

- **Código y consumidores:** listados Compradores y Vendedores.
- **Datos/migraciones:** ninguna modificación; auditoría separada de solo lectura.
- **Permisos/seguridad:** autorización existente; datos de auditoría fuera de Git.
- **Concurrencia/idempotencia:** N/A, vistas de lectura.
- **Integraciones/efectos externos:** despliegue habitual vía PR y CI.
- **Observabilidad/KPIs:** sin cambios.

## Criterios de aceptación

- [x] Entrada sin parámetros resuelve la vista personal de ambos módulos.
- [x] Vistas explícitas y filtros directos de responsable se respetan.
- [x] Se puede seleccionar Todos / En gestión y volver a Mis leads.
- [ ] Duplicados entre responsables comprobados en producción.

## Verificación

| Criterio                           | Evidencia prevista                    | Resultado                                                         |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Vista personal y vistas explícitas | Vitest lead-list-view                 | 8 casos aprobados                                                 |
| Filtro de vendedores               | Vitest seller-intake                  | 11 casos aprobados                                                |
| Tipos y lint                       | typecheck / lint                      | Pendiente de cierre                                               |
| Duplicados                         | Consulta de producción sin escrituras | Bloqueada: credenciales sensibles no exportables y CRM sin sesión |

## Rollout, rollback y stop conditions

- **Rollout:** PR con CI quality verde; despliegue normal de main.
- **Rollback/mitigación:** elegir vista general o revertir el commit de las vistas.
- **Detener si:** CI falla o aparecen cambios fuera del alcance.
- **Validación post-despliegue:** verificar revisión desplegada y, con sesión, entrada personal.

## Revisión adversarial

| Riesgo intentado                  | Mitigación o riesgo pendiente                   |
| --------------------------------- | ----------------------------------------------- |
| Todos vuelve a Mis leads          | view=todos explícito en el enlace               |
| Otra cartera queda vacía          | agentId explícito resuelve vista general        |
| Mis leads conserva otro comercial | El enlace elimina ese agentId                   |
| Exposición de contactos           | Auditoría sin teléfonos/emails en salida ni Git |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** pendiente.
- **Validación:** tests de dominio locales; consulta de producción pendiente de acceso.
- **Deuda restante:** verificar coincidencias reales antes de proponer una corrección de datos.

## Consulta administrativa y autorización

El alcance solicitado incluye desplegar la vista personal y comprobar duplicados en producción. La consulta /compradores/duplicados exige requireAdmin antes de leer compradores y vendedores, compara teléfono normalizado y correo y muestra sólo fichas, responsables y estados. Las coincidencias pueden corresponder a familiares; no se fusionan ni reasignan registros. No se serializan contactos al HTML ni a logs. Pruebas de control de acceso y render sin contactos: 2; agrupación: 5. La sesión administrativa del usuario ya está disponible para validar tras desplegar. No hay migraciones ni escrituras de negocio. Rollback: revertir el commit; detener ante fallo de quality o exposición de contactos.

