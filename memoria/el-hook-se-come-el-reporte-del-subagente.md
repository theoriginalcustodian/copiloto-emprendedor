---
name: el-hook-se-come-el-reporte-del-subagente
description: Un hook que interviene en el turno final de un sub-agente headless deja el reporte fuera del JSON — está en el transcript, no hay que repetir el trabajo
metadata:
  type: project
---

2 de 4 sub-agentes headless (`claude -p ... --output-format json`) devolvieron un `result`
de ~800-1400 chars donde correspondían ~20.000. El trabajo **estaba hecho**: un hook del harness
(el gate de *"sin evidencia no está listo"*) intervino después del reporte, el agente respondió
la objeción, y **esa aclaración quedó como turno final** — que es lo único que `--output-format
json` captura en `result`.

Síntoma: el `result` empieza con algo como *"El hook marcó falsos positivos…"* o *"Control
positivo: el grep sobre…"* en vez de con el entregable. `is_error: false`, exit 0 — nada indica
que falta contenido.

**Recuperación** (el reporte completo sigue en el transcript de esa sesión):

```bash
SID=$(python -c "import json;print(json.load(open('out-X.json',encoding='utf-8'))['session_id'])")
TR="$HOME/.claude/projects/<slug>/$SID.jsonl"
# tomar el bloque de texto MÁS LARGO de los mensajes type=assistant
```

**Why:** un `result` corto pero sintácticamente válido no se parece a un fallo — se parece a un
agente conciso. Sin un control de tamaño esperado, la pérdida pasa desapercibida y el reflejo
caro es **re-lanzar el sub-agente**, pagando dos veces el mismo barrido. El control que lo cazó
acá fue trivial: `grep -c '^|'` sobre cada reporte (¿trae la tabla que pedí?) — 51, 61, 49 filas
en tres, **0 en el cuarto**.

**How to apply:** después de cosechar sub-agentes headless, correr **siempre** un control de
forma sobre el output, no sólo de exit code: contar las filas de tabla, los encabezados pedidos,
o los bytes mínimos esperados. Ante un `result` anómalamente corto, **ir al transcript antes de
re-lanzar**. Y al escribir el prompt, pedir la salida en un formato que el control pueda medir
(*"empezá directo con la tabla"*) — eso hace el chequeo posible.
Relacionado: [[encabezado-tranquilizador-se-come-la-carga-util]], [[vacio-no-es-hallazgo-correr-el-control]],
[[claude-code-headless-capabilities]].
