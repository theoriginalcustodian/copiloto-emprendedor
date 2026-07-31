"""Aplicación de parches en formato SEARCH/REPLACE — Fase 3.

## Por qué no diffs unificados

Medido en el spike S5 con el **mismo** modelo, el **mismo** contexto y la **misma** temperatura,
cambiando una sola variable —el formato de salida—:

| Formato pedido | Resultado |
|---|---|
| diff unificado (`git apply`) | ❌ `error: while searching for:` |
| bloques SEARCH/REPLACE | ✅ aplicado → **12 tests verdes** |

`gpt-4o-mini` **sabe** reparar el bug; lo que no puede es acertar líneas y espacios exactos de un
diff. **El cuello de botella era el formato de entrega, no la capacidad del modelo.** Si el spike
hubiera parado antes de probar la variante, la conclusión habría sido *"el autohealing no es viable
con un modelo barato"* — y habría sido falsa. (Aider llegó a lo mismo y por eso usa este formato.)

## 🔴 El forjador NO acierta siempre — medido, y eso cambia el diseño

Sobre el bug real de `fingerprint.py` (quitar el `& 0xFFFFFFFF`), con el módulo productivo:

```
12 corridas contra gpt-4o-mini, temperature=0  →  11 VERDE, 1 ROJA
```

La corrida que falló **aplicó su bloque sin problemas** —`aplicado=True, 1 bloque`— y dejó la suite
roja igual. O sea: **el aplicador no puede detectar un parche que está bien formado y mal pensado**.
Ninguna validación de formato lo habría cazado.

⚠️ Mi primera explicación fue que el texto del `no_romper` había cambiado entre corridas. Un test
diferencial (3 corridas con cada versión del texto) la **refutó**: 3/3 verde con las dos. La causa es
variabilidad del modelo, que `temperature=0` **no** elimina. Sin ese diferencial habría canonizado una
causa falsa a partir de una sola observación.

**Consecuencia, y es la razón de que esta medición valga más que el módulo:** el ciclo **jamás** puede
confiar en que el forjador acertó. Correr la suite después de aplicar y descartar el parche si queda
roja no es una precaución razonable — es la única cosa que separa un PR que arregla de uno que no, y
ahora está **medido**, no supuesto. (Mismo criterio que S1 dejó escrito: ningún gate del ciclo puede
usar el exit code como oráculo.)

## Este módulo es PURO a propósito

No abre archivos, no llama a ningún LLM, no toca el disco: recibe texto y devuelve texto. Así el
aplicador —la pieza donde un error significa **escribir código equivocado en un repo**— se puede
probar exhaustivamente sin API key, sin costo y en milisegundos. Quien escribe al disco es el
llamador, y lo hace sobre una copia.

## El endurecimiento que el spike no tenía, y no es menor

El spike usaba `contenido.replace(buscar, reemplazar, 1)`: si el fragmento aparecía **más de una vez**,
parchaba **la primera** ocurrencia y seguía como si nada. Eso es exactamente *aplicar mal en silencio*,
que es de lo que SEARCH/REPLACE viene a proteger — y es peor que fallar, porque el resultado compila,
puede pasar los tests, y modificó un lugar que nadie eligió. Acá un fragmento **ambiguo se rechaza**:
el modelo tiene que citar suficiente contexto para que sea único.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

#: El formato que se le pide al forjador. `re.DOTALL` para que el cuerpo pueda tener saltos de línea.
BLOQUE = re.compile(r"<<<<<<< SEARCH\n(.*?)\n=======\n(.*?)\n>>>>>>> REPLACE", re.DOTALL)

#: Tope de bloques por parche. Un parche legítimo de una reparación puntual toca uno o dos lugares;
#: veinte es un modelo reescribiendo el módulo, que es justo lo que el prompt le prohíbe.
MAX_BLOQUES = 8


@dataclass(frozen=True)
class Aplicacion:
    ok: bool
    contenido: str
    detalle: str
    bloques: int = 0


def extraer_bloques(texto_modelo: str) -> list[tuple[str, str]]:
    """Los pares `(buscar, reemplazar)` que el modelo devolvió. Lista vacía si no respetó el formato."""
    return BLOQUE.findall(texto_modelo or "")


def aplicar_bloques(texto_modelo: str, contenido: str) -> Aplicacion:
    """Aplica los bloques sobre `contenido`. **Fail-closed: ante cualquier duda no toca nada.**

    Rechaza —devolviendo el contenido **original intacto**— si:

    - el modelo no devolvió ningún bloque con el formato pedido;
    - hay más de `MAX_BLOQUES` (eso ya no es una reparación puntual);
    - un fragmento **no existe** literalmente en el archivo (el modelo lo reconstruyó de memoria);
    - un fragmento aparece **más de una vez** → ambiguo. Parchar "la primera" sería elegir por el
      modelo un lugar que él no eligió, y el resultado podría compilar y pasar los tests estando mal;
    - el parche no cambia nada (no-op): un parche que no modifica el archivo no arregla el bug, y
      dejarlo pasar haría que el ciclo proponga un PR vacío diciendo que reparó algo.
    """
    bloques = extraer_bloques(texto_modelo)
    if not bloques:
        return Aplicacion(False, contenido, "el modelo no devolvió ningún bloque SEARCH/REPLACE")
    if len(bloques) > MAX_BLOQUES:
        return Aplicacion(False, contenido,
                          f"{len(bloques)} bloques (máx {MAX_BLOQUES}): esto es una reescritura, "
                          "no una reparación puntual")

    nuevo = contenido
    for buscar, reemplazar in bloques:
        apariciones = nuevo.count(buscar)
        if apariciones == 0:
            return Aplicacion(False, contenido,
                              f"fragmento no encontrado literalmente: {buscar[:70]!r}")
        if apariciones > 1:
            return Aplicacion(False, contenido,
                              f"fragmento AMBIGUO: aparece {apariciones} veces, {buscar[:70]!r}. "
                              "El parche tiene que citar más contexto para que sea único")
        nuevo = nuevo.replace(buscar, reemplazar, 1)

    if nuevo == contenido:
        return Aplicacion(False, contenido, "el parche no cambia nada (no-op)")
    return Aplicacion(True, nuevo, f"{len(bloques)} bloque(s) aplicado(s)", bloques=len(bloques))


def prompt_de_forja(*, archivo: str, contenido: str, salida_pytest: str, no_romper: str) -> str:
    """El prompt del forjador.

    **Acá está el trabajo real, no en la elección de modelo** (definición del operador, 2026-07-31):
    la efectividad del forjador depende de la calidad del contexto que se le entrega. Por eso van los
    cuatro: el archivo entero, la salida **real** de pytest (no un resumen), qué NO romper, y el
    formato exacto — y no una orden genérica del tipo *"arreglá el bug"*, que empíricamente **aumenta**
    las regresiones ([[localizacion-estructurada-feedback-agentes]]).
    """
    return f"""Sos un ingeniero reparando UN bug puntual. NO reescribas el módulo.

ARCHIVO {archivo}:
```python
{contenido}
```

SALIDA REAL DE PYTEST:
```
{salida_pytest[-1500:]}
```

QUÉ NO ROMPER: {no_romper}

Respondé SOLO con uno o más bloques en este formato EXACTO, copiando el texto a buscar
LITERALMENTE del archivo (mismos espacios, misma indentación). El fragmento que cites tiene que
aparecer UNA SOLA VEZ en el archivo: si es ambiguo, incluí más líneas de contexto.

<<<<<<< SEARCH
(texto exacto actual)
=======
(texto nuevo)
>>>>>>> REPLACE
"""
