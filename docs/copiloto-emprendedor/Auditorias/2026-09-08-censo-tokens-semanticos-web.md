# Censo de tokens semánticos (bien/atención/error) — Odobi web

**Autor:** frontend2 · **2026-09-08** · Contrato: `coordinacion/en-curso/2026-09-07_contrato_planificacion-a-frontend2_tokens-semanticos-el-hueco-que-el-mockup-admite.md`

## Resultado del censo (paso 1 del contrato, hecho ANTES de tocar nada)

Barrido de `apps/copiloto-web/src` (todo `.ts`/`.tsx`, fuera de `themes.css` y de tests) buscando
literales hex que pudieran estar supliendo un rol semántico fuera del sistema de tokens. Resultado:
**no hay leak**. Los únicos hex crudos fuera de `themes.css` son:

- `design-system/serviceIcons.tsx` — colores de marca de terceros (MercadoPago, Gmail, HubSpot,
  Instagram...). Categórico, no semántico — fuera de alcance de este contrato.
- `modules/inteligencia/graficos/GraficoTorta.tsx` — paleta categórica de 8 colores para series de
  gráfico, ya gateada por `gastosNoHexLiterals.test.ts` y verificada en las 3 pieles (hallazgo previo
  de FE1). No es bien/atención/error.
- `modules/contabilidad/ContabilidadScreen.tsx` — comentarios con cifras de contraste, no color real.

92 de 93 módulos tienen su propio gate `*NoHexLiterals.test.ts` (el único sin gate es `ajustes`, sin
literales hex detectados tampoco). **Conclusión:** la premisa del contrato ("cada módulo va a
inventar su rojo y su verde") no se concretó en código — ya existía la barrera. Lo que sí faltaba,
confirmado abajo, era la barrera sobre los **tokens de texto** del sistema semántico existente.

## El rol "atención" YA EXISTE — el hueco real era otro

`Badge.tsx` ya define 4 variantes por ROL, no por color: `warning` → `atención` (REVISAR,
RECONECTAR), `danger` → `error` (IRREVERSIBLE), `ok` → `bien` (CONECTADO, PAGADO), `neutral`. Los
tres colores (`--badge-fg` mostaza, `--danger-fg`/`--danger-btn-fg` carmesí, `--ok-fg` verde) son
**de fuera de paleta**, ninguno derivado de la terracota del acento (`#B04A2E`/`#DE7250`) — cumplen
la restricción de diseño del contrato sin que hiciera falta tocarlos.

El hueco real, medido con el mismo arnés WCAG del gate existente (`themesContrast.test.ts`):

| Token | Rol | Piel | Ratio medido | Estado |
|---|---|---|---|---|
| `--badge-fg` | atención | claro/root-default | **1,98–2,06:1** | 🔴 bajo el piso 3:1 no-textual — **corregido** |
| `--badge-fg` | atención | oscuro/nocturno | 4,96 / 5,72:1 | ✅ ya pasaba |
| `--danger-btn-fg` | error (botón) | claro/root-default | **4,00:1** | 🟡 AA-debt, escalado (no corregido) |
| `--ok-fg` | bien | claro/root-default | **3,77–3,95:1** | 🟡 AA-debt, escalado (no corregido) |
| `--amount-fg`, `--name-fg`, `--cancel-fg` | (no semánticos, texto general) | las 4 | 4,73–15,9:1 | ✅ ya pasaban, sólo sin cobertura de gate |

`--badge-fg` se corrigió **mecánicamente**: mismo H/S que `#C6952E`, sólo menos L, hasta cruzar
4,5:1 (`#7B5C1D`, da 4,51–4,70:1 según piel/superficie). No cambia el matiz ni el rol visual, sólo
recupera contraste — dentro del permiso que dio planificación para este caso puntual.

`--danger-btn-fg` y `--ok-fg` **no se tocan** en este contrato: corregirlos es una decisión de qué
tono usar, no una recuperación mecánica de luminosidad, y el contrato es de sistema/gate, no de
repintado. Quedan documentados y **exentos con motivo** en `EXEMPT_FG_TOKENS` del gate (no ocultos:
el gate invertido los lista explícitamente, con la cifra, hasta que alguien decida el fix).

## Call-sites reales de `variant="warning"` (rol atención)

- `modules/connections/ServiceCard.tsx:77`
- `modules/apps/ModeButton.tsx:57`
- `modules/ingresos/TarjetaIngreso.tsx:45`

## Hallazgo colateral: "texto sobre acento" tiene 3 encarnaciones (no se unifica, sólo se nombra)

Por pedido de planificación (`2026-09-08_hallazgo_...tres-colores-para-un-mismo-rol-web-vs-mobile.md`),
mismo patrón que `bloque-cifra`/`acentoTinta`: un rol sin nombre común entre plataformas.

| Rol | Dónde | Color | Ratio contra `#DE7250` |
|---|---|---|---|
| texto sobre acento | web, `--btn-fg`/`--send-fg` | `#FBF3E2` crema | 2,8694 (mide contra `--btn-bg`/`--send-bg` reales, que son sólidos `#B04A2E` → 4,92:1, no contra `#DE7250`) |
| texto sobre acento | web, `--user-fg` | `#FBEEE6` | 2,7870 |
| texto sobre acento | mobile, `ACCENT_ON` | `#FFFFFF` blanco | 3,1681 |

No se unifican los 3 valores acá — es decisión visual del operador si cambia algo que se ve. Queda
nombrado el rol para que la próxima cifra que alguien copie entre web/mobile choque contra un nombre,
no contra un hex suelto.

## Gate invertido (paso 4 del contrato — "extendé lo que ya existe")

`themesContrast.test.ts` pasó de lista manual (`TEXT_TOKENS` a mano, sin garantía de estar completa)
a auto-verificado: `findUnmappedFgTokens()` recorre cada bloque de `themes.css`, extrae todo
`--*-fg` declarado, y exige que esté en `TEXT_TOKENS` (con superficie mapeada y gate estricto AA) o
en `EXEMPT_FG_TOKENS` (con motivo escrito). Un token nuevo sin ninguno de los dos **rompe CI**, no
pasa callado — que era exactamente el bug que dejó a `--badge-fg` y otros 5 sin cubrir hasta hoy.

Control negativo (`describe('control negativo — findUnmappedFgTokens...')`, 3 tests): demuestra con
datos sintéticos que un token no mapeado SÍ aparece detectado, que uno exento con motivo NO aparece,
y que los tokens reales de `TEXT_TOKENS` tampoco disparan falso positivo — prueba que el detector no
es un no-op antes de confiar en que el gate real (verde) significa algo.

## Qué quedó fuera, y por qué (DoD)

- **No se diseñaron tokens nuevos.** El censo encontró que el rol "atención" ya existe
  (`--badge-*`), nombrado por rol, fuera de paleta de la terracota — cumple la restricción de diseño
  sin necesitar un token nuevo. "Si el censo dice que sólo hacen falta dos roles, son dos": acá dice
  que hacen falta cero roles nuevos, los tres ya estaban.
- **No se repintó ningún módulo.** Sólo se tocó `themes.css` (un valor) y `themesContrast.test.ts`
  (el gate). Ningún componente cambió.
- **No se tocó mobile.**
- **`--danger-btn-fg` y `--ok-fg` quedan con AA-debt sin corregir**, documentados y escalados a
  planificación con las cifras (ver `EXEMPT_FG_TOKENS` en el código) — corregirlos es una decisión de
  tono, no de este contrato.
- **La unificación de "texto sobre acento"** entre web/mobile no se resuelve — es decisión visual del
  operador, sólo se nombra.

## Evidencia

`bash scripts/ci/web.sh` verde: 93 test files / 815 tests, exit 0 (incluye los 99 tests de
`themesContrast.test.ts`, gate invertido + control negativo). Corrido en worktree limpio
`fix/fe2-tokens-semanticos` sobre `origin/main`, no en el checkout compartido (ver
`coordinacion/cerrado/2026-09-07/...checkout-compartido-corria-el-escalador-viejo...` — mismo motivo
por el que este contrato se ejecutó en worktree aparte).
