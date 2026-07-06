---
name: fugu-revisor-integracion
description: "Sakana Fugu evaluado — archivado como músculo/arquitecto (cost-play negativo bajo Max); puesto encontrado = revisor final de integración independiente, advisory y security-first para proyectos complejos flaggeados. Protocolo + extractor ya en código."
metadata: 
  node_type: memory
  type: project
  originSessionId: db10c758-defe-4aab-b0c5-c9c5091e2c82
---

Sakana **Fugu** (OpenAI-compatible, models `fugu`/`fugu-ultra`/`fugu-ultra-20260615`, base `https://api.sakana.ai/v1`, auth Bearer). Drop-in en el boundary `infer` pluggable (A-1, [[variante-deepseek-aditiva]]).

**Archivado como músculo/arquitecto (cost-play NEGATIVO).** Verificado en spike (2026-06-24): factura los tokens de **orquestación interna** (`usage.prompt_tokens_details.orchestration_input_tokens`), que **escalan** con la dificultad (multiplicador 18x→32x medido) → ~**$0.20/hard-call**, 60-85s, ~**100x flash**. Bajo **suscripción Max, Claude es $0 marginal**, así que meter Fugu en la cascade = pagar real para desplazar un frontier (Opus 4.8) que ya es gratis. Reactivar SOLO si: la fábrica sale de Max · Fugu baja de precio · necesidad de resiliencia anti-Anthropic (los 529 que justificaron SP7).

**Puesto ENCONTRADO (sobrevive la economía por ser raro + big-client):** **revisor FINAL de integración**, independiente (otro cerebro, no el Claude que arquitectó), **advisory** (informa, NO decide — la autoridad del MAYOR queda humana; mismo encuadre que el gate_agent de [[loop-desarrollo-gate-senior]]), **security-first**. Trigger = **flag explícito del operador** por proyecto. Precondición = el sistema YA pasó gate Docker + `validate.py` + GATE2 (revisa lo que se coló).

**Test = A/B CIEGO:** brazo A = Claude-con-tools (control gratis, baseline honesto) vs brazo B = Fugu-con-bundle-curado; ciegos entre sí, mismo prompt/schema/dimensiones (incl. seguridad). Fugu gana SOLO si surface findings **true-novel materiales** que los gates Y el control Claude no cazaron. **El operador adjudica** (autoridad). Regla pre-registrada: K=3, keep si ≥1 true-novel ≥high en ≥50%, FP-rate ≤30%, costo no-vinculante. Output secundario: cada true-novel → endurecer `gate_agent.py`/`validate.py` (la fábrica mejora aunque Fugu no se adopte).

**Run#1 = la clínica (`clinic-management`, 20 units PHI, 2026-06-25).** Adjudicación `file:line` de los 17 findings → **7/7 candidatos novel de Fugu confirmados material (F2 identity-binding HIGH-sec · F6/F7/F9/F10/F11/F12), 0 falsos positivos**; el control (Claude, repo+tools COMPLETO) había perdido 6-7 con MÁS acceso que el bundle de 26k de Fugu. **Fugu limpia el bar K=3 DECISIVAMENTE en el run#1** (true-novel ≥high presente, FP-rate 0%). Output secundario cumplido: los 17 → fix de raíz en la app (PR #3 merged) + la lección de seam a `/generar-plano` (K34). Y un 2do dato fuerte: el re-review adversarial del PROPIO hardening cazó 7 bugs más (incl. H1 fusión cross-paciente) → el cuello de calidad es la verificación adversarial independiente, no la generación. Adjudicación en `docs/Follow up/2026-06-25-clinic-management-review-claude-vs-fugu.md`. Ver [[clinica-hardening-3-frentes]].

**Artefactos** (en `spikes/fugu-ultra/`, **MERGED a main — PR #82, 2026-06-25**):
- `PROTOCOLO-revisor-integracion.md` — protocolo autocontenido, end-to-end ejecutable.
- `extract_integration_surface.py` — **extractor determinístico** stdlib (ast+rglob+regex); `test_extract.py` **9/9** contra fixtures REALES (`composicion-3-mixed`/`-2`). Produce bundle = system map + grafo de wiring cross-pieza + qué cubre `validate.py` + índice de seguridad (SECRETS/TENANCY/QUERY_INJECTION/AUTHZ/EXTERNAL_INPUT, `file:line`) + source de composition_root/glue/facades/backends, con tope de chars + truncado no-silencioso.
- `sakana_provider.py` — `_sakana()` (espeja `_openrouter`) + `compute_cost()` con tokens FACTURADOS; `test_cost.py` **7/7**.
- `RESULT.md` (veredicto + reactivación) · `sample_bundle_3mixed.md` (evidencia).

**🛠️ Skill global reusable `dupla-fugu-opus`** (`~/.claude/skills/dupla-fugu-opus/`, 2026-06-30 — spec PR #96 a main): generaliza este protocolo a **CUALQUIER repo/stack**. Núcleo extractor agnóstico (multi-lenguaje) + **perfiles pluggable** (`_base`/unreal-copilot/node/python/go, config TOML no código) + `sakana_provider` portado + `run_review.py` (brazo A=`claude -p` Opus headless ∥ brazo B=Fugu, ciegos) + adjudicación adversarial (sub-agentes default-FP, ver `references/adjudication_rubric.md`). **Validada como ladrillo: 23/23 pytest + smoke determinista en Python y Next.js reales.** Brazos LLM reales = `[REQUIRES_LIVE_VALIDATION]` al 1er run. Decisión: stack-agnóstica día 0 (el extractor original UC = un perfil más). Trigger = flag explícito del operador; advisory, read-only, post-gate. NO automática, NO para diffs triviales (eso es `/code-review`).

🔐 **Pendiente (owner: operador):** rotar la API key de Fugu — comprometida en chat. Vive en `~/.claude/secrets/sakana_fugu.env` + 2 env vars de usuario (`setx SAKANA_API_KEY`/`SAKANA_BASE_URL`). Nunca tocó el repo.

[[costo-incertidumbre-precision-ratchet]] [[composicion-cierre-m1-mixto]] [[no-codificar-la-esperanza-principio-raiz]]
