---
name: el-primer-test-rojo-mata-la-suite-y-el-rojo-ajeno-se-vuelve-escudo-del-propio
description: Un gate con set -e que corre sus suites en un bucle sin capturar el código aborta en el primer test rojo, así que reporta UN defecto por corrida y los siguientes quedan invisibles — y como el glob va en orden alfabético, qué defectos son observables depende del NOMBRE del archivo; leer el log completo de una corrida truncada se siente como haber medido todo.
metadata:
  type: feedback
---

**2026-09-30.** Afirmé en el cuerpo del PR #771: «**el único fallo es
`test-contar-veredictos-padron.sh`**, y no lo introduce este PR. Todo lo demás está verde». Falso.
Había un **segundo** fallo, **sí introducido por mí**, y lo encontró el CI de GitHub. Yo había leído el
log local **completo** — el log estaba completo; la **suite** estaba truncada al 17 %.

## El mecanismo

`scripts/ci/lint.sh:4` es `set -euo pipefail`. El bucle (`:44-48`) corre `bash "$t"` **sin capturar el
código**:

```bash
for t in "$ROOT"/scripts/tests/test-*.sh; do
  [ -e "$t" ] || continue
  echo "▶ $(basename "$t")"
  bash "$t"            # ← un rc≠0 acá mata el script entero por set -e
done
```

Tres corridas del **mismo** `lint.sh`, contadas con `grep -c '▶'`:

| corrida | suites ejecutadas | murió en |
|---|---|---|
| local 08:55 (antes de mi control nuevo) | **47** | — (verde) |
| local 19:51 (mi rama) | **8** | `test-contar-veredictos-padron.sh` (8ª, letra «c») |
| CI de GitHub 23:06 UTC | **33** | `test-medidor-avisa-en-el-borde.sh` (33ª, letra «m») |

**39 suites no corrieron localmente**, y entre ellas estaba la que mi propio commit rompía.

## Las dos propiedades que lo vuelven una trampa

**(a) El orden alfabético del glob decide qué defecto es visible.** No hay ninguna relación entre el
nombre de un archivo y la importancia de lo que prueba, así que qué mitad de la suite se ejercita es
**arbitrario** — y estable, que es peor: el mismo rojo tapa a los mismos 39 en cada corrida.

**(b) Un rojo ajeno se vuelve escudo del propio.** Acá se combinó con
[[un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit]] en el peor par posible: el
rojo del corpus vivo cae en la letra «c» y **oculta todo lo que venga después**; en CI ese test se
saltea por diseño, la corrida llega a la «m», y aparece el defecto real. **Los dos alcances del gate
no difieren sólo en el veredicto: difieren en qué defectos son observables.** Atribuí el rojo entero a
la causa ajena y el instrumento me dio la razón, porque no llegó a mirar lo mío.

## Por qué no lo cazó ninguna de mis precauciones

Volqué el log a archivo completo y **no** lo pipeé por `tail`
([[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]]) — hice lo correcto y no alcanzó:
esa regla protege de perder el final del log, no de que el **productor** se corte. Lo que faltaba es
la pregunta de denominador de [[instrumento-que-no-mira-nunca-falla]] aplicada a la corrida y no al
script: **¿cuántas suites miró esta corrida, y cuántas hay?** `grep -c '▶'` contra `ls
scripts/tests/test-*.sh | wc -l` lo contesta en un comando, y habría dicho 8 de 47.

**Why:** un gate que sólo puede reportar **un** defecto por corrida obliga a N corridas seriales para
encontrar N defectos, y cada corrida cuesta minutos. Peor: convierte cualquier rojo —sobre todo el
ajeno, el que no puedo arreglar— en una tapa sobre todos los siguientes, y al mismo tiempo produce la
sensación de haber medido, porque el log se lee entero y termina con un veredicto. La palabra «suite»
promete que se corren todas; el código es una **cadena**.

**How to apply:**
1. **Antes de creerle a una corrida, contá su denominador.** `grep -c '▶' log` vs. la cantidad de
   suites que existen. Un log completo de una corrida truncada es indistinguible de un log completo.
2. **En un bucle de tests bajo `set -e`, acumulá**: `bash "$t" || rojas=$((rojas+1))` y fallá al final
   con la cuenta. Verificado con control positivo: corpus de 4 suites (2 rojas separadas por una
   verde) → la variante actual reporta **1 de 2** y deja 2 suites sin correr; la propuesta reporta
   **2 de 2** con 0 sin correr, sigue saliendo rc=1 (no apaga el gate) y sale rc=0 con el corpus todo
   verde (no fabrica rojos). **Dos** rojas y no una: con una sola, las dos variantes reportan lo mismo
   y el control no separa nada.
3. **Cuando atribuyas un rojo a una causa ajena, preguntate qué habría tapado esa causa.** «El test X
   falla y no es mío» es compatible con «y además hay otro que sí es mío, detrás».
4. Si el orden de ejecución sale de un glob, el orden es **alfabético y arbitrario**: cualquier
   propiedad del gate que dependa de él (qué se mide, qué se ve primero) depende del nombre del
   archivo, que nadie eligió pensando en eso.
