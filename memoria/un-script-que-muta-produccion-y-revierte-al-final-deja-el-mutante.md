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

---

## 🔁 Refuerzo (2026-10-11): tenía las DOS defensas puestas y el mutante sobrevivió igual

Control positivo de `esAnulable` en los dos fronts (F1.3 / issue #1015). Hice exactamente lo que
prescribe esta entrada: revert en `trap ... EXIT INT TERM` (el `finally` de bash) **y** backup en un
archivo, no en una variable. **En mobile el mutante quedó vivo en el working tree de todas formas.**

Dos causas, y ninguna estaba en la lista de arriba:

1. **El `trap` guardó una ruta RELATIVA y el `cwd` cambió entre armarlo y dispararlo.** Armé el trap
   con `F=apps/mobile/src/.../X.tsx`, después hice `cd apps/mobile` para correr jest. Al salir, el
   `mv` resolvió `apps/mobile/apps/mobile/src/...` — que no existe. El `trap` **sí corrió**; lo que
   falló fue a dónde apuntaba. ⇒ **en un `trap`, las rutas van absolutas**, porque el `cwd` del
   momento de disparo no es el de armado.
2. **El mensaje de éxito no estaba condicionado al efecto.** El trap era
   `mv -f "$F.backup" "$F" 2>/dev/null; echo "[trap] original restaurado"`. El `;` hace que el `echo`
   corra **siempre**, y el `2>/dev/null` se comió la queja del `mv`. El instrumento imprimió
   «original restaurado» mientras el disco tenía el mutante — exactamente
   [[prometer-no-es-ejecutar-el-gate-media-la-palabra]], pero dentro del limpiador.
   ⇒ `mv ... && echo OK || echo "FALLO EL REVERT"`, nunca `;`.

**Y la asimetría es la prueba:** el mismo patrón, dos corridas. **Web quedó limpio y mobile no**, y la
única diferencia fue un `cd` en medio. Una corrida limpia no acredita a la siguiente cuando el
instrumento depende del `cwd` ([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]] — acá sí
decía cuál estaba mal, pero sólo porque medí las dos).

**Lo que lo cazó fue el control de cierre que esta entrada ya pedía** —`grep -c MUTANTE` + `git status`
sobre el disco— y lo cacé **porque lo corrí como paso aparte, después del trap**. Si lo hubiera puesto
*dentro* del trap, habría heredado el mismo `cwd` roto y me habría dicho que estaba todo bien.
⇒ el control del disco va **fuera** del limpiador, en un paso que no comparte su estado.

**Y el daño que no ocurrió lo evitó CANON 9:** el commit se armó con `git add <rutas explícitas>` de
los dos `.test.tsx`, así que el `.tsx` mutado **quedó afuera**. Con `git add -A` el mutante se iba a la
rama del PR. La regla de las rutas explícitas no es sólo contra el checkout compartido: también es la
red que ataja a este modo de falla.
