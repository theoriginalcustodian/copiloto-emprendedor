---
name: un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit
description: Un gate de CI cuyo sujeto vive en una carpeta no versionada deja de medir el commit y empieza a medir el estado vivo del equipo — cualquiera lo pone rojo sin tocar código, y si el script resuelve esa carpeta por ruta absoluta el gate tiene dos alcances distintos (local ve el corpus, CI se saltea y sale verde).
metadata:
  type: feedback
---

**2026-09-30.** `scripts/ci/lint.sh` salía **1** en mi rama por
`test-contar-veredictos-padron.sh`: «3 documento(s) producen veredictos del criterio y no están ni en
`MEDICIONES_DECLARADAS` ni en `NO_SON_MEDICION`». Los 3 eran mensajes del buzón escritos **ese día**:
dos míos y **uno de otra sesión**. Ningún commit los tocó.

## El mecanismo, en dos líneas de código

1. `contar-veredictos.py:57` resuelve el buzón por **ruta absoluta al checkout compartido**
   (`C:/…/copiloto-emprendedor/coordinacion`).
2. `test-…-padron.sh:44-56` saltea el caso «no hay buzón» **por código de salida** (`rc == 2` ⇒
   «sin coordinacion/ en este checkout»).

Juntas dan un gate con **dos alcances**:

| dónde corre | ve el corpus | resultado |
|---|---|---|
| cualquier worktree de la máquina | **sí** — mi worktree no tiene `coordinacion/` y lo leyó igual, por la ruta absoluta | corre contra el corpus **vivo** |
| clon sin esa ruta (CI de GitHub) | no | **se saltea → verde** |

## Las dos consecuencias, y por qué no son el mismo problema

**(a) El gate mide al equipo, no al commit.** Escribir un mensaje pone rojo el gate de **todas** las
ramas a la vez. El `dato_` de otra sesión ponía rojo mi lint y mi `cierre_` ponía rojo el de ella:
cuatro sesiones comparten un semáforo que cualquiera enciende sin tocar código, y el rojo aparece en
la rama de quien corre el gate, no en la de quien lo causó. **Eso invierte la atribución**, que es lo
que convierte un gate en ruido: el dueño del rojo no es el dueño de la rama.

**(b) El verde de arriba no acredita al de abajo.** GitHub se saltea el test y sale verde mientras
`gate.sh` local sale 1. Con un ADR que dice «el gate es local, GitHub es la atestación», los dos
miden universos distintos y nadie lo nota — el de arriba no puede confirmar lo que no mira. Hermano de
[[un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate]]: ahí el alcance lo decidía el
flag de salida, acá la **presencia de una carpeta**.

Y estaba **escrito ocho renglones más arriba en el mismo `lint.sh`**: «su corpus vive en
`coordinacion/`, gitignoreado, así que en CI sólo se lo puede ejercitar contra **fixtures**». La norma
existía y el mecanismo la contradecía — la forma en que un defecto se vuelve invisible **por escrito**
en vez de visible ([[el-guard-se-satisface-con-su-propio-comentario]]).

## La prueba de NO-ATRIBUCIÓN, y cómo casi pasa por la razón equivocada

«Mi rama rompió el gate» y «mi rama heredó un gate roto» llevan a trabajos distintos, así que hay que
medirlo: **correr la versión de `origin/main` contra el mismo corpus**. Salió **exit 6** por otra causa
⇒ el test ya estaba rojo antes; mis commits cambiaron la causa, no el color.

**Pero el primer intento no valía.** Extraje el script al scratchpad y lo corrí ahí: abortó con exit 2
por no encontrar `docs/`, porque resuelve sus rutas con `Path(__file__).resolve().parents[2]`. Midió el
**cambio de directorio**, no mis commits — y habría servido igual de «prueba», porque la forma de esta
prueba es *«la versión vieja también falla»* y **cualquier** fallo la satisface. Un control cuyo
criterio de éxito es un fallo ajeno acredita a cualquier fallo, incluido el que introduce el método.
Lo que lo arregla: extraer la versión vieja **a su propio directorio**, y exigir que falle por la
**misma clase** de causa que se está discutiendo (acá: un ratchet del contador, no un `FileNotFound`).

**Why:** porque este rojo no se puede resolver desde la rama que lo ve. Yo no podía clasificar los 3
documentos (el archivo es de otra sesión y el clasificador me lo deniega), y aunque hubiera podido, el
próximo mensaje del buzón lo habría vuelto a encender. Un gate así no se «arregla»: se **reubica**. Y
mientras nadie lo note, cada sesión gasta el turno investigando un rojo que no es suyo — o peor, lo
saltea con `--no-verify` y se lleva puesto todo lo demás que el gate sí medía
([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]).

**How to apply:**
1. **Antes de arreglar un rojo heredado, medí la atribución**: corré la versión de la rama base *en su
   propio directorio* contra el mismo sujeto. Si también falla, el trabajo es reportar la causa, no
   perseguir el síntoma en tu rama.
2. **Preguntale a todo gate dónde vive su sujeto.** Si no está versionado, el gate no mide el commit.
   Las dos salidas honestas: *(a)* el gate mira **fixtures** y el corpus vivo se audita con un comando
   aparte, o *(b)* el gate sigue mirando el corpus vivo y entonces «dejar el corpus clasificado» pasa
   a ser parte del **DoD de producirlo**, escrito donde todas las sesiones lo lean. Lo que no es
   opción es dejarlo implícito.
3. **Sospechá de un skip que decide por código de salida** sobre un recurso que en tu máquina siempre
   existe: ese skip está muerto localmente y vivo en CI, y ese par es exactamente el doble alcance.
4. Cuando un gate compartido se enciende por algo que **otra sesión** produjo, entregale a su dueña el
   parche **ya verificado** (rc antes / rc después, medido sobre una copia), no el pedido de trabajo.
   Es la diferencia entre destrabar el tronco de todos y pasarle una tarea más.
