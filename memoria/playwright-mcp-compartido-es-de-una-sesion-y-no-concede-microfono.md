---
name: playwright-mcp-compartido-es-de-una-sesion-y-no-concede-microfono
description: El Playwright MCP usa un perfil persistente único; lo retiene una sola sesión y no puede dar micrófono — la evidencia PWA va con Chromium propio.
metadata:
  type: reference
---

El Playwright MCP de esta máquina arranca con un **perfil persistente compartido**
(`ms-playwright-mcp\mcp-chrome-<hash>`). Mientras una sesión tiene el navegador abierto, las demás
no pueden usarlo y no se enteran de quién lo tiene. Además, **no puede conceder permiso de
micrófono**: `getUserMedia` queda colgado, sin resolver ni rechazar (FE1 lo midió: 1800 s).

**Medido 2026-09-22 (sprint beta Odobi):**
- FE1 esperó unos 40 min por capturas.
- FE2 retuvo el navegador desde las 06:44 hasta que se le pidió cerrarlo.
- La captura PWA del chip de voz (BL-J7) no se pudo sacar y quedó diferida al sprint siguiente.

**Cómo encontrar al dueño:** PowerShell sobre `Win32_Process`. Buscá el chrome con `mcp-chrome`,
subí por el PPID (chrome → node → claude.exe) y mapeá ese pid en `~/.claude/sessions/<pid>.json`.
Pedile a esa sesión que lo cierre; nunca mates el proceso de otra sesión.

**Cómo aplicarlo:**
- La evidencia de la PWA se saca con `scripts/evidencia/pwa-lib.mjs`, que abre su propio Chromium.
  Los contratos de A4 ya lo exigen.
- Para voz, el Chromium propio va con `--use-fake-ui-for-media-stream
  --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`. Script pendiente
  de FE1, sprint siguiente.
- Arreglo de raíz propuesto al operador (le toca decidirlo, es harness): `@playwright/mcp
  --isolated`, que da un perfil temporal por instancia.

Relacionado: [[git-stash-es-comun-a-todos-los-worktrees]] (el mismo patrón: un recurso que parece
de la sesión y es común a todas) · [[pwa-sw-staleness-gotcha]].
