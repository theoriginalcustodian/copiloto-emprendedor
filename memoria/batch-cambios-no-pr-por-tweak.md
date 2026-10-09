---
name: batch-cambios-no-pr-por-tweak
description: El operador NO quiere commit/push/PR por cada cambio chico (es trabado) — batchear docs/cambios pequeños en menos PRs/commits con sentido
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22, feedback directo del operador:** *"no hagas commit push pr a cada rato... no nos sirve trabajar así, es muy trabado"*. En una sola sesión hice ~5 PRs separados (#57 #58 #59 #60 #61) por cambios chicos de docs, cada uno con su merge-gate → fricción.

**Why:** PR-por-cambio-chico = un merge-gate (atención del operador) por cada tweak → workflow trabado y lento. La ceremonia de merge tiene costo. Es exactamente el **M4 del retro** ("default 1-PR-por-unidad") que yo mismo había identificado y seguí violando.

**How to apply:** acumular cambios relacionados (sobre todo docs) y commitear/PRear en **lotes con sentido**, NO uno-por-edición. Cuando el operador itera conversacionalmente sobre docs/plan: **retener las ediciones y bundlear** — hacer todas las ediciones, después UN commit/PR (o pocos, lógicos), no un PR por doc. Sigue valiendo: nada de push directo a `main` (regla del proyecto) — pero batchear en menos ramas/PRs. La excepción es cuando el operador pide explícitamente cerrar/mergear algo puntual.

Tensión a no perder: batchear NO debe causar drift ni perder el registro — se sigue propagando todo ([[propagar-cierre-a-docs-maestros]]), solo que en menos commits. Relacionado: M4 en `docs/ROADMAP.md` (🗒️ ANOTADO).

**⚠️ REINCIDENCIA 2026-07-25 — la misma sesión que escribió esta memoria la violó.** En una sola
sesión de trabajo conversacional (CONTEXT.md, README, hooks de eficiencia, mapa de funciones) hice
**7 PRs separados** (#141-#147), cada uno con su propio `commit-tree` + push + `gh pr create` + `gh pr
merge`. El operador cortó explícito: *«no hagas commit push pr merge por cada cosa que hagamos… una
vez que definamos todo se hace junto»*.

**Por qué reincidió pese a estar escrita:** cada cambio individual se sentía "cerrado" (una decisión
tomada, un documento terminado) y el patrón de la sesión —construir sobre `origin/main` con
`commit-tree` para no tocar el checkout compartido— hace el PR-por-cambio **mecánicamente barato**: no
hay fricción técnica que lo frene, así que nada compite con el hábito. Es la brecha que la propia
constitución nombra: *"una regla escrita protege del olvido, no de la racionalización"* — acá ni
siquiera hizo falta racionalizar, alcanzó con que fuera fácil.

**Ajuste concreto para la próxima sesión:** default a **NO mergear en el momento**. Acumular los
cambios (ediciones locales, o commits en una sola rama de trabajo si hace falta persistir entre
turnos) y recién abrir/mergear PR(s) cuando el operador cierre el tema o lo pida explícito — "listo,
mergealo" es la señal, no "terminé de escribir este archivo". Si son cambios de dominios distintos
sin relación (código vs. hooks globales vs. memoria), pueden ir en PRs separados **pero igual
diferidos**, no uno inmediatamente después del otro.

---

## Refuerzo 2026-10-09 — reincidencia #2, y la fricción que faltaba ya existe: el `.goal`

Hoy, en plena apertura del sprint mobile, iba a abrir un PR por **dos archivos de memoria**. El
operador cortó: *«no hagas prs todo el tiempo… tenemos que esperar una barbaridad de tiempo para que
se mergeen y el trabajo se retrasa muchísimo»*. Es la **segunda** vez sobre esta misma entrada, que ya
decía «default a NO mergear en el momento» y que *«terminé de escribir este archivo» no es la señal*.

**Lo que la entrada ya había diagnosticado y seguía sin resolver:** *«no hay fricción técnica que lo
frene, así que nada compite con el hábito»*. Una nota más enfática no agrega fricción. El mecanismo
que faltaba **ya existe desde ayer** y no lo había conectado a esto:

> **Un PR se abre cuando se cierra el `.goal` activo — no cuando se termina un archivo.**

`scripts/goal.sh show` dice si hay una orden abierta, y el gate de atribución ya marca `FUERA-GOAL`
todo commit que cite otro id. Un PR cuyo contenido no es el DoD del goal vigente es exactamente ese
desvío, una capa más arriba: en vez de un commit fuera de la orden, un **ciclo de PR entero** fuera de
la orden. El costo no es simbólico — cada PR cuesta la espera del CI, y esa espera **la paga el
sprint**, no yo. Ver [[autorizacion-permanente-merges-y-deploys]]: la autorización permanente elimina
la espera de *aprobación*, no la del CI.

**Lo chico no abre PR propio.** Memoria, docs, refuerzos y fixes mecánicos se **commitean local y
esperan** al próximo lote sustantivo. Lo único que sale solo es lo que **desbloquea a otra sesión**, y
eso se dice explícito al abrirlo. Caso de hoy: los dos refuerzos quedaron commiteados en
`plan/refuerzos-modelo-por-tarea-y-anclas` **sin pushear**, esperando el lote del sprint mobile.

**El chequeo de un segundo, antes de tipear `gh pr create`:** *¿esto es el DoD del goal activo, o
desbloquea a alguien hoy?* Si ninguna de las dos, el commit se queda local.
