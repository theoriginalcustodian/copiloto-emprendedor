---
name: gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea
description: Script-first, headless y elección de modelo pasaron de recordatorio (nivel 2) a 3 gates PreToolUse que frenan (nivel 1) — con severidad EXPLÍCITA (script-first > headless > modelo) y asentado en CLAUDE.md + HARNESS.md globales
metadata:
  type: feedback
---

# 🔒⚡ Script-first, headless y el modelo se ELIGEN SOLOS — 3 gates que frenan, no recuerdan

Instrucción del operador, 2026-07-24: *«no quiero solamente medición… quiero que se ejecute casi
obligatoriamente: todo lo que se pueda hacer con scripts que se haga, en secuencial y con scripts en
background también»* y *«que se use haiku para lo que es mejor: cosas puntuales y con velocidad»*.

## Qué había, y por qué no alcanzaba

Script-first y `model:sonnet` vivían en `efficiency_checklist.mjs` (hook `UserPromptSubmit`) y en el
canon §4 — texto inyectado en cada turno. **Ninguno devolvía decisión de permiso: sólo avisaban.**
De ~30 hooks globales, `read_repeat_blocker.mjs` era el único con freno real.

Por la taxonomía de enganche del proyecto eso es **nivel 2 (contextual)**, y su límite es conocido:
*una regla escrita protege del olvido, no de la racionalización*. Nada medía si en un turno hice 12
tool calls donde correspondía un script → **sin señal no hay corrección**.

## Lo que se construyó (global, `~/.claude/hooks/`)

**`script_first_gate.mjs`** — `PreToolUse` sobre `Bash|PowerShell|Grep|Glob`, dos gates:

- **Repetición:** al **2º comando del mismo *shape*** en la sesión (⚠️ bajado de 3 a 2, ver
  "Severidad" abajo). Lo fino es que **normaliza los argumentos**: `grep -rn "foo" apps/` y
  `grep -rn "bar" apps/` son el MISMO shape (`grep|apps`) — que es justo el caso que un script
  resuelve en una pasada y N tool calls en N roundtrips, pagando contexto en cada respuesta
  intermedia.
- **Background:** comando de la lista de lentos (`pytest`, builds, `eas build`, `rsync`, `deploy.sh`,
  `docker build`, `expo`, `terraform`) sin `run_in_background: true`.

**`pretooluse_validate_agent.mjs`** (extendido, reglas 4 y 5):

- **Regla 4 — modelo por forma de tarea**, en las **dos direcciones**: mecánico
  (contar/listar/localizar/grepear/extraer) sin `model:"haiku"` → frena; construcción/diseño/debug/
  auditoría **con** `haiku` → frena también.
- **Regla 5 — headless, no inline** (agregada 2026-07-25): CUALQUIER llamada `Agent`/`Task` dispara,
  siempre, sugiriendo el comando `claude -p` equivalente. Instrucción del operador tras verlo
  interferir en las 3 sesiones paralelas: *«los subagentes toman control de la sesión y empiezan a
  escribir en la terminal esta… para todo lo que sea sub agentes usaremos headless, no inline»*.
  Ver [[subagentes-van-headless-no-inline-en-la-terminal]] para el comando completo y la corrección
  del dato de costo (headless usa la misma auth OAuth/Max, no tarifa API aparte).

**El espejo de la regla 4 es el que más importa.** Pagar Sonnet por un conteo cuesta centavos de más;
mandar Haiku a implementar **sale barato y hay que rehacerlo**, más el tiempo de descubrir que estaba
mal. La asimetría de costo no está en el modelo: está en el retrabajo.

## Severidad EXPLÍCITA — no los tres iguales

Instrucción del operador, 2026-07-25: *«lo que más me importa y lo que más ahorra en volumen son los
scripts… es a lo que hay que darle la mayor severidad de aplicación»*. Medido antes de responder
"sí" — y **no era cierto todavía**: script-first tenía umbral 3, igual que `read_repeat_blocker`, y
**por DEBAJO** de headless (dispara siempre, umbral 1 de facto). El más severo era headless, no
script-first — invertido respecto a lo que más ahorra.

**Corregido: script-first pasa a umbral 2.** Jerarquía resultante, de mayor a menor severidad:

1. **Script-first** — frena al 2º repetido. Es lo que más tokens ahorra medido (~200k/sesión).
2. **Headless** — frena siempre que se use `Agent`/`Task`. Es la queja original del operador.
3. **Modelo por tarea** — frena siempre que no coincida con la forma de la tarea.

No es casualidad que estén en ese orden: a mayor ahorro medido, mayor severidad del gate. Un sistema
de eficiencia que trata todo por igual no refleja dónde está el ahorro real.

## Las tres decisiones defensivas (hay 3 sesiones sobre este harness)

1. **`decision: "ask"`, NUNCA `"deny"`** — frena y obliga a justificar; no paraliza.
2. **Fail-open ante cualquier error** — un hook roto trabaría la fábrica entera.
3. **Allowlist** de lo que se repite legítimamente (`git status`, `gh pr`, `ls`): su valor **es**
   estar al día, y un script no lo reemplaza.

Si un gate frena y la excepción es legítima → aprobar **diciendo por qué**. Esa justificación es el
punto: convierte una racionalización silenciosa en una decisión declarada.

## El bug que casi los deja mudos — `\b` es ASCII

Las regex de la regla 4 no disparaban. Causa: **`\b` en JavaScript es ASCII**, así que en `contá `
la `á` es non-word y **no forma frontera** con el espacio → `contá\b` nunca matchea. Como los
imperativos del español terminan casi siempre en vocal acentuada (`contá`, `implementá`, `buscá`,
`diseñá`), usar `\b` deja la regla **muerta y silenciosa** — el hook corre, no rompe nada, y no
protege de nada. Fix: lookarounds de letra (`(?<![a-záéíóúüñ])…(?![a-záéíóúüñ])`).

Es exactamente [[instrumentos-que-confirman-en-vez-de-verificar]] aplicado a un guard: un gate que
nunca dispara es **indistinguible de uno que no existe**, y da la misma sensación de cobertura. Por
eso los tres gates se probaron **antes** de registrarse — con un script, que es el chiste — y **se
re-probaron** cada vez que cambió algo: 9/9 (script-first, umbral 3) → 8/8 (bajado a 2) · 8/8 (regla
haiku) → 7/7 (regla headless agregada, con no-regresión de las 4 anteriores).
[[no-codificar-la-esperanza-principio-raiz]]

## Dónde está TODO — asentado en 4 lugares, no sólo acá

Instrucción del operador: que sea *«rotundamente inevitable ejecutarlo en todos los repositorios»*.
Por eso vive en capas, del mecanismo a la doctrina, y las cuatro se actualizan juntas:

1. **`~/.claude/hooks/script_first_gate.mjs`** · **`pretooluse_validate_agent.mjs`** (reglas 4 y 5) —
   el mecanismo. Registrados en `~/.claude/settings.json` (backup `.bak-pre-script-first-gate`) →
   **aplican a TODO repo**, no sólo a éste.
2. **`~/.claude/HARNESS.md` §1.3** — detalle de implementación, umbrales exactos, smoke tests. Único
   lugar con el detalle; el resto apunta acá para no duplicar (convención del propio archivo, §6).
3. **`~/.claude/CLAUDE.md`** §"Meta-trabajo del agente" — la doctrina: tabla "Modelos por rol" con
   `haiku`, sección **"Sub-agentes van HEADLESS, no inline"** (el `Agent` tool pasa de default a
   excepción documentada), y **"Los 3 gates mecánicos"** con la tabla de severidad. Es la capa que
   **todo repo carga siempre** (global, agnóstico) — el ancla real de "inevitable en todos lados".
4. **`~/.claude/commands/ejecutar-con-eficiencia.md`** — Pilar 0 (headless) + Pilar 5 actualizado
   (modelo por tarea) + tabla Quick Reference con los 6 pilares (0-5).
5. Esta memoria — el porqué, la evidencia y el bug (`\b` ASCII) que casi lo deja mudo.

Un cambio futuro a cualquiera de los tres gates debe tocar **1 y 2 juntos** (mecanismo + su detalle);
si cambia la doctrina (severidad, cuándo aplica la excepción) también **3**.
