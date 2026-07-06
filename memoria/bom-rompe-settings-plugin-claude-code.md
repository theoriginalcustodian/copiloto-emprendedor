---
name: bom-rompe-settings-plugin-claude-code
description: "Un BOM UTF-8 en ~/.claude/settings.json rompe \"set model\" del plugin Claude Code; PowerShell oculta el BOM, validar con Node"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6c5b1af3-9641-49ff-a173-baca807d0b8b
---

Síntoma: el plugin Claude Code (VS Code / Antigravity) falla al cambiar de modelo con `Failed to set model: Unexpected token '', "{ "e"... is not valid JSON`. El `''` es el BOM invisible U+FEFF.

Causa raíz (medida 2026-06-20): `C:\Users\Admin\.claude\settings.json` tenía un **BOM UTF-8** (bytes `EF BB BF`) al inicio. El `JSON.parse` de JS (el del plugin) no lo tolera → revienta exactamente con ese error, en TODAS las pestañas (leen el mismo archivo global). No era concurrencia de sesiones.

Trampa de diagnóstico: PowerShell (`Get-Content -Encoding utf8 | ConvertFrom-Json`, `Test-Json`) **descarta el BOM** → da falso "JSON válido". **Validar siempre con el parser real del plugin (Node `JSON.parse` sobre el buffer crudo)**, no con PowerShell. Detección rápida del BOM: primeros 3 bytes `ef bb bf`.

Fix de raíz: reescribir el archivo sin BOM (UTF-8 puro), preservando el contenido (`buf.slice(3)` + verificar parseo + backup + `fs.writeFileSync`). NO reescribir settings con PowerShell 5.1 `Set-Content/Out-File -Encoding utf8` → vuelve a meter BOM; usar `utf8NoBOM` o Node. Sospechar de hooks/skills (ej. `update-config`, `audit-claude-md`) que editen settings vía PowerShell como origen del BOM.

Hallazgo lateral (no era la causa): `~/.claude.json` tenía 7 entradas de `projects` duplicadas por capitalización del drive (`C:\…` vs `c:\…`). Cosmético, JS tolera duplicados; limpieza opcional. Las pestañas de Antigravity sí son instancias separadas del plugin sobre el mismo estado global, pero no causaron este bug.
