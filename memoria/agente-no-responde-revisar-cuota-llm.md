---
name: agente-no-responde-revisar-cuota-llm
description: "El agente aceptaba el chat pero nunca respondía: la cuenta de OpenAI sin cupo (429 insufficient_quota) mata el workflow sin escribir reply"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T12:18:53.883Z
---

**2026-07-21.** `POST /chat` devolvía `{"accepted":true}` y arrancaba el workflow, pero `GET /reply`
quedaba **vacío para siempre** (sesiones de 8h atrás seguían vacías). Nada en la app ni en el
front-door estaba roto.

**Causa raíz:** la cuenta de **OpenAI** (el copiloto usa `gpt-4o-mini` vía
`apps/copiloto/worker_b.py` → `LlmProvider`, NO OpenRouter pese al default del motor) se quedó
**sin cupo**. La activity `call_llm_tools` recibía `HTTP 429 · code=insufficient_quota`, que
`motor/clients/agent/providers/llm.py::_is_non_retryable_http_error` clasifica —correctamente— como
**no-retryable**: el workflow muere sin persistir reply. Fix: rotar la key a una con saldo +
`systemctl restart uc-copiloto-worker`. Verificado: 2 turnos E2E con contexto mantenido.

**Why:** el síntoma miente. Un `/reply` vacío se siente como "el worker está caído" o "falta
provisioning", y ninguno de los dos lo era: `systemctl is-active` daba **active** y el worker
consumía tasks. El error vivía en el *log*, no en el estado del servicio. Y `429` se lee como
rate-limit transitorio ("ya va a pasar") cuando `insufficient_quota` es **permanente**.

**How to apply — el orden barato cuando el agente no responde:**
1. **`journalctl -u uc-copiloto-worker.service -n 30`** ANTES de teorizar. `is-active` no alcanza:
   un worker sano puede estar fallando cada task.
2. **Correr el control del vacío**: `GET /reply` con una sesión **inexistente** devuelve el
   *mismo* `{"replies":[],"next_id":0}` ⇒ el vacío NO distingue "no hay sesión" de "no hay
   respuesta"; por sí solo no prueba nada. Y una sesión **vieja** que sigue vacía descarta lentitud.
3. **Probar la API del LLM directo** desde el VPS (`set -a; . /etc/unreal-copilot/copiloto.env`) —
   distingue sin ambigüedad `insufficient_quota` (cuota) de rate-limit.
4. Los **ids de `/reply` son globales, no por sesión** (llegaron 321/322 en la 1ª sesión). Pasar
   `after_id=1` esperando "el 2º turno" devuelve basura — usar el `next_id` que devuelve el server,
   como hace `packages/core/src/api/reply.ts`.

**Alternativa viva si vuelve a faltar cupo:** `GROQ_API_KEY` YA está en el env del VPS y responde
200 (documed lo usa para su copiloto). Cambiar el provider es tocar `worker_b.py:65-66` (url + key +
modelo), pero **requiere spike de tool-calling nativo** antes — el loop ReAct depende de él.

[[copiloto-deploy-multitenant-vivo]] · [[vacio-no-es-hallazgo-correr-el-control]] · [[copiloto-motor-react-concatenadas]]
