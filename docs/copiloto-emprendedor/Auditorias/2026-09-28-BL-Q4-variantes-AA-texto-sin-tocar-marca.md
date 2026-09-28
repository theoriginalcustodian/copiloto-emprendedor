# BL-Q4 — Variantes de texto AA sin tocar la marca (propuesta, sin aplicar)

**De:** FRONTEND2 · **2026-09-28** · Responde a `pedido_..._BL-Q4-preparar-las-variantes-de-texto-AA-sin-tocar-la-marca.md`
(2026-09-23) y a la clarificación de planificación del mismo hilo. **No se mergea nada de esto**:
es la tabla + capturas para que el operador decida. El gate real (`themesContrast.test.ts`,
`paresPintadosContraste.test.ts` web y `.test.tsx` mobile) sigue igual, con sus `EXEMPT_FG_TOKENS`/
`DEUDA_CONOCIDA` intactos.

## 0. Inventario — esto NO se mide de cero

El barrido de los pares "pintados" (no sólo los declarados) **ya existe y está en `main`**:
- Web: `apps/copiloto-web/src/design-system/paresPintadosContraste.test.ts` (`DEUDA_CONOCIDA` L111-118)
  + `themesContrast.test.ts` (`EXEMPT_FG_TOKENS` L168-186).
- Mobile: `apps/mobile/src/theme/paresPintadosContraste.test.tsx` (`DEUDA_CONOCIDA` L749-799, walker
  con control positivo `> 40 pares` por piel, L813-817).

Mi trabajo acá es **derivar la variante candidata** (mismo H/S, sólo se mueve la L, hasta 4.5:1) de
cada par ya catalogado, con un script que usa la MISMA fórmula WCAG que los gates reales — no a ojo
(`scratchpad/blq4-tabla.mjs`, resultados verificados abajo).

## 1. Los dos pares de DEC-11 (autorizados a corregir, sin acta)

Ambos son **mobile únicamente** — busqué el equivalente web (badge CONECTADO de `ServiceCard.tsx`,
`MicButton.tsx`/`RecordingOverlay.tsx`) y **no tiene este problema**: el mic de web pinta
`color: var(--input-fg)` sobre fondo `transparent` (`chat.css:557-572`), ya cubierto y en AA. Los
números de DEC-11 (3,17:1 y 1,26:1) coinciden EXACTO con el isotipo de `Marca.tsx`/`BotonVoz.tsx` en
mobile — no hay una segunda instancia escondida en web.

| Par | Archivo:línea | Actual | Variante fg-only mínima | Resultado | Mínima de verdad? |
|---|---|---|---|---|---|
| **Sello de acción** — isotipo (`acentoTexto`) sobre `acento` sólido `#DE7250` | `apps/mobile/src/theme/tokens.ts:594` (token) · pintado en `Marca.tsx` (badge) y `BotonVoz.tsx:339-366` (stroke, último stop) | `#FFFFFF` → **3,17:1** (igual en claro/oscuro: `acento` no cambia de piel) | `#2A2A2A` | **4,53:1 ✅** | **NO.** ΔL=83% — invierte el isotipo de blanco a casi negro. No es "un tono menos", es otro ícono. |
| **Botón de grabar** — mismo `acentoTexto` contra el 1er stop del degradé (`glass.accent2` = `#F8E0D9`) | `apps/mobile/src/modules/chat/BotonVoz.tsx:323` (stop) + `:339-366` (stroke) | `#FFFFFF` → **1,26:1** (igual en claro/oscuro) | `#666666` | **4,55:1 ✅** | **NO.** ΔL=60% — mismo problema, más severo. |

**Lectura honesta:** técnicamente SÍ existe una variante fg-only que llega a AA para las dos — no es
un "no se puede sin tocar marca" en sentido literal. Pero ninguna es mínima: las dos piden invertir
el isotipo de blanco a gris oscuro/casi negro, un cambio de identidad visual, no un ajuste de tono.

**El precedente que ya existe en el propio repo apunta al otro lado.** `HudGrabacion.tsx` (el HUD que
se ve MIENTRAS se graba, componente hermano de `BotonVoz.tsx` que es el botón que dispara la
grabación) tenía el MISMO problema y ya se corrigió — pero **tocando el fill**, no el texto: cambió
su degradé de `[glass.accent2, acento, acento]` a `glass.ub1 → glass.ub2` (`#B04A2E → #722717`),
conservando el isotipo blanco y llegando a 5,43:1 en el peor punto (`tokens.ts:441-443`, comentario
`BL-Q4 (DEC-11)`). `BotonVoz.tsx` (el botón en sí, no el HUD) es el que **sigue** con el degradé
viejo y el 1,26:1 — es la mitad de esta pareja que no se tocó.

Dado que mi pedido es explícitamente fg-only, dejo las dos filas con la variante calculada Y la nota
de que no son mínimas, más el precedente de fill-fix ya aplicado al componente hermano. La decisión
de cuál camino tomar (invertir el ícono vs. replicar en `BotonVoz.tsx` el fix de fill que
`HudGrabacion.tsx` ya probó) es de diseño — no la tomo acá.

**Capturas:** mockup de swatches (no hay device esta semana, diferido a próximo sprint por regla del
operador) → `bl-q4-sello-grabar-mockup-swatches.png`, misma carpeta.

## 2. Los otros pares catalogados (2→34: extensión pendiente de firma del operador)

**No aplico ninguno de éstos** — sólo transcribo lo ya catalogado + la variante calculada, para que
la extensión de DEC-11 (si se firma) tenga la tabla lista y no haya que re-medir. Todos con ΔL chico
(0-18%), consistente con "mínima de verdad" salvo donde se marca lo contrario.

### Web (`themesContrast.test.ts` `EXEMPT_FG_TOKENS`)

| Token | Actual | Variante mínima | ΔL |
|---|---|---|---|
| `--core` (claro, dual-role decorativo/texto — DA-4/DEC-11) | `#B04A2E` sobre `--bg` = 4,38:1 | `#AC482D` → 4,55:1 | 1% |
| `--danger-btn-fg` (claro/root) | `#F5EBD5` sobre `--danger-btn-bg` = 4,00:1 | `#FCF9F1` → 4,51:1 | 7% |
| `--ok-fg` (claro/root) vs `--bg` | `#3C8069` = 3,77:1 | `#36725E` → 4,54:1 | 4% |
| `--ok-fg` (claro/root) vs `--card-bg` | `#3C8069` = 3,95:1 | `#377661` → 4,51:1 | 3% |

### Mobile (`paresPintadosContraste.test.tsx` `DEUDA_CONOCIDA`)

**Piel claro** (11 pares más allá de los 2 de DEC-11):

| Componente/patrón | Actual | Variante mínima | ΔL |
|---|---|---|---|
| Acento como texto (total/CAE) — DetallePresupuesto/Comprobante | `#DE7250` = 2,95:1 | `#C24A25` → 4,55:1 | 14% |
| Acento como texto de acción (mandar/guardar) | `#DE7250` = 2,65:1 | `#B64622` → 4,53:1 | 17% |
| Acento en botón "confirmar" (PasoResumen) | `#DE7250` = 2,57:1 | `#B34422` → 4,52:1 | 18% |
| Acento en chip seleccionado (CampoSelect) | `#DE7250` = 3,15:1 | `#CA4D26` → 4,53:1 | 12% |
| Acento en chip seleccionado, variante superficie | `#DE7250` = 3,08:1 | `#C84C26` → 4,53:1 | 13% |
| Peligro (cancelar/cerrar sesión) sobre peligroFondo | `#C7455A` = 3,77:1 | `#B8384C` → 4,50:1 | 5% |
| Peligro (desconectar/anular) | `#C7455A` = 4,12:1 | `#C23A50` → 4,55:1 | 3% |
| Peligro — error de campo / status Composer | `#C7455A` = 4,29:1 | `#C53F55` → 4,50:1 | 2% |
| "facturado" (DetallePresupuesto) | `#3C8069` = 4,37:1 | `#3B7D67` → 4,54:1 | 1% |
| "conectada" (PantallaApps) | `#3C8069` = 4,50:1 | ya en el borde, sin cambio práctico | 0% |
| Ícono enviar (Composer) casi invisible contra su propio fondo | `#F8E0D9` sobre `#EBE7E0` = 1,02:1 | `#B44221` → 4,55:1 | 49% — **no mínima**, revisar si el par real es el correcto primero (huele a estado sin texto, no a bug de color — ya anotado así en `DEUDA_CONOCIDA`) |

**Piel oscuro** (6 pares más allá de los 2 de DEC-11):

| Componente/patrón | Actual | Variante mínima | ΔL |
|---|---|---|---|
| `textoTenue` sobre burbuja del operador (PantallaTicket) | `#928777` = 4,39:1 | `#948979` → 4,50:1 | 1% |
| Acento — acción (mandar/guardar), oscuro | `#DE7250` = 4,45:1 | `#DE7452` → 4,51:1 | 1% |
| Acento — botón "confirmar", oscuro | `#DE7250` = 4,35:1 | `#DF7655` → 4,50:1 | 1% |
| Acento — chip seleccionado, oscuro | `#DE7250` = 3,91:1 | `#E28365` → 4,52:1 | 5% |
| `textoTenue` sobre superficieAlta oscura (patrón sistémico, 5+ pantallas) | `#928777` = 3,39:1 | `#A79E91` → 4,52:1 | 9% |
| `textoTenue` sobre vidrio de campo, oscuro | `#928777` = 3,51:1 | `#A49B8D` → 4,51:1 | 8% |

**Total catalogado hoy:** 4 web + 19 mobile (11 claro + 6 oscuro + los 2 de DEC-11 en cada piel) = 23,
no 34. La cifra de "34 pares" que traía el pedido original viene de auditorías previas
(`2026-09-21-auditoria-A2-ola-2.md:15`, `2026-09-22-inventario-ola-4.md:467`, +1 de H-A3-10) — puede
incluir pares que ya se corrigieron entre medio (el propio `--badge-fg` se corrigió el 2026-09-08) o
contar sub-casos que acá se agrupan por patrón. **No ajusté la medición para que dé 34** (el pedido
mismo lo pide así): reporto los 23 que el barrido AUTOMATIZADO actual encuentra y deja `DEUDA_CONOCIDA`.

## 3. Reconciliación 23 vs. 34 — aporte de FRONTEND1 (trabajó el mismo hito en paralelo)

Planificación detectó la duplicación (asignación cruzada, falla suya no de ejecución) y pidió
consolidar en un solo documento en vez de dos cierres paralelos. Lo que sigue es el aporte de
FRONTEND1, verificado por mí contra el código antes de incorporarlo (no transcribo sin probar).

**Los dos números no compiten — miden universos distintos, y ninguno se promedia:**

- **23 (este doc):** entradas ya catalogadas en `EXEMPT_FG_TOKENS` (web) + `DEUDA_CONOCIDA`
  (web/mobile) — el catálogo **vivo** de hoy, un renglón por token/patrón declarado en el gate real.
- **34 (auditoría A2 original):** reglas/selectores CSS que fallan AA en el **árbol renderizado**
  (`paresPintadosContraste.test.ts:88-105,111-116` web + `temaContraste.test.ts:103-263` mobile) —
  29 web + 5 mobile. Cuenta ocurrencias en el DOM, no tokens únicos: varias filas del árbol pueden
  compartir el mismo token.

**Verificado — los 29 renglones web colapsan a 3 variables raíz de `themes.css` (piel claro):**

| Token | Actual | Ratio actual | Variante candidata | Ratio verificado | Nota |
|---|---|---|---|---|---|
| `--ok-fg` (`#3C8069`) | vs `--bg` `#EFE6D2` = 3,77 · vs `--bg-layer` `#F5EBD5` = 3,95 | — | `#35725d` (mismo hue, ΔL 11% más oscuro) | **4,55** / **4,77** — re-verificado, coincide | Candidata sólida, mínima. |
| `--core` (`#B04A2E`) | vs `--bg` = 4,38 | — | Existe `#ac492d` (ΔL 2%) → 4,52 | re-verificado, coincide | **No aplicable sin tocar marca**: `themes.css:1-26` (header) documenta explícitamente la regla "nunca 3 terracotas conviven" (CLAUDE.md §4.1 del audit citado ahí mismo) — el palette de acento está cerrado a 2 valores y ya declara esto como deuda heredada visible, no bug de este PR. Confirmado leyendo el comentario, no de oídas. |
| `--danger-btn-fg` (`#F5EBD5`) | vs `--danger-btn-bg` `#c7455a` = 4,00 | — | Variante matemática `#fcf9f2` (4,51) o **`#FFFFFF`** (4,74, valor limpio) | re-verificado, ambas coinciden | FE1 recomienda `#FFFFFF` por ser un valor "limpio" en vez de una fracción — no toca el fill. |

**Mobile — reutilización de derivación, no recalculada aparte (verificado el hex compartido,
archivo:línea de ambos lados):**

| Token web | Token mobile | Hex | Coincide |
|---|---|---|---|
| `--ok-fg` claro (`themes.css:174`/`:335`) | `exito` claro (`tokens.ts:513`) | `#3C8069` | ✅ |
| `--danger-btn-bg` claro (`themes.css:180`/`:343`) | `peligro` claro (`tokens.ts:381`) | `#c7455a` | ✅ |
| `--ok-fg` oscuro (`themes.css:436`) | `exito` oscuro (`tokens.ts:372`) | `#34e5a0` | ✅ (dato extra de FE1, verificado) |

La piel oscura mobile de `peligro` (`tokens.ts:372`, `#ff8fa0`) NO coincide con nada de `themes.css`
oscuro — hex propio, no reutilizado. La misma variante derivada arriba (`--ok-fg`→`#35725d`) aplica
al par claro sin recalcular; los 19 pares mobile de la sección 2 ya cubren el resto del catálogo.

**Conclusión para el operador — el número no mueve el trabajo, mueve el relato:** en cualquiera de
los dos conteos (23 vivo o 34 histórico), lo que se firma son **3 tokens web** (`--ok-fg`, `--core`,
`--danger-btn-fg`) — uno de ellos (`--core`) ya bloqueado por la regla de marca, no por falta de
cálculo. Se reportan los dos números con su definición al lado; el que se usa para "cuánto falta" es
el 23 (deuda viva del walker de hoy), no el 34 (deuda histórica con casos ya corregidos entre medio).

## 4. DoD

- [x] Pares pintados (no sólo declarados) — ya cubierto por el gate existente, no remedido de cero.
- [x] Variante mínima calculada para cada par catalogado, con archivo:línea donde aplica.
- [x] Las dos excepciones de DEC-11: variante calculada + nota explícita de que ninguna es mínima +
      precedente de fill-fix ya aplicado al componente hermano.
- [x] Capturas de los pares DEC-11 (mockup, sin device — diferido a próximo sprint).
- [ ] Sin mergear — nada de esto toca `themes.css`/`tokens.ts`/`EXEMPT_FG_TOKENS`/`DEUDA_CONOCIDA`.

Script de verificación: `blq4-contraste.mjs` + `blq4-tabla.mjs` (scratchpad de sesión, no committeados
— la fórmula está documentada en este doc si hace falta re-correrla).
