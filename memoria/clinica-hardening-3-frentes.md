---
name: clinica-hardening-3-frentes
description: "Hardening de clinic-management (review Fugu): 7/7 findings novel 0 FP; remediación RPC atómicos + audit keyed-hash + composition root que DRIVEA seams; K34 MECANIZADA. Meta-insight VIVO: el cuello de calidad = verificación adversarial independiente."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Hardening de `clinic-management`** (multi-tenant PHI) tras review A/B ciego Claude-control vs **Fugu Ultra** (2026-06-25, PR #3 MERGED). Fugu (bundle 26k, MENOS acceso que el control con repo+tools) cazó **7/7 findings novel confirmados material, 0 FP** (F2 identity-binding HIGH-sec) → K=3 run#1 limpia el bar. Reporte: `docs/Implementaciones terminadas/2026-06-25-clinica-hardening-3-frentes-review-fugu_reporte.md` · adjudicación `docs/Follow up/2026-06-25-clinic-management-review-claude-vs-fugu.md`.

**Remediación:** capa DB (`migrations/001_hardening.sql`, idempotente): RPC transaccionales atómicos (`clinic_create_booking`/`clinic_apply_movement`/`clinic_record_fired`) + audit inmutable tamper-evident (trigger anti UPDATE/DELETE gateado owner+GUC, REVOKE incl. service_role + **hash-chain CLAVEADO** con secreto en tabla restringida vía SECURITY DEFINER). Capa código: el composition root FIJO **DRIVEA los seams** (audit por acceso PHI · flag Documed per-tenant · F2 identity-binding · pricing real · notifier+reminder consent-gated).

**El re-review adversarial (2 rondas opus) cazó 7 bugs en el PROPIO hardening que pytest+validate_real+e2e NO vieron** — el más grave **H1:** el RPC reusaba el turno por `(cliente_id,prof,slot)` SIN `patient_id` → un 2do paciente recibía silenciosamente el booking/factura de OTRO (fusión cross-paciente); mis tests usaban el mismo paciente → ciegos. + C1 (hash forjable→keyed), H2, M1/M2, A1, L1. QA E2E adversarial concurrente 6/6 (race que validate_real secuencial NO prueba).

**✅ K34 MECANIZADA en `/generar-plano`:** el gate testea UNIDADES (fakes) + validate_real testea HAPPY-PATH → NINGUNO ejercita el **seam adversarial cross-unit** (donde A debe MANEJAR a B); "wired but never driven" es sistémico, la capa **N+1** de K31/K32/K33. El plano de un compuesto DEBE: composition root que DRIVEE los seams + seam-test por seam + op multi-store = RPC transaccional + QA adversarial concurrente + (regulado) capa DB de hardening con residual NOMBRADO.

**Meta-insight VIVO:** el cuello de calidad de una fábrica autónoma NO es la generación sino la **VERIFICACIÓN ADVERSARIAL INDEPENDIENTE** — el control con MÁS acceso perdió lo que un revisor con MENOS cazó, dos veces (Fugu + el re-review del propio hardening). **Residual no-código (operador):** retención Ley 26.529 · TDE encryption-at-rest · custodia/rotación de la llave del audit + firma WORM externa.

[[clinica-medica-2do-sistema-compuesto]] [[fugu-revisor-integracion]] [[no-codificar-la-esperanza-principio-raiz]] [[cierre-del-aprendizaje-no-opcional]]
