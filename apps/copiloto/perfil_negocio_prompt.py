"""Traduce el perfil del negocio + el soul a un bloque de texto para el system prompt.

Capa PURA (sin DB, sin FastAPI, sin Temporal): entra un dict, sale un string. Testeable aislado.

## Dónde se inyecta y por qué importa el orden

Viaja por `system_extra`, el canal por turno que ya usa la memoria
(`motor/backend/agent/agent_activities.py`). **Este bloque va ANTES del Context Block de memoria.**

No es estética: el perfil es ESTABLE (cambia una vez por mes) y la memoria VARÍA en cada turno. Con lo
estable primero, el prefijo del prompt se mantiene cacheable; al revés se invalida el cache en cada
turno. El motor ya trata esto como una preocupación de primer orden — el docstring de `_react_recall`
dice que el recall corre 1×/turno "para preservar el prefijo de prompt-cache". Con el LLM en ~95% del
COGS, el orden de dos strings es plata.

## Por qué se lee por turno y NO se cachea

La sesión del copiloto es PERMANENTE (continue-as-new), y tanto `config` como `self._state` sobreviven
al CAN. Cualquier cosa que se lea una vez y se guarde ahí queda congelada **para siempre**: el usuario
cambiaría su perfil en Ajustes y el copiloto seguiría usando el viejo, sin error y sin log. Por eso el
perfil se carga con una activity por turno, igual que el recall.
"""
from __future__ import annotations

_A_QUIEN_TEXTO = {
    "empresas": "Le vende principalmente a empresas.",
    "consumidor_final": "Le vende principalmente a consumidores finales.",
    "ambos": "Le vende tanto a empresas como a consumidores finales.",
}
_FORMALIDAD_TEXTO = {
    "formal": "Escribí en un registro formal y profesional, sin modismos.",
    "cercano": "Escribí en un registro cercano y cotidiano, sin ser informal de más.",
}
_LARGO_TEXTO = {
    "breve": "Respondé corto: lo justo para resolver, sin rodeos.",
    "detallado": "Podés extenderte y explicar el detalle cuando aporte.",
}

# K-15: una respuesta de EJEMPLO por cada combinación tono × largo, que la app muestra mientras se elige
# («Cómo hablarle»). Vive JUNTO a las dos tablas de arriba a propósito: quien cambie una instrucción de
# registro o de largo tiene el ejemplo en la misma pantalla. `tests/test_perfil_negocio_ejemplo.py`
# falla si una combinación queda sin ejemplo (o sobra una) y arma el prompt real de cada combinación.
_EJEMPLO_TEXTO = {
    ("cercano", "breve"): "Dale, ya te dejo el presupuesto listo — lo revisás y me decís.",
    ("cercano", "detallado"): ("Dale, ya armé el presupuesto: son 3 ítems por $45.000 en total, con el IVA "
                               "incluido. Si querés cambiar algo, decime y lo ajusto antes de mandárselo."),
    ("formal", "breve"): "El presupuesto está listo para su revisión. Avíseme si desea modificar algo.",
    ("formal", "detallado"): ("He preparado el presupuesto con los tres ítems solicitados, por un total de "
                              "$45.000 con IVA incluido. Quedo a disposición para ajustar cualquier detalle "
                              "antes de enviarlo al cliente."),
}


def ejemplo_de_tono(formalidad: str, largo_respuesta: str) -> str | None:
    """La respuesta de ejemplo de esa combinación, o `None` si alguno de los dos valores no es válido
    (el endpoint lo traduce a 400). Pura: sin DB ni estado."""
    return _EJEMPLO_TEXTO.get((formalidad, largo_respuesta))


def bloque_de_contexto(perfil: dict | None) -> str:
    """El bloque a anteponer al system prompt. `""` si no hay perfil.

    Devolver cadena vacía —y no un texto genérico tipo "el usuario no configuró su negocio"— es
    deliberado: un tenant sin perfil tiene que comportarse EXACTAMENTE como antes de que este frente
    existiera. Un bloque de relleno cambiaría el prompt de todos los que nunca entraron a Ajustes, que
    hoy son todos, y es justo lo que el A/B tiene que poder aislar.
    """
    if not perfil:
        return ""
    lineas: list[str] = []

    negocio: list[str] = []
    if perfil.get("nombre_comercial"):
        negocio.append(f"El emprendimiento se llama «{perfil['nombre_comercial']}».")
    if perfil.get("que_vende"):
        negocio.append(f"A qué se dedica: {perfil['que_vende']}")
    if perfil.get("a_quien") in _A_QUIEN_TEXTO:
        negocio.append(_A_QUIEN_TEXTO[perfil["a_quien"]])
    if perfil.get("horario_atencion"):
        negocio.append(f"Horario de atención: {perfil['horario_atencion']}. "
                       "No propongas turnos ni reuniones fuera de ese horario.")
    if negocio:
        lineas.append("SOBRE EL NEGOCIO DEL USUARIO:")
        lineas.extend(f"- {n}" for n in negocio)

    estilo: list[str] = []
    if perfil.get("nombre_copiloto"):
        estilo.append(f"Te llamás {perfil['nombre_copiloto']}. Si te preguntan tu nombre, decilo.")
    if perfil.get("formalidad") in _FORMALIDAD_TEXTO:
        estilo.append(_FORMALIDAD_TEXTO[perfil["formalidad"]])
    if perfil.get("largo_respuesta") in _LARGO_TEXTO:
        estilo.append(_LARGO_TEXTO[perfil["largo_respuesta"]])
    if estilo:
        if lineas:
            lineas.append("")
        lineas.append("CÓMO HABLAR:")
        lineas.extend(f"- {e}" for e in estilo)

    return "\n".join(lineas)


# La COMPOSICIÓN (perfil + memoria, en ese orden) NO vive acá: vive en el motor
# (`backend.agent.agent_activities.componer_system_extra`), que es quien arma el system prompt. Este
# módulo sólo produce el bloque. Tener una copia local del compositor habría dejado un test verde
# sobre una función que producción no usa.
