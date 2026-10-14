"""EDITARMUERTO — canario INVERTIDO de `editable` en `card.detalle` (contrato 2026-10-14).

`editable` existe en las 4 capas (contrato, backend, core, UI) y NADIE lo emite en `true`: el backend lo
hardcodea `False` y ninguna UI lo lee. El daño no es que falte el botón «Editar» (eso es producto y es del
operador) sino que **emitir el campo no avisa a nadie**: el día que una regla lo ponga en `true` no cambia
nada en pantalla y nadie se entera. Los fixtures de las 4 capas lo fijan en `false`, así que ningún test
puede ponerse rojo.

Este test no exige una UI que no existe (nacería rojo y se volvería escudo de los rojos propios). Va sobre
la EMISIÓN: afirma que HOY ninguna fila de ningún servicio sale con `editable: true`, y se pone rojo el día
que alguien la emita, con un mensaje que dice qué le falta.

**Control positivo (por qué este test no es ciego):**
  · `test_el_canario_dispara_con_una_fila_en_true` corre el MISMO verificador sobre un servicio mutado que
    emite `editable: True` y exige que reporte violaciones;
  · el instrumento cuenta cuántas filas miró y el test real exige que sean > 0 (una lista vacía pasa
    siempre).
"""
import hitl_card

# Argumentos representativos por toolkit con detalle. Es un set DECLARADO a propósito: el día que se migre
# otro servicio a `hitl_card._POR_TOOLKIT`, `test_cada_toolkit_con_detalle_tiene_argumentos_para_el_canario`
# se pone rojo y obliga a agregarlo acá — si no, el canario dejaría de mirar al servicio nuevo sin avisar.
_ARGUMENTOS_POR_TOOLKIT = {
    "gmail": [
        {"recipient_email": "lucia@x.com", "subject": "Recordatorio", "body": "Te recuerdo la reunión."},
        {"recipient_email": "lucia@x.com"},                               # sin asunto ni cuerpo
        {"recipient_email": "lucia@x.com", "subject": "", "body": ""},
    ],
}

_QUE_HACER = (
    "una fila de card.detalle salió con editable=True. NINGUNA UI (mobile ni web) lee ese campo: emitirlo "
    "no cambia nada en pantalla. Antes de emitirlo hay que implementar «Editar» en las DOS plataformas "
    "(el prototipo lo modela por campo, no como botón de la card) o declarar por qué no. Decisión de "
    "producto del operador; este test no se saltea con --no-verify ni se relaja a mano."
)


def _filas_editables(por_toolkit: dict) -> tuple[list[str], int]:
    """(violaciones, filas_miradas). Recorre TODAS las filas de `detalle` de cada servicio con sus
    argumentos representativos y junta las que no son exactamente `editable is False`."""
    violaciones: list[str] = []
    miradas = 0
    for toolkit, variantes in por_toolkit.items():
        for args in variantes:
            detalle = hitl_card.detalle_de(toolkit, args)
            if detalle is None:
                continue
            for fila in detalle.get("filas") or []:
                miradas += 1
                if fila.get("editable") is not False:
                    violaciones.append(f"{toolkit}:{fila.get('k')!r} editable={fila.get('editable')!r}")
    return violaciones, miradas


def test_ninguna_fila_de_ningun_servicio_emite_editable_true():
    violaciones, miradas = _filas_editables(_ARGUMENTOS_POR_TOOLKIT)
    assert miradas > 0, "el canario miró 0 filas: un recorrido vacío pasa siempre y no prueba nada"
    assert not violaciones, f"{_QUE_HACER} Filas: {violaciones}"


def test_cada_toolkit_con_detalle_tiene_argumentos_para_el_canario():
    """Sin esto, migrar un servicio nuevo lo deja FUERA del canario y nadie se entera."""
    sin_cubrir = sorted(hitl_card.TOOLKITS_CON_DETALLE - set(_ARGUMENTOS_POR_TOOLKIT))
    assert not sin_cubrir, (
        f"servicios con detalle que el canario no recorre: {sin_cubrir}. Agregarles argumentos "
        f"representativos en _ARGUMENTOS_POR_TOOLKIT de este archivo."
    )


def test_el_canario_dispara_con_una_fila_en_true(monkeypatch):
    """CONTROL POSITIVO: un servicio que emite `editable: True` TIENE que acusar el verificador. Si este
    test pasa con el verificador ciego, el de arriba es decorativo."""
    def _detalle_mutado(args: dict) -> dict:
        return {"titulo": "mutante", "filas": [
            {"k": "Para", "v": "x", "sub": None, "editable": False},
            {"k": "Asunto", "v": "y", "sub": None, "editable": True},      # <- el mutante
        ], "cita": None, "nota": None}

    monkeypatch.setitem(hitl_card._POR_TOOLKIT, "gmail", (_detalle_mutado, lambda a, h: None))
    violaciones, miradas = _filas_editables(_ARGUMENTOS_POR_TOOLKIT)
    assert miradas > 0
    assert violaciones and all("editable=True" in v for v in violaciones), violaciones
