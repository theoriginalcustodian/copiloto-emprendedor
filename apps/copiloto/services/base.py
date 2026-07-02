"""Contrato del patrón 'módulo de servicio' plug-in del Copiloto (capa CLIENTE).

Cada servicio Composio (gmail, googlesheets, ...) vive en `services/<svc>.py` y expone:
  TOOLKIT: str                                  # slug del toolkit Composio (ej 'gmail')
  POLICY: ToolkitPolicy                         # allowlist MÍNIMA (defensa tool-overload nivel 1)
  PROMPT_FRAGMENT: str                          # instrucciones para el LLM (qué ops emitir)
  build(op, entities, *, now_iso) -> Proposal | Read | None

El core (dispatcher_emprendedor) hace el confirm-gate + ejecuta contra el ComposioGateway; el módulo SOLO
arma el call. Agregar un servicio = agregar UN archivo acá (discovery automático en __init__). Cero edición
central → fan-out sin colisión + gating por toolkit. `nombre de archivo` = nombre de servicio que emite el LLM.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass
class Proposal:
    """Acción de ESCRITURA: se propone (HITL, botón Confirmar) y el core la ejecuta con confirmed=True."""
    slug: str
    arguments: dict
    reply_text: str                    # "Voy a enviar un mail a X. ¿Confirmás?"
    ok_text: str = "Listo ✅"          # texto al confirmar con éxito ("Listo, lo envié ✅")
    then: dict | None = None           # tool de 2 pasos: {slug, id_key, id_arg, arguments} — ver dispatcher _execute_pending
    resolve: dict | None = None        # pre-paso: {slug(read), arguments, path, into} — resuelve un valor (ej nombre
    #                                    real de la hoja) ANTES del write y lo inyecta en arguments[into]. Simétrico a `then`.


@dataclass
class Read:
    """Acción de LECTURA: sin efecto → el core la ejecuta directo (confirmed=False) y resume la respuesta."""
    slug: str
    arguments: dict
    summarize: Callable[[dict], str]   # (respuesta Composio) -> texto para el usuario
