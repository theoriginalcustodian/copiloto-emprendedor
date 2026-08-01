---
name: canal-antigravity-bajo-demanda
description: Existe un canal formal Claude Code ↔ Antigravity (IDE) por carpeta coordinacion/Antigravity/ — bajo demanda del operador, no es una cuarta sesión; reglas en COORDINACION.md §7
metadata:
  type: project
---

# 🛸 Canal Antigravity — auxiliar, bajo demanda

Formalizado 2026-07-26 tras prueba bidireccional verificada (ida y vuelta ~1 min: `prueba_` de
Claude 14:07 → `respuesta_` de Antigravity 14:08).

**Qué es:** el operador corre el agente del IDE Antigravity en paralelo; se comunica con las
sesiones Claude Code por archivos en `coordinacion/Antigravity/` (misma convención del buzón:
`fecha_tipo_emisor-a-destinatario_slug.md`). **No es una cuarta sesión** — no tiene cola, ni hitos,
ni acceso al buzón principal.

**Cómo se usa:** SÓLO cuando el operador lo pide. Al activarse, la sesión que coordina monta un
cron temporal (1-3 min) sobre la carpeta y **lo baja al cerrar el intercambio** — los crones son
session-only y no sobreviven reinicios. Sin acuse en ~10 min → avisar al operador, no loopear.

**Límite duro:** Antigravity no escribe fuera de su carpeta; nada que afecte a backend/frontend se
acuerda ahí sin bajarlo después al buzón como `dato_`. Reglas completas: `coordinacion/COORDINACION.md`
§7 + README de la carpeta. [[coordinacion-tres-sesiones-buzon]]
