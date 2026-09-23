---
name: el-gate-verifica-el-par-declarado-no-el-par-pintado
description: Un test de contraste que compara pares de tokens no ve el par que el componente realmente pinta; el gate queda verde sin cubrir a sus consumidores más visibles.
metadata:
  type: feedback
---

`temaContraste.test.ts:78-98` verificaba los pares que los **tokens declaran** (`acentoTexto` vs
`acentoSuperficie`). Pero `BotonVoz.tsx:273-300` y `Marca.tsx:41` pintan `acentoTexto` sobre
`acento` **puro** — un par que ningún caso del test contemplaba. El botón de voz está visible todo
el tiempo en el chat y `Marca` es el hero del login: los dos consumidores de mayor exposición,
ambos sin cobertura, con el gate en verde.

⚠️ **El par resultó SANO** (3,1681:1, pasa el piso de 3:1 de 1.4.11 para un ícono) — pero eso se
supo computándolo, no por el test. La lección no depende del veredicto: el gate no lo sabía.

**Why:** el control existía para el par *correcto*, no para el par *usado*. Enumerar las
combinaciones ideales de tokens produce un test que confirma el diseño en el papel y es ciego a lo
que el código hace de hecho — y el verde da confianza mientras tanto. Mismo fail-open que
[[control-negativo-estatico-no-caza-constante-equivocada]] y
[[defense-in-depth-enmascara-el-control-negativo-de-la-capa-interna]].

**How to apply:** un gate de contraste enumera **consumidores**, no combinaciones. Derivá del
código quién pinta qué sobre qué (grep de los consumidores del token de tinta) y generá un caso por
consumidor con su fondo real, con el ratio computado como piso anti-regresión — el baseline real,
no el mínimo WCAG: poner 3,0 donde el real es 3,16 regala 5% de deriva silenciosa. Control negativo
en las dos direcciones. Lo cazó un censo manual de backend, no el gate.
