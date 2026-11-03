"""Escala de monotributo de ARCA, versionada (SM-N36).

El `tope` de `GET /contabilidad/resumen` salía `None` a propósito (contrato master §4.3): las escalas se
actualizan por inflación dos veces al año y hardcodearlas es deuda con vencimiento garantizado. Esto paga la
deuda SIN hardcodear: los topes viven en `escala_monotributo.json` (config versionada con `vigencia_desde`),
y este módulo sólo los lee y calcula.

Reglas que NO se negocian (el modo de falla de este módulo no da síntoma: el número sale, se ve bien y es
falso):
  * Escala vencida => `None`, NUNCA el tope viejo. «Vigente» = `vigencia_desde <= hoy <= vigencia_hasta`.
  * Sin categoría, sin escala vigente, o categoría ausente de la escala => `None`. Nunca un default.
  * Un JSON malformado ABORTA al cargar (el deploy lo muestra): degradar callado a «sin escala» escondería
    que la config está rota.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

CATEGORIAS = tuple("ABCDEFGHIJK")
RUTA_POR_DEFECTO = Path(__file__).with_name("escala_monotributo.json")


class EscalaInvalida(ValueError):
    """La config de la escala está rota: se aborta al cargar, no se degrada."""


@dataclass(frozen=True)
class Escala:
    vigencia_desde: date
    vigencia_hasta: date
    fuente: str
    topes: dict[str, Decimal]


@dataclass(frozen=True)
class Umbrales:
    amarillo_pct: Decimal
    rojo_pct: Decimal
    aviso_pct: Decimal


@dataclass(frozen=True)
class ConfigEscala:
    escalas: tuple[Escala, ...]
    umbrales: Umbrales


def categoria_valida(categoria: object) -> bool:
    return isinstance(categoria, str) and categoria in CATEGORIAS


def _fecha(valor: object, campo: str) -> date:
    try:
        return date.fromisoformat(str(valor))
    except ValueError:
        raise EscalaInvalida(f"{campo} no es una fecha ISO: {valor!r}") from None


def _decimal_positivo(valor: object, campo: str) -> Decimal:
    try:
        d = Decimal(str(valor))
    except InvalidOperation:
        raise EscalaInvalida(f"{campo} no es un número: {valor!r}") from None
    if not d.is_finite() or d <= 0:
        raise EscalaInvalida(f"{campo} debe ser > 0: {valor!r}")
    return d


def _parsear_escala(crudo: dict, i: int) -> Escala:
    desde = _fecha(crudo.get("vigencia_desde"), f"escalas[{i}].vigencia_desde")
    hasta = _fecha(crudo.get("vigencia_hasta"), f"escalas[{i}].vigencia_hasta")
    if hasta < desde:
        raise EscalaInvalida(f"escalas[{i}]: vigencia_hasta anterior a vigencia_desde")
    fuente = crudo.get("fuente")
    if not isinstance(fuente, str) or not fuente.strip():
        raise EscalaInvalida(f"escalas[{i}].fuente es obligatoria (URL oficial de ARCA): una escala sin cita no se carga")
    topes_crudos = crudo.get("topes")
    if not isinstance(topes_crudos, dict) or set(topes_crudos) != set(CATEGORIAS):
        raise EscalaInvalida(f"escalas[{i}].topes debe traer exactamente las categorías {''.join(CATEGORIAS)}")
    topes = {c: _decimal_positivo(topes_crudos[c], f"escalas[{i}].topes.{c}") for c in CATEGORIAS}
    orden = [topes[c] for c in CATEGORIAS]
    if orden != sorted(orden) or len(set(orden)) != len(orden):
        raise EscalaInvalida(f"escalas[{i}].topes debe ser estrictamente creciente de A a K")
    return Escala(desde, hasta, fuente.strip(), topes)


def cargar(ruta: Path | str | None = None) -> ConfigEscala:
    """Lee y valida la config. Dos escalas que se solapan en fechas abortan: con solape, «la vigente»
    sería ambigua y el tope dependería del orden del archivo."""
    try:
        crudo = json.loads(Path(ruta or RUTA_POR_DEFECTO).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EscalaInvalida(f"no se pudo leer la escala de monotributo: {exc}") from None
    umb = crudo.get("umbrales") or {}
    umbrales = Umbrales(*(_decimal_positivo(umb.get(k), f"umbrales.{k}")
                          for k in ("amarillo_pct", "rojo_pct", "aviso_pct")))
    if not umbrales.amarillo_pct < umbrales.rojo_pct <= 100:
        raise EscalaInvalida("umbrales: se exige amarillo_pct < rojo_pct <= 100")
    escalas = tuple(_parsear_escala(e, i) for i, e in enumerate(crudo.get("escalas") or []))
    ordenadas = sorted(escalas, key=lambda e: e.vigencia_desde)
    for previa, siguiente in zip(ordenadas, ordenadas[1:]):
        if siguiente.vigencia_desde <= previa.vigencia_hasta:
            raise EscalaInvalida("dos escalas se solapan en fechas: la vigente sería ambigua")
    return ConfigEscala(escalas, umbrales)


def escala_vigente(config: ConfigEscala, hoy: date) -> Escala | None:
    for e in config.escalas:
        if e.vigencia_desde <= hoy <= e.vigencia_hasta:
            return e
    return None


def tope_de(config: ConfigEscala, categoria: str | None, hoy: date) -> Decimal | None:
    """El tope anual de la categoría en la escala VIGENTE HOY, o `None` en cualquier otro caso."""
    if not categoria_valida(categoria):
        return None
    escala = escala_vigente(config, hoy)
    return escala.topes[categoria] if escala else None


def semaforo(config: ConfigEscala, porcentaje: Decimal) -> str:
    if porcentaje >= config.umbrales.rojo_pct:
        return "rojo"
    if porcentaje >= config.umbrales.amarillo_pct:
        return "amarillo"
    return "verde"


def medidor(config: ConfigEscala, categoria: str | None, doce_meses: Decimal, hoy: date) -> dict | None:
    """La forma que consume el front (`TopeMonotributo`: valor/porcentaje/semaforo), o `None`."""
    tope = tope_de(config, categoria, hoy)
    if tope is None:
        return None
    pct = (doce_meses / tope * 100).quantize(Decimal("0.1"))
    return {"valor": f"{tope:.2f}", "porcentaje": float(pct), "semaforo": semaforo(config, pct)}
