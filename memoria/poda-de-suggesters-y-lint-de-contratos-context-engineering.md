---
name: poda-de-suggesters-y-lint-de-contratos-context-engineering
description: Del artículo de context engineering de Anthropic se ejecutaron 2 extracciones con scripts — poda medida de 4 suggesters (~2,57M tok/mes duplicados) y lint de referencias ricas en contratos; qué se descartó y por qué
metadata:
  type: feedback
---

# ✂️📏 Context engineering aplicado: poda medida + contratos con artefacto

2026-07-26. Del artículo de Anthropic *"new rules of context engineering"* (Claude 5) el operador
autorizó ejecutar lo scriptable. Dos piezas entraron, una quedó como doctrina.

## 1. Poda de suggesters — medida, no estimada

Con los gates mecánicos (2026-07-25) + `canon_invariantes` (siempre-ON), cuatro suggesters de
`UserPromptSubmit` quedaron **diciendo lo que otra capa ya dice con dientes**. El audit
(`~/.claude/scripts/audit_suggester_overlap.py`) corrió cada hook una vez (tokens/fire reales) ×
fires del mes (event-log Gap 3, 7.387 eventos):

| Hook apagado | tok/mes | Ya lo cubre |
|---|---|---|
| `efficiency_checklist` | 1,33M | los 3 gates + skill Pilares 0-5 |
| `tech_debt` | 677k | canon §6 |
| `empirical_check` | 557k | canon §1/§5 + `empirical_gate` (dientes) |
| `root_cause` | 9k | canon §6 |

**~2,57M tokens/mes por sesión.** Apagados con `toggle_suggesters.py` — parkeados en el settings,
no borrados; `--enable` restaura idéntico. **Criterio de reversión declarado:** si una métrica de
auto-tracking empeora 2 sesiones seguidas en la regla que el suggester cubría, se re-enciende.

**Quedan ON a propósito:** `spike_first`, `estimation_calibrator`, `model_suggester`,
`complexity_scoring` (contenido único), `secret_detector` (seguridad), `canon_invariantes`
(instrumento del operador, contrato NO CRECER — absorbe a los podados en 1 línea cada uno).

**El toggle también pagó su control:** su primer run reportó "no encontrado" para los 4 hooks —
asumía una entrada-por-hook y el settings real tiene UNA entrada con los 11 adentro. Vacío del
instrumento, no del sistema ([[vacio-no-es-hallazgo-correr-el-control]]).

## 2. Lint de contratos — la prosa explica, el artefacto define

`scripts/lint-contratos-referencias.sh`: todo `contrato_`/`addendum_` con fecha **≥ 2026-07-26**
debe llevar ≥1 referencia rica — bloque cercado de ≥3 líneas (shape/test/request) o path a
artefacto real. Grandfather para los previos. Cableado como sección 2.bis de
`vigilancia-check.sh` → **los crones lo corren solos**, sin disciplina nueva que recordar.

Raíz: los 4 incidentes del 2026-07-21 fueron costuras donde cada lado leyó la misma prosa y
entendió mitades distintas; el contrato del hito C (shape sacado del cliente que YA consume) salió
sin ida y vuelta. La regla generaliza ese caso bueno.

## 3. Lo que NO se scripteó, a propósito

El criterio de admisión de reglas futuras — *¿hay un failure mode demostrado que el modelo no
razona solo?* — es un **juicio**, no un patrón grepeable. Quedó como doctrina en
[[gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea]]; scriptearlo sería el ritual
sin el filo.

## Hallazgo lateral que valió la corrida

El working tree compartido (20 commits detrás de main) había **perdido** `vigilancia-check.sh`,
`escaladores-buzon.sh` y 2 scripts más que los crones de esta sesión invocan cada 3 minutos — el
gate determinista fallaba con **exit 127 en silencio** desde que el checkout quedó atrás.
Restaurados desde `origin/main`. Un instrumento que no está no alarma: falla con la misma cara
que "sin novedades" ([[instrumentos-que-confirman-en-vez-de-verificar]]).

Detalle completo del cambio global: `~/.claude/HARNESS.md` §1.2 (poda) y §8 (2026-07-26).
