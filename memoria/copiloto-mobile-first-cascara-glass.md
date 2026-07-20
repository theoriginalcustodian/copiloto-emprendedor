---
name: copiloto-mobile-first-cascara-glass
description: "Sprint mobile-first — app nativa Expo clonando la cáscara glass de documed; estado, gate F2 y contratos"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-20T15:48:46.295Z
---

**Sprint EN CURSO (2026-07-20).** Rama `feat/mobile-first-cascara-glass`, 9 commits.
**Al retomar leer:** `docs/copiloto-emprendedor/2026-07-20-HANDOFF-sprint-mobile-first.md`.

**Decisión de origen: mobile-first.** `apps/copiloto-web` pasa a vía secundaria y no se toca. Se
clona la cáscara visual de `apps/mobile` de documed, pinneada en `documed@a6841474` (rama
`feat/frontend-h6-anclaje`). **documed es READ-ONLY.**

Hecho: scripts S1–S7, `packages/core`, capa glass + shell, escritorio de 6 funciones cableadas
(Apps · Ajustes · Recientes · Redes Sociales · Métricas · Facturación). 119 tests verdes + 55 de core.
Falta: F5 chat E2E, F6 voz Groq, F7 índice.

**El gate F2 NO se puede cerrar sin el operador.** El tirón del glass de función se investiga con la
Medición 1 (`spikes/repliegue-glass/COMO-CORRER.md`), y está verificado que `adb shell input swipe`
**no reproduce el defecto** — cero frames >40ms contra 150ms con dedo humano. Un A/B cuyo caso base
no exhibe el síntoma no prueba nada. Mi hipótesis original (el traspaso gesto→router al soltar) está
**refutada**: el tirón ocurre durante el arrastre. Ver `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`,
que lista 5 hipótesis ya refutadas — no repetirlas.

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
