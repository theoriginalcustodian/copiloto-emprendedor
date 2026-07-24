---
name: deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo
description: Un monitor que DETECTA la parálisis y sólo la reporta no la resuelve — detección sin acción es ocio pasivo; el blocker de otra sesión suele ser categoría-A (resoluble por planificación con un grep), no externo
metadata:
  type: feedback
---

**El 2026-07-24 la fábrica quedó ~9 h ociosa DE NOCHE con TRES monitores corriendo.** No fue falta de
detección — fue **respuesta pasiva a la detección**. La REPL de backend murió ~00:31; el frontend quedó
7 h bloqueado en una pregunta de seam (la "Q1": *¿ingreso/factura/kanban emiten la card por el mismo
canal que gasto?*) **que era un grep de planificación de 20 min**; y planificación reportó "sigo el
vigía" cada 3 min durante 7 h en vez de resolver. El operador: *"cuando te dejo trabajando solo de noche
nunca terminas... 9 h ociosos es inaceptable."*

**La causa raíz (por qué las reglas anti-ocio que YA existían no alcanzaron):** el loop de monitor
**acepta "hold" sin exigir prueba de que no hay trabajo alcanzable.** "Backend mudo" se clasificó como
externo (sólo el operador revive la REPL) cuando el blocker real del frontend era **categoría A:
resoluble por planificación con un grep.** Planificación se escondió detrás de "yo no implemento" sobre
algo que ERA su trabajo: **leer código para contestar una pregunta de costura no es implementar — es la
razón de ser de la sesión dueña del seam** ([[verificar-que-el-camino-recomendado-existe]], la junta con
dueña). Es el mismo *un-vacío-no-es-hallazgo* aplicado al propio ocio: "no hay nada que hacer" se SIENTE
como un dato, y es una hipótesis que casi nunca se corre el control.

**La triada que ahora ENFORZA `scripts/no-ocio-check.sh`** (cada ciclo de monitor, junto a
`cola-check.sh` y el janitor — COORDINACION §4.2.sexies). Ante ocio, PROHIBIDO "hold" hasta descartar en
orden:
1. **(A) blocker resoluble por planificación** — `[ASSUMED_PENDING_VERIFY]`, Q de seam, contrato sin
   bajar, grep, lectura, decisión táctica → resolver en el MISMO ciclo, NO diferir a otra sesión.
2. **(B) backlog independiente** — COLA-VIVA, Bandeja, memoria sin commitear, PLAN, prep del próximo
   hito (de-risk, NUNCA implementar la fase siguiente) → adelantar.
3. **(D) dead-man's-switch** — REPL muda **≥ 30 min** en camino crítico → `PushNotification` al operador
   + reasignar a planificación lo resoluble sin esa REPL. **Habría disparado a las 01:01, no a las 09:00.**

**Parámetros del operador (2026-07-24):** parada 6 min · REPL muerta 30 min · bloqueo operator-only 15
min, y **de noche (00–08 h) push INMEDIATO al teléfono** — para que conteste del celular en 30 s en vez
de congelar la cola hasta la mañana. Mientras espera, planificación sigue adelantando lo que no depende
de la decisión.

**Por qué el push nocturno es el lever que faltaba:** una REPL muerta es un proceso muerto — planificación
NO puede revivirla, sólo el operador. De noche, un bloqueo operator-only sin push **congela la cola
entera hasta la mañana**. `PushNotification` empuja al teléfono si Remote Control está conectado → el
bloqueo se resuelve en 30 s, no en 9 h. Marker determinista: `abierto/bloqueo-operador_<slug>.md` con
línea `ASK:` para que el check lo vea sin depender del chat.

**Regla dura:** **planificación NUNCA está ociosa con la cola no vacía.** Ocio legítimo sólo si (A) y (B)
vacíos Y el bloqueo es operator-only con push emitido. Hermana de [[ejecutar-la-cola-acordada-no-es-una-decision-de-scope]]
(aquélla: no frenar ante un hito arrancable; ésta: no frenar ante un hito arrancando-pero-parado).
[[cero-tiempo-ocioso-tres-estados]] · [[trabajo-oportunista-esperas]] · [[una-espera-sin-disparador-nombrable-es-paralisis]].
