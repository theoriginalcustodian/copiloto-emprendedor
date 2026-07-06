---
name: copiloto-recall-temporal
description: "Recall temporal del copiloto — \"qué hice ayer/esta semana\" por rango de fecha libre desde Graphity (PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**LEER al tocar el recall por fecha o al agregar una acción nueva al motor conversacional.**

Acción `consultar_actividad`: el emprendedor pregunta "qué hice ayer / esta semana / el mes pasado / del 1 al 5 de julio" y el copiloto lo responde desde la memoria de largo plazo (Graphity) en vez del historial de chat. Rango de fecha **libre** (no presets) + análisis **exhaustivo** (no top-K semántico). Pipeline: `resolve_date_range` (determinista es-AR, `now` inyectado) → `MemoryProvider.recall_range` (agregado al ladrillo [[copiloto-memoria-provider-ladrillo]]) → `activity_summary.summarize_activity` (umbral adaptativo: directo si entra en contexto, map-reduce si grande). Corre en la activity `dispatch_intent` (I/O LLM fuera del sandbox del workflow → replay-safe). **PR #125 mergeado + desplegado LIVE** (scp + restart `uc-copiloto-worker`, "memoria: ON").

**Reglas duras que reventaron y NO deben volver (review adversarial 2 pasadas, 14 fixes):**
- **Acción nueva → SIEMPRE registrarla en `types.ACTIONS`** o `Intent.from_dict` la degrada a `clarify` y la feature muere en prod. Mismo patrón que `mp_charge`. Los tests que construyen `Intent` directo ESQUIVAN este path → siempre incluir un test que pase por `from_dict`.
- **`valid_at` del server llega NAIVE** (sin offset) — el copiloto persiste `reference_time` naive UTC-valued. Comparar contra `since/until` aware lanzaba `TypeError` que colgaba el turno bajo LOOP_RETRY → normalizar naive→UTC (`_parse_iso`). NUNCA asumir el wire-format: verificarlo (los mocks con `Z` lo escondían).
- **El `content` de los episodios es contenido NO confiable** (texto de mails/mensajes extraído por LLM) → envoltorio anti-injection `[ACTIVIDAD]` + delimitador neutralizado, en TODOS los paths incluido el fallback del map-reduce. Mismo patrón que `memory_provider._wrap_context`. Ver [[agente-conversacional-hardening-3-lentes]].
- **Best-effort duro:** `recall_range` degrada a `[]` ante CUALQUIER excepción (catch-all) — una excepción escapada mata el `ConversationWorkflow` durable. Ver [[agente-loop-tool-failure-retry-infinito]].
- **Fechas siempre en pasado**, año por el INICIO del rango (`range_base_year`, straddle-safe); rango de días sin nombre de mes → `None` (no caer en rama ancha 'este mes').

**Deuda VISIBLE (gestionada, no impaga):** `list_episodes_in_range` trae los últimos ≤500 episodios; un rango con >500 episodios *más viejos* puede truncarse. Documentado en el docstring del método. Condición de pago = cuando un tenant supere ~500 episodios (hoy tienen decenas) → paginar por `uuid_cursor` (sin orden fecha → traer todo y filtrar). Cero deuda invisible.

**Metodología que rindió:** verificación adversarial (workflow multi-agente 1ª pasada + Fable inline 2ª) cazó 14 bugs que 28 tests unitarios verdes no vieron — el valor estuvo en atacar el path REAL del motor y verificar el wire-format contra realidad, no en el modelo. Spike-first contra Graphity vivo (`spikes/recall-por-fecha/RESULT.md`) validó los 4 supuestos antes de diseñar. [[copiloto-deploy-multitenant-vivo]] [[copiloto-emprendedor-roadmap]]
