---
name: gate-visual-multi-tema-tokens
description: "Frontend con theme toggle (dark/light): el gate visual DEBE cubrir ambos temas, y los colores deben ser tokens semánticos theme-aware, nunca literales (slate-800) ni variantes -light hardcodeadas"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec33fdc4-2762-40dc-aa4d-a1d591ef80fb
---

Lección del fix de contraste dark mode de la consola clínica (2026-06-29, PR #6 `clinic-management`, commit 03903aa). Un bug visual **llegó al operador**: en dark mode el texto era ilegible (cards lavadas + títulos oscuros sobre fondo oscuro).

**Why (causa raíz doble):**
1. El re-skin se portó del diseño #3 con **estilos light-only que no reaccionaban al `.dark`**: clases `.glass-card-light` hardcodeadas sin su `dark:` pair → fondo claro en tema oscuro; y `text-slate-{800,500,...}` **literales** → no cambian con el tema. En light coincidían con los tokens, por eso "se veía bien".
2. El **gate visual se hizo solo en light mode** → el dark nunca se evaluó. Contraste real medido: **1.38:1** (ilegible) vs **7.24–16.89:1** tras el fix (WCAG AA/AAA).

**How to apply:**
1. **Colores = tokens semánticos theme-aware, nunca literales.** Usar `text-foreground` / `text-muted-foreground` / `bg-card` / `border-border` (que ya reaccionan al `.dark`), NUNCA `text-slate-800`, `bg-white`, ni variantes `-light`/`-dark` que el dev tenga que combinar a mano con `dark:`. La dualidad de clases que hay que recordar combinar ES la deuda que produce el bug; colapsar a una clase única theme-aware lo elimina por construcción (test *¿puede volver?* → no, la variante que se olvidaba dejó de existir). [[cero-deuda-no-gestionada]]
2. **Si la app tiene theme toggle, el gate visual cubre AMBOS temas.** Validar solo el default deja el otro sin evaluar — y el bug llega al usuario. Aplica al objetivo #2 (cosechar plantilla de frontend de la fábrica).
3. **Medir contraste, no juzgar "a ojo".** Playwright MCP contra el deploy expuesto + `getComputedStyle` componiendo el alpha de los glass sobre el body → ratio WCAG real. Diagnóstico empírico, no aserción. [[no-codificar-la-esperanza-principio-raiz]]
