# Assets externos (fuera de git)

Los assets pesados del copiloto **no viven en este repo** (para no inflar la historia git de un
repo de producto). Decisión de graduación (Fase 2, 2026-07-06): almacenamiento externo.

| Asset | Qué | Tamaño |
|---|---|---|
| `APP Copiloto Movil/` + `.zip` | Handoff de diseño de la app móvil | ~10 MB |
| `Web copiloto/` + `.zip` | Handoff de diseño de la web | ~11 MB |
| `Copiloto App.html` | Export de diseño | — |
| `es-ar-listen/` | Spike de voces argentinas (dataset de audio) | ~28 MB |
| `docs/Imagen de marca/*.pdf` | Deliverables de diseño (propuesta de la diseñadora gráfica) | ~220 KB c/u |

**Ubicación actual (transitoria):** `../_copiloto-assets-fase2/` (sibling del repo `unreal-copilot`,
con su propio README). **TODO (owner: David):** subir a un bucket/Drive del proyecto y dejar acá el
puntero definitivo. Están gitignoreados (`*.zip`, `es-ar-listen/`, `APP Copiloto Movil/`, `Web copiloto/`,
`docs/Imagen de marca/*.pdf`). Los `.md` de esa misma carpeta (brief, research) **sí** viven en el repo:
son texto, no assets pesados.
