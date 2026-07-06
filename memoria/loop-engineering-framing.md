---
name: ""
metadata: 
  node_type: memory
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

**"Loop Engineering"** — término acuñado ~7-8 jun 2026 (tweet de Peter Steinberger "deberías diseñar loops que prompteen a tus agentes" → post de Addy Osmani que lo formalizó). Boris Cherny (head de Claude Code) lo valida: "ya no prompteo Claude, escribo loops que lo hacen". Linaje previo al nombre: **Ralph** (Geoffrey Huntley, ppios 2026) = correr un agente en un while-loop pelado contra un spec hasta terminar.

**Definición:** diseñar/operar/mejorar los feedback loops que dejan al agente planificar → cambiar código → observar → revisar enfoque, hasta completar — en vez de tratar la IA como generador one-shot. El leverage se mueve del *contenido* (qué le digo al agente) a la *estructura* (qué sistema decide qué decirle, lo verifica y persiste el estado). Tres capas que se envuelven: prompt eng (un turno) → context eng (la ventana) → loop eng (el ciclo auto-corriendo). El loop **amplifica**, no sustituye el juicio.

**Anatomía del patrón convergente** (= los órganos que Unreal Copilot ya tiene, ver [[plataforma-agentica-estado]]):
- **Decisor** — el modelo elige la próxima acción en cada tick contra el estado actual (vs rama hardcodeada). Es lo que separa loop de script. *Acá:* Hermes/kernel.
- **Verificador separado** — maker-checker: el que escribe NO califica su propia tarea; la condición de parada es verificable, no opinión del maker. *Acá:* `run_tests` (gate objetivo) + checkpoint de Opus por sprint.
- **Estado persistente** — la columna que sobrevive entre/durante runs. *Acá:* Temporal.

**El diferenciador (VALIDADO E2E 2026-06-19, ya no solo en diseño):** todo el mainstream resuelve persistencia con loops **efímeros** — Ralph while-loop, `/goal` (driver de sesión nativo de Claude Code — ver la corrección abajo), estado en archivo markdown / board. Eso es *resumibilidad gruesa* ("releo mi TODO y arranco de nuevo aproximado"), idempotente por run — NO durabilidad de ejecución. Unreal Copilot pone el loop sobre **rieles durables (Temporal)**: reanuda exacto tras un crash a mitad, sin perder ni duplicar. **Validado:** el spike de durabilidad cross-corte ([[durabilidad-cross-corte-validada]]) probó que el workflow sobrevive la muerte del worker y reanuda exacto sin re-ejecutar lo hecho — la ventaja diferencial dejó de ser aserción.

**Dos anclajes accionables:**
- **Ralph "context reset" valida el ejecutor stateless** — no querés sesión larga (se degrada); querés instancias frescas con el mismo spec, estado afuera. = DeepSeek/Kaggle descartables, estado en Temporal+plan, no en la cabeza del que codea (ver [[variante-deepseek-aditiva]]).
- **`/goal` — corregido 2026-06-20 contra la doc oficial (`code.claude.com/docs/en/goal`):** es una **feature NATIVA de Claude Code** (v2.1.139+), NO el patrón Ralph ni un "micro-loop de code-gen". Fijás una **condición de completitud** y, tras CADA turno, un modelo chico (Haiku) evalúa contra la conversación si se cumple; si no, arranca otro turno SOLO hasta cumplirla o `/goal clear`. Es un wrapper de un Stop-hook prompt-based, **session-scoped**. **Clave:** opera UN NIVEL ARRIBA — sobre la SESIÓN del operador (el arquitecto), NO sobre el loop de ejecución de la fábrica → es **ORTOGONAL** a Temporal, no su competidor. No se "reemplaza" por Temporal: se puede usar `/goal` para conducir la sesión que CONSTRUYE la fábrica. **Limitación medida (2026-06-20):** el evaluador solo ve la conversación (no corre comandos) y NO puede clickear los gates HITL → no cierra solo un E2E gateado. El framing "durable vs efímero" aplica al loop de EJECUCIÓN (Temporal), no a `/goal`.

**Fuentes reales (el resto es content-farm derivado, MindStudio/Kilo/etc.):** post de Osmani · writeup original de Ralph (Huntley) · charla de Cherny. Osmani mismo se declara escéptico ("hay que tener mucho cuidado"); las mejores prácticas aún se escriben.
