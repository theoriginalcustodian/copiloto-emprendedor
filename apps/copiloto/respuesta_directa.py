"""Respuesta directa por CÓDIGO para las consultas de datos (2026-11-06, orden del operador).

En `consultar_negocio` y `consultar_cliente` la 2ª llamada al LLM sólo reescribía en una frase los números
que la tool ya trajo: ~1,3 s por turno y la única oportunidad de que un número salga distinto del que se
consultó. Acá la frase la arma el código con los MISMOS valores de la card / la ficha.

Cómo se activa: `COPILOTO_RESPUESTA_DIRECTA=1` en el env del worker. Sin la variable (o `0`) el camino es
el de siempre —el LLM redacta—, byte a byte: la tool ni siquiera agrega el campo. Volver atrás = borrar la
variable y reiniciar el worker.

Cuándo NO contesta el código aunque esté activo (devuelve None y redacta el LLM):
- la pregunta es de CAUSA («¿por qué bajaron…?»): ahí hace falta aclarar qué no se puede saber;
- la pregunta pide además A QUIÉN y la consulta no es un ranking de clientes (pregunta doble);
- la pregunta nombra un tema (presupuestos, facturas, cobros) que la frase armada no menciona;
- en el turno ya corrió más de una tool (el modelo está encadenando: que termine él);
- la tool no dejó `respuesta_directa` (error, otra tool, flag apagado cuando corrió).
"""
from __future__ import annotations

import json
import os
import re

from datos_card import MESES, plata_corta

CAMPO = "respuesta_directa"
TOOLS_DIRECTAS = ("consultar_negocio", "consultar_cliente")
_CAUSA = re.compile(r"\bpor\s*qu[eé]\b|\bporqu[eé]\b|\ba\s+qu[eé]\s+se\s+debe\b|\bc[oó]mo\s+es\s+que\b", re.I)
_QUIEN = re.compile(r"\bqui[eé]n(es)?\b", re.I)


def activa(env=os.environ) -> bool:
    return (env.get("COPILOTO_RESPUESTA_DIRECTA") or "").strip() == "1"


# ── el hook del motor: (messages) -> texto | None ─────────────────────────────────────────────────────

def elegir(messages: list[dict]) -> str | None:
    """Hook `respuesta_directa` del dominio. `messages` = scratchpad ReAct; el último es el resultado de la
    tool. Devuelve el texto final del turno, o None para que redacte el LLM."""
    if not activa() or not messages or messages[-1].get("role") != "tool":
        return None
    ultimo_user = max((i for i, m in enumerate(messages) if m.get("role") == "user"), default=None)
    if ultimo_user is None:
        return None
    llamadas = [tc for m in messages[ultimo_user + 1:] if m.get("role") == "assistant"
                for tc in (m.get("tool_calls") or [])]
    if len(llamadas) != 1:
        return None
    fn = llamadas[0].get("function") or {}
    if fn.get("name") not in TOOLS_DIRECTAS:
        return None
    pregunta = str(messages[ultimo_user].get("content") or "")
    if _CAUSA.search(pregunta):
        return None
    try:
        args = json.loads(fn.get("arguments") or "{}")
    except (ValueError, TypeError):  # args ilegibles: se decide sin ellos (el caso conservador lo cubre `_QUIEN`)
        args = {}
    if (fn.get("name") == "consultar_negocio" and args.get("consulta") != "mejores_clientes"
            and _QUIEN.search(pregunta)):
        return None
    try:
        obs = json.loads(messages[-1].get("content") or "{}")
    except (ValueError, TypeError):  # observation no-JSON: no hay frase armada, redacta el LLM como siempre
        return None
    texto = obs.get(CAMPO) if isinstance(obs, dict) else None
    if not (isinstance(texto, str) and texto.strip()):
        return None
    if _omite_lo_preguntado(pregunta, texto):
        return None
    return texto


# Lo que la pregunta nombra y la frase armada tiene que mencionar para contestarla. La frase omite lo que
# está en cero (no dice «0 presupuestos»): si justo eso se preguntó, contestar la ficha genérica es no
# contestar (eval SM-P21 2026-11-07: «¿cuántos presupuestos tiene ClienteJ4?» → facturas y cobros).
_TEMAS = (
    (re.compile(r"presupuest", re.I), re.compile(r"presupuest", re.I)),
    (re.compile(r"\bfactur", re.I), re.compile(r"factur", re.I)),
    (re.compile(r"\bcobr", re.I), re.compile(r"cobr|deben|vencid", re.I)),  # «sin cobrar» = lo que te deben
)


def _omite_lo_preguntado(pregunta: str, texto: str) -> bool:
    return any(p.search(pregunta) and not t.search(texto) for p, t in _TEMAS)


# ── redacción: consultar_negocio ──────────────────────────────────────────────────────────────────────

def _mes_de(clave: str | None) -> str | None:
    """`"2026-10"` → `"octubre 2026"` (la clave que usa la card), o None si no tiene forma de mes."""
    m = re.match(r"^(\d{4})-(0[1-9]|1[0-2])$", clave or "")
    return f"{MESES[int(m.group(2)) - 1]} {m.group(1)}" if m else None


def _con_de(mes_card: str) -> str:
    """`"octubre 2026"` → `"octubre de 2026"`, como se dice."""
    nombre, _, anio = mes_card.partition(" ")
    return f"{nombre} de {anio}" if anio else mes_card


def _lista(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " y " + items[-1]


def _cifras(card: dict) -> dict[str, str]:
    return {c["k"]: c["v"] for c in card.get("cifras") or []}


def _sin_centavos(texto: str) -> str:
    """`$1.234,00` → `$1.234` dentro de un texto ya formateado (la card trae plata con centavos)."""
    return re.sub(r"(\$[\d.]+),00\b", r"\1", texto)


def _es_cero(v: str) -> bool:
    return re.fullmatch(r"-?\$0(,00)?", v.strip()) is not None


def _partes_mes(valor: str) -> dict[str, str]:
    """`"Entró $1,00 · Salió $2,00"` → `{"Entró": "$1,00", "Salió": "$2,00"}`."""
    out = {}
    for parte in valor.split("·"):
        k, _, v = parte.strip().partition(" ")
        out[k] = v.strip()
    return out


def frase_negocio(consulta: str, card: dict, args: dict) -> str | None:
    """La frase del turno para la card `card` de `consulta`. Sale de la card —no de otra lectura— para que lo
    que se dice y lo que se pinta no puedan diferir. None = no sé redactarla: que lo haga el LLM."""
    c = _cifras(card)
    nota = f" {card['nota']}" if card.get("nota") and consulta == "portada" else ""
    if consulta == "portada":
        chip = (card.get("chip") or "").replace("Al ", "al ")
        return _sin_centavos(
            f"Este mes ({chip}) entraron {c['Entró']} y salieron {c['Salió']}; te quedan {c['Queda']}. "
            f"Facturaste {c['Facturado']} y cobraste {c['Cobrado']}.{nota}")
    if consulta == "por_cobrar":
        vencido = ("y no hay nada vencido" if _es_cero(c["Vencido"])
                   else f"de eso, {c['Vencido']} está vencido")
        return _sin_centavos(f"Te deben {c['Total']} en total, {vencido}.")
    if consulta == "mejores_clientes":
        top = [f"{k} ({v})" for k, v in list(c.items())[:3]]
        return _sin_centavos(f"Tus mejores clientes por lo que te cobraron: {_lista(top)}. "
                             f"Los cobros de Mercado Pago no se atribuyen a un cliente.")
    if consulta in ("entro_vs_salio", "facturacion_por_mes"):
        mes = _mes_de(args.get("mes"))
        if mes is not None:
            if mes not in c:
                return f"No tengo {_con_de(mes)} en lo que muestro: la tarjeta cubre los últimos 6 meses."
            if consulta == "entro_vs_salio":
                p = _partes_mes(c[mes])
                return _sin_centavos(f"En {_con_de(mes)} entraron {p['Entró']} y salieron {p['Salió']}.")
            monto, _, cant = c[mes].partition(" · ")
            return _sin_centavos(f"En {_con_de(mes)} facturaste {monto} ({cant}).")
        if consulta == "entro_vs_salio":
            ultimo = list(c)[-1]
            p = _partes_mes(c[ultimo])
            return _sin_centavos(f"En {_con_de(ultimo)} entraron {p['Entró']} y salieron {p['Salió']}. "
                                 f"En la tarjeta tenés los últimos 6 meses.")
        con = [(k, v.partition(" · ")[0]) for k, v in c.items()]
        con_algo = [f"{v} en {k.split(' ')[0]}" for k, v in con if not _es_cero(v)]
        if not con_algo:
            return "En los últimos 6 meses no facturaste nada."
        resto = "" if len(con_algo) == len(con) else "; en el resto de los meses, nada"
        return _sin_centavos(f"En los últimos 6 meses facturaste {_lista(con_algo)}{resto}.")
    if consulta == "torta_categorias":
        total = c.get("Total gastado")
        cats = [(k, v) for k, v in c.items() if k != "Total gastado"]
        if total is None or not cats:
            return None
        periodo = _con_de(card.get("chip") or "el mes")
        top = f"Lo que más pesa es {cats[0][0]} ({cats[0][1]})"
        if len(cats) > 1:
            top += f", seguido de {cats[1][0]} ({cats[1][1]})"
        return _sin_centavos(f"En {periodo} gastaste {total} en total. {top}.")
    return None


def frase_sin_datos(card: dict) -> str:
    return f"Todavía no tengo nada registrado para «{card['titulo']}»."


# ── redacción: consultar_cliente ──────────────────────────────────────────────────────────────────────

def _n(cant: int, singular: str, plural: str) -> str:
    return f"{cant} {singular if cant == 1 else plural}"


def frase_cliente(ficha: dict, resumen: dict) -> str:
    nombre = ficha["nombre"]
    partes = []
    if resumen["facturas_atribuibles"]:
        nc = (f", con {_n(resumen['notas_credito'], 'nota de crédito ya descontada', 'notas de crédito ya descontadas')}"
              if resumen["notas_credito"] else "")
        partes.append(f"le facturaste {plata_corta(resumen['facturado'])} en "
                      f"{_n(resumen['facturas'], 'factura', 'facturas')}{nc}")
    if resumen.get("cobros"):
        partes.append(f"le cobraste {plata_corta(resumen['cobrado'])} en "
                      f"{_n(resumen['cobros'], 'cobro', 'cobros')}")
    if resumen["presupuestos"]:
        partes.append(f"tiene {_n(resumen['presupuestos'], 'presupuesto', 'presupuestos')} por "
                      f"{plata_corta(resumen['presupuestado'])}")
    texto = (f"Con {nombre}: {_lista(partes)}." if partes
             else f"Con {nombre} no tengo cobros ni presupuestos registrados.")
    if not resumen["facturas_atribuibles"]:
        texto += (" De facturas no puedo decirte nada: no tiene CUIT o DNI cargado y las facturas se atan "
                  "por documento. Si me lo pasás, lo cargo.")
    ops = resumen.get("operaciones") or []
    if ops:
        ult = "; ".join(f"{_fecha_corta(o['fecha'])}, {o['detalle']} por {plata_corta(o['monto'])}"
                        for o in ops[:3])
        texto += f" Lo último: {ult}."
    return texto


def _fecha_corta(iso: str) -> str:
    try:
        anio, mes, dia = str(iso)[:10].split("-")
        return f"{int(dia)} de {MESES[int(mes) - 1]}"
    except (ValueError, IndexError):  # fecha con otro formato: se muestra tal cual, mejor que perderla
        return str(iso)


def frase_cliente_no_encontrado(nombre: str) -> str:
    return (f"No encontré ningún cliente que se llame «{nombre}». Puede que todavía no esté cargado o que "
            f"figure con otro nombre: ¿cómo lo tenés anotado?")


def frase_cliente_varios(nombre: str, nombres: list[str], hay_mas: bool) -> str:
    cola = " (y hay más)" if hay_mas else ""
    return (f"Encontré varios que coinciden con «{nombre}»: {_lista([f'«{n}»' for n in nombres])}{cola}. "
            f"¿A cuál te referís?")
