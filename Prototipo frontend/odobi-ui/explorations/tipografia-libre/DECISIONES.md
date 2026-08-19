# DECISIONES — Reemplazo de NeueEinstellung por una tipografía libre

Origen: 06/08/2026. Martin vio el precio de la licencia de app en MyFonts (**USD 375/año**, renovable, por 1 título) y decidió cambiar de tipografía. Piezas: `comparativa.png` (2560×1440, la hoja que decide) · `comparativa.html` (regenerable) · `fonts/` (los TTF medidos + el OTF de referencia).

**Estado: abierto — falta que Martin elija.** Recomendación: Plus Jakarta Sans.

---

## 1 · Por qué esto no es "cambiar los títulos"

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Qué está realmente en juego | **El isotipo.** El monograma "la o que habla" (rev. 29/07) **es el glifo real de la O** extraído del OTF — el mismo path que el wordmark. Cambiar de fuente cambia el símbolo de marca, no solo la tipografía de títulos. | Es la consecuencia directa de la decisión del 29/07 de usar la O real en vez de un círculo dibujado: ganó constancia de signo, y el precio es que el signo queda atado a la fuente. | Tratarlo como un swap de tipografía: se elegiría por cómo se ven los títulos y se rompería el isotipo de costado. |
| Criterio de selección | **La O**, medida: relación ancho/alto, tamaño del contrapunzón y grosor de trazo (h y v). | Son los tres parámetros que definen si el monograma sigue leyendo igual. Medidos con `fontTools` sobre los archivos reales, no estimados de vista. | Elegir por "se parece": a 76px casi todas las geométricas se parecen; a 16px con las ondas al lado, no. |

## 2 · Medición (fontTools, sobre los archivos reales)

Referencia NeueEinstellung Bold tomada del path ya extraído en `mockups/09-mi-dia/index.html`: O de 16,246 × 16,0 con contrapunzón de 10,140 × 10,116.

`distancia` = `|Δratio|·3 + |Δcontrapunzón|·2 + |Δtrazo_h|·4` — pondera lo que más afecta al monograma.

| Fuente | O an/al | Contrapunzón | Trazo h | Contraste h/v | Distancia |
|---|---|---|---|---|---|
| **NeueEinstellung** (ref) | 1,015 | 0,624 | 0,191 | 1,038 | — |
| **Plus Jakarta Sans** | 1,013 | 0,650 | 0,178 | 1,101 | **0,111** |
| **Figtree** | 0,992 | 0,609 | 0,194 | 1,120 | **0,112** |
| Outfit | 1,016 | 0,566 | 0,221 | 1,126 | 0,238 |
| Gabarito | 0,994 | 0,575 | 0,211 | 1,038 | 0,244 |
| Onest | 0,968 | 0,582 | 0,202 | 1,093 | 0,272 |
| Nunito Sans | 0,935 | 0,605 | 0,185 | 1,218 | 0,303 |
| Urbanist | 0,950 | 0,646 | 0,168 | 1,000 | 0,330 |
| Hanken Grotesk | 0,918 | 0,610 | 0,179 | 1,052 | 0,369 |
| Manrope | 0,919 | 0,630 | 0,170 | 1,128 | 0,383 |
| Poppins | 1,001 | 0,515 | 0,243 | 1,122 | 0,467 |

### Dos resultados contraintuitivos que la medición evitó

- **Hanken Grotesk es del MISMO autor y fundición que Neue Einstellung** (Alfredo Marco Pradil / Hanken Design Co — los archivos que mandó David se llaman literalmente `Hanken Design Co - Neue Einstellung *.otf`) y es gratis en Google Fonts. Era la respuesta obvia. **Sale 9ª de 10**: su O es angosta (0,918) porque es una *grotesque*, no una geométrica. Misma mano ≠ mismo esqueleto.
- **Poppins, la geométrica de default, sale última** (0,467): contrapunzón chico (0,515 vs 0,624) y trazo grueso. Es la que más deforma el monograma.

## 3 · Recomendación

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Familia | **Plus Jakarta Sans** (Tokotype, SIL OFL) | O prácticamente idéntica (1,013 vs 1,015) y **tiene carácter propio**: se dibujó para la identidad de la ciudad de Yakarta, no es una geométrica neutra. Cumple el criterio de singularidad de Chaves que el brief exige (§7.6) sin depender del color. | Poppins/Outfit: más "default de producto digital", justo la estética genérica que las prohibiciones del kickoff evitan. |
| Segunda opción | **Figtree** (Erik Kennedy, SIL OFL) | Empata en números (0,112). Más redonda y amable. Válida si se decide que Odobi debe leer menos seco. | — |
| Licencia | **SIL OFL** en ambas: permite embeber en app y web, sin costo ni renovación. | Elimina los USD 375/año y el riesgo de que la licencia venza con la app publicada. | Seguir con NeueEinstellung: costo recurrente por título y, hoy, uso probablemente fuera de licencia (ver §4). |

## 4 · El problema ya es activo, no preventivo

La fuente **ya está embebida en código productivo** (auditado 06/08 sobre el repo nuevo): `apps/mobile/assets/fonts/NeueEinstellung-Bold.otf`, usada desde `apps/mobile/app/_layout.tsx`, `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/modules/auth/PantallaLogin.tsx` y `apps/copiloto-web/src/design-system/fonts.css`. El `ODOBI_Brief_Visual.md` §5 afirma *"Licencia adquirida"* — **si la adquirida es Desktop, ese uso ya está fuera de licencia**. Verificar qué licencia se compró es previo a publicar.

## 5 · Qué hay que rehacer cuando se elija

1. **Re-extraer el path de la O** del nuevo OTF/TTF y regenerar el monograma en `mockups/09-mi-dia` (y donde se haya propagado).
2. **Rehacer el wordmark del Rive**: los 5 glifos de `Splash` y la O de `Entrada` son paths outlineados de NeueEinstellung. Al reimportar, **acordarse de `isHole`** en los contrapunzones (ver §5 de `../splash-o/DECISIONES.md`) — el bug reaparece con cualquier glifo nuevo.
3. Reemplazar el `@font-face` de los 9 mockups y regenerar los 27 PNG de `deck-assets/`.
4. Actualizar `ODOBI_Brief_Visual.md` §5 en el repo de David.

## 6 · Cómo regenerar la comparativa

`comparativa.html` referencia `fonts/` con rutas relativas. Los TTF se bajaron de Google Fonts con user-agent de escritorio (con UA moderno la API devuelve `.woff2`; con UA de escritorio devuelve `.ttf`, que es lo que `fontTools` lee sin dependencias extra):

```
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700" | grep -oE "https://[^)]*\.ttf"
```

Render: Chrome headless `--window-size=2560,1440 --virtual-time-budget=3000`, misma receta que `deck-assets/INDICE.md`.

⚠️ **El `fontTools` del sistema está roto**: `bezierTools.*.so` está compilado para x86_64 sobre un Python arm64, y eso tumba también la tabla `glyf`. Solución sin tocar el sistema: `pip install --target ./pylib fonttools` y `sys.path.insert(0, './pylib')`.
