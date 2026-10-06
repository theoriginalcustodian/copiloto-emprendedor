# ¿Qué acredita realmente el smoke «37/37 BETA-READY»?

**Auditoría · 2026-10-06** · pedido por planificación · **SHA medido:** `smoke_beta_e2e.py` y
`run-smoke-prod.sh` idénticos a `origin/main` (0 líneas de diff, verificado); `deploy.sh` re-medido
sobre `origin/main` = `a659f0b2`.

---

## 0 — Veredicto en tres renglones

1. **Los 37 checks discriminan. Ninguno pasa por vacuidad.** La hipótesis que motivó esta auditoría
   («¿cuántos pasan por vacuidad?») se midió y **se descartó**: 0 de 37. El script es bueno — trae
   control negativo propio, verifica efectos en la tabla de auditoría, y falla ruidoso cuando le falta
   su env.
2. **Pero `BETA-READY` no afirma los 37: afirma 5.** Medido con canario: **32 de los 37 pueden fallar y
   el script imprime `BETA-READY` y sale `exit 0`.**
3. **Y nada lo corre.** El smoke de 37 checks **no está en `deploy.sh`, ni en `gate.sh`, ni en
   `scripts/ci/`, ni en los workflows** (0 hits en los cuatro, con control positivo del grep: 47 hits de
   «smoke» en el conjunto, así que el grep mira). Se corre **a mano**.

   > ⚠️ **CORREGIDO 20:30 UTC — acá decía «la última corrida es del 23/09» y era FALSO.** Backend lo
   > corrió **hoy** sobre `55b3f219` (37 PASS / 0 FAIL), porque el DoD de `DEPLOYPROD` lo exigía. Mi
   > error de método: medí `_evidencia/*/BL-Q2/` **en mi worktree**, y `run-smoke-prod.sh:13` escribe la
   > salida en el árbol **que lo lanzó** — otro worktree. Un artefacto ausente de mi disco no es un
   > artefacto que no existe.
   > **Y el hallazgo queda más filoso, no menos:** la frescura de hoy es **accidental** — la produjo un
   > **contrato**, no un mecanismo. Sin ese contrato, la última corrida seguiría siendo del 23/09. Un
   > instrumento cuya ejecución depende de que alguien se acuerde de pedirla no tiene frescura: **tiene
   > suerte.**

⇒ **El titular no es falso, es más chico de lo que suena.** «37/37 BETA-READY» se lee como «los 37 están
verdes **y por eso** está listo»; lo que el veredicto afirma es «los **5** críticos están verdes». Que
los otros 32 estuvieran verdes ese día es información del `total=`, **no del veredicto**.

---

## 1 — El canario, con sus dos controles positivos

El cerebro del veredicto (`smoke_beta_e2e.py:433-444`) se puede ejercitar **sin tocar prod**: se extrae
el bloque literal y se le inyecta un `results` fabricado.

| escenario | `total/pass/fail` | VEREDICTO | exit |
|---|---|---|---|
| **A) los 37 en PASS** — *control positivo del verde* | 37/37/0 | `BETA-READY` | **0** ✅ esperado |
| **B) falla UN crítico (login)** — *control positivo del rojo* | 37/36/1 | `BLOQUEA BETA (critico rojo)` | **1** ✅ esperado |
| **C) fallan los 32 no-críticos, los 5 críticos verdes** | 37/5/**32** | **`BETA-READY (criticos verdes)`** | **0** ⚠️ |
| **D) un check DESAPARECE, el resto verde** | **36**/36/0 | `BETA-READY` | **0** ⚠️ |

A y B existen para que C y D signifiquen algo: sin ellos, un exit 0 podría ser «el arnés no ejercita
nada». El canario **se pone rojo cuando debe** (B) — por eso su verde en C es un hallazgo y no un
artefacto del arnés.

**C es el diseño declarado, no un bug encubierto:** `CRIT` tiene 5 nombres y un comentario que explica
por qué el check de la alta abierta es crítico. Lo que falla es el **nombre del veredicto**, que no dice
«5 críticos verdes, 32 sin mirar».

**D no es diseño: el 37 no existe en el código.** No hay `EXPECTED_TOTAL`; el total es `len(results)`
(`:440`). Un check que se borre en un refactor sale `total=36 pass=36 fail=0 BETA-READY` y **nadie lo
nota** — el instrumento sólo ve al que falla, nunca al que no vino.

---

## 2 — Los 37, clasificados por lo que la condición mira

| clase | cuántos | cuáles | qué acredita |
|---|---|---|---|
| **Compara contra un valor concreto del cuerpo, o verifica el EFECTO** | **15** | 1, 2, 4, 5, 9, 10, 11, 21, 29, 31, 33, 34, 35, 36, 37 | lo más fuerte del script |
| **Sólo status HTTP** (`== 200`, `== 403`) sin mirar el cuerpo | **16** | 6, 12-17, 18, 22-27, 28, 32 | legítimo para autorización; ciego al cuerpo |
| **La condición mira menos que la etiqueta** | **6** | 3, 7, 8, 19, 20, 30 | ver la tabla de abajo |

### Lo mejor del script, que hay que no romper

- **29 y 33 verifican el efecto, no el status.** El 28 y el 32 mutan (`POST …/estado`,
  `POST …/reintentar`) y sólo miran `== 200`; **pero** el 29 y el 33 leen `/admin/auditoria` y afirman
  sobre el **detalle** (`detalle.cliente_id`, `detalle.a == "suspended"`, `detalle.fingerprint`). Ese par
  status+efecto es exactamente el patrón correcto.
- **El 36 es un control negativo explícito:** `bundle.count(imposible) == 0`. El 35 afirma que el dominio
  de auth está horneado en el bundle; el 36 prueba que ese conteo sabe dar 0. **El script trae su propio
  control positivo** — poco frecuente, y vale decirlo.
- **El `sys.exit` de `:28-33`** (falta `COPILOTO_INVITE_TOKEN`) tiene un comentario que explica por qué
  falla ahí y no diez pasos después: sin él alguien leería «C4.1 rompió prod» en vez de «falta la env».
- **Ningún check acepta dos status como éxito.** Todas las comparaciones son `==` contra un único valor.

### Los 6 cuya etiqueta promete más que la condición

Ninguno es vacuo; todos discriminan contra «no pasó nada». El hueco está entre el nombre y la medición.

| # | etiqueta | condición real | el hueco |
|---|---|---|---|
| 8 | `chat ReAct (multi-paso) → responde coherente` | `bool(reply)` (`:148`) | **no mide coherencia ni multi-paso**: cualquier texto no vacío pasa |
| 7 | `chat simple → el agente responde` | `bool(reply)` (`:132`) | igual mecanismo, pero la etiqueta promete menos ⇒ honesta |
| 19 | `consola: otorgar claim admin` | `rec(..., True, ...)` incondicional (`:219`) tras dos `raise_for_status()` | no lee de vuelta el claim; **el 21 sí** (`es_admin is True`), así que el par cubre |
| 3, 20 | login / re-login post-grant | `bool(token)` | no mira el status; un token no vacío basta |
| 30 | `reintento: trauma fabricado` | `trauma_id is not None` | es un INSERT propio: afirma que su propio setup funcionó |

### Un falso PASS latente — `:101` (check 4)

`j.get("cliente_id") == cliente_id`. Si el alta no devolvió `cliente_id` (queda `None`) y `/me` responde
200 sin ese campo, `None == None` es **True** y el check da **PASS**. **Hoy no muerde** porque el check 2
(crítico) ya estaría rojo y tumbaría el smoke. Es deuda latente, no incidente.

### Sospecha que medí y descarté

`CRIT` filtra **por nombre exacto**, y las ramas de cascada registran con nombres distintos
(`adversarial: no-admin {path} → 403` vs `… no-admin GET {path} → 403`; `consola: {step}`,
`reintento: {step}`). Si un crítico cayera por cascada con otro nombre, `crit_fails` no lo vería y el
veredicto saldría verde **con un crítico rojo**.

**No ocurre.** Los 5 críticos registran su nombre literal en el `try` **y** en el `except`: `:71/:73`,
`:82/:84`, `:92/:94`, `:101/:103`, `:132/:134/:136`. El filtro por nombre es seguro para los críticos.
Las cascadas sí renombran a los no-críticos, que no afectan el veredicto.

---

## 3 — El hallazgo que no estaba en el pedido: hay DOS cosas llamadas «smoke»

`deploy.sh:484` imprime `==> [7/7] Smoke (evidencia real, no autoevaluación)`. **Ese paso no es este
smoke.** Lo que corre son 6 comprobaciones de proceso vivo — `systemctl is-active` ×3, `curl -sf
/healthz`, `curl -sf /`, `caddy validate` — más **3 `curl` que no pueden poner rojo nada**: `-s -o
/dev/null -w '%{http_code}'` con `|| true`, y el propio comentario los llama «status code informativo».

Las 6 primeras **sí** discriminan: con `set -euo pipefail` y `-f`, un 5xx aborta el deploy. El problema es
el **nombre**: cuando alguien lee «el deploy pasó el smoke», lee el paso [7/7] y entiende los 37 checks.
**`smoke_beta_e2e` tiene 0 hits en `deploy.sh` de `origin/main`.**

### La pata buena, acreditada hoy

El paso [5/7] de `origin/main` **ya trae el control positivo de `/healthz`** que recomendé esta mañana:
escribe `UC_BUILD_SHA` con el HEAD desplegado y después **aborta el deploy** si `/healthz` no devuelve ese
SHA (15 reintentos de 2 s, `exit 1`), con el comentario citando el hallazgo. Leído, **falla cerrado en los
tres caminos de error**: `curl` falla → `got=""` → aborta; `python3`/json falla → `got=""` → aborta; no
reinició → SHA viejo → aborta.

**Verificado por lectura, no por corrida:** no desplegué. Su control positivo real es el próximo deploy —
y hoy ese control **daría ROJO** contra el estado que medí en la ventana (`sha 1c92e25` con `55b3f219`
desplegado), que es justamente lo que lo hace un gate y no un adorno.

---

## 4 — El renglón de la memoria, corregido con la cifra medida

`memoria/MEMORY.md` lista hoy, bajo **🚦 Estado vivo**:

> **Prod-beta multitenant vivo**, smoke **37/37 BETA-READY** (2026-09-23), RLS `FORCE`.

Tiene la fecha, así que no miente. Lo que falta es **qué afirma el veredicto** y que **nada lo re-corre**.
Renglón propuesto, listo para pegar:

> **Prod-beta multitenant vivo**, RLS `FORCE` · smoke **37/37** del 23/09 — pero `BETA-READY` sólo afirma
> **5 críticos**: 32 pueden fallar con exit 0. No corre en ningún gate.

(`MEMORY.md` es de planificación; no lo edito.)

---

## 5 — Filas, con dueño y DoD binario

| id | qué | dueño | DoD |
|---|---|---|---|
| **SMOKEDENOM** | Aserir el denominador: `EXPECTED_TOTAL = 37` y FAIL si `len(results) != EXPECTED`. | backend | **Control positivo:** borrar un `rec` a propósito ⇒ el smoke sale **ROJO**. Hoy sale verde (escenario D). |
| **SMOKEVEREDICTO** | Que el veredicto diga lo que afirma: `BETA-READY (5/5 criticos · 32/32 no-criticos)`, o `BETA-READY CON RESERVAS` si `fail > 0`. | backend | Correr con un no-crítico forzado a FAIL y ver que el texto lo nombra **sin** cambiar el exit (el exit 0 es diseño, no se toca). |
| **SMOKEETIQUETA8** | El check 8 dice «multi-paso → coherente» y mide `bool(reply)`. Renombrarlo (barato) o hacerlo medir el multi-paso (caro). | backend | Que el nombre y la condición digan lo mismo. Recomiendo renombrar. |
| **SMOKEME4** | `:101` da PASS con `None == None` si el alta no trajo `cliente_id`. | backend | `and j.get("cliente_id") is not None`. Control: forzar `cliente_id=None` ⇒ el 4 sale ROJO. |
| **SMOKENOMBRE7** | Dos cosas llamadas «smoke»: el paso [7/7] del deploy y los 37 checks. | planificación | Renombrar el paso del deploy (p. ej. `[7/7] Sanidad del servicio`) **o** que el deploy corra el smoke real. Decisión de alcance, no mecánica. |
| **SMOKEFRESCURA** | La corrida de hoy existe (backend, sobre `55b3f219`), pero la produjo un **contrato**, no un mecanismo: sin alguien que la pida, no corre. | planificación | Una corrida contra prod. **Necesita ventana**: crea tenant sintético, **suspende un tenant** (check 28) e **inserta en `copiloto_traumas`** (check 30). No la tomé por eso. |

---

## 6 — Lo que NO pude acreditar, y por qué

**El canario contra prod no corrió.** Lo que probé es el **cerebro del veredicto** (local, sin red). Lo
que falta es inyectar un defecto real — apagar un endpoint, romper el bundle — y ver si el smoke lo caza
de punta a punta. Eso **exige correr el smoke**, y correrlo **muta estado compartido de producción**
(tenant suspendido, filas en `copiloto_traumas`). Sin ventana no lo hago: sería producir efectos reales
para llegar a un estado.

**Disparador escrito:** si planificación concede ventana para `SMOKEFRESCURA`, el canario E2E va **en la
misma ventana** — una corrida limpia (la cifra fresca) y una con un defecto inyectado a propósito (que
debe salir **ROJO**). Las dos en la misma ventana o ninguna: **una corrida verde sola no distingue «el
smoke cubre» de «el smoke no mira».**

---

## 7 — Advertencia sobre mi propio método

Casi emití un hallazgo falso, y el control positivo lo frenó. Medí `grep -c '\[PASS\]'` sobre el script:
dio **0**. Eso parecía probar que el wrapper (`run-smoke-prod.sh:17`, `grep -c '^\[PASS\]'`) **siempre
reporta `0 PASS · 0 FAIL`** — un instrumento ciego, el hallazgo del año.

Era falso. `rec` construye el prefijo en runtime (`:39`, `f"[{'PASS' if ok else 'FAIL'}]"`), así que la
salida real **sí** empieza con `[PASS]` y el wrapper cuenta bien. **El literal ausente no probaba nada:
medí el código fuente cuando la pregunta era sobre la salida.**

Cuarta vez en el día que un esperado propio no coincidió, y la cuarta vez que el camino correcto fue ir a
mirar en vez de ajustar el número →
`memoria/un-control-positivo-con-esperado-falso-acusa-al-script.md`.

🤖 auditoría · Opus 5 (1M context)
