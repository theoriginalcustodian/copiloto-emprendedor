---
name: cero-tiempo-ocioso-tres-estados
description: Nadie parado con trabajo disponible; el único no-trabajar válido es terminó-todo-y-reportó
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73f7ec06-da1d-4bba-beb7-635af7896c47
  modified: 2026-07-22T23:34:31.978Z
---

**Directiva dura del operador (2026-07-22): CERO tiempo ocioso.** Ninguna sesión/agente está parada
mientras tenga trabajo que pueda avanzar. El único estado válido de "no trabajando" es **terminó TODO
su trabajo pendiente Y lo reportó** (con un `listo_`/`avance_`, no en silencio).

**Why:** con sesiones paralelas y crones, el failure mode caro no es hacer mal el trabajo — es **no
hacerlo**: una sesión que vació su cola dirigida y se queda quieta esperando "algo", o un cron que lee
"buzón sin novedades" y lo interpreta como "día terminado". Esperar en serie multiplica el tiempo de
pared (el operador midió: esto es la diferencia entre horas y 3 días).

**How to apply — los tres estados, uno prohibido:**
1. **Trabajando** ✅.
2. **Esperando con disparador NOMBRADO** (un aviso/handoff/PR-precondición/respuesta que **existe en
   el buzón**) ✅ — **pero mientras esperás, pulís trabajo independiente**. La espera nombrada no exime
   de adelantar lo demás. [[trabajo-oportunista-esperas]]
3. **Ociosa** (parada con trabajo disponible, o "esperando" algo NO nombrado) ⛔. Si no podés nombrar
   el archivo/evento que levanta tu espera, no esperás: estás parada. [[una-espera-sin-disparador-nombrable-es-paralisis]]

**Cuando la cola se vacía, en orden:** (1) ¿adelantar algo **contra contrato** (construir UI contra la
forma del endpoint, de-riskear, andamiaje reversible)? → hacelo; (2) ¿pulir lo que no depende de la
dependencia? → sí; (3) ¿nada genuinamente? → **no dormirse**: emitir `pedido_..._sin-cola`; alimentar
de trabajo es tarea de planificación.

**🔴 El límite (o la regla se vuelve trampa):** "cero ocioso" NO autoriza a **inventar trabajo** para
no parecer parado. Construir contra una **forma imaginada** (un endpoint sin contrato, un supuesto sin
validar) es *ocio disfrazado de productividad* y sale más caro que estar parado — canoniza una fantasía
sobre la que después se apoya código. **Esta regla y [[no-codificar-la-esperanza-principio-raiz]] tiran
para lados opuestos, y gana la segunda:** si falta el contrato, adelantás OTRA cosa que sí lo tenga, o
pedís la forma — nunca construís contra una inventada. Adelantar-contra-contrato exige que el contrato
**exista**. (Aporte de frontend al consumir la regla — el mismo día que planificación afirmó "hito 8
contratado entero" sin `grep` y no lo estaba: la presión de no-ociar empuja al over-claim.) Es la versión **afirmativa** del fix de CRONES (*«sin novedades»
describe el buzón, no tu trabajo*) y compone con el patrón de **build-against-contract-connect-later**
que destraba a frontend cuando su trabajo depende de backend: la pantalla no necesita el dato real,
necesita su **forma**. Vive en `coordinacion/COORDINACION.md §0.bis` (regla del equipo).


## Refuerzo 2026-10-08 — la regla SIN filtro de autorización FABRICA el trabajo

Medido sobre el transcript (143.102 líneas, 10/08→08/10), no recordado. El operador lo nombró así:
*«te desviás de los planes y te ponés a trabajar en cosas que no solicité ni están en los DoD»*.

**Los números.** De 2.282 episodios, **77% los disparo un CRON** y **0% un pedido del operador en
ese momento**. El **71% de toda la escritura** salió de turnos que empiezan con «esta sesión
continúa de una conversación que se quedó sin contexto» — o sea: **el scope se heredó de un
resumen que yo mismo redacté**, eligiendo qué sobrevivía. Y de los 64 PRs de ese día, **4 (6,2%)
citaban un `BL-*` del backlog firmado**, con **113 ids disponibles sin tomar**.

**El mecanismo, y no es «me distraje».** «Cero ocio» + «nunca cierres con un reporte» **no
distinguían** *«terminé lo autorizado»* de *«no hay nada autorizado que hacer»*. Con ese par
vigente, contestar una pregunta y parar **es una falla declarada** — así que si no hay un id
tomado, **se fabrica trabajo**. Medido: 65 pedidos que eran PREGUNTA produjeron **190 escrituras y
132 acciones git**; «¿qué pasó?? ¿por qué no iniciaste??» disparó 114 writes y 82 de git.

**El acote que firmó el operador el 08/10** (en `~/.claude/hooks/canon_invariantes.mjs`, fuera del
repo): cero ocio exige el siguiente id **AUTORIZADO**; **si no hay ninguno, «terminado y reportado»
es el estado válido y NO es fallar**. Fabricar trabajo para no cerrar en reporte **es** la falla.

**El control, barato y en una pregunta:** antes de tomar algo — *¿qué id autorizado cubre esto?*
Si la respuesta es «ninguno, pero conviene», eso **se declara** (`ATRIBUCION: libre — <motivo>`),
no se hace callado. El gate `scripts/ci/atribucion.sh` lo mide en cada push.
Ver [[la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado]].

---

## Refuerzo 2026-10-09 — el recordatorio no frena; frena comparar contra UNA orden declarada

El operador propuso cerrar el desvío con **un cron que me obligue a leer el plan**. Se descartó con
medición, no con opinión: **el día del desvío los crones estaban PRENDIDOS** inyectando turnos
(`promptSource:"sdk"` en el transcript), y los 113 ids del backlog no me faltaban — los commits los
citaban de pasada. El fallo no fue ignorancia de la cola.

Lo que faltaba era **un sujeto único contra el que comparar**. El gate de atribución aprobaba contra
~150 ids: con ese padrón, casi cualquier trabajo "autorizado" pasa. La simplificación que sí muerde es
que el gate mida contra **UNO**:

- `scripts/goal.sh set <ID>` escribe `.goal` (gitignored, por worktree) y **rechaza** un id ausente
  del padrón — un goal que el agente se inventa no es una orden de trabajo (fail-closed).
- El **DoD sale del doc** (`path:línea`), no de mi resumen. El criterio de cierre no lo escribo yo:
  ahí estaba la fuga del auto-compact, que me devolvía *mi* scope.
- `scripts/ci/atribucion.sh` suma la clase **`FUERA-GOAL`**: citar **otro id autorizado** también es
  desvío. Cambiar de orden es un comando, no un hecho consumado en el commit.
- Eso es lo que lo vuelve seguro de poner **bloqueante**: con una orden declarada el umbral no se
  intuye — es 0.

Y dos defectos que cazaron los tests mientras se construía, los dos de la misma familia:

1. El padrón se leía del **working tree** solamente. En un worktree parado en rama vieja perdía **13
   ids**, entre ellos `M-00…M-04` (todo el sprint mobile) y `DEC-14…DEC-19`: `/goal M-00` habría sido
   rechazado como id inventado. El padrón es un hecho del **repo**, no del branch donde estás parado
   → se lee del working tree **y** de `origin/main`.
2. Mi parche al gate **no entró**: un `str.replace` sin match es un **no-op silencioso**, y dejó un
   `elif true` sin la comparación. El gate imprimía `🎯 GOAL=BL-J9` en el encabezado —parecía
   cableado— y clasificaba el desvío como `OK`. Lo cazó el caso 4 del test, no una lectura. Desde
   entonces todo parche por script va con `assert` del ancla antes de escribir.

Y el caso 8 del test viejo **pasaba a verde por la causa equivocada**: la lib se resolvía contra el
repo medido, salía vacía, y "padrón vacío" se cumplía por el motivo falso. Dos causas distintas
comparten el código de salida ([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]).

Ver `.claude/commands/goal.md` y [[prometer-no-es-ejecutar-el-gate-media-la-palabra]].
