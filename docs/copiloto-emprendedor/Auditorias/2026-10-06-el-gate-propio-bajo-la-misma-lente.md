# El gate propio bajo la misma lente: ¿cuántos de sus checks pueden dar ROJO?

**Auditoría · 2026-10-06** · misma pregunta que le hice al smoke, aplicada a lo que autoriza **todos**
los merges (ADR-001) · **SHA medido: `origin/main` = `97dcb35a`**, worktree `wt-aud-criterio3`.

---

## 0 — Veredicto: el gate **resiste**. Un hueco no declarado, dos declarados.

Al smoke le encontré que su veredicto afirma 5 de 37. Buscando lo mismo acá, el resultado es el
opuesto: **el gate está construido para fallar cerrado, y lo hace.**

| lo que verifiqué | resultado |
|---|---|
| ¿los 5 jobs pueden dar ROJO? | **sí, los 5.** `core/web/mobile/lint/backend` con `set -euo pipefail`; los comandos de la suite (`vitest`, `jest`, `pytest`, `tsc`, `eslint`) van **sin pipe**, así que ningún exit se pierde |
| ¿de dónde sale el veredicto? | de `PIPESTATUS[0]` por job (`gate.sh:132`), no de `$?` global — por eso `gate.sh` puede correr **sin `-e`** sin perder nada |
| ¿puede salir 0 sin que corra nada? | **no.** `gate.sh:246`: `[ "${#RESULTADO[@]}" -eq 0 ]` ⇒ `exit 2` |
| ¿el SSH caído da verde? | **no, en ninguno de los 6 caminos.** candado no tomado, `test-db` caído, `test-gotrue` caído, sync roto, pytest 255, pytest rc 5 ⇒ todos `RESULTADO[backend]="failed"` |
| ¿`\|\| true` en los checks? | **no.** Las 14 apariciones son limpieza (`docker rm -f`), banderas (`status --porcelain`) o captura explícita (`\|\| rc=$?`). Ninguna traga el exit de un test |
| ¿`exit 0` explícitos en los jobs? | **0** en `backend/core/web/mobile/lint` |

## 1 — El riesgo que el barrido marcó y la medición descartó

El inventario señaló que **el recibo ACUMULA por SHA** (`gate.sh:226-234`: lee el recibo previo y
mergea job por job), así que un recibo con los 5 en verde podría ser la **unión de 5 corridas
distintas**, ninguna con los 5. Como un merge cita el recibo del SHA, eso sería grave.

**No lo es, y lo decide el consumidor, no el productor.** `scripts/recibo-cubre.sh:28` declara
`JOBS=(core web mobile lint backend)` y exige **los 5**: `:68` lee `.jobs[$j] // "ausente"` (un job que
nunca corrió se nombra `ausente`, no pasa), `:70` verifica `sucio` por job con `"sin-dato"` para los
recibos viejos, y `:84/:87` salen 0 sólo si algún recibo cubre, 1 si ninguno.

Y la acumulación **resuelve** un problema real, escrito en `gate.sh:220-221`: `sucio` va **por job**
para que «una corrida sucia de ayer no pueda quedar tapada por el `sucio:false` de la corrida limpia de
hoy de otro job». Es diseño con su razón adjunta.

→ **La lección de método: un productor que acumula no es un defecto hasta que se mide qué exige el
consumidor.** El riesgo vive en el **par**, y leer sólo el productor lo habría reportado como falso
positivo.

## 2 — El único hueco NO declarado: **ningún SSH tiene timeout**

```
candado-stage.sh      -> 0 timeouts   (usa $GATE_SSH, parametrizable)
test-db.sh            -> 0 timeouts   · 12 invocaciones de ssh
test-gotrue.sh        -> 0 timeouts   · 18 invocaciones de ssh
sync-test-backend.sh  -> 0 timeouts   ·  2 invocaciones de ssh
en TODO el repo       -> 0 ConnectTimeout / ServerAliveInterval
```

(Control positivo del grep: las 32 invocaciones de `ssh` sí se cuentan, así que el 0 de timeouts es un
cero real.)

**Qué falla:** un VPS que **acepta la conexión TCP y se cuelga** deja el gate esperando **sin rojo y
sin verde**. No es un falso verde — es peor para una sesión autónoma: es ocio invisible, el patrón
`memoria/mudo-no-es-parado-el-silencio-mide-reporte-no-trabajo.md`. El candado sí acota su espera
(`UC_GATE_LOCK_WAIT`, 900 s, `candado-stage.sh:39,47`); los otros tres, no.

**Fila `GATESSHTIMEOUT`** · dueño **backend** · DoD: `-o ConnectTimeout=15 -o ServerAliveInterval=15 -o
ServerAliveCountMax=4` en las invocaciones a `$HOST`. **Control positivo:** apuntar `UC_DEPLOY_HOST` a
una IP que descarta paquetes (p. ej. `203.0.113.1`) y verificar que el gate sale **ROJO en < 2 min** en
vez de colgarse. Sin ese control el fix es indistinguible de no hacerlo.

## 3 — Los dos huecos que el propio código ya declara

**`lint.sh:44-48` — el glob vacío sale verde.** `for t in "$ROOT"/scripts/tests/test-*.sh; do [ -e "$t" ]
|| continue` ⇒ si el glob no matchea, el bucle no corre y el job sale **0 sin ejecutar un solo test**.
Hoy matchea **53** archivos. El comentario de `:41-43` ya nombra el riesgo con precisión: *«Sin este
bucle, `scripts/tests/` es letra muerta — un test que nadie ejecuta no es un control, es un archivo»*.

**Es exactamente el defecto `SMOKEDENOM` del smoke, en otro instrumento:** el denominador no está
aserido, así que la cobertura puede vaciarse sin cambiar de color.

**Fila `LINTDENOM`** · dueño **backend** · DoD: contar los `test-*.sh` ejecutados y fallar si son menos
que un mínimo. **Control positivo:** mover los `test-*.sh` a un directorio temporal ⇒ `lint` sale
**ROJO**. Hoy saldría verde. **Mismo PR que `SMOKEDENOM`: es la misma línea de código, dos veces.**

**`nativo-freeze.sh:16-19` — fail-open, pero explícito.** Sin `merge-base` con `origin/main` (clon
superficial) avisa y sale 0. El comentario de `:10` lo declara: *«fail-open explícito, no silencioso»*, y
sólo saltea **el guard de congelamiento nativo**, no los tests de mobile (`tsc` y jest siguen,
`mobile.sh:13,15`).

Lo que sí queda sin registrar: **el recibo no tiene campo para «no evaluado»**, así que un recibo con
`mobile: ok` es compatible con «el guard nativo nunca se evaluó». Severidad baja, dueño **planificación**
(es el formato del recibo): `GATERECIBOSALTADO`.

## 4 — Lo que no audité

**No corrí el gate.** Todo lo de arriba es lectura de código más greps con control positivo. El canario
real —apuntar `UC_DEPLOY_HOST` a un agujero negro y cronometrar— **es el DoD de `GATESSHTIMEOUT`**, y lo
tiene backend: correrlo acá significaría tomar el candado del stage de tests y bloquear a las otras
sesiones.

`scripts/ci/no-drift.sh` y `fetch-depth-check.py` quedan **fuera** de este veredicto: viven sólo en el
job `drift` de `tests.yml`, no en `gate.sh`.

🤖 auditoría · Opus 5 (1M context)
