"""D3 (2026-10-13) — el cobro NO promete un mecanismo que no existe.

El link de MercadoPago se crea sin `expires` y nada avisa cuando se paga (la regla de Mi día de
«cobro acreditado» no existe). El texto que ve el emprendedor lo redacta el LLM, y sin esta prohibición
decía «vence en 7 días» / «te aviso cuando pague»: falso en producción.

⚠️ Qué mide este archivo y qué NO: acá no hay un LLM real (la suite usa uno guionado), así que mide las
dos mitades **deterministas** — (1) que la prohibición LLEGA al modelo (descripción de la tool + prompt
ReAct) y (2) que lo que la TOOL devuelve (preview, observación, artifact) no promete. Que un modelo real
la obedezca se mide con un retest contra prod, no acá.
"""
import json
import re

import tool_catalog
from context_factory import TenantCtx
from system_prompt import SYSTEM_PROMPT_REACT

PROMESA = re.compile(r"vence|caduca|expira|te aviso|te avisamos|avisar", re.IGNORECASE)


class _Gw:
    def create_payment_link(self, at, *, amount, external_reference, notification_url, title="Cobro"):
        return {"id": "pref-1", "init_point": "https://mp/redirect?pref_id=pref-1",
                "external_reference": external_reference}


class _Cred:
    def get(self, seller): return {"access_token": "AT"}
    def salud(self): return "conectado"


def _ctx():
    return TenantCtx(cliente_id="cli-A", composio_user_id="u", mp_gateway=_Gw(), mp_cred_store=_Cred(),
                     mp_seller_user_id="146", mp_webhook_base="https://mp.example", idem_key=None)


def _salida_de_la_tool(confirmed: bool) -> str:
    r = tool_catalog._run_mp_charge("mp_charge", {"amount": 5000, "concept": "Clase de yoga"}, _ctx(),
                                    confirmed, "idem-1", lambda: "2026-10-13T10:00:00", None)
    art = r.artifact.data if r.artifact else {}
    return json.dumps({"obs": r.observation, "art": art}, ensure_ascii=False)


def _descripcion_mp_charge() -> str:
    return tool_catalog.MP_CHARGE_SCHEMA["function"]["description"]


def test_la_salida_de_la_tool_no_promete_vencimiento_ni_aviso():
    for confirmed in (False, True):                       # propuesta y link ya creado
        salida = _salida_de_la_tool(confirmed)
        assert salida                                     # sensor: midió algo, no una cadena vacía
        assert not PROMESA.search(salida), f"la tool promete algo que no existe: {salida}"


def test_la_prohibicion_llega_al_modelo_en_la_descripcion_de_la_tool():
    d = _descripcion_mp_charge().lower()
    assert "no afirmes" in d and "vence" in d and "avisar" in d


def test_la_prohibicion_llega_al_modelo_en_el_prompt_react():
    low = SYSTEM_PROMPT_REACT.lower()
    assert "link de cobro" in low and "no digas cuándo vence" in low and "avisar" in low


def test_la_prohibicion_del_prompt_no_filtra_lenguaje_de_gate():
    """Guarda cruzada con `test_system_prompt_react.py`: el spike 2 midió que contarle el gate al
    modelo rompe el tool-calling. La frase nueva no puede traer esas palabras."""
    low = SYSTEM_PROMPT_REACT.lower()
    for prohibida in ("confirm", "pendiente", "aprob", "botón", "boton"):
        assert prohibida not in low


def test_control_positivo_una_tool_que_promete_vencimiento_se_detecta(monkeypatch):
    """El detector (`PROMESA`) tiene que cazar la promesa en la FORMA en que sale de la tool: un `preview`
    que diga «vence en 7 días» y un `concept` con «te aviso»."""
    original = tool_catalog._run_mp_charge

    def _mentirosa(*a, **kw):
        r = original(*a, **kw)
        r.observation["preview"] = str(r.observation.get("preview", "")) + " (vence en 7 días, te aviso)"
        return r

    monkeypatch.setattr(tool_catalog, "_run_mp_charge", _mentirosa)
    salida = json.dumps(tool_catalog._run_mp_charge(
        "mp_charge", {"amount": 5000, "concept": "x"}, _ctx(), False, "idem-2", lambda: "t", None).observation,
        ensure_ascii=False)
    assert PROMESA.search(salida), "el detector no caza una promesa de vencimiento"
