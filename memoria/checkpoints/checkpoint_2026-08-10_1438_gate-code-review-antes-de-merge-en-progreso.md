---
name: Checkpoint planificación — 2026-08-10 14:38
description: A mitad de cablear un gate global nuevo (code-review obligatorio antes de gh pr merge), pedido explícito del operador. Sesión pausada para compactar — nada roto, nada registrado todavía.
type: checkpoint
project_root: C:/Proyectos/Claude/Claude code/copiloto-emprendedor
parent_checkpoint: memoria/checkpoints/checkpoint_2026-08-10_1352_bloat-contexto-refactor-pilar-a-y-poda-skills.md
---

## 🎯 Objetivo de este segmento

El operador pidió explícitamente: *"cablea e implementa como parte del flujo standard"* un gate de
code-review obligatorio antes de mergear PRs de backend/frontend — surgió porque hoy PR#369/#370
mergearon (y #371 casi) con sólo CI verde + autoevaluación, sin una pasada adversarial independiente.
El CI roto de #371 lo agarré yo de casualidad revisando el buzón, no por ningún gate.

## ✅ Hecho

1. Verifiqué contra el sistema real (no asumido) que el plugin `superpowers` está instalado y
   habilitado, y que lo usamos hasta 2026-07-21 (`docs/superpowers/specs|plans/`) y después lo
   abandonamos por el sistema INL/buzón propio.
2. Decisión de diseño ya tomada y validada: el gate va en **`~/.claude/settings.json` GLOBAL, no
   project-scoped** — verifiqué que backend trabaja desde un clon aislado (`/c/tmp/ci-clone`) sin
   `.claude/settings.local.json` propio, así que un gate project-scoped nunca lo alcanzaría. Mismo
   razonamiento que ya justifica que `cross_session_pretooluse.mjs` (que intercepta `gh pr create`)
   sea global.
3. **Escrito y guardado** (NO registrado todavía, cero efecto en el sistema):
   `C:\Users\Admin\.claude\hooks\require_code_review_before_merge.mjs` — hook `PreToolUse` (matcher
   `Bash`) que intercepta `gh pr merge`, extrae el número de PR del comando, corre
   `gh pr view <N> --json comments,body` (vía `execFileSync`, `cwd` del comando, timeout 8s), busca el
   marcador `code-review: PASS|OK|APROBADO` en el body o los comentarios. Si no está →
   `decision:"ask"` con la remediación exacta (correr `code-reviewer` o `Skill(code-review)`, postear
   `gh pr comment <N> --body "🔍 code-review: PASS — ..."`, reintentar). Fail-open absoluto (gh no
   disponible / sin red / JSON inválido / sin número de PR → `exit 0`, nunca bloquea). Sigue el mismo
   patrón exacto que `git_commit_lowercase.mjs` y `cross_session_pretooluse.mjs` (leídos como
   template antes de escribir, canon REUTILIZAR).

## 🔄 En curso / falta (en este orden)

1. **Registrar el hook** en `~/.claude/settings.json`, bloque `hooks.PreToolUse`, agregando una entrada
   `{"matcher": "Bash", "hooks": [{"type":"command","command":"node \"$HOME/.claude/hooks/require_code_review_before_merge.mjs\""}]}`
   — mismo array donde ya viven `git_commit_lowercase.mjs`/`cross_session_pretooluse.mjs`/
   `empirical_gate.mjs` bajo `matcher: "Bash"` (línea ~144 del archivo, ver bloque leído en este
   segmento).
2. **Smoke test ANTES de dar por hecho** (spike-first aplicado al propio hook, mismo patrón que
   `graph_first_gate`/`script_first_gate` en su día): simular vía stdin un `tool_input.command` con
   `gh pr merge 999999` sin evidencia → confirmar `decision:"ask"`. Simular contra un PR real que SÍ
   tenga un comentario con `code-review: PASS` (hay que postear uno de prueba primero, o mockear la
   salida) → confirmar `exit 0` silencioso. Confirmar fail-open con `gh` inexistente (`PATH` vacío) o
   JSON stdin corrupto.
3. **Documentar en `~/.claude/HARNESS.md`**: nueva fila en la tabla §1.3 (mismo formato que las
   demás — Matcher/Hook/Qué bloquea) + entrada en el changelog §8 con fecha 2026-08-10, motivo,
   decisión de diseño (global no project-scoped, con la evidencia del clon de backend), resultado del
   smoke. **"Requiere restart de sesión (settings read-at-start)"** — anotarlo, es el patrón de los
   demás hooks nuevos de PreToolUse.
4. Avisar a backend/frontend (via `coordinacion/`, `dato_` corto) que desde ahora un `gh pr merge`
   sin evidencia de code-review va a pedir justificación — no es una sorpresa silenciosa.

## 📚 Contexto crítico para retomar

- Archivo template que copié el estilo: `~/.claude/hooks/git_commit_lowercase.mjs` (estructura básica)
  y `~/.claude/hooks/cross_session_pretooluse.mjs` (uso de `execFileSync` con `cwd`, timeout, fail-open,
  formato de `reason` multilínea). Ambos ya leídos en este segmento, no hace falta releerlos de cero.
- `~/.claude/settings.json` — sección `hooks.PreToolUse`, el array con `matcher: "Bash"` que ya tiene
  `git_commit_lowercase.mjs` + `cross_session_pretooluse.mjs` + `empirical_gate.mjs` es donde va la
  nueva entrada (visto en este segmento, no releer el archivo completo — usar `grep -n` para ubicar la
  línea exacta del array antes de editar).
- El trabajo del sprint de soporte (SOP4-SOP7) sigue en paralelo, sin tocar en este segmento — ver
  `coordinacion/PLAN.md` COLA-VIVA, ya actualizada hasta las 14:27 de hoy. PR#371 (S6-11) seguía con
  CI roto esperando el fix de frontend cuando se pausó este segmento; backend tenía mi `dato_`
  priorizando el endpoint de S6-11 sin confirmar lectura todavía.

## 🧠 Modelo mental / supuestos

- Asumo (no verificado en este segmento) que `manejo-errores` también trabaja desde un checkout
  propio sin `settings.local.json` — no lo chequeé como sí hice con backend/`ci-clone`. No cambia la
  decisión (igual sería global), pero si alguna sesión SÍ tiene su propio `.claude/settings.local.json`
  con overrides, revisar que no lo desactive por accidente.
- El marcador elegido (`code-review: PASS`) es una convención NUEVA, inventada en este segmento — no
  existe precedente en el repo. Si al retomar parece que no hay forma de "aprobar" un PR salvo el
  bypass manual del `ask`, es esperado: recién nace, todavía nadie posteó ese marcador nunca.

## 📊 Estimación de progreso

Gate de code-review: **~40%** — diseño + archivo del hook escritos y verificados contra el estilo
existente; falta registrar, testear, documentar y avisar a las sesiones. ~15-20 min restantes
estimados.
