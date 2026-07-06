---
name: clinica-medica-2do-sistema-compuesto
description: "Clínica médica — 2do sistema compuesto (20 units, 2× billing) heal=0; Documed = adapter A-1 opcional (diseño activo); lecciones K31/K32/K33 MECANIZADAS en /generar-plano. Provenance + diseño Documed + caveat regulado."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Clínica Médica — 2do sistema compuesto ✅ `heal_turns=0` + `validate_real ALL PASS` al 1er intento** (2026-06-25, `github.com/theoriginalcustodian/clinic-management`, PRs #1+#2 MERGED). 20 units, 11 tablas `clinic_*` (J27 namespacing), pay-per-visit. La fábrica corregida de billing produjo el 2do compuesto **2× más grande** sin heal → el mecanismo es sólido a escala. Plantilla reusable a cualquier clínica (dental/estética/veterinaria por config). Reporte: `docs/Implementaciones terminadas/2026-06-25-clinica-medica-2do-sistema-compuesto_reporte.md` · CATALOGO §24.

**Diseño ACTIVO — Documed = adapter A-1 OPCIONAL detrás del flag `documentacion_medica`.** Invariante: flag OFF ⇒ clínica opera 100% (Documed nunca es ruta crítica). **Conectar el Documed real** (`Agencia_IA_HyC/App Documed`) = reemplazar SOLO ese adapter (`register_patient/attach_document/get_clinical_summary/chat`, stub no-op hoy). Clínica dueña del paciente ADMINISTRATIVO, Documed del CLÍNICO, reconciliados por `documed_ref` (no copia de contenido clínico). Producto unificado = capa UI/BFF, no fusión de deployables.

**✅ LECCIONES MECANIZADAS en `/generar-plano`** (calidad de skeleton/tests, NO de mecanismo — la fábrica funcionó heal=0; catálogo §K): **K31** fake de facade FIJA fiel a firmas reales (int≠dict → gate verde, crash en validate_real; caso `schedule_reminder`) · **K32** test de op multi-paso asersa **atomicidad del camino de FALLO** (`add_movement` insertaba antes de validar → fila huérfana; fix: validar ANTES de insertar) · **K33** harness E2E con claves estables necesita cleanup-at-start. (K34 = seam adversarial → [[clinica-hardening-3-frentes]].)

**Caveat VIVO (salud regulado):** `validate_real ALL PASS` ≠ compliant — faltan 4 bloqueantes 🔴 infra/legal (auth real · audit inmutable · cifrado en reposo · retención Ley 26.529/25.326) que la fábrica NO produce por diseño. Ver `HARDENING_PRODUCCION.md`. Decir "lista para pacientes reales" sin esos 4 = codificar la esperanza.

[[billing-system-sistema-compuesto]] [[clinica-hardening-3-frentes]] [[r5-generar-plano-unico-generador]] [[cierre-del-aprendizaje-no-opcional]]
