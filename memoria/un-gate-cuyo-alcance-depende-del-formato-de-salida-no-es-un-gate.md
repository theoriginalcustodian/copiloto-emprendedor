---
name: un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate
description: El alcance de un control no puede depender de lo que elige el llamador: el abort vivía tras el `return` de `--json` (inerte en el único camino real), y el REFUERZO es su gemelo en permisos — un sujeto cuyo destino entra por argumento no es un sujeto acotado.
metadata:
  type: feedback
---

Embarqué un ratchet (`exit 11`) en `scripts/evidencia/contar-veredictos.py` y escribí su control
positivo. **El control salió VERDE con el caso hostil puesto a propósito.** Lo primero que hice fue
diagnosticar en vez de parchear el test, y ahí estaba la causa:

```python
if "--json" in sys.argv:
    print(json.dumps(res, ...))
    return          # <- y mi gate estaba 60 líneas más abajo
```

El fixture funcionaba (`grep -c` confirmó que sacó la entrada declarada). El gate funcionaba: corrido
**sin** `--json` imprimía «CONFLICTO NUEVO — 1 id(s) … ['card']». Pero **la suite entera usa `--json`**,
igual que todo llamador real. Un gate colocado después de ese `return` **no protege nada**.

**Por qué:** es el espejo exacto de [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]].
Ahí el problema era el test; acá el test **sí** usaba el camino real y **el gate** era el que vivía en
el otro. La forma general: *el alcance de un control no puede depender del formato de salida.* La
detección y el abort son del gate y corren siempre; la tabla legible es del reporte y puede vivir
donde quiera. Mezclarlas en un solo bloque, al final de `main`, es lo que las ató al camino humano —
que es justamente el que nadie automatiza.

**Cómo aplicarlo:** al agregar un `sys.exit` a un script que tiene ramas por formato (`--json`,
`--quiet`, `--csv`) o cualquier `return` temprano, medir **en qué rama quedó**: `grep -n 'sys.exit\|
return' archivo` y comparar los números de línea contra la bifurcación. La pregunta es *¿con qué flags
lo llama el que lo usa?*, no *¿el gate está escrito?*. Y el control estructural: extraer la detección
a su propia función, de modo que el orden de las líneas deje de ser lo que decide si el gate corre
(hice `contraste_de_veredictos(res)`; el abort la llama arriba, la tabla la reusa abajo).

Corolario que casi me muerde en el mismo parche: al **mover** un bloque hacia arriba, sus variables
de loop entran en un scope que ya tiene nombres. El `for a, b in INCOMPATIBLES` era inofensivo al
final de `main` y, subido, pisaba los conteos `a`/`b` que se imprimen como «lote A={a}, lote B={b}» —
el control positivo habría mentido su propia cifra. Ver [[la-costura-leia-un-campo-que-nadie-escribe]]
para la familia y [[el-canario-el-control-positivo-de-lo-que-falla-callado]] para por qué el control
tiene que existir antes: **sin él, este gate se embarcaba inerte y yo lo contaba como protección.**

---

## REFUERZO (2026-10-11) — la misma forma, con el ALCANCE dependiendo de un ARGUMENTO

El título de arriba generaliza más de lo que yo creía cuando lo escribí: *el alcance de un control no
puede depender de algo que elige el llamador.* Ahí era el **formato de salida**. Hoy fue un
**argumento**, y el control era un **permiso**.

Escribí `scripts/evidencia/contar-filas-prod.sh` justamente para que un permiso apuntara a algo
acotado en vez de a `ssh <host> psql …` libre (el clasificador me había negado la lectura, con razón).
Acoté el SQL: lista de tablas fija en el fuente, sólo `count(*)`, guard read-only con su control
positivo. Y dejé `--host <h>` como flag. El patrón del permiso es
`Bash(bash scripts/evidencia/contar-filas-prod.sh:*)`, y **el `:*` cubre cualquier argumento**: con ese
flag, «contar filas en nuestra instancia» era en realidad «SSH a cualquier destino». Peor: `ssh -o… "$HOST"`
**sin `--`** hace que un valor que empieza con `-` lo lea ssh como flag, y `-oProxyCommand=…` ejecuta un
comando arbitrario **en esta máquina**. Un sujeto read-only convertido en ejecución local por una
comodidad.

**Por qué no lo vi:** acoté *la mitad que estaba mirando* — el SQL, porque era la que me habían negado.
El destino era la otra mitad del mismo alcance y nunca la miré, porque nadie me la había objetado.
**Acotar una dimensión y parametrizar la otra no reduce el permiso: lo disfraza**, y lo disfraza mejor
cuanto más prolijo es el guard de la dimensión acotada. El test verde del guard read-only era evidencia
real de una mitad, y funcionó como coartada de la otra —
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

**Cómo aplicarlo:** antes de pedir un permiso para un script, leé el patrón que vas a pedir y preguntá
*¿qué es lo PEOR que hace este script con los argumentos que `:*` permite?* — no *¿qué hace cuando lo
llamo como pienso llamarlo?*. Lo que define el alcance se pone `readonly` en el fuente y queda en el
diff; lo que entra por argumento es alcance libre, por prolijo que se vea el resto. Si el valor fijo
alimenta un comando que acepta flags, `--` antes del valor **y** un guard de forma (`case "$HOST" in -*|…)`)
con su propio control positivo mutando la constante a `-oProxyCommand=touch /tmp/pwned`: así se ve
disparar, en vez de suponerlo ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).
