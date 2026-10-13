"""datos_card — la card «datos del negocio» (preg-datos, C-D5 del contrato 2026-10-13).

«¿Cuánto entró este mes?», «¿quién me debe?»: la respuesta al emprendedor era TEXTO plano, y la app no
tiene nada que pintar más que una burbuja. Esto arma la card de lectura que la acompaña:

    artifact = {kind: "datos_negocio",
                data: {titulo, cifras:[{k, v}], chip, nota}}

**De dónde sale cada número:** de `InteligenciaQueries` —la MISMA capa que las pantallas de Inteligencia
(§0 del contrato de IN: un número, un camino)— y pasa TAL CUAL: acá no se suma, no se resta, no se
compara, no se atribuye nada. Un builder que recalcula es un segundo camino al mismo número.

**Sin side effects, sin gate:** es lectura pura. No hay `confirmed`, no hay propuesta.

**Qué NO hace (a propósito):** no responde «cuántos volvieron a comprar» ni ninguna atribución causal —eso
es `preg-promo`, BACKLOG/MAYOR—, y no expone `margen_por_trabajo` (su forma `sin_ingreso` pide una decisión
de presentación que no es de este corte).

`v` viaja YA FORMATEADO (plata argentina, `$1.234,56`): el backend arma el texto de negocio y la app lo
pinta, igual que `titulo`/`detalle` de `/actividad`. El número crudo no se pierde: nace del mismo dict que
la pantalla de Inteligencia, no se re-deriva del texto.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Callable

from inteligencia_queries import DIAS_VENCIDO

MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre")
_MES_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")

KIND = "datos_negocio"

NOTA_MP_CAIDO = ("Mercado Pago está desconectado: lo que entró puede estar incompleto. "
                 "Reconectalo para ver el número real.")
NOTA_RANKING = "Ranking por lo cobrado. Los cobros de Mercado Pago no se atribuyen a un cliente."
NOTA_FACTURADO = "Sólo facturas con CAE; las notas de crédito restan."


def plata(monto: str) -> str:
    """`"123456.00"` → `"$123.456,00"`. Miles con punto y decimales con coma, que es como se escribe
    la plata acá — y como el LLM la va a leer en voz alta."""
    entero, _, decimales = str(monto).partition(".")
    negativo = entero.startswith("-")
    miles = f"{int(entero.lstrip('-') or 0):,}".replace(",", ".")
    return f"{'-' if negativo else ''}${miles},{(decimales or '00')[:2]:0<2}"


def _mes_legible(clave: str) -> str:
    """`"2026-10"` → `"octubre 2026"`."""
    anio, mes = clave.split("-")
    return f"{MESES[int(mes) - 1]} {anio}"


def _fecha_legible(iso: str) -> str:
    """`"2026-10-13"` → `"13 de octubre"`."""
    _, mes, dia = iso.split("-")
    return f"{int(dia)} de {MESES[int(mes) - 1]}"


def _card(titulo: str, cifras: list[tuple[str, str]], *, chip: str | None = None,
          nota: str | None = None) -> dict:
    return {"titulo": titulo, "cifras": [{"k": k, "v": v} for k, v in cifras], "chip": chip, "nota": nota}


# ── un builder por consulta: (queries, args) -> card ─────────────────────────────────────────────────

def _portada(q, _args: dict) -> dict:
    p = q.portada()
    mes, caja = p["mes"], p["caja"]
    return _card(
        "Este mes",
        [("Entró", plata(mes["ingresos"])), ("Salió", plata(mes["gastos"])),
         ("Queda", plata(caja["saldo"])), ("Facturado", plata(mes["facturado"])),
         ("Cobrado", plata(mes["cobrado"]))],
        chip=f"Al {_fecha_legible(caja['fecha_corte'])}",
        nota=NOTA_MP_CAIDO if caja.get("incompleta") else None)


def _por_cobrar(q, _args: dict) -> dict:
    d = q.por_cobrar()
    return _card("Lo que te deben",
                 [("Total", plata(d["total"])), ("Vencido", plata(d["vencido"]))],
                 nota=f"«Vencido» es lo emitido hace más de {DIAS_VENCIDO} días y todavía impago.")


def _mejores_clientes(q, _args: dict) -> dict:
    # La portada ya trae el ranking: no hay un segundo método público que lo calcule por separado.
    ranking = q.portada()["mejores_clientes"]
    return _card("Tus mejores clientes",
                 [(c["cliente"], plata(c["total"])) for c in ranking], nota=NOTA_RANKING)


def _facturacion_por_mes(q, _args: dict) -> dict:
    serie = q.facturacion_por_mes(6)["serie"]
    return _card("Facturado por mes",
                 [(_mes_legible(m["mes"]),
                   f"{plata(m['total'])} · {m['cantidad']} comprobante{'s' if m['cantidad'] != 1 else ''}")
                  for m in serie],
                 chip="Últimos 6 meses", nota=NOTA_FACTURADO)


def _entro_vs_salio(q, _args: dict) -> dict:
    serie = q.entro_vs_salio(6)["serie"]
    return _card("Entró y salió por mes",
                 [(_mes_legible(m["mes"]), f"Entró {plata(m['entro'])} · Salió {plata(m['salio'])}")
                  for m in serie],
                 chip="Últimos 6 meses")


def _torta_categorias(q, args: dict) -> dict:
    mes = args.get("mes")
    # Un mes que no tiene forma `YYYY-MM` se IGNORA (mes en curso): el `chip` dice cuál se mostró, así
    # que el emprendedor nunca lee un período distinto al que aparece escrito.
    mes = mes if isinstance(mes, str) and _MES_RE.match(mes) else None
    d = q.torta_categorias(mes)
    con_gasto = sorted(((s["categoria"], s["total"]) for s in d["serie"] if Decimal(s["total"]) > 0),
                       key=lambda t: Decimal(t[1]), reverse=True)
    return _card("En qué gastaste", [(cat, plata(total)) for cat, total in con_gasto],
                 chip=_mes_legible(d["periodo"]))


# consulta → (builder, cuándo usarla). El `cuándo` es lo que lee el LLM para ELEGIR: vive acá, al lado del
# builder, para que enum y descripción no puedan divergir (una sola tabla).
_CONSULTAS: dict[str, tuple[Callable[[object, dict], dict], str]] = {
    "portada": (_portada,
                "cuánto entró, salió, quedó, facturó o cobró ESTE MES"),
    "por_cobrar": (_por_cobrar,
                   "cuánta plata le deben, qué tiene impago o vencido"),
    "mejores_clientes": (_mejores_clientes,
                         "quiénes son sus mejores clientes / a quién le cobró más"),
    "facturacion_por_mes": (_facturacion_por_mes,
                            "cuánto facturó mes a mes, cómo viene la facturación"),
    "entro_vs_salio": (_entro_vs_salio,
                       "si entró más de lo que salió, o cómo viene la plata mes a mes"),
    "torta_categorias": (_torta_categorias,
                         "en qué gastó, qué categoría pesa más (acepta `mes` YYYY-MM; sin mes, el actual)"),
}

CONSULTAS = tuple(_CONSULTAS)


def cuando_usar() -> str:
    """El texto de la `description` del schema: una línea por consulta, de la MISMA tabla que el enum."""
    return "; ".join(f"`{k}`: {cuando}" for k, (_, cuando) in _CONSULTAS.items())


def datos_de(consulta: str, queries, args: dict | None = None) -> dict | None:
    """`{titulo, cifras, chip, nota}` de la consulta, o `None` si no existe (el executor lo informa)."""
    entrada = _CONSULTAS.get(consulta)
    return entrada[0](queries, args or {}) if entrada else None


def texto_para_el_llm(card: dict) -> str:
    """Lo que ve el modelo: los MISMOS números de la card, en texto. Sale de la card —no de una segunda
    lectura de la base— para que lo que dice y lo que se pinta no puedan diferir."""
    cifras = "; ".join(f"{c['k']}: {c['v']}" for c in card["cifras"])
    chip = f" ({card['chip']})" if card.get("chip") else ""
    nota = f" Nota: {card['nota']}" if card.get("nota") else ""
    return (f"{card['titulo']}{chip} — {cifras}.{nota} Se lo muestro en una tarjeta: decí en UNA frase lo "
            f"principal, con los números TAL COMO VIENEN. No los recalcules, no los compares con períodos "
            f"que no están acá y no expliques causas.")
