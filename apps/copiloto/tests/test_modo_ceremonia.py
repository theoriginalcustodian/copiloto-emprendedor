"""El modo de ceremonia vive en el perfil del negocio, y es **fail-closed de verdad**.

Contrato de modos §3. Lo único que este archivo tiene que probar bien es el §3 de ese contrato:
*«si el modo no llega, no se lee, o llega un valor desconocido → confirmación. Nunca automático por
omisión»*. Todo lo demás es cableado.

**Y se prueba rompiéndolo, no razonándolo** — el DoD lo pide con esas palabras. Un fail-closed que
nadie ejercitó con basura es una afirmación: el camino feliz («guardo automatico, leo automatico»)
pasa igual con una implementación que devuelve el valor crudo.
"""
from __future__ import annotations

import pytest

from perfil_negocio_store import AUTOMATICO, CONFIRMACION, MODOS, CAMPOS, _DEFAULTS, modo_de


def test_el_campo_es_parte_del_perfil():
    assert "modo_ceremonia" in CAMPOS
    assert _DEFAULTS["modo_ceremonia"] == CONFIRMACION


def test_hay_dos_modos_y_nada_mas():
    """Un tercero («pregunta lo importante») es lo que ya hace el piso, y nombrarlo como opción
    sugiere que se puede apagar."""
    assert MODOS == (CONFIRMACION, AUTOMATICO)


def test_automatico_se_respeta():
    """El control del control: si `modo_de` devolviera SIEMPRE confirmación, todos los tests de
    abajo pasarían y ninguno probaría nada."""
    assert modo_de({"modo_ceremonia": AUTOMATICO}) == AUTOMATICO


@pytest.mark.parametrize("perfil", [
    None,                                   # el tenant nunca configuró nada
    {},                                     # perfil sin el campo (columna que todavía no existe)
    {"modo_ceremonia": None},               # la columna existe y está en NULL
    {"modo_ceremonia": ""},                 # vacío
    {"modo_ceremonia": "automatic"},        # typo — el caso que más se parece a funcionar
    {"modo_ceremonia": "AUTOMATICO"},       # mayúsculas: no es el valor, y adivinarlo sería inventar
    {"modo_ceremonia": " automatico "},     # con espacios
    {"modo_ceremonia": True},               # basura de tipo
    {"modo_ceremonia": ["automatico"]},
    "no soy un dict",                       # el store devolvió cualquier cosa
    123,
])
def test_todo_lo_demas_es_CONFIRMACION(perfil):
    """🔴 El test del contrato. Cada uno de estos casos, con la implementación «si dice confirmacion
    → confirmación», dejaría pasar el modo permisivo — y el bug se descubriría por un registro que
    nadie autorizó, cuando ya se guardó."""
    assert modo_de(perfil) == CONFIRMACION


def test_el_typo_no_se_corrige_solo():
    """`automatic` NO es `automatico`. Aceptarlo «porque se entiende» convertiría el fail-closed en
    un adivinador, y el próximo valor parecido —`auto`, `automático` con tilde— volvería a caer del
    lado permisivo por la misma lógica generosa."""
    assert modo_de({"modo_ceremonia": "automatic"}) == CONFIRMACION
    assert modo_de({"modo_ceremonia": "automático"}) == CONFIRMACION


# ── el bloqueo temporal del modo automático ──────────────────────────────────────────────────────
#
# Deuda GESTIONADA con dueño y condición de pago: se retira cuando la corrección del motor esté
# viva. Está acá y no en la app porque el contrato de modos §3 dice «el backend decide y el backend
# impone» — si sólo estuviera gris en la UI, un `POST` alcanzaría para ponerse en el modo peligroso.

def test_el_modo_automatico_YA_SE_ACEPTA():
    """⚠️ ANTES esto afirmaba lo contrario (`test_el_modo_automatico_se_rechaza_con_MOTIVO`), y esa
    expectativa era correcta EN SU MOMENTO: el modo estaba en pausa porque el copiloto narraba
    acciones que no ejecutaba, y en automático ese fallo es invisible.

    Se invierte —no se borra— el 2026-07-29, tras pagar la condición que el propio código declaraba
    («se retira cuando la corrección del motor esté viva»). Se pagó MIDIENDO:
    `scripts/retest_narra_sin_hacer.py --rondas 10` contra el LLM real, 10 sesiones limpias →
    **0/10 mentiras**, comparando lo que el texto afirma contra los `execute_tool` completados en el
    history de Temporal.

    Queda invertido en vez de borrado para que el próximo que lea esto sepa que hubo una pausa, por
    qué existió y con qué evidencia se levantó ([[el-test-que-canoniza-el-bug-como-si-fuera-el-contrato]]).
    """
    from presupuestos_web import _validar_perfil, PerfilBody

    # El modo automático ya no se rechaza: pasa la validación como cualquier otro modo válido.
    cambios = _validar_perfil(PerfilBody(modo_ceremonia=AUTOMATICO))
    assert cambios["modo_ceremonia"] == AUTOMATICO


def test_CONTROL_un_modo_INEXISTENTE_sigue_siendo_400():
    """El control que hace que el test de arriba signifique algo: si la validación aceptara
    cualquier cosa, aceptar `automatico` no probaría nada. Un typo sigue siendo 400."""
    from presupuestos_web import _validar_perfil, PerfilBody
    import pytest as _pytest
    from fastapi import HTTPException

    with _pytest.raises(HTTPException) as exc:
        _validar_perfil(PerfilBody(modo_ceremonia="automatic"))   # typo, valor que NO existe
    assert exc.value.status_code == 400


def test_el_enum_distingue_NO_EXISTE_de_EN_PAUSA():
    """🔴 `automatic` (typo) es un valor que no existe → 400. `automatico` existe y está en pausa →
    409 con el motivo. Colapsarlos en un 400 «tiene que ser uno de: confirmacion» le diría a la app
    que el modo automático no existe, y la app tendría que inventar el porqué para mostrarlo."""
    from presupuestos_web import PerfilBody, _validar_perfil
    from fastapi import HTTPException
    import pytest as _pytest

    # el valor REAL pasa la validación de enum (lo frena el guard, después)
    assert _validar_perfil(PerfilBody(modo_ceremonia=AUTOMATICO)) == {"modo_ceremonia": AUTOMATICO}
    # el typo muere antes, con 400
    with _pytest.raises(HTTPException) as exc:
        _validar_perfil(PerfilBody(modo_ceremonia="automatic"))
    assert exc.value.status_code == 400
