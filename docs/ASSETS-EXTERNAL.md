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

**Referencias de fidelidad citadas en el código** (~25 comentarios en `apps/copiloto-web/src/**`,
p. ej. `AppsModal.tsx`, `ConnectionsScreen.tsx`, `DesktopShell.tsx`): apuntan a estos dos archivos
`.dc.html`, que existen dentro de las carpetas de handoff de arriba, no sueltos:

- `APP Copiloto Movil/Copiloto App.dc.html` — citado como fidelidad para módulos `connections`/`apps` mobile-first.
- `Web copiloto/Copiloto Web.dc.html` — citado como fidelidad para `AppsModal`, `DesktopShell`, `AppShell`, `chat/*`, `account/*`.

Verificado 2026-09-29 (frontend2): ambos archivos existen en `../_copiloto-assets-fase2/`
(70811 y 73078 bytes respectivamente, 2026-07-04), con contenido consistente con lo citado —
p. ej. `Copiloto Web.dc.html:363-402` contiene el bloque `<!-- APPS MODAL -->` que `AppsModal.tsx`
declara portar. No estaban perdidos: la referencia era real pero no estaba citada por nombre en
esta tabla, así que un `find` sobre el repo (que es donde vive el código, no los assets) daba 0
resultados y parecía una fidelidad inverificable.

**Ubicación actual (transitoria):** `../_copiloto-assets-fase2/` (sibling del repo `unreal-copilot`,
con su propio README). **TODO (owner: David):** subir a un bucket/Drive del proyecto y dejar acá el
puntero definitivo. Están gitignoreados (`*.zip`, `es-ar-listen/`, `APP Copiloto Movil/`, `Web copiloto/`,
`docs/Imagen de marca/*.pdf`). Los `.md` de esa misma carpeta (brief, research) **sí** viven en el repo:
son texto, no assets pesados.
