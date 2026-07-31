"""El aplicador de parches — donde un error significa escribir código equivocado en un repo.

Sin LLM, sin base, sin disco: el módulo es puro, así que se puede exprimir en milisegundos y sin
costo. Es deliberado — la pieza más peligrosa del ciclo de autosanación es la que **modifica archivos**,
y esa tiene que estar cubierta hasta el hueso antes de que ningún modelo la use.
"""
from __future__ import annotations

from forjador_parches import (MAX_BLOQUES, Aplicacion, aplicar_bloques, extraer_bloques,
                              prompt_de_forja)

ORIGINAL = """def djb2(texto):
    h = 5381
    for ch in texto:
        h = ((h << 5) + h + ord(ch))
    return f"{h:08x}"
"""


def _bloque(buscar: str, reemplazar: str) -> str:
    return f"<<<<<<< SEARCH\n{buscar}\n=======\n{reemplazar}\n>>>>>>> REPLACE"


# ======================================================================================
# El camino feliz — y su control
# ======================================================================================
def test_un_bloque_valido_se_aplica():
    r = aplicar_bloques(
        _bloque("        h = ((h << 5) + h + ord(ch))",
                "        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF"),
        ORIGINAL)
    assert r.ok and r.bloques == 1
    assert "& 0xFFFFFFFF" in r.contenido
    assert r.contenido.count("h = 5381") == 1, "tocó más de lo que citó"


def test_varios_bloques_se_aplican_todos():
    texto = (_bloque("    h = 5381", "    h = 5382") + "\n" +
             _bloque('    return f"{h:08x}"', '    return f"{h:016x}"'))
    r = aplicar_bloques(texto, ORIGINAL)
    assert r.ok and r.bloques == 2
    assert "h = 5382" in r.contenido and "016x" in r.contenido


# ======================================================================================
# Los rechazos — cada uno es un modo de fallo distinto
# ======================================================================================
def test_sin_bloques_no_toca_nada():
    r = aplicar_bloques("acá va mi explicación de por qué el bug ocurre, sin código", ORIGINAL)
    assert not r.ok and r.contenido == ORIGINAL
    assert "ningún bloque" in r.detalle


def test_un_fragmento_INVENTADO_se_rechaza():
    """El modelo reconstruyó el archivo de memoria en vez de citarlo. Es el modo de fallo que hundió
    los diffs unificados en el spike S5."""
    r = aplicar_bloques(_bloque("    h = 9999", "    h = 1"), ORIGINAL)
    assert not r.ok and r.contenido == ORIGINAL
    assert "no encontrado" in r.detalle


def test_un_fragmento_AMBIGUO_se_rechaza_en_vez_de_parchar_el_primero():
    """El endurecimiento que el spike no tenía, y es el más importante del módulo.

    El spike hacía `replace(..., 1)`: con el fragmento repetido, parchaba **la primera** ocurrencia y
    seguía como si nada. Eso es aplicar mal **en silencio** —justo lo que SEARCH/REPLACE viene a
    evitar— y es peor que fallar: el resultado compila, puede pasar los tests, y modificó un lugar que
    nadie eligió.
    """
    repetido = "x = 1\ny = 2\nx = 1\n"
    r = aplicar_bloques(_bloque("x = 1", "x = 42"), repetido)
    assert not r.ok, "parchó una ocurrencia ambigua eligiendo por su cuenta cuál"
    assert r.contenido == repetido, "modificó el contenido pese a rechazar"
    assert "AMBIGUO" in r.detalle and "2 veces" in r.detalle


def test_un_parche_NO_OP_se_rechaza():
    """Un parche que no cambia nada no arregla el bug. Si pasara, el ciclo propondría un PR vacío
    afirmando que reparó algo — 'no mentir con el PR' es un guard portado de ARCA."""
    r = aplicar_bloques(_bloque("    h = 5381", "    h = 5381"), ORIGINAL)
    assert not r.ok and "no-op" in r.detalle


def test_demasiados_bloques_es_una_REESCRITURA_y_se_rechaza():
    """El prompt le pide una reparación puntual. Veinte bloques es un modelo reescribiendo el módulo,
    y un parche así no se puede revisar de un vistazo — que es la única defensa que le queda al humano
    del otro lado del PR."""
    texto = "\n".join(_bloque(f"linea_{i}", f"nueva_{i}") for i in range(MAX_BLOQUES + 1))
    contenido = "\n".join(f"linea_{i}" for i in range(MAX_BLOQUES + 1))
    r = aplicar_bloques(texto, contenido)
    assert not r.ok and "reescritura" in r.detalle
    assert r.contenido == contenido


def test_si_UN_bloque_falla_NINGUNO_se_aplica():
    """Atomicidad. Un parche aplicado a medias deja el archivo en un estado que ni el modelo ni el
    humano pidieron — y encima uno que podría compilar."""
    texto = (_bloque("    h = 5381", "    h = 5382") + "\n" +
             _bloque("    no existe esta linea", "    tampoco esta"))
    r = aplicar_bloques(texto, ORIGINAL)
    assert not r.ok
    assert r.contenido == ORIGINAL, "aplicó el primer bloque antes de descubrir que el segundo fallaba"


# ======================================================================================
# El parser, por separado
# ======================================================================================
def test_extraer_bloques_ignora_la_prosa_alrededor():
    """Los modelos suelen envolver la respuesta en explicaciones o en ```. El parser tiene que
    encontrar los bloques igual, sin que el prompt dependa de que el modelo se contenga."""
    texto = ("Claro, el problema es el overflow.\n```\n" +
             _bloque("    h = 5381", "    h = 5382") + "\n```\nEspero que sirva.")
    assert extraer_bloques(texto) == [("    h = 5381", "    h = 5382")]


def test_extraer_bloques_tolera_entrada_vacia_o_None():
    assert extraer_bloques("") == []
    assert extraer_bloques(None) == []  # type: ignore[arg-type]


def test_el_prompt_lleva_los_CUATRO_datos_que_lo_hacen_efectivo():
    """«La efectividad del forjador reside en la calidad del contexto que entregamos» (operador,
    2026-07-31). Un prompt sin la salida real de pytest o sin el 'qué no romper' es una orden genérica,
    y ésas **aumentan** las regresiones en vez de bajarlas (TDAD: -70% con feedback localizado)."""
    p = prompt_de_forja(archivo="fingerprint.py", contenido=ORIGINAL,
                        salida_pytest="E   assert '00597728' == '5f0a...'", no_romper="la firma pública")
    assert "fingerprint.py" in p
    assert "djb2" in p                       # el archivo entero, no un extracto
    assert "00597728" in p                   # la salida REAL de pytest
    assert "la firma pública" in p           # qué NO romper
    assert "<<<<<<< SEARCH" in p             # el formato exacto
    assert "UNA SOLA VEZ" in p               # la instrucción anti-ambigüedad


def test_aplicacion_es_inmutable():
    """El resultado no se puede editar después de decidido: si alguien pudiera marcar `ok=True` sobre
    un rechazo, el guard entero sería decorativo."""
    r: Aplicacion = aplicar_bloques("nada", ORIGINAL)
    try:
        r.ok = True  # type: ignore[misc]
    except Exception:
        return
    raise AssertionError("Aplicacion debería ser inmutable (frozen)")
