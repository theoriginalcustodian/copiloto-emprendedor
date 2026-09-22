---
name: un-fixture-no-aisla-lo-que-el-script-lee-por-fuera
description: "Agregar una fuente de datos a un script sin parametrizarla convierte sus tests en falsos verdes, porque el fixture ya no cubre todo lo que el script lee"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T18:03:02.900Z
---

Al agregar una **fuente de datos nueva** a un script que ya tiene tests con fixture, parametrizarla
es parte del cambio, no una mejora opcional. El fixture sólo aísla lo que el script lee a través de
las variables que el test controla; todo lo demás lo sigue leyendo del sistema real, y ahí el test
deja de medir el código para medir la máquina donde corre.

**Why:** el 2026-09-21 agregué a `senal_rol()` (`scripts/vigilancia-check.sh`) una cuarta señal de
vida: el último commit en una rama que lleva el nombre del rol. La leí de `$REPO_ROOT` fijo. Los
tests tenían `BUZON_DIR` y `SLUGS_ROOT` parametrizados, así que el buzón y los transcripts eran de
mentira — pero el `.git` era el REAL. `test-vigilancia-rol-ausente` pasó de 9/9 a 4 fallos, y los
cuatro eran controles POSITIVOS: casos que esperaban alarma y ya no la daban, porque backend
acababa de commitear en `backend/…` en esa misma máquina. El mismo defecto rompió los casos 2 y 3
de `test-vigilancia-rol-digitos-extremo-a-extremo`.

Lo grave no es que fallaran: es lo que habría pasado si no existieran. El resultado del script
habría dependido de qué ramas tuviera el repo en ese instante — verde en mi PC, rojo en CI, y un
gate que se apaga solo cuando cualquier sesión commitea. El test cazó el defecto **antes** del
commit y de ahí salió `RAMAS_GIT_DIR`.

**How to apply:** cuando el diff agregue una lectura del mundo exterior (git, red, reloj, FS fuera
del fixture), agregá en el mismo diff su `VAR="${VAR:-<default real>}"` y usala en los tests. Y
escribí el porqué al lado: el próximo que lea `RAMAS_GIT_DIR` no va a adivinar que existe porque un
control positivo se puso verde por una rama ajena.

Corolario que vale aparte: cuando la señal nueva **calla** una alarma en vez de encenderla, el
sentido del riesgo se invierte respecto de las señales que acusan. Un patrón laxo no produce un
falso positivo ruidoso — ciega el gate, y en silencio. Ahí la regla es al revés que en
`firma_patrones()`: ante la ambigüedad, NO contar.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[control-negativo-estatico-no-caza-constante-equivocada]] ·
[[defense-in-depth-enmascara-el-control-negativo-de-la-capa-interna]] ·
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]]
