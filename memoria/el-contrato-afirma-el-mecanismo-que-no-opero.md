---
name: el-contrato-afirma-el-mecanismo-que-no-opero
description: El riesgo característico de PLANIFICACIÓN — el rol cuyo trabajo es bajar contratos afirma, con autoridad de contrato, el comportamiento de un sistema o persona que no opera directamente. Dos ejes, un tronco, un guardrail. LEER antes de congelar cualquier cláusula que ate un sistema/persona externo.
metadata:
  type: feedback
---

**Mi trabajo (PLANIFICACIÓN) es bajar contratos. La falla característica de ese trabajo es afirmar, con
autoridad de contrato, el mecanismo de algo que no ejecuto yo.** No es un descuido puntual: es la sombra
del rol. Autor de contratos = autor de aserciones que otros construyen encima sin re-chequear — por
diseño. Por eso el radio de daño es mayor que el de una aserción común: **una cláusula de contrato es,
literalmente, lo que otro mapea encima sin volver a leer la fuente.** Si es falsa, se canoniza y todo lo
apoyado la hereda.

## Dos ejes, el mismo tronco ([[no-codificar-la-esperanza-principio-raiz]])

| Eje | Afirmo… | El dato lo tiene… | Cómo se verifica |
|---|---|---|---|
| **A · persona** | la acción/setup/capacidad de otra sesión | **el que ejecuta** | preguntar por el buzón ANTES de escribir |
| **B · sistema** | el mecanismo de un sistema externo (modelo de auth, algoritmo de identidad, schema, forma de una API) | **el código/spike de ese sistema** | leerlo / spikearlo ANTES de congelar |

**Eje A** — canonizado en [[regla-escrita-sobre-el-setup-de-otro]] (5 instancias ya: ramas/worktree/device
de frontend, ADB de backend, ruta del repo, y el runbook que le dijo a backend "provisioná con
`provision-tenant.sh`" asumiendo que tenía **admin de Graphity** — no lo tenía, 403).

**Eje B** — [[formula-de-identidad-congelada-sin-validar-el-mecanismo-del-server]] (2026-07-23): congelé la
fórmula uuid5 de las aristas de estado desde mi modelo mental; el server deriva el `edge_uuid` distinto y
mi fórmula rompía la invalidación **en silencio**. No había "otro ejecutor" con el dato — lo tenía el
**código del server**, y lo cacé porque backend lo leyó, no porque yo lo validé.

## El guardrail (uno solo, cubre los dos ejes)

**Toda cláusula de contrato que ate un sistema o persona que no opero debe llevar su evidencia adosada
—el path de código leído, el resultado del spike, o la confirmación por buzón— o el sello
`[ASSUMED_PENDING_VERIFY]` que bloquea el mapeo aguas abajo.** Una cláusula que afirma un mecanismo
externo sin ninguna de las dos es codificar la esperanza *con autoridad de contrato* — la peor variante,
porque se lee como verdad establecida.

## Lo que SÍ contuvo el daño (la red, no mi disciplina)

Las dos veces las cazó **el ejecutor leyendo la fuente real** (backend), no mi auto-review. Eso no es
suerte: el protocolo del buzón pide "emití un `hallazgo_` si una columna/mecanismo que nombré no matchea
lo que ves". Yo cerré los addendums con esa invitación explícita, y **funcionó las dos veces**. Corolario
operativo: no alcanza con auto-disciplina — hay que **diseñar el contrato para que el ejecutor lo pueda
falsar** y pedirle activamente que lo haga antes de mapear. Un contrato falsable + un ejecutor que lee el
código es el gate que evita que mi error se canonice. Mantenerlo: nunca congelar un mecanismo externo sin
dejarle al ejecutor la puerta del `hallazgo_` abierta y el `[ASSUMED_PENDING_VERIFY]` puesto donde no leí
la fuente. Relacionado: [[verificar-que-el-camino-recomendado-existe]] · [[spike-first-central-proyecto]] ·
[[verificar-la-composicion-root-no-el-default]].
