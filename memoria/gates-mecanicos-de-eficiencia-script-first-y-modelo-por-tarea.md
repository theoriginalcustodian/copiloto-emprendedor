---
name: gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea
description: Script-first y elección de modelo pasaron de recordatorio (nivel 2) a gate PreToolUse que frena (nivel 1) — dos hooks globales, con el porqué y los umbrales
metadata:
  type: feedback
---

# 🔒⚡ Script-first y el modelo se ELIGEN SOLOS — dos gates que frenan, no recuerdan

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

- **Repetición:** al **3er comando del mismo *shape*** en la sesión. Lo fino es que **normaliza los
  argumentos**: `grep -rn "foo" apps/` y `grep -rn "bar" apps/` son el MISMO shape (`grep|apps`) —
  que es justo el caso que un script resuelve en una pasada y N tool calls en N roundtrips, pagando
  contexto en cada respuesta intermedia. Umbral 3 y no 2: *dos veces es tanteo, tres es un patrón*.
- **Background:** comando de la lista de lentos (`pytest`, builds, `eas build`, `rsync`, `deploy.sh`,
  `docker build`, `expo`, `terraform`) sin `run_in_background: true`.

**`pretooluse_validate_agent.mjs`** (extendido, regla 4) — el modelo se elige por la **forma de la
tarea**, en las **dos direcciones**:

- mecánico (contar/listar/localizar/grepear/extraer) sin `model:"haiku"` → frena;
- construcción/diseño/debug/auditoría **con** `haiku` → frena también.

**El espejo es el que más importa.** Pagar Sonnet por un conteo cuesta centavos de más; mandar Haiku
a implementar **sale barato y hay que rehacerlo**, más el tiempo de descubrir que estaba mal. La
asimetría de costo no está en el modelo: está en el retrabajo.

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
eso los dos hooks se probaron **antes** de registrarse (9/9 y 8/8, incluidas no-regresiones) — con
un script, que es el chiste. [[no-codificar-la-esperanza-principio-raiz]]

## Dónde está todo

`~/.claude/hooks/script_first_gate.mjs` · `~/.claude/hooks/pretooluse_validate_agent.mjs` (regla 4) ·
registro en `~/.claude/settings.json` (backup `.bak-pre-script-first-gate`) · doctrina y tabla de
umbrales en `~/.claude/commands/ejecutar-con-eficiencia.md` §"Gates mecánicos".
