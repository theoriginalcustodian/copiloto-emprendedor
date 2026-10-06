---
name: un-script-que-muta-produccion-y-revierte-al-final-deja-el-mutante
description: Un control positivo por mutación escribe en un archivo de producción y lo restaura al final del cuerpo; si algo revienta en medio, la mutación queda en disco y el próximo commit se la lleva — el revert va en finally y el backup en disco, no en memoria del proceso
metadata:
  type: feedback
---

# 🧟 Un script que MUTA producción y revierte AL FINAL deja el mutante si algo revienta en medio

El patrón de control positivo por mutación es correcto: mutá el código, corré los tests, mirá el
**ROJO**, revertí, mirá el verde. El verde final es lo que acredita que el revert funcionó, así que el
script escribe **en un archivo de producción** y lo restaura solo.

El modo de falla no está en la mutación ni en el revert: está en **todo lo que pasa entre los dos**. Si
el revert vive al final del cuerpo del script, cualquier excepción intermedia —un `print`, un parseo, un
timeout— sale del proceso **con el mutante escrito en disco**, y el script muere reportando el ROJO que
acababa de medir, que es exactamente lo que esperabas ver. La salida se lee como éxito parcial.

**Por qué es peor que un bug normal:** el estado malo queda en el **working tree**, no en el script. El
siguiente `git add` + commit se lleva el mutante a una rama, y el mutante está hecho para **romper
tests** — pero el `git status` lo muestra como una modificación más del archivo que ya venías tocando.
Si el mutante hubiera sido sutil en vez de romper, el CI lo deja pasar.

## El caso (2026-10-06, A3-web)

El control positivo de `SeccionMisComprobantes.tsx` tenía dos mutantes. Entre M1 y su revert había un
`print` de las líneas de `AssertionError` del log de vitest, y una de esas líneas traía una flecha
unicode. El stdout de Windows es **cp1252**: `UnicodeEncodeError`, proceso muerto, `MUTANTE M1`
**escrito en el archivo de producción**. El reporte terminaba en «M1 exit=1 failed=3», que es el ROJO
correcto.

Lo que lo cazó fue mirar el `git diff --stat` del worktree antes de commitear, no el script.

## Las dos defensas, y ninguna es «no te equivoques con el encoding»

1. **El revert va en `finally`**, no al final del cuerpo. Es la única forma de que cubra los fallos que
   no previste — y el que me mató fue un `print`, no la lógica.
2. **El backup va a un archivo, no a una variable.** Leer el original a una variable lo pierde con el
   proceso; si el script muere de golpe (o lo matás vos), no hay desde dónde restaurar. Con el original
   en el scratchpad, se restaura desde afuera. Importa el doble cuando el fix **todavía no está
   commiteado**: ahí `git checkout -- <path>` no te devuelve el original, te borra el trabajo.

Más un control de cierre que cuesta una línea: `grep -c MUTANTE` sobre el archivo + `git diff --stat`
dentro del propio `finally`. El veredicto del control positivo tiene que incluir **el estado del disco**,
no sólo los exit codes de las corridas.

**La clase:** cuando un instrumento modifica el sistema que mide, su manejo de errores es parte del
instrumento. Un script de medición que puede morir dejando el sistema mutado no es un control positivo:
es [[el-artefacto-que-genera-el-instrumento-no-tiene-dueno]] con el artefacto adentro del código fuente.
Hermana de [[un-control-positivo-con-esperado-falso-acusa-al-script]] —ahí se corrompe el criterio, acá
el **sistema medido**— y de [[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]], que es el
mismo descuido sobre la evidencia en vez de sobre el disco.
