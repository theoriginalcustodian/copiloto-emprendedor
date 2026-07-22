"""Todo 409 lleva un `codigo` que la app puede leer — y **no puede volver a no llevarlo**.

El bug que esto cierra ya se pagó dos veces del lado del cliente: la app discriminaba los conflictos
por *la forma del cuerpo* («¿trae `factura_id`?», «¿el `detail` es un string?»), y un 409 nuevo
aterrizaba en la rama de otro. El síntoma no era un error: al emprendedor se lo mandaba a cargar un
CUIT que ya tenía, por una factura que ya existía.

El test del final es el que importa. Los demás verifican que hoy está bien; **ése verifica que
mañana tampoco se pueda romper**, porque un `status_code=409` escrito a mano en cualquier módulo lo
hace fallar aunque nadie se acuerde de este archivo.
"""
from __future__ import annotations

import pathlib
import re

import pytest
from fastapi import HTTPException

import errores_web
from errores_web import CODIGOS, FALTA_CUIT, conflicto


def test_el_conflicto_lleva_codigo_y_mensaje():
    exc = conflicto(FALTA_CUIT, "falta el perfil fiscal (CUIT)")
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 409
    assert exc.detail["codigo"] == FALTA_CUIT
    assert exc.detail["mensaje"] == "falta el perfil fiscal (CUIT)"


def test_los_campos_extra_siguen_viajando():
    """El cambio es ADITIVO: un cliente que todavía discrimina por forma sigue funcionando mientras
    migra. Si `factura_id` desapareciera, la migración dejaría de ser opcional y habría que
    coordinar el deploy de las dos capas al mismo minuto."""
    exc = conflicto("presupuesto_ya_facturado", "el presupuesto ya fue facturado", factura_id="f1")
    assert exc.detail["factura_id"] == "f1"


def test_un_codigo_inventado_falla_fuerte():
    """Y no en silencio: un 409 con un código que la app no conoce cae en su rama por defecto, que
    es exactamente el modo de fallo que este módulo vino a cerrar."""
    with pytest.raises(ValueError, match="desconocido"):
        conflicto("me_lo_acabo_de_inventar", "…")


def test_los_codigos_son_todos_distintos():
    """Dos significados con el mismo código son indistinguibles para la app — el problema original,
    con otro disfraz."""
    nombres = [v for k, v in vars(errores_web).items()
               if k.isupper() and isinstance(v, str) and not k.startswith("_")]
    assert len(nombres) == len(set(nombres))
    assert set(nombres) == set(CODIGOS)


def test_facturar_y_cambiar_estado_NO_comparten_codigo():
    """Los dos devuelven `{mensaje, estado}` y significan cosas distintas: «no puedo facturar ESTO»
    vs «no podés pasar de acá para allá». Con un solo código la app tendría que volver a mirar de
    qué endpoint vino — adivinar por contexto, que es el hábito que estamos sacando."""
    assert errores_web.PRESUPUESTO_NO_FACTURABLE != errores_web.TRANSICION_INVALIDA


# ── el guard ─────────────────────────────────────────────────────────────────────────────────────

_APP = pathlib.Path(__file__).resolve().parent.parent
# `clientes_web` es la excepción DECLARADA: su 409 es un `JSONResponse` cuyo `detail` es un string
# que la app ya consume así, y lleva el código en la raíz. Convertirlo a dict sería el mismo cambio
# que rompe al cliente en silencio. Está en la lista para que la excepción sea explícita y visible,
# no para que pase desapercibida.
_EXCEPCIONES = {"errores_web.py", "clientes_web.py"}


def test_ningun_409_escrito_a_mano():
    """🔴 El test que hace que esto no vuelva.

    Sin él, la regla vive en la cabeza de quien la escribió: el próximo conflicto se agrega con un
    `HTTPException(409, …)` a mano —que es lo natural— y nadie se entera hasta que un cliente
    discrimine mal. **Un acuerdo que depende de que alguien se acuerde ya falló.**
    """
    culpables = []
    for archivo in _APP.glob("*.py"):
        if archivo.name in _EXCEPCIONES:
            continue
        for n, linea in enumerate(archivo.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"status_code\s*=\s*409|HTTPException\(\s*409", linea):
                culpables.append(f"{archivo.name}:{n}")
    assert not culpables, ("409 escrito a mano (usá `errores_web.conflicto`, que obliga a declarar "
                           f"el código): {', '.join(culpables)}")


def test_el_guard_mira_donde_dice_mirar():
    """El control del control: si el glob no encontrara los módulos web, el test de arriba pasaría
    siempre — un instrumento que confirma. Ver [[instrumentos-que-confirman-en-vez-de-verificar]]."""
    nombres = {a.name for a in _APP.glob("*.py")}
    for esperado in ("presupuestos_web.py", "afip_web.py", "clientes_web.py", "gastos_web.py"):
        assert esperado in nombres, f"el guard no está viendo {esperado}"
