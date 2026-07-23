"""Hito 5 §1.2 — los primitivos de identidad del grafo. Puro, sin servidor.

El valor de este test son los **golden `uuid5`**: fijan el esquema de identidad al que Graphity
persiste (verificado contra el servidor real en el spike de documed, `RESULT.md` pregunta 1). Si
alguien cambia `STRUCTURED_NS`, el formato del seed o `normalize_key`, el `uuid5` deja de coincidir
con el del servidor —y el fallo es **silencioso**: invalidar/leer/atar apunta a un nodo que no existe
y devuelve vacío, sin error (`ingesta-determinista-grafo.md` §2)—. Acá ese cambio da ROJO, no un
grafo que se re-identifica entero en silencio.
"""
from __future__ import annotations

from graph_identity import STRUCTURED_NS, edge_uuid, node_uuid, normalize_key


def test_namespace_es_el_del_servidor():
    # Este UUID es el que el servidor de Graphity usa como namespace de la ingesta structured. NO es
    # arbitrario: cambiarlo re-identifica TODO el grafo. Fijado como golden a propósito.
    assert str(STRUCTURED_NS) == "2c99bd80-2305-54ac-8016-15cbb922a33b"


def test_node_uuid_golden_y_determinista():
    u = node_uuid("grupo-x", "Negocio", "Panaderia Los Tilos")
    assert u == "88f46882-44d0-5cca-b08f-8a58a144406c"
    # Determinista: mismos inputs → mismo uuid, siempre.
    assert node_uuid("grupo-x", "Negocio", "Panaderia Los Tilos") == u


def test_normalize_key_absorbe_case_y_espacios_antes_del_hash():
    # NFC + casefold + colapso de espacios: tres formas de escribir lo mismo caen al MISMO nodo. Es lo
    # que evita que "Tablero", "  tablero  " y "TABLERO" sean tres conceptos con la serie de precios
    # partida en tres.
    esperado = "ef60b073-1060-5b78-ba43-957384698f36"
    assert node_uuid("grupo-x", "Concepto", "  Tablero   Electrico  ") == esperado
    assert node_uuid("grupo-x", "Concepto", "tablero electrico") == esperado
    assert normalize_key("  ÁÉÍ   Ñ  ") == "áéí ñ"


def test_edge_uuid_golden_y_liga_los_dos_nodos():
    n = node_uuid("grupo-x", "Negocio", "n")
    t = node_uuid("grupo-x", "Cliente", "c")
    assert edge_uuid("grupo-x", n, "FACTURADO_A", t) == "731e13d4-3dc1-5664-9958-6cd3b43cc83b"
    # El tipo de arista es parte de la identidad: dos aristas distintas entre los mismos nodos no
    # colapsan.
    assert edge_uuid("grupo-x", n, "FACTURADO_A", t) != edge_uuid("grupo-x", n, "DIRIGIDO_A", t)


def test_grupo_logico_cambia_la_identidad():
    # El seed lleva el group_id lógico: el mismo negocio en dos tenants NO comparte nodo. Es la primera
    # de las dos barreras de aislamiento que el DoD §6 pide ejercitar (la otra, el group_id físico del
    # servidor, vive en el derivador).
    assert node_uuid("tenant-a", "Negocio", "x") != node_uuid("tenant-b", "Negocio", "x")
