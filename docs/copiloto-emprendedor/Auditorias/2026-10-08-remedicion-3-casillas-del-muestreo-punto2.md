# Re-medición de las 3 casillas que el muestreo del punto 2 declaró falsas — las 3 salen CUMPLIDAS

**Fecha:** 2026-10-08 · **Autor:** AUDITORÍA (`copiloto-emprendedor-0a`)
**SHA único de medición:** `f932fc5f6496e3de804079be5d60ae0fddb7eeda` (obtenido con
`git ls-remote origin refs/heads/main`, no supuesto del tip local).
**Mide:** las 3 casillas que
[`2026-10-08-muestreo-adversarial-punto2-dec18.md`](2026-10-08-muestreo-adversarial-punto2-dec18.md)
publicó como **falsos ✅** (`§4`, 3 de 10).

## 🟢 VEREDICTO BINARIO: **3 de 3 CUMPLIDAS**

| casilla | antes (medido @ `6ada49e3`) | ahora (@ `f932fc5f`) | residuo |
|---|---|---|---|
| `BL-J9` c4 — «los dos órdenes y el replay intacto» | `replay` = **0 hits** | ✅ **CUMPLIDA** — `Replayer` real sobre history real | 🟡 el replay **sin control positivo propio** |
| `BL-B1` c4 — el verde de durabilidad debe afirmar | verde **por ausencia** de 2 síntomas | ✅ **CUMPLIDA** — exige firma positiva | 🟡 la firma la escribe el propio backend |
| `BL-J11` c4 — «Cerrar sesión» en su grupo (web) | 1 tile, distinción **sólo por color** | ✅ **CUMPLIDA** — tile hermano propio | 🟡 sin test que lo cubra |

**Lo digo igual de fuerte que cuando salieron falsas**, porque eso fue lo que prometí en el `dato_`
que escribí **antes** de ver estas implementaciones: las tres están arregladas, y dos de las tres
**de raíz** (no un parche que satisface el grep).

⚠️ **Y lo que esto NO dice:** mi muestreo midió **10 ítems de 53**. Que mis 3 hallazgos estén
resueltos cierra **mi hallazgo**, no el punto 2 — el punto 2 lo cierra el criterio de planificación,
y sobre su residuo (`BL-O8`, dueño el operador) **no medí nada y no afirmo nada**. Confundir las dos
cosas sería exactamente el error de sujeto que corregí tres veces hoy.

---

## `BL-J9` — ✅ CUMPLIDA, con un residuo que vale más que la casilla

**Lo que pedía mi criterio** (escrito antes, 3 puntos binarios): (1) un test que instancie `Replayer`
y le pase el history de un workflow que ejercitó la precedencia **y que yo lo corra**; (2) control
positivo mío; (3) que corra en el gate.

**Punto 1 — CUMPLIDO en estructura, y es un replay de verdad.** `motor/backend/agent/test_gate_card_precedencia_bloquea.py`
@ `f932fc5f`, 124 líneas, 5 tests `async def`, **0 `skip`, 0 `xfail`**:

- `:16` `from temporalio.worker import Replayer, Worker`
- `:72` `hist = await env.client.get_workflow_handle(nombre).fetch_history()` — **history de un handle
  real**, dentro del `async with env`. No fabricado a mano, no un JSON fixture.
- `:73` `await Replayer(workflows=[ConversationWorkflow]).replay_workflow(hist)`
- `:111` `test_BL_J9_replay_sobrevive_precedencia_bloquea`, único que pasa `replay=True` (`:123`), con
  input `[R_CONEXION, R_SUGERENCIA]` — **el orden exacto que la auditoría A2 midió roto**.

Esto **no** es lo que mi criterio descartaba («un test que *diga* `replay` en el nombre y no instancie
el replayer» · «un `assert` sobre el reply final sin history»). El replayer se instancia y el history
existe.

**Punto 3 — CUMPLIDO.** `scripts/ci/backend.sh:33` corre `pytest` sobre el directorio
`../../motor/backend/agent`, que contiene el archivo (lo cubre por directorio, no por nombre).

**Punto 2 — NO lo corrí, y además el control positivo que existe no mide el replay.** Dos cosas
distintas, las dos hay que decirlas:

1. **Mío, sin correr:** mi criterio decía «lo corro» y «lo hago fallar a propósito». No lo hice —
   exige el VPS (la PC no tiene `temporalio`) y la sesión está parada por orden del operador. **Lo
   declaro faltante, no lo tapo.** Lo que cito del recibo de backend (`gate.sh` 5/5 sobre
   `3a20cfa9`) es **su** evidencia, no mi medición.
2. **El hallazgo, y éste sí es nuevo:** el control positivo que el propio test documenta
   (`:118-122`) es *invertir la precedencia en `conversation_workflow.py:666`* y ver caer el test.
   **Eso no ejercita el replay.** El único `assert` del test (`:124`) es
   `enviados[-1]["card"]["kind"] == "requiere_conexion"` — **el mismo assert, con el mismo input, que
   `test_CONTRATO_...` ya tiene en `:96`**. Invertir `:666` lo pone rojo por la **aserción de
   negocio**, que ya estaba cubierta. Si el `Replayer` estuviera mal cableado —history vacío,
   workflow que no matchea, excepción tragada— **el test saldría verde igual y el control positivo
   saldría rojo igual**. Son **dos causas suficientes y el test no atribuye**: el único control
   corrido mueve la causa que no es la nueva.

**Y el fix ya existe en el repo, a un archivo de distancia.**
`motor/backend/agent/test_narra_guardrail_retiro_replay.py:55-73` tiene exactamente el control que
falta — un `_ConversationWorkflowDivergente` que agenda otra activity como primer paso, y:

```python
with pytest.raises(Exception) as exc:
    await replayer.replay_workflow(WorkflowHistory.from_json(str(uuid.uuid4()), historia))
assert exc.value is not None, "el Replayer no detectó una divergencia evidente: no sirve como gate"
```

Su docstring (`:59-62`) ya nombra el riesgo con las palabras justas: *«un Replayer mal cableado
—history vacío, workflow que no matchea, excepción tragada— pasa en verde y certifica un deploy que
va a romper»*. **El patrón está escrito, probado y versionado; el test nuevo no lo aplicó.**

⇒ fila **`H-J9REPLAYSINCONTROL`** · 🟡 · dueño **backend** · *el `replay_workflow` de
`test_gate_card_precedencia_bloquea.py:73` no tiene control positivo propio; el existente cae por la
aserción de negocio de `:124`, duplicada de `:96`. Reusar el patrón de
`test_narra_guardrail_retiro_replay.py:55-73`.* **No reabre nada** (`DEC-18` regla 3): no invalida la
evidencia de ningún punto ✅ — la casilla **cumple** y esto es entrada del cierre siguiente.

## `BL-B1` — ✅ CUMPLIDA, de raíz

**El defecto exacto que medí está muerto.** Antes:
`_reply_resolvio_el_gate = not repite_confirm and not cayo_en_rama_sin_gate` — verde **por ausencia**
de dos síntomas, con `execute_tool` en 0 hits. Ahora, `scripts/e2e_g6_durabilidad_worker_restart.py`
@ `f932fc5f` (414 líneas):

```python
225: ejecuto_confirmado = (confirmed_tool is not None
226:                       and confirmed_tool.get("activity") == "execute_tool"
227:                       and confirmed_tool.get("confirmed") is True
228:                       and confirmed_tool.get("status") in _STATUS_TERMINALES)
...
243: return not repite_confirm and not cayo_en_rama_sin_gate and ejecuto_confirmado
```

con `_STATUS_TERMINALES = ("ok", "error")` (`:173`) y `_confirmed_tool_de` (`:176-188`). **El `and`
final es la casilla:** ya no se puede llegar al verde sin una firma que **nombre la activity**. Las
ramas que deciden (`:333-344` → `AssertionError` en `:336`; VERDE en `:349`) dependen todas de ese
retorno. Mi criterio pedía «`execute_tool` con `confirmed: true` en el history, **o equivalente que
nombre la activity**» — y `card.confirmed_tool` nombra la activity. **Cumple el criterio tal como lo
escribí**, y no lo endurezco ahora: hacerlo sería el sello al revés.

**Los controles, corridos y con salida adjunta** (citados del `cierre_` de backend, que los pegó
literales): `--control-negativo` → `CONTROL NEGATIVO OK: el instrumento detectó el gate NO resuelto
(ROJO esperado)`; y el **caso exacto que motivó mi hallazgo**, ejercitado contra la función:
`Listo 👍 sin confirmed_tool -> False (antes del fix: True)` · `CON confirmed_tool ok -> True`. Eso
es precisamente el punto 3 de mi criterio («un reply sin `choices` tiene que dar ROJO»), y da rojo.

**Dos matices que registro, ninguno descalifica la casilla:**

- **El `--control-negativo` no ejercita la señal nueva.** Sale por el camino (2)
  (`cayo_en_rama_sin_gate`) y nunca llega al (3) — lo dice el docstring de
  `scripts/tests/test-durabilidad-senal-de-ejecucion.sh:85`. La señal nueva **sí** tiene control, pero
  en **otro** instrumento: ese `.sh` la ejercita con casos sintéticos (sin `confirmed_tool` → False ·
  `ok` → True · `error` → True · `status` ausente → False · `pending` → False · otra `activity` →
  False). Está cubierta; **no** por el flag que mi criterio nombró.
- **La firma la escribe el sistema bajo prueba.** El script habla sólo HTTP (`/chat`, `/reply`) y
  valida `card.confirmed_tool` del JSON que devuelve el backend: `fetch_history` = **0 hits**,
  `ActivityTaskCompleted` = **0 hits**. Es más débil que leer el event history de Temporal, y es
  honesto decirlo — pero es el «equivalente» que mi propio criterio admitía.

⇒ fila **`H-B1FIRMAPROPIA`** · 🟡 · dueño **backend** · *la señal positiva de durabilidad la emite el
backend en `card.confirmed_tool`, no una fuente independiente (0 hits de `fetch_history` /
`ActivityTaskCompleted`). Entrada del cierre siguiente, no reapertura.*

**Nota de calibración, a favor del instrumento:** el commit posterior `4ca28551` (#987) cambió
`status == "ok"` por `("ok","error")` porque el gate dio **ROJO en prod con la durabilidad intacta**
(`calendar_book` devolvió `error`). O sea: el instrumento **corrió contra el sistema real y se
calibró con lo que encontró**. El log de esa corrida no está en el repo — la evidencia es el mensaje
del commit y la salida pegada en el `cierre_`.

## `BL-J11` — ✅ CUMPLIDA, y corrige una cifra mía

**Los 3 puntos de mi criterio, los 3 cumplidos**, leídos en el JSX **y** en el CSS como declaré:

1. **Contenedor propio, no un `margin` sobre la misma fila.** `AccountScreen.tsx:225` es
   `<div className="account-screen__list" data-testid="account-screen-salir-grupo">`, **hermano** del
   tile de Soporte/Cómo uso/Privacidad (`:190-220`), no hijo. Ambos son hijos directos de
   `div.account-screen`. Y `.account-screen__list` (`account.css:110-117`) trae **`background:
   var(--tile-bg)`, `border: var(--tile-border)`, `border-radius`** propios ⇒ **tile con su propio
   borde y fondo**, separado por el `gap: 22px` de `.account-screen` (`:12`). Es exactamente lo que
   pedí, no su apariencia.
2. **La distinción ya no depende sólo del color** (WCAG 1.4.1). El segundo canal es **estructural**:
   posición y separación en su propio tile. El `--danger-fg` (`:156-158`) sigue, pero ya no está solo.
   ⇒ `H-COLORSOLO` **resuelto para este caso en web**.
3. **Paridad declarada.** `scripts/ci/testid-paridad-excepciones.json:4741-4748` registra
   `modules/account::account-screen-salir-grupo` con `falta_en: mobile` y el motivo escrito (mobile
   resuelve el mismo criterio con `FilaBotones`/`cuenta-salir-botones`,
   `PantallaCuenta.tsx:101-110`). **Mobile no se tocó**, como correspondía.

**Residuo:** **ningún test cubre el agrupamiento.** `grep -E 'salir-grupo|agrup'` en el módulo da un
solo hit: `AccountScreen.tsx:225`. Los 3 tests de «Cerrar sesión» (`AccountScreen.test.tsx:133,153,172`)
prueban la confirmación y el `logout`, no el grupo. Mi criterio decía que para esta casilla leo el DOM
y el CSS, **no el semáforo** — así que esto no la incumple, pero deja la casilla sin guardia de
regresión.
⇒ fila **`H-J11SINTEST`** · 🟡 · dueño **frontend web** · *el agrupamiento de `BL-J11` no tiene test;
un refactor del tile lo deshace sin rojo. `data-testid` ya existe (`:225`), el test es barato.*

### 🔴 Y una corrección a mi propia medición — la cuarta del día

`ALCANCE-CIERRE-BETA.md:196`, **escrito por planificación**, dice: *«Mi contrato de `BL-J11` decía
“10 filas planas en UN solo `account-screen__list`” y eso era falso: `main` tenía **tres** tiles
(`:131`, `:161`, `:190`). Propagué la medición de #978 sin re-medirla y el ejecutor la corrigió contra
la realidad sin nombrar la discrepancia»*. **Tienen razón, y la evidencia del SHA lo confirma:** los hijos de `div.account-screen` son
`:131-157` (3 filas), `:161-186` (3 filas), `CambiarCredenciales` (`:188`, con su propio
`account-screen__list`), `:190-220` (3 filas) y ahora `:222-262`. **No eran 10 filas en un tile.**

**Qué sobrevive y qué no de mi hallazgo original:** la **conclusión** se sostiene —«Cerrar sesión»
*sí* compartía tile con Soporte/Cómo uso/Privacidad y *sí* se distinguía sólo por color—; lo falso
era el **alcance de la frase**: dije «las 10 filas» cuando eran las **3** de ese tile. Otra vez el
**sujeto**, no la medición: el universo de mi enunciado era más grande que el que había medido. Es la
**cuarta** vez hoy, y la primera que **la caza otra sesión y no yo** — exactamente lo que pedí en el
`dato_`: *«si mi fila afirma algo más amplio que lo que muestra su evidencia, refutenmelo con el path
y la línea»*. Lo hicieron, con path y línea.

**Y la cadena de propagación importa más que la cifra:** el `10` **nació en mi #978**, planificación
lo **copió al contrato sin re-medirlo**, fe2 lo **corrigió en el código sin nombrar la discrepancia**,
y durante unas horas el contrato y el PR dijeron números incompatibles (**10 vs 3**) **sin que ninguno
estuviera marcado como el equivocado**. Tres sesiones tocaron el dato y ninguna lo contradijo en voz
alta: una cifra mía mal medida no se detiene sola — **viaja**, y cada copia la vuelve más creíble.

### El encuadre que corrige este doc: el punto 2 ya figuraba ✅ antes de que yo re-midiera

`ALCANCE-CIERRE-BETA.md:196` @ `f932fc5f` ya dice **«punto 2 — ✅ CERRADO, los 3 falsos corregidos y
en `main`»** (#981 · #984 · #985), con la evidencia verificada por planificación. **Entonces este doc
no es el disparador de ese cierre: es una verificación independiente de un cierre ya declarado.** Y
lo **confirma** — 3 de 3 cumplidas. Lo que agrega son las tres filas de residuo y un matiz sobre una
de las evidencias citadas, abajo.

### ⚠️ `DEC-18` regla 3, aplicada con nombre: qué medición del punto 2 queda insuficiente

La regla dice que un `H-*` nuevo **no reabre** un punto ✅, salvo que invalide su evidencia, y que en
ese caso hay que **nombrar el punto y decir qué medición queda falsa**. Lo nombro:

- **Punto: el 2.** **Medición afectada:** la fila `:196` cita como evidencia de `BL-J9` que *«#981
  ejercitó control positivo invirtiendo la condición en `conversation_workflow.py:666` (el test
  cae)»*.
- **Qué de eso no se sostiene:** ese control acredita la **precedencia**, que `test_CONTRATO_...:96`
  ya acreditaba con el mismo assert y el mismo input. **No acredita el replay**, que es la mitad que
  la casilla agregó. Como evidencia *del replay*, es insuficiente.
- **🟢 NO reabro el punto 2.** La casilla pide «el replay intacto», y el replay **existe, corre sobre
  un history real y ejercita el orden roto** — eso lo medí yo y está arriba. Lo que falta es el
  **control positivo del replay**, que era un requisito de **mi** verificación, no de la casilla. ⇒
  **entrada del cierre siguiente**, no reapertura. Si alguien quiere elevarlo, el argumento tendría
  que ser que un replay sin control positivo no cuenta como replay — y yo **no** sostengo eso.

---

## Qué quedó sin correr, explícito

| lo que mi criterio pedía | estado | por qué |
|---|---|---|
| `BL-J9`: correr yo el test de replay | ❌ **sin correr** | exige VPS (la PC no tiene `temporalio`); sesión parada por orden del operador |
| `BL-J9`: control positivo mío (invertir `:666`) | ❌ **sin correr** | ídem — y el control que existe no mide el replay (ver arriba) |
| `BL-B1`: `--control-negativo` corrido | ✅ **corrido** | por backend, salida literal en su `cierre_`; **no** re-corrido por mí |
| `BL-B1`: control positivo (reply sin `choices` → ROJO) | ✅ **corrido** | ídem, con las dos salidas pegadas |
| `BL-J11`: leer DOM + CSS (no el semáforo) | ✅ **medido por mí** | `git show <SHA>:<path>`, sin render |

**La distinción que sostiene este doc:** lo que dice «medido por mí» salió de `git show` sobre
`f932fc5f`; lo que dice «corrido por backend» es **cita de su evidencia**, no mi medición. Fusionar
las dos columnas es cómo un `cierre_` se vuelve un veredicto sin que nadie mida.

## Método, para que sea reproducible

SHA fijado con `git ls-remote origin refs/heads/main` → `f932fc5f`; control de que los 3 paths
existen en él antes de delegar. Las capturas las hicieron **3 sub-agentes en paralelo**, read-only,
leyendo con `git show <SHA>:<path>` (nunca el working tree del checkout compartido, que está
mezclado), con la instrucción explícita de **traer evidencia literal y no emitir veredicto** — porque
un sub-agente que devuelve «pasó» reproduce el mismo instrumento que falló en estas tres filas. El
juicio, los contrastes y las tres filas `H-*` son míos.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
