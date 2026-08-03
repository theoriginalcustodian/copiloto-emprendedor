"""`construir_gasto_desde_foto` — traduce la lectura cruda del OCR (`vision.OpenAIVisionOCR`) al
`data` de la card `gasto_propuesto` que consume `packages/core/src/chat/gastoPropuesto.ts`.

🔴 El `monto` SIEMPRE viaja vacío acá — nunca se pre-carga desde el OCR. Es la decisión dura del spike
`spikes/ocr-tickets/RESULT.md` §3: `legible` se midió `true` en TODAS las alucinaciones, así que ningún
campo del modelo es señal suficiente para auto-confirmar un monto. Lo que el modelo leyó viaja aparte
en `monto_sugerido`, que la card ofrece como sugerencia TOCABLE, nunca como valor ya cargado."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from gasto_store import CATEGORIAS, LIMITES, dos_decimales, hoy_del_negocio


def _fecha_leida(valor, *, ahora=None) -> str:
    """`fecha` de la card: la que leyó el OCR si es una fecha ISO válida, si no, hoy del negocio.
    A diferencia de `_fecha_dictada` (voz), acá no hay lenguaje natural que resolver — el prompt le
    pide al modelo YYYY-MM-DD directo; sólo hay que blindarse de que mienta el formato."""
    if isinstance(valor, str) and valor.strip():
        try:
            from datetime import date
            date.fromisoformat(valor.strip())
            return valor.strip()
        except ValueError:
            pass          # el modelo mintió el formato -> cae al default de abajo, no es un fallo real
    return hoy_del_negocio(ahora).isoformat()


def _monto_leido(valor) -> str | None:
    """`monto_sugerido`: el número que leyó el modelo, formateado a 2 decimales — o `None` si no leyó
    nada / leyó basura. Nunca lanza: un monto ilegible no puede tumbar el endpoint."""
    if valor is None:
        return None
    try:
        Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        return None       # el modelo leyó basura donde iba el monto -> None, no un 500 del endpoint
    return dos_decimales(valor)


def _texto(valor, limite: int | None = None) -> str | None:
    if not isinstance(valor, str):
        return None
    v = valor.strip()
    if not v:
        return None
    return v[:limite] if limite else v


def construir_gasto_desde_foto(extraido: dict, *, ahora=None) -> dict:
    """`extraido` = el dict crudo de `OpenAIVisionOCR.leer_ticket` (monto/evidencia_monto/fecha/
    proveedor/categoria/legible, cualquiera puede faltar o venir sucio). Devuelve el `data` de
    `Artifact(kind='gasto_propuesto')` — mismas claves que la voz (`_run_registrar_gasto`), con
    `monto` vacío + `monto_sugerido` poblado y `origen='foto'`."""
    categoria = str(extraido.get("categoria") or "").strip().lower()
    if categoria not in CATEGORIAS:
        categoria = "otros"          # el modelo inventó/no supo un rubro: cae en otros, no falla
    return {
        "monto": "",                 # 🔴 nunca se pre-carga — ver docstring del módulo
        "monto_sugerido": _monto_leido(extraido.get("monto")),
        "fecha": _fecha_leida(extraido.get("fecha"), ahora=ahora),
        "categoria": categoria,
        "proveedor": _texto(extraido.get("proveedor"), LIMITES["proveedor"]),
        "medio_pago": None,          # una foto de ticket no dice el medio de pago; nunca se infiere
        "descripcion": _texto(extraido.get("evidencia_monto"), LIMITES["descripcion"]),
        "origen": "foto",
    }
