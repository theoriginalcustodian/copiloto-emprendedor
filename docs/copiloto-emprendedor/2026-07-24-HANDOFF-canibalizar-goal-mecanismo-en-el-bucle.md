# HANDOFF — canibalizar el mecanismo de `/goal` en nuestro bucle canónico

> **Estado: CANDIDATO, nada implementado.** Charla exploratoria del 2026-07-24, cierre de sprint.
> El operador pidió NO implementar nada más esta sesión — esto es el punto de partida para retomar
> en frío, sin tener que re-derivar la conversación.

---

## 0. Fuente — leer primero

`C:\Proyectos\Claude\Claude code\unreal-copilot\docs\research\2026-06-21-goal-mecanismo-completo-reverse-engineering.md`

Ingeniería inversa completa (2026-06-21) del comando `/goal` de Claude Code sobre el binario
`claude.exe` 2.1.138. Documento largo (417 líneas) — la sección que importa para esto es **§20
CANIBALIZACIÓN**, pero el mecanismo completo (§6 el evaluador `k0_`, §7 los system prompts, §14 los
5 tipos de hook) es el contexto que sostiene las 3 ideas de abajo.

**En una frase:** `/goal` registra un Stop hook tipo `prompt`; tras cada turno un LLM barato (Haiku,
salida JSON forzada `{ok,reason}`, sin tools) juzga el transcript. Si `ok:false` → **bloquea sin
prevenir la continuación** (el agente sigue otro turno con `reason` como guía). Si `ok:true` → limpia
el goal y libera.

---

## 1. Las 3 ideas discutidas, con complejidad evaluada

### 1.1 — `preventContinuation:false` (bloquear sin frenar) — **complejidad BAJA, con un spike previo**

Hoy `~/.claude/hooks/completion_evidence_gate.mjs` (Stop hook, tipo `command`) sólo **loguea**
`closure_without_next_step` — modo observabilidad, no bloquea nada. `/goal` logra bloquear-sin-frenar
con un hook tipo `prompt`, no `command`.

**Supuesto crítico SIN VALIDAR** (por eso no se implementó ya — spike-first lo frenó en la charla):
¿un hook tipo `command` (el que ya usamos) puede lograr el mismo "bloquea pero el agente sigue" que
`/goal` logra con tipo `prompt`? El documento fuente no lo confirma para `command` — sólo confirma
`preventContinuation: !isStop` para el branch `prompt`. §14 menciona que un `command` hook puede
devolver `decision:"block"` + `reason`, pero no queda claro si eso frena de verdad o si el agente
sigue igual que con un `prompt` hook.

**Antes de tocar el gate real:** spike mínimo desechable — un Stop hook `command` de juguete que
devuelva `{"decision":"block","reason":"test"}` y observar empíricamente si el agente para o sigue.
Recién con ese resultado se sabe si hace falta migrar el gate a tipo `prompt`/`agent`, o si `command`
ya alcanza.

**Si se confirma:** upgradear `completion_evidence_gate.mjs` de observabilidad pura a enforcement
real de canon 8a — hoy sólo se mide si alguien cierra con reporte, con esto se **bloquearía** de
verdad (sin frenar el trabajo, sólo forzando un paso más con el motivo como guía).

### 1.2 — Evaluador barato con Haiku (`{ok,reason}` estructurado) — **complejidad BAJA**

La receta de `/goal`: Haiku + `outputFormat: json_schema` (forzado) + `thinkingConfig:disabled` +
`tools:[]` = juez determinista en forma, costo mínimo. Reusa el patrón ya documentado en memoria
(`claude-code-headless-capabilities.md` — `claude -p` headless). Es un script chico (llamada API con
schema forzado), no un subsistema nuevo.

**Encaje:** reemplazar razonamiento caro (Sonnet/Opus) en checks tipo "¿esta card tiene evidencia de
que se ejecutó?" por un juicio Haiku barato con el mismo patrón anti-reward-hacking del system prompt
de `/goal` (§7 del doc fuente: exige citar evidencia del transcript, ante duda `ok:false`).

**Sin supuestos críticos pendientes** — es la más fácil de arrancar directo, sin spike.

### 1.3 — Verificador `agent` independiente (ejecuta y verifica, no sólo lee) — **complejidad ALTA, y el matiz importa**

Pregunta del operador en la charla: *"son las mismas sesiones de frontend y backend... no aplica
tanto acá, ¿o sí?"* — respuesta que quedó cerrada:

**No es redundante con backend/frontend ejecutando sus propios tests.** La diferencia no es *quién
ejecuta*, es *quién audita*. Backend/frontend corriendo sus propios tests es **autoevaluación** —
canon 7 ya dice "tu autoevaluación no cuenta". El valor de un `agent`-verifier tipo `/goal` es ser
**independiente**: un sub-agente sin stake en haber construido eso, que corre el DoD real (los tests,
el harness de device) y reporta sin el sesgo de "ya lo hice, debe estar bien".

**Dónde encajaría, concretamente:** es el mismo principio que ya tenemos en A1/A2 (auditoría separada
de quien planifica/construye — ver `docs/BUCLE-CANONICO.md`) pero bajado al nivel de **cada hito/PR
individual**, automático, en vez de esperar la revisión manual de planificación o de Fable. Correría
**después** de que backend/frontend declaren un hito listo, como segundo par de ojos barato, ANTES de
que llegue a revisión humana/A2. Apuntaría directo a la clase de bug que ya nos mordió varias veces
(memoria: "el error apunta a un parámetro que nunca mandaste", "un guard cazó algo distinto de lo que
vigilaba", "el mensaje niega el efecto que ya ocurrió" — todos casos de "se declaró listo y no lo
estaba", detectados tarde).

**Por qué es la más pesada:** no es un script chico — es un sub-agente con acceso a tools que corre
comandos de verdad (pytest, el harness de device), con timeout y manejo de fallos. Semanas de
esfuerzo real, no horas.

---

## 2. Orden sugerido si se retoma (no decidido, sólo la lectura obvia del esfuerzo)

1. Spike de `preventContinuation` en hooks `command` (§1.1) — barato, desbloquea saber si el gate
   actual alcanza o hay que migrarlo de tipo.
2. Si el spike confirma que `command` no alcanza, o en paralelo: prototipo del evaluador Haiku (§1.2)
   sobre UN check chico primero (ej. "¿la card mostró evidencia de persistencia?"), no sobre todo el
   gate de una.
3. El `agent`-verifier independiente (§1.3) queda para cuando el sprint tenga presupuesto de días, no
   de horas — es la pieza que más se parece a un mini-proyecto propio.

## 3. Qué NO se tocó esta sesión

Nada de `~/.claude/hooks/completion_evidence_gate.mjs` ni de `docs/BUCLE-CANONICO.md` se modificó por
esta charla. El gate sigue en modo observabilidad pura (sólo loguea `closure_without_next_step`),
exactamente como quedó tras el cierre del sprint de hoy (PR#124-137).
