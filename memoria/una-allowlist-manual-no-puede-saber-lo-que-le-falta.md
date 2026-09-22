---
name: una-allowlist-manual-no-puede-saber-lo-que-le-falta
description: themesContrast.test.ts verificaba 10 de 16 tokens de texto y estaba verde; el badge RECONECTAR daba 1,98:1 en piel clara sin que nada lo mirara.
metadata:
  type: feedback
---

`themesContrast.test.ts` mapea cada token de texto a su superficie real y computa el ratio — el
diseño correcto. Pero su lista de tokens es **manual**: 10 de los **16** `*-fg` declarados en
`themes.css`. Sin cobertura quedaron `--badge-fg`, `--amount-fg`, `--cancel-fg`, `--danger-btn-fg`,
`--name-fg`, `--ok-fg`. El 37% del sistema, con el gate en verde.

Costo real: `--badge-fg` (`#C6952E`, **idéntico en las 4 pieles**, nunca adaptado) da **1,9788:1**
en `claro` — falla AA *y* el piso de 3:1. Se pinta en producción como el badge **RECONECTAR** de
`ModeButton.tsx:57` y `ServiceCard.tsx:77`: el aviso ilegible justo en el estado donde el usuario
más lo necesita.

**Why:** una allowlist enumera lo que se recuerda, y su modo de fallo es el **silencio** — lo
omitido no produce ningún síntoma, ni siquiera un skip. El gate no midió mal el badge: **no lo
miraba**. Un token nuevo entra al sistema y nace exento sin que nadie lo decida. Es el mismo
fail-open que [[el-gate-verifica-el-par-declarado-no-el-par-pintado]], una capa más arriba: allá el
par verificado no era el pintado, acá el token verificado no es todo el conjunto.

**How to apply:** un gate sobre un conjunto enumerable **deriva** el conjunto de la fuente
(parsear `themes.css`), nunca lo transcribe. Cada elemento queda cubierto o **exento con motivo
escrito**; uno nuevo sin clasificar rompe el build. Antes de confiar en cualquier gate de lista,
computá `declarados − cubiertos` — si da > 0, el verde no significa nada sobre esa diferencia. Lo
cazó el censo semántico de frontend 2, no el gate.
