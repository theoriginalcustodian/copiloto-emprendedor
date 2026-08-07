---
name: un-token-con-dos-definiciones-y-la-equivocada-no-da-sintoma
description: El mismo token CSS definido en dos archivos (root + override por shell) — tocar el equivocado compila, pasa los tests y no cambia nada visible
metadata:
  type: project
---

**LEER antes de rewirear un token de diseño.** Caso: ODOBI hito 3 (tipografía), PR #268. El §0
Reutilización del contrato lo cazó **antes** de tocar código; sin esa lectura el hito habría salido
"verde" sin cambiar nada.

## El hallazgo

`--font-display` tiene **DOS** definiciones en `apps/copiloto-web`:

| Archivo | Alcance | Valor |
|---|---|---|
| `fonts.css` | `:root` — mobile-web | el que había que cambiar |
| `fonts-web.css` | `[data-shell='desktop']` | Space Grotesk — **sistema de escritorio aparte, documentado, fuera del hito** |

Tocar el archivo equivocado **no da ningún síntoma**: compila, la suite sigue verde, y el cambio
simplemente no se ve en la superficie que estás mirando. Es el fallo que no protesta — hermano de
[[instrumento-que-no-mira-nunca-falla]].

## La regla

Antes de cambiar el valor de un token, **contá cuántas veces está definido**, no cuántas veces se
usa:

```bash
git grep -n -- "--<token>:" -- apps/ | grep -v "var("
```

Más de una línea ⇒ hay cascada/override, y hay que decidir **explícitamente** cuál entra en el
alcance del cambio y cuál no. Escribilo en el contrato: la próxima persona no lo va a deducir.

## El corolario del DoD

El gate de este hito fue un **diferencial de archivos** (`2` en la base → `5` en la rama) **más una
captura de device**. jsdom **no renderiza fuentes**: verde ahí no prueba absolutamente nada visual.
Ver [[gate-jsdom-no-ve-gestos-tactiles]] — misma clase de ceguera, otra dimensión.

Relacionado: [[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]] ·
[[gate-visual-multi-tema-tokens]]
