---
name: compactacion-a-umbral-investigacion-pausada
description: Puntero — investigación PAUSADA sobre compactar las sesiones autónomas a 500k en vez de a 950k; cuando el operador pregunte "lo de la compactación", retomar desde el doc
metadata:
  type: project
---

**PUNTERO a retomar.** El operador quiere que las sesiones autónomas nocturnas **compacten a ~500k
tokens** (mitad de la ventana de 1M) en vez de a ~950k (auto-compact nativo al 95%), porque a 950k el
resumen gasta muchos tokens y se pierden cosas. **Investigación pausada el 2026-07-22.** Cuando pregunte
por "lo de la compactación / compactar a un umbral", el detalle completo está en
[`docs/copiloto-emprendedor/2026-07-22-compactacion-a-umbral-investigacion.md`](../../docs/copiloto-emprendedor/2026-07-22-compactacion-a-umbral-investigacion.md).

**Lo esencial ya verificado (para no re-derivar):**
- **Medir contexto vivo = FUNCIONA:** transcript JSONL, `input_tokens + cache_creation + cache_read` del
  último turno (~233k medido en vivo). Caveat: formato interno, puede cambiar entre versiones.
- **`/compact` inyectado NO ejecuta** (spike negativo, cron one-shot): llega como texto. El asistente
  tampoco puede auto-compactar (no es tool). Auto-compact no es configurable (`autoCompactEnabled` on/off).
  Hooks no leen token count ni disparan compact.
- **No hay daemon** — el operador arranca las 3 sesiones a mano cada mañana. Target exacto 500k **no es
  alcanzable limpio**; el único camino literal es AutoHotkey (tecleo GUI de `/compact`), frágil.
- **Camino achievable recomendado:** bajar cadencia de monitores (3→7-8 min) + hook `PreCompact` de
  checkpoint + confiar en el estado externalizado (`HANDOFF` + buzón + `memoria/`). Ver
  [[cero-tiempo-ocioso-tres-estados]] no aplica; esto es infra de sesión.
