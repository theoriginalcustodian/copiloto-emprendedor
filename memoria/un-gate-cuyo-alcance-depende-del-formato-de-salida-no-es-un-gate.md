---
name: un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate
description: El abort vivía después del `return` de `--json`, así que era inerte en el único camino que alguien llama; lo cazó su propio control positivo saliendo verde.
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
