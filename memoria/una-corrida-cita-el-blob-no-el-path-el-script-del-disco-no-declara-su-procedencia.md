---
name: una-corrida-cita-el-blob-no-el-path-el-script-del-disco-no-declara-su-procedencia
description: El mismo script existía en tres versiones a la vez — HEAD 493 líneas, working tree 918, origin/main 1239 — y `python script.py` corre la del disco. Cinco horas de probes contra un blob que no estaba ni commiteado ni pusheado. Un path identifica un archivo; sólo el blob identifica qué código corrió
metadata:
  type: feedback
---

**El caso (2026-09-29, `contar-veredictos.py`).** Después de escribir una adenda entera basada en probes
contra ese parser, `git status` mostró el archivo modificado. Medido:

| versión | líneas | blob |
|---|---|---|
| `HEAD` de mi rama | 493 | `5c0f07c3` |
| **working tree** — lo que corrieron mis probes | 918 | `7f998371` |
| **`origin/main`** — la vigente | **1239** | `4e989f3e` |

Tres versiones del mismo path, y **la que corre es siempre la del disco**. Ni la de mi rama ni la que
gobierna. El working tree tenía 460 líneas de otra sesión sin commitear, y ningún paso de mi método lo
hubiera detectado: el script existía, se importaba, respondía, y sus controles positivos daban verde.

**Re-corrido contra `origin/main` el resultado fue idéntico renglón por renglón, así que no se cayó
nada.** Y eso es exactamente lo que hay que no celebrar: **coincidieron por suerte.** Las 460 líneas de
diferencia tocaban el *universo* del parser (`SPEC` en vez de `MATRIZ`), no las *formas* que mis canarios
ejercitaban. Un diff que hubiera tocado el regex de celdas me deja una adenda entera midiendo un
instrumento que nadie corre.

> **Toda corrida que se cite como evidencia declara el BLOB, no el path.** Un path identifica un archivo;
> sólo el blob identifica qué código corrió. `git hash-object <script>` antes de correr, y el hash en el
> reporte al lado del resultado.

## Por qué este sujeto equivocado es peor que los otros

Fue el **quinto** de la jornada —árbol equivocado, universo incompleto, celda que no era el id, documento
del medio de una cadena— y el único donde el sujeto equivocado **era el instrumento**. Los otros cuatro
los cazó un control de denominador («esperaba N, encontré M»). Este no podía: **el denominador salió bien
porque el archivo era el correcto**; lo que estaba mal era *cuál de sus versiones*. Ningún control sobre
los datos ve eso, porque no es un problema de los datos.

Y el disparador fue accidental: un `Warning: 1 uncommitted change` que `gh pr create` imprime al pasar. Si
hubiera commiteado con rutas explícitas sin mirar el `status` completo —que es lo correcto en checkout
compartido— **no aparecía nunca**. De ahí la segunda regla: **en un worktree propio, `git status` completo
antes de citar una corrida**, no sólo las rutas que vas a commitear.

## El corolario sobre el residuo ajeno

Las 460 líneas **ya estaban en `origin/main`** (verificado por marcas distintivas: `CIEGOS_DECLARADOS`
5=5, `C3-13` 4=4). No era WIP a rescatar sino un estado intermedio superado — pero eso **no se podía
saber sin medirlo**, y la reacción barata («hay trabajo sin commitear, avisá que se puede perder») habría
mandado a otra sesión a rescatar algo que ya existía. Ver
[[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]], que es el caso **opuesto** y
tiene el mismo síntoma: **un working tree sucio no dice si adelanta o atrasa; sólo el diff contra el
tronco lo dice.**

Hermanas: [[el-instrumento-respondio-sobre-otro-sujeto]] ·
[[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]] ·
[[el-checkout-compartido-sirve-comandos-viejos]] (misma familia, un nivel más abajo: ahí el comando es
viejo, acá el comando es de nadie) ·
[[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]] ·
[[el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario]] (la adenda que casi se cae).
