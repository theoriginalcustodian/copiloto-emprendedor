---
name: el-script-de-fondo-lee-su-archivo-por-ruta-fija-y-el-primer-plano-lo-pisa
description: Un proceso de fondo que ejecuta un script por ruta FIJA falla con el error de OTRO script si el primer plano reescribe esa ruta; el rojo se lee como fallo del gate.
metadata:
  type: feedback
---

Un proceso lanzado en **background** que ejecuta un script desde una **ruta fija** (`$env:TEMP\x.sh`,
`/tmp/run.sh`) no lee el archivo una sola vez al arrancar: `bash` lo lee **a medida que avanza**. Si
el primer plano sigue escribiendo esa misma ruta para las tareas siguientes, el proceso de fondo
termina ejecutando líneas de un script que **nunca lanzó**, y falla con un error que no se parece en
nada a lo que estaba haciendo.

**Cómo se vio acá (2026-11-04).** Lancé `scripts/ci/lint.sh` en background desde `$env:TEMP\x.sh` y
después usé ese mismo path para cinco comandos más. El job murió con
`x.sh: line 8: syntax error near unexpected token '('` y **exit 2**. Leído de frente, eso es «el
gate lint falló»: un rojo, con código de salida, sobre el commit que estaba por mergear. Y el gate
de GitHub sobre el mismo árbol había salido **verde 6/6** — así que lo que parecía era un gate
propio contradiciendo al de CI, que es un hallazgo grave y falso.

**Lo que lo delató fue leer el log entero y no el exit code**: el lint había avanzado hasta
`✅ registro del sprint: autotest verde, coherente e idempotente`, o sea que el gate **estaba
pasando**. El error de sintaxis venía después de todo su trabajo, de una línea que pertenecía a otro
script. El exit 2 era mío, no suyo.

**Why:** el exit code no dice de quién es el fallo. Un wrapper pisado produce un rojo
**indistinguible** de un rojo del gate que envuelve — misma forma, mismo canal, mismo código — y la
lectura por defecto («el gate falló») acusa justo a lo que funcionaba. Es la contracara de
[[el-pipe-se-come-el-exit-code]]: ahí el exit code absuelve de más, acá condena a quien no fue, como
en [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]. Y el daño no es sólo el diagnóstico perdido:
un rojo falso del gate propio contra un verde de CI invita a desconfiar del gate propio, que por
ADR-001 es **la** definición de la suite.

**How to apply:**
- Un script que se lanza en background va a una ruta **única** (`lint-unico-4nov.sh`, un sufijo con
  el id de la tarea). Nunca al `x.sh` compartido que se reusa para todo.
- Antes de concluir que un gate falló, **leer el log completo hasta dónde llegó**. Si el gate imprimió
  sus líneas de cierre («autotest verde», «todos los controles OK») y el error aparece *después*, el
  fallo es del envoltorio.
- Cuando el gate propio y el de CI discrepan sobre **el mismo árbol**, el primer sospechoso es el
  instrumento local, no el código: medí qué archivo ejecutó cada uno antes de escribir el hallazgo.