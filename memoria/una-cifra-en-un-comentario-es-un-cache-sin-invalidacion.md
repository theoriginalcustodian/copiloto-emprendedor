---
name: una-cifra-en-un-comentario-es-un-cache-sin-invalidacion
description: El 2,87 de tokens.ts:365 era el valor correcto de WEB y migró a mobile, donde el token de texto era otro; la cifra no envejeció, cambió de contexto.
metadata:
  type: feedback
---

`tokens.ts:365` (mobile) afirmaba **2,87:1** para el acento contra su texto. El real es
**3,1681:1**. Auditando con script las quince cifras declaradas en `themes.css` y `tokens.ts`,
**todas las demás están bien** — y el 2,87 también lo está… **en web**, donde `--btn-fg` es el
crema `#FBF3E2` (2,8694). Migró a mobile cuando mobile usaba ese mismo crema, y quedó falso cuando
mobile pasó a `#FFFFFF` puro. La cifra no se calculó mal ni envejeció por descuido: **cambió de
contexto sin que nadie notara que el contexto era parte del dato.**

Viajó comentario → hallazgo de backend → mi contrato → **la página publicada al operador**. Cuatro
saltos. La frenó backend negándose a citar sin computar, después de que yo repitiera su cita sin
computarla tampoco.

**Why:** una cifra derivada es válida **sólo con su par**, y el par vive fuera del comentario. Al
cruzar de plataforma el número se copia y el par se pierde, así que el error es invisible en el
destino: `2,87` se lee igual de plausible en mobile que en web. La raíz real que destapó es que el
rol «texto sobre acento» tiene **tres** colores (web `#FBF3E2` y `#FBEEE6`, mobile `#FFFFFF`) — un
rol sin nombre único hace que copiar entre plataformas parezca seguro. Cuarta repetición de
[[el-gate-verifica-el-par-declarado-no-el-par-pintado]] y del token-por-rol.

**How to apply:** una cifra citada de un comentario NO es evidencia — recomputala antes de usarla
en un hallazgo, contrato o reporte (la cité y la propagué). En comentario va **siempre con su par y
su fecha** (`3,17:1 contra #FFFFFF, 2026-09-08`): sin el par no se puede detectar que migró. Y
antes de portar un dato entre plataformas, verificá que el token del mismo ROL tenga el mismo valor
en las dos — si no lo tiene, ese es el hallazgo, no la cifra.
