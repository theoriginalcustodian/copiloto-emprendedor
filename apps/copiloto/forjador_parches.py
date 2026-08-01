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


#: El test de reproducción viaja en su propio bloque: es un archivo COMPLETO, no un reemplazo dentro
#: de otro. Marcador distinto del de `BLOQUE` a propósito — mezclarlos obligaría al modelo a usar
#: SEARCH/REPLACE contra un archivo que todavía no existe.
BLOQUE_TEST = re.compile(r"<<<<<<< TEST\n(.*?)\n>>>>>>> FIN TEST", re.DOTALL)


def extraer_test(texto_modelo: str) -> str | None:
    """El contenido del test de reproducción, o `None` si el modelo no lo produjo.

    Devuelve el **contenido**, nunca una ruta: el nombre del archivo lo decide el ciclo, no el
    modelo. Dejar que un LLM elija dónde escribir es abrirle la puerta a `../..` y a pisar un test
    existente — y acá el archivo termina commiteado en un repo de verdad.
    """
    encontrado = BLOQUE_TEST.search(texto_modelo)
    if not encontrado:
        return None
    return encontrado.group(1).strip() or None


def prompt_de_forja(*, archivo: str, contenido: str, salida_pytest: str, no_romper: str) -> str:
    """El prompt del forjador.

    **Acá está el trabajo real, no en la elección de modelo** (definición del operador, 2026-07-31):
    la efectividad del forjador depende de la calidad del contexto que se le entrega. Por eso van los
    cuatro: el archivo entero, la salida **real** de pytest (no un resumen), qué NO romper, y el
    formato exacto — y no una orden genérica del tipo *"arreglá el bug"*, que empíricamente **aumenta**
    las regresiones ([[localizacion-estructurada-feedback-agentes]]).

    **Y desde el 2026-08-01 pide una segunda cosa: un test que REPRODUZCA el bug.** Sin él, el gate
    sólo puede afirmar que el parche no rompe nada — que es exactamente lo que dejó pasar un parche
    no-op con CI 5/5 (PR #179). El test es lo único que convierte "no rompió" en "arregló".
    """
    modulo = archivo.rsplit("/", 1)[-1].removesuffix(".py")
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

Respondé con DOS cosas, en este orden.

1) EL ARREGLO: uno o más bloques en este formato EXACTO, copiando el texto a buscar LITERALMENTE
del archivo (mismos espacios, misma indentación). El fragmento que cites tiene que aparecer
UNA SOLA VEZ en el archivo: si es ambiguo, incluí más líneas de contexto.

<<<<<<< SEARCH
(texto exacto actual)
=======
(texto nuevo)
>>>>>>> REPLACE

2) UN TEST QUE REPRODUZCA EL BUG. Archivo pytest completo, sin fences ```, entre estos marcadores:

<<<<<<< TEST
(archivo de test completo)
>>>>>>> FIN TEST

El test tiene que FALLAR con el código ACTUAL y PASAR con tu arreglo aplicado. Se va a correr las
dos veces y se comparan los resultados. Es lo único que prueba que arreglaste algo: sin él, un
cambio que no rompe nada es indistinguible de uno que tampoco arregla nada.

Reglas del test, todas obligatorias:
- importá el módulo bajo prueba por su nombre (`import {modulo}` o `from {modulo} import ...`), sin
  rutas relativas y sin tocar `sys.path`;
- ejercitá EXACTAMENTE la condición del error de arriba, con los mismos datos si los tenés;
- nada de red, base de datos, archivos ni servicios externos: tiene que correr aislado;
- una sola función de test, con nombre descriptivo del bug;
- el assert tiene que fallar HOY **por el bug**, no por un import roto ni por un error de sintaxis;
- si no podés escribir un test que falle hoy por esta causa, NO inventes uno: omití el bloque TEST
  por completo. Un test que pasa antes y después no prueba nada y va a ser descartado.
"""


#: Centinela imposible de encontrar en un prompt. Un parche sin ninguna línea de código no viajó a
#: ningún lado y `False` es la respuesta correcta — pero tiene que salir de una comparación que falle
#: de verdad, no de un `""` que está contenido en cualquier texto y daría `True` siempre.
SIN_CODIGO = "\0sin-codigo-en-el-parche"


def linea_de_codigo(texto_modelo: str) -> str:
    """La primera línea con contenido REAL de un parche: ni marcador, ni fence, ni vacía.

    Existe para poder preguntar honestamente *¿el prompt de reintento lleva el intento previo?*. Es
    lo único que sobrevive intacto a `_neutralizar_marcadores`, que indenta cada línea y reescribe
    los marcadores como prosa.

    El banco lo preguntaba comparando los primeros 60 caracteres **crudos** del intento previo contra
    el prompt, y eso no podía dar `True` nunca: el previo empieza por `<<<<<<< SEARCH` —el formato lo
    exige— y en el prompt ese marcador ya no existe. Se midió contra el código anterior para
    descartar que fuera una regresión: daba `False` ahí también. El instrumento acusaba al sistema de
    un fallo que era suyo, y no era inofensivo — el guard `ciegos` del banco puede reprobar la
    corrida entera por ese flag.
    """
    for linea in texto_modelo.splitlines():
        pelada = linea.strip()
        if pelada and not pelada.startswith(("<<<<<<<", "=======", ">>>>>>>", "```")):
            return pelada
    return SIN_CODIGO


def _neutralizar_marcadores(texto: str) -> str:
    """Reescribe los marcadores SEARCH/REPLACE del intento previo como prosa.

    **Medido el 2026-07-31, y es la causa por la que el reintento daba 0/12.** El prompt citaba el
    intento anterior tal cual, con sus `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE` adentro de un
    bloque ```. El modelo entonces devolvía el arreglo **correcto** (`& 0xffffffff`, exacto) pero
    envuelto en un fence ``` y con sólo el `=======` del medio: había imitado la forma del texto
    citado en vez de la del formato pedido. `aplicar_bloques` lo rechazaba —bien rechazado— y el
    ciclo agotaba los 3 intentos con un parche correcto en la mano.

    El ejemplo negativo contaminaba la salida. Y era invisible: el intento 1 no lleva texto citado, y
    por eso el banco sin reintento daba 12/12 mientras el reintento estaba roto de punta a punta.

    Lo que el modelo necesita del intento previo es **qué propuso**, para no repetirlo. Los marcadores
    no aportan nada a eso y son justamente lo que lo desvía.
    """
    lineas = []
    for linea in texto.splitlines():
        pelada = linea.strip()
        if pelada.startswith("<<<<<<< SEARCH"):
            lineas.append("  [buscabas]")
        elif pelada.startswith("======="):
            lineas.append("  [y lo reemplazabas por]")
        elif pelada.startswith(">>>>>>> REPLACE"):
            lineas.append("  [fin del cambio propuesto]")
        elif pelada.startswith("<<<<<<< TEST"):
            lineas.append("  [y este test proponías]")
        elif pelada.startswith(">>>>>>> FIN TEST"):
            lineas.append("  [fin del test propuesto]")
        elif pelada.startswith("```"):
            continue          # los fences también invitan a imitar la envoltura
        else:
            lineas.append(f"  {linea}")
    return "\n".join(lineas)


def prompt_de_reintento(*, archivo: str, contenido: str, salida_pytest: str, no_romper: str,
                        intento_previo: str, motivo_rechazo: str,
                        regresiones: tuple[str, ...] = ()) -> str:
    """El prompt del SEGUNDO intento — el que convierte "acierta 11 de 12" en "termina bien 12 de 12".

    Medido en S5: el forjador falla ~1 de cada 12 por **variabilidad del modelo**, no por falta de
    contexto (`temperature=0` no la elimina — se verificó con un diferencial de 3 corridas por cada
    versión del prompt: 3/3 verde con las dos). Contra variabilidad, la respuesta no es un prompt más
    perfecto: es **volver a tirar con información nueva**.

    Y la información nueva tiene que ser **localizada**, no un "falló, probá de nuevo". Empírico
    (TDAD): decirle QUÉ archivo, QUÉ test y QUÉ no romper baja regresiones ~70%; la orden genérica
    las **aumenta**. Por eso este prompt lleva el parche anterior (para que no lo repita), el motivo
    exacto del rechazo, y los nodeids que rompió.

    El intento previo va COMPLETO a propósito: sin verlo, el modelo tiende a re-emitir el mismo
    parche —es su respuesta de máxima probabilidad para el mismo input— y el reintento se convierte
    en una segunda tirada idéntica, que es exactamente lo que no queremos.
    """
    detalle = ""
    if regresiones:
        listado = "\n".join(f"  - {r}" for r in regresiones)
        detalle = (f"\nTESTS QUE PASABAN ANTES Y TU PARCHE ROMPIÓ (son la causa del rechazo):\n"
                   f"{listado}\n")

    previo = _neutralizar_marcadores(intento_previo[-1200:])

    return f"""Tu intento anterior de reparar este bug FUE RECHAZADO. Corregilo.

ARCHIVO {archivo}:
```python
{contenido}
```

SALIDA REAL DE PYTEST (el bug original):
```
{salida_pytest[-1500:]}
```

TU INTENTO ANTERIOR, descrito en palabras (NO lo repitas, y NO copies ESTE formato):
{previo}

POR QUÉ SE RECHAZÓ: {motivo_rechazo}
{detalle}
QUÉ NO ROMPER: {no_romper}

Pensá qué asumiste mal en el intento anterior antes de escribir. Si el rechazo fue por romper otros
tests, tu parche tocó algo de lo que esos tests dependen: acotá el cambio.

No envuelvas nada en ``` ni omitas ninguno de los marcadores: un parche sin sus tres marcadores se
descarta entero aunque el arreglo sea correcto.

Respondé con el arreglo Y con un test que reproduzca el bug (falla con el código actual, pasa con
tu arreglo). Si el rechazo anterior fue porque tu test no fallaba sin el parche, ese test no
ejercitaba la causa: escribí otro o no lo mandes.

<<<<<<< TEST
(archivo de test completo, sin fences)
>>>>>>> FIN TEST

Y el arreglo en uno o más bloques en este formato EXACTO, copiando el texto a buscar LITERALMENTE
del archivo (mismos espacios, misma indentación). El fragmento que cites tiene que aparecer
UNA SOLA VEZ en el archivo: si es ambiguo, incluí más líneas de contexto.

<<<<<<< SEARCH
(texto exacto actual)
=======
(texto nuevo)
>>>>>>> REPLACE
"""
