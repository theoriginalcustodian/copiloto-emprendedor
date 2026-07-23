# Compactación a un umbral propio (500k) — investigación (PAUSADO para retomar)

> **Estado:** pausado por el operador el 2026-07-22 para retomar más adelante.
> **Objetivo:** que las sesiones de Claude Code que corren autónomas toda la noche **compacten a ~500k
> tokens** (mitad de la ventana de 1M) en vez de a ~950k (95%, el auto-compact nativo). Motivo del
> operador: compactar a 950k **gasta muchos tokens** en el resumen y **en un contexto tan grande se
> pierden cosas** — no es eficiente.

---

## Lo que se VERIFICÓ empíricamente (no supuesto)

1. **Medir el contexto vivo: FUNCIONA.** El transcript JSONL de cada sesión
   (`~/.claude/projects/<slug>/<session>.jsonl`) registra por turno del assistant:
   ```
   usage: { input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens }
   ```
   **Contexto vivo ≈ `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`** del último
   turno. Medido en vivo: la sesión de planificación estaba en ~233k. Un script externo PUEDE leer esto y
   decidir si pasó 500k. ⚠️ Caveat real: la doc dice que el formato del JSONL es interno y **puede cambiar
   entre versiones** de Claude Code → si se automatiza, poner un guard de versión.

2. **`/compact` inyectado NO ejecuta — SPIKE NEGATIVO.** Se armó un `CronCreate` one-shot que disparó el
   prompt `/compact` en la sesión de planificación. **Llegó como TEXTO** (se recibió como prompt a
   responder), **no disparó la compactación**. Conclusión firme: los slash-commands NO se procesan cuando
   se inyectan por el canal de prompts (cron/scheduler) — solo cuando los tipea un humano en el REPL.

3. **El asistente NO puede auto-compactar.** `/compact` es comando del REPL, no una tool disponible para
   el modelo. Aunque le llegue "compactá", no puede ejecutarlo.

4. **Auto-compact nativo NO es configurable.** Key `autoCompactEnabled` (default `true`; env
   `DISABLE_AUTO_COMPACT=1`). Es on/off — el umbral (~95%) es interno, no se puede fijar a 500k. Verificado
   en settings del repo: sin override → ON por default.

5. **Hooks NO alcanzan.** Existen `PreCompact`/`PostCompact`, pero su input **no incluye el token count**,
   no pueden leer el estado de contexto, y no pueden disparar `/compact`. El Agent SDK tampoco expone
   límite de contexto configurable ni callback de usage por turno.

6. **NO hay daemon externo.** El operador arranca las 3 sesiones **a mano cada mañana** (abre la PC, inicia
   las sesiones interactivas de VS Code, levanta los crones) y se va. No hay proceso supervisor vivo.

## Por qué el target exacto de 500k NO es alcanzable limpio (en este setup)

- Forzar compactación a 500k necesita, o bien inyectar `/compact` (no ejecuta, #2), o un **supervisor
  externo** que reinicie la sesión (no hay daemon, #6), y las sesiones son **interactivas de VS Code** →
  no se relanzan limpio por script. Una sesión **no puede reiniciarse a sí misma**.
- El único camino literal a 500k sería **automatización de tecleo por GUI** (AutoHotkey/xdotool que el
  operador levanta cada mañana y que "tipea" `/compact` en la caja cuando un script detecta 500k leyendo
  el transcript). Funciona porque emula al humano, pero es **frágil y platform-specific**. No recomendado
  para algo desatendido toda la noche.

## Lo que SÍ rinde y es achievable (recomendación)

En vez de forzar 500k (imposible limpio), **hacer que el contexto crezca más lento y que cada
compactación sea inofensiva**:

1. **Bajar la cadencia de los monitores.** Son el mayor llenador de contexto: el monitor de PARÁLISIS cada
   3 min ≈ ~160 turnos/noche + respuestas. Pasarlo a **cada 7-8 min** hace que auto-compact dispare mucho
   menos seguido y quema menos tokens. Aplicable por sesión vía `CronCreate` (cada sesión edita el suyo).
2. **Hook `PreCompact`** que en cada auto-compactación corra un checkpoint (seed de memoria / persistir
   estado). Ataca el miedo real ("se pierden cosas") sin depender del timing.
3. **Confiar en el estado externalizado.** El estado del proyecto vive en `HANDOFF.md` + `coordinacion/`
   (buzón) + `memoria/`, NO en el contexto. Cuando compacta a 950k, casi no se pierde nada recuperable.

## Para retomar (próximos pasos concretos)

- [ ] Decidir si vale montar el AutoHotkey de 500k (target exacto, frágil) o quedarse con la cadencia
      reducida + PreCompact (achievable, robusto).
- [ ] Si se va por la vía achievable: (a) bajar los monitores a 7-8 min en las 3 sesiones, (b) escribir el
      script `PreCompact` de checkpoint, (c) registrarlo en `~/.claude/settings.json`.
- [ ] Si se va por AutoHotkey: escribir el medidor (lee transcript → contexto vivo) + el disparador GUI,
      con guard de versión del formato JSONL.

## Referencias de la investigación

- Verificación con el agente guía de Claude Code (2 pasadas): auto-compact, hooks, SDK, `/compact` headless.
- Spike del `/compact` inyectado: `CronCreate` one-shot `c58e45b8`, 2026-07-22 22:20 → negativo.
- Medición del transcript: campos `usage.*` del JSONL de la sesión, ~233k medidos en vivo.
