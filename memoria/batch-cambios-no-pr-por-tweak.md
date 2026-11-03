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

---

## ⚠️ REFUERZO 2026-11-02 — la forma que reincide es el PR POR MARCADO DE FICHA, y el costo es la espera de CI

**Lo medido.** Reincidí en un solo día con **ocho** PRs: #1400, #1402, #1403, #1405, #1407, #1410,
#1412, #1415. Casi ninguno era código: eran **marcados de ficha** (`--marcar … --estado`),
correcciones de un `Cierre:`/`Falta:` y refuerzos de memoria. Cada uno con su rama, su PR, su
`gh workflow run`, su espera de 6 jobs y su merge. El reclamo del operador nombró el costo exacto,
y no es el ruido en el historial:

> «si hacemos commits y PRs por cada cosa insignificante el trabajo se traba y no terminamos nunca…
> **porque por cada commit hay que esperar CI** y así no avanzamos más»

**Why:** la orden de arriba ya existía y aun así reincidí, porque cada PR se justificaba **solo**.
Marcar una ficha se siente obligatorio —el estado tiene que quedar escrito, el gate lo exige, hay
una sesión esperando el merge para marcar lo suyo— y ninguno de esos argumentos es falso. El error
no está en ningún PR individual: está en que **el trámite cuesta más que el cambio**, y eso sólo se
ve sumando. Un marcado no puede romper runtime; lo único que compra su CI es la atestación de un
doc. Peor todavía era el patrón de dos PRs por un hecho: una sesión manda `cierre_`, planificación
registra la ficha en un PR, y la sesión marca el estado en **otro**.

**How to apply:**
1. **Una rama de lote por sesión** (`<sesion>/lote-estado-fichas`), viva, que acumula marcados,
   correcciones de `Cierre:`/`Falta:`, refuerzos de memoria y docs de registro. Sube cuando hay
   varias cosas o al cerrar el día: **un CI por lote**.
2. **Código, fixes desplegables, gates e instrumentos siguen abriendo PR propio y ya.** Ahí la
   espera de CI se paga por algo. El criterio no es el tamaño del diff: es **si puede romper algo
   en runtime**.
3. **Un hecho, un commit.** Quien tiene la evidencia la manda; **planificación registra Y marca en
   el mismo commit**. Nunca «registrá vos y marco yo después».
4. Lo que el lote **no** relaja: el DoD exige la misma evidencia, `sprint-estado.py --marcar` sigue
   siendo el único que escribe el estado, y un `TERMINADO` sigue necesitando su sha ancestro de
   `origin/main`. El lote cambia **cuándo** se sube, no **qué** se acredita.
5. Conflicto del lote en la **tabla generada**: no se toma un lado, se regenera con `--tabla`
   conservando los dos bloques de bullets ([[resolver-tomando-un-lado-nunca-converge]]).

**El disparador para revisarse, porque la autoevaluación acá no sirve:** si en una jornada abriste
más de un par de PRs y la mayoría no toca código, ya reincidiste — contalos antes de abrir el
siguiente ([[prometer-no-es-ejecutar-el-gate-media-la-palabra]]).

## Refuerzo 2026-11-03 — reincidí, y el costo que el operador nombró NO es el ruido

Abrí **#1475** (el alta de una ficha) y **#1478** (el lote) en la misma jornada, ninguno de los dos
tocando código de la app. El operador me paró con la causa dicha de otra manera que la que yo tenía
escrita acá: *«es anti-eficiente porque hay que andar esperando por cada cosa a que termine»*.

**Hasta hoy esta memoria justificaba el lote por el RUIDO de PRs. El costo real es la ESPERA.** Cada
PR agrega una corrida de CI que hay que vigilar antes de mergear, y con tres sesiones en paralelo eso
serializa el turno sobre algo que no produce nada. Por eso la regla operativa no es «juntá los
commits» sino:

- **Commiteá local todo lo que quieras; `push` una sola vez por jornada de registro.** El commit es
  gratis, el push dispara CI y el PR dispara la espera.
- **Un PR abierto se REUSA.** Si ya hay uno de registro vivo, el próximo marcado va a su rama, no a
  una rama nueva. Abrir el segundo es la reincidencia, no el tamaño del primero.
- El disparador de arriba —contá tus PRs del día— se queda, pero **medilo antes del `push`**, no
  antes del `commit`: cuando ya pusheaste, la espera ya está comprada.

Y el agravante de este caso: ninguno de los dos PR tocaba la app, así que la espera se pagó entera
por mover registro. [[ejecutar-la-cola-acordada-no-es-una-decision-de-scope]]
