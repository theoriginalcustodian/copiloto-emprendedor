---
name: copiloto-mobile-first-cascara-glass
description: "Sprint mobile-first — app nativa Expo clonando la cáscara glass de documed; estado, gate F2 y contratos"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-20T15:48:46.295Z
---

**Estado 2026-07-23 — SPRINT CERRADO (sign-off del operador, opción a).** E2E DATOS+IN 6/6 VERDE en
device. El trabajo se mergeó a `main` (PR#78-84, `main@ec1735d`); la rama vieja
`feat/mobile-first-cascara-glass` quedó congelada. Corrido con `e2e-device@copiloto.test`, evidencia en
`_evidencia/`, math cruzada verificada (caja 5.444,33 = ingresos − gastos, coincide HTTP + Resumen + chat).
El operador aceptó voz-ítem-7 (dictar mientras se scrollea) como **residual documentado, no bloqueante**.

**Verificado en device:** los 6 frentes (Gastos · Ingresos · Clientes · Presupuestos · Actividad ·
IN Resumen+Preguntar+chat), freeze-al-volver ✅3/3 (PR#77), voz/dictado ✅ ítems 1-6 (PR#74+#76),
gestos+scroll ✅ implícito (el E2E navegó las 6 pantallas y scrolleó el Resumen). Fixes menores cerrados:
#83 (key duplicada GraficoBarras), #84 (`GET /me` devuelve email). **Único residual documentado:**
**voz-ítem-7** = dictar *mientras* se scrollea la lista (backend no lo pudo simular por ADB con confianza;
edge case, no roto). Recomendación bajada: cerrar con voz-ítem-7 como residual → **espera sign-off del
operador**. Ver `coordinacion/abierto/2026-07-23_dato_planificacion...SPRINT-mobile-first-IN-cerrado...`.

**Decisión de origen: mobile-first.** `apps/copiloto-web` pasa a vía secundaria y no se toca. Se
clonó la cáscara visual de `apps/mobile` de documed, pinneada en `documed@a6841474`. **documed es READ-ONLY.**

**Histórico (gate F2, ya superado por el device real):** el tirón del glass se investigó con la Medición 1;
`adb shell input swipe` **no reproduce el defecto** (cero frames >40ms vs 150ms con dedo humano) — un A/B
cuyo caso base no exhibe el síntoma no prueba nada. La regresión de freeze-al-volver terminó cerrándose
por otra vía (PR#77, retest 3/3 en device). Ver `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`
(5 hipótesis refutadas, no repetirlas) e [[glass-apilado-empujar-una-vez]].

**Contratos que no se rompen:**
- La capa aporta el chrome (vidrio, ícono, nombre, Cerrar); la pantalla aporta solo contenido. Una
  pantalla de función con `backgroundColor` propio tapa el vidrio. Hay tests que lo fijan.
- `canonGlass.ts` no se toca (`ALTO_HANDLE 56`, `CONFIG_SNAP 420ms bezier(.2,.8,.2,1)`).
- Los 5 skins son `cian` (default), `violeta`, `ambar`, `medicalWhite`, `black`. **No existe un skin
  `documed`** — esa era paleta vieja descartada.
- Voz: mic → Groq → texto, **sin retención de audio** (D6). Índice local = caché de UI, **nunca**
  camino del agente, que corre server-side (D8).

Infra: EAS cloud (la PC no tiene JDK ni Android SDK), proyecto `@341lin/copiloto-emprendedor` en la
misma cuenta que Documed. Device de verificación: SM-A217M (`RF8R50N2WGR`), el mismo con el que
documed calibró.

[[copiloto-frontend-movil-ux-estado]] · [[copiloto-graduacion-fase0-fase1]] · [[tests-se-corren-en-vps]]
