---
name: vacio-no-es-hallazgo-correr-el-control
description: "Un cero/vacío del propio instrumento es una pregunta, no buena noticia — correr el control del control"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-20T15:49:08.396Z
---

**Antes de leer un `0` como buena noticia, comprobar que el detector sepa encontrar algo.**

Caso vivido (sprint mobile-first, 2026-07-20). Escribí en `S2-classify-port.mjs` un detector de
"fugas de dominio" (archivo agnóstico que importa uno descartado). Reportó `fugasDeDominio: 0` y lo
leí como que el boundary estaba limpio. **Era estructuralmente imposible que reportara otra cosa:**
`path.resolve` en Windows devolvía `C:\packages\...` y mi `.slice(1)` dejaba `:/packages/...`, así
que ningún import matcheaba jamás con el registro. Un agente encontró después, a mano, una fuga real
(`api/index.ts` → `api/clinical.ts`) que ese chequeo debía haber cazado.

**Why:** es exactamente el fallo que la constitución llama *un vacío es una pregunta, no un
hallazgo* — pero aplicado al **propio instrumento**, que es donde más engaña: un `0` producido por
código propio se siente verificado, no asumido. Y una vez leído como buena noticia, se canoniza:
entra al reporte y contamina todo lo que se apoye encima.

**How to apply:**
1. Todo detector/validador que pueda devolver "no encontré nada" necesita un **control**: quitarle
   deliberadamente lo que debe detectar y confirmar que lo detecta. Cuesta un minuto.
2. Mejor todavía, **hornear el control en el script**: si el grafo inverso sale vacío en un árbol de
   250 archivos, eso es imposible → reventar, no emitir un `0`. Un instrumento que no distingue
   "no hay" de "no puedo buscar" es peor que no tenerlo, porque da sensación de vigilancia.
3. Lo mismo aplica a vigías y monitores: el primer vigía del build devolvía `UNKNOWN` en cada
   iteración y habría reportado "sigue en cola" para siempre.

Se aplicó bien después, en el mismo sprint: al escribir el validador de assets de S4 corrí el
control (saqué `icon.png`, verifiqué que abortara, lo restauré) **antes** de confiar en él.

[[no-codificar-la-esperanza-principio-raiz]] · [[spike-first-central-proyecto]] · [[copiloto-mobile-first-cascara-glass]]
