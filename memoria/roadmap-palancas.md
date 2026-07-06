---
name: roadmap-palancas
description: "Estudio SOTA de 15 palancas de la fabrica (capacidad/calidad/autonomia/costo/memoria/seguridad) ordenado por ROI; doc docs/ROADMAP-palancas.md (PR #39). C2 (PR real, ROI #1) YA CERRADO E2E."
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Estudio de palancas (2026-06-20, workflow ultracode).** 15 palancas investigadas (SOTA 2024-2026 + failure map + fit con el stack + ROI), calibracion cross-palanca + sintesis (opus), **verificado vs codigo real**. Doc versionado: `docs/ROADMAP-palancas.md` (PR #39). Expande [[casa-fabrica-features-diseno]] en 6 familias: **A** capacidad · **B** calidad · **C** autonomia · **D** costo · **E** memoria · **F** seguridad.

**Ranking por ROI calibrado (alto→bajo):** 1.**C2** PR real (15.5, quick-win, ✅ **CERRADO**) · 2.D3 fix fan-out paralelismo (5.1) · 3.D2 HOME dedicado (4.8) · 4.B1 verificador robusto held-out+Hypothesis (3.3) · 5.F1 hardening (3.1) · 6.E2 prompts adaptativos "dale el plano" (2.8) · 7.B2 integracion E2E (2.7) · 8.A2 DB/servicios SOLO-fakes (2.5) · 9.A3 paquetes/jerarquia (1.95) · 10.**C1 SP7 intake NL** (1.85) · 11.D1 model routing (1.7) · 12.A1 deps PyPI (1.6) · 13.E1 Graphity (1.4, big-bet) · 14.A4 multi-lenguaje (1.0) · 15.C3 auto-mejora (1.0).

**Insights que corrigieron intuiciones (el valor del estudio):**
- **C2 domina** (15.5): el codigo ya existia, solo faltaba gh auth + `--draft`; desbloquea el return `completed` (trace SP5/SP6 en vivo) y es precondicion de SP7. **CERRADO E2E** (ver banner en [[casa-fabrica-features-diseno]]).
- **SP7 (C1) NO es lo primero** — rank 10, depende de **C2+F1**. Camino a L3 = `C2 → F1 → SP7`, no "SP7 ya".
- **A1 deps NO era el #1** (intuicion previa ERRONEA, el estudio la cazo) — rank 12: tensiona la frontera, depende de F1, ~2 dias (no "1 linea de Dockerfile"). SOTA deps = imagen pre-baked + lockfile hash-pinned + allowlist curado + quarantine (supply chain: >454k paquetes maliciosos en 2025).
- **F1 antes de TODA palanca de capacidad** (A1/A3/A4 reabren path-traversal / supply-chain). F1 quick-win = test negativo de sandbox + bearer-token MCP + reorden del conftest del gate.
- **D2 "prompt caching" inerte bajo Max** (el CLI no expone la cache API); beneficio real = solo HOME aislado (calidad de planes + headroom de cuota), NO ahorro de plata (Claude = $0 marginal).
- **B2 es incremento de B1, no palanca aparte** (doble conteo de held-out). **E2 domina a E1/C3** en el scope flat actual (~80% del beneficio, barato y puro).
- **Big-bets gated por METRICA** (activar por medicion, no proyeccion): E1 Graphity (>50 features + spike latencia VPS→Helsinki <500ms; valor=0 hasta la 2da feature) · C3 auto-mejora (>20 fallos en corpus; hoy solo instrumentar `record_outcome`) · A4 multi-lenguaje (si piden no-Python recurrente).
- **A2 Accion 3 (Postgres real) ROMPE `--network none`** → diferida (decision MAYOR); solo A2-fakes (sqlite3/http.server in-process) tiene sentido hoy.

**Niveles de autonomia (marco L0-L5):** la fabrica esta en **L2 robusto, asomando a L3**. L2 = hace la feature E2E sola pero el operador encola + aprueba 2 gates + define el "que". L3 = intake NL (SP7) + PR real (✅ C2) + el operador solo supervisa lo irreversible. **C2 cerrado movio 1 de las 2 piezas de L3**; falta SP7 (+ F1 como su precondicion).

**Ola 1 "hacer ya" (~2-4h wall con waves):** C2 (✅) → F1 → D3 → D2. Cierra los 4 desbloqueos de mayor ROI.

**Gotchas del workflow ultracode:** lanzar 15 agentes en paralelo gatillo **rate-limit del servidor Anthropic** (11/15 cayeron, "Server is temporarily limiting requests") → fix = **olas de 5 con barrier** entre olas. El return del workflow llega bajo `data["result"]` (no en el root del output file).
