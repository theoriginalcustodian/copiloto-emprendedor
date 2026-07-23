"""INTELIGENCIA DE NEGOCIO — el chat (capa CLIENTE, multi-tenant). Contrato: `contrato_..._inteligencia-de-negocio` §3.

**Sólo consulta, nunca ejecuta.** Dos pasos con LLM (`LlmProvider`, el mismo del motor —
`worker_b.py:build_llm()`, `gpt-4o-mini`, ver `hallazgo_..._traverse-no-existe-y-la-decision-de-modelo`):

1. **Planner** — la pregunta en lenguaje natural → qué herramienta de la MISMA capa de queries
   (§0) correr, con qué argumentos. Las 15 preguntas de `docs/ontologia-grafo-negocio-v1.md §9` son
   el catálogo — no se inventan casos nuevos, cada herramienta mapea a una fila de esa tabla.
2. **Redactor** — la pregunta + el resultado crudo de la herramienta → una respuesta en lenguaje
   natural. Si el resultado no alcanza para contestar, dice **«No tengo ese dato.»** y nada más —
   nunca inventa (DoD §5).

**Filtro de vigencia — server-side, DENTRO de acá** (decisión de planificación, supersede el §3
original "del lado del cliente": la app nunca ve el grafo directo, sólo esta capa — una sola verdad).
`/graph/search` no filtra `invalid_at`; `_facts_vigentes` lo hace antes de que el redactor vea nada.

`/graph/traverse` NO EXISTE (spike 2026-07-23, 405) — la navegación multi-hop usa los listados
exhaustivos del graph (`listar_edges_del_graph`) resueltos en memoria, no un traverse real.
"""
from __future__ import annotations

import json
from typing import Callable

from graphity_structured_client import GrafoIngestError, GraphityStructuredClient
from inteligencia_queries import InteligenciaQueries

# Las 15 preguntas de §9, con la herramienta que cada una dispara. Es el catálogo del planner — no
# una lista de ejemplos: el DoD (§5) exige contestar al menos 10/15 con el número correcto.
_CATALOGO = """\
Herramientas SQL disponibles (números exactos, todas de `inteligencia_queries`):
- portada: caja del mes, entró/salió/rentabilidad/facturado/cobrado, mejores clientes, por cobrar.
  Sirve para: "¿cuánto me queda?", "¿quién me debe?" (aproximado, vía por_cobrar), "¿quiénes son mis
  mejores clientes?".
- facturacion_por_mes: serie de 6 meses de lo facturado.
- entro_vs_salio: serie de 6 meses de entró/salió (los 3 orígenes: factura, dictado, MercadoPago).
  Sirve para: "¿cuánto entró en efectivo este mes?", "¿gasté más que el mes anterior?".
- torta_categorias(mes): en qué se gastó por categoría en un mes.
- margen_por_trabajo: cuánto dejó cada trabajo (cobrado−gastado), separando los sin ingreso registrado.
  Sirve para: "¿cuánto me dejó este trabajo?", "¿qué tipo de trabajo me deja más?".

Herramienta de grafo (relaciones, para qué/quién/cómo se relaciona/qué cambió — NO para sumas):
- buscar_grafo(query): búsqueda semántica sobre hechos del negocio (precios históricos, qué se le
  vendió a un cliente, si un proveedor subió precios, presupuestos aceptados/rechazados).
  Sirve para: "¿cuánto cobraba antes por esto?", "¿este proveedor me subió los precios?", "¿qué le
  vendí a este cliente la última vez?".

Si NINGUNA herramienta puede contestar la pregunta (dato que el sistema no registra — ej. "¿cuántos
presupuestos mandé y cuántos me aceptaron?", que hoy no tiene esa distinción), fuente="no-se" y no
llames ninguna herramienta."""

# 🔴 DoD §5 ("el chat rechaza una orden y redirige al copiloto") — NO es un caso más para el redactor
# improvisar: `es_orden` es un campo aparte que el planner completa SIEMPRE, y ante `true` el código
# corta ACÁ, determinístico, sin pasar por el redactor. Un LLM que a veces "decide bien" redirigir no
# es un rechazo verificable; un campo booleano con mensaje fijo, sí.
_SYSTEM_PLANNER = f"""Sos el router del chat de Inteligencia de Negocio de un copiloto para \
emprendedores argentinos. Tu ÚNICO trabajo es elegir qué herramienta correr para responder la \
pregunta del usuario — NO respondés la pregunta vos, y **NUNCA ejecutás ni proponés ejecutar nada**.

{_CATALOGO}

🔴 Si la pregunta es una ORDEN o pide EJECUTAR/CAMBIAR/BORRAR/CREAR/MARCAR/COBRAR/FACTURAR algo (en vez
de sólo consultar información ya existente) — ej. "borrá la factura 12", "marcá este presupuesto como
aceptado", "cobrale a Juan 5000" — es `es_orden: true`, `herramienta: null`, `fuente: "no-se"`. Este
chat SÓLO LEE; toda acción se redirige al copiloto conversacional, nunca se ejecuta desde acá.

Devolvé SOLO un JSON: {{"herramienta": "<nombre o null>", "args": {{}}, "fuente": "sql"|"grafo"|"no-se",
"es_orden": true|false}}. `args` para torta_categorias puede llevar {{"mes": "YYYY-MM"}} (opcional);
para buscar_grafo lleva {{"query": "<texto de búsqueda>"}}. Las demás herramientas no llevan args."""

_MSG_ORDEN = "Eso lo puedo ejecutar, pero no desde acá — pedímelo por el chat del copiloto."
_MSG_NO_SE = "No tengo ese dato."

_SYSTEM_REDACTOR = """Sos el redactor del chat de Inteligencia de Negocio. Recibís la pregunta del \
usuario y datos JSON ya calculados por el sistema. Componé una respuesta corta en español, natural, \
con los números TAL COMO VIENEN en los datos (no los recalcules, no inventes decimales).

REGLA DURA: si los datos no alcanzan para responder la pregunta con precisión, respondé EXACTAMENTE \
"No tengo ese dato." y nada más — nunca inventes un número que no esté en los datos."""

HERRAMIENTAS_SQL = frozenset({
    "portada", "facturacion_por_mes", "entro_vs_salio", "torta_categorias", "margen_por_trabajo"})


def group_id_negocio(cliente_id: str) -> str:
    """El graph lógico de negocio de UN tenant — un graph POR emprendedor, nunca compartido (regla 7:
    aislamiento multitenant real). 🔴 Hoy nada escribe acá para un tenant real (sólo existe el dataset
    sintético del hito 5, en `copiloto-negocio`, cargado a mano) — `buscar_grafo` sobre esta convención
    da `[]` para todo tenant real hasta que exista la ingesta automática (deuda visible, ver
    `hallazgo_..._traverse-no-existe-y-la-decision-de-modelo`). El chat degrada correcto igual: "No
    tengo ese dato.", no un error."""
    return f"negocio-{cliente_id}"


def _facts_vigentes(edges: list[dict]) -> list[str]:
    """Filtra `invalid_at is not None` (la vigencia que `/graph/search` no filtra sola, trampa 6) y
    devuelve sólo los `fact` en texto — es lo único que el redactor necesita ver del grafo."""
    return [e["fact"] for e in edges
            if isinstance(e, dict) and e.get("invalid_at") is None and e.get("fact")]


class InteligenciaChat:
    def __init__(self, *, queries: InteligenciaQueries, llm, grafo_client: GraphityStructuredClient,
                 graph_id: str) -> None:
        self._queries = queries
        self._llm = llm
        self._grafo = grafo_client
        self._graph_id = graph_id

    def _ejecutar_herramienta(self, herramienta: str, args: dict) -> dict | list | None:
        if herramienta in HERRAMIENTAS_SQL:
            fn: Callable = getattr(self._queries, herramienta)
            if herramienta == "torta_categorias":
                return fn(args.get("mes"))
            return fn()
        if herramienta == "buscar_grafo":
            query = (args.get("query") or "").strip()
            if not query:
                return None
            # `search()` semántico alcanza para v1: el `fact_template` de cada arista (grafo_mapeo.py)
            # ya interpola el hecho completo en texto ("Tablero eléctrico costaba $X desde el Y"), así
            # que el redactor no necesita navegación estructurada multi-hop para las 3 preguntas de
            # grafo de §9 (5/11/12) — el texto YA trae la relación resuelta.
            #
            # TODO(backend, deuda gestionada — condición de pago: cuando aparezca una pregunta que el
            # top-10 semántico no alcance a cubrir, o el grafo crezca lo bastante para que `search` deje
            # de encontrar el fact relevante en el top-K): cambiar a `listar_edges_del_graph` + filtro/
            # navegación en memoria (el mecanismo que reemplaza a `/traverse`, ya en
            # `graphity_structured_client.py`). Aprobado así por planificación, 2026-07-23 02:04.
            resultado = self._grafo.search(query, group_ids=[self._graph_id], scope="edges", limit=10)
            return {"hechos": _facts_vigentes(resultado.get("edges") or [])}
        return None

    def responder(self, pregunta: str) -> dict:
        """`{respuesta, fuente}`. Nunca lanza por una falla del LLM/grafo — degrada a "no tengo ese
        dato" (best-effort: un chat de sólo-lectura no puede tumbar la pantalla). Una ORDEN se corta
        ANTES de tocar cualquier herramienta — nunca llega a ejecutar nada (DoD §5)."""
        pregunta = (pregunta or "").strip()
        if not pregunta:
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}

        try:
            plan = self._llm.complete(_SYSTEM_PLANNER, pregunta, json_mode=True)
        except Exception:
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}
        parsed = plan.get("parsed") or {}

        if parsed.get("es_orden"):
            return {"respuesta": _MSG_ORDEN, "fuente": "no-se"}

        herramienta = parsed.get("herramienta")
        fuente = parsed.get("fuente") if parsed.get("fuente") in ("sql", "grafo", "no-se") else "no-se"
        if not herramienta or fuente == "no-se":
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}

        try:
            datos = self._ejecutar_herramienta(herramienta, parsed.get("args") or {})
        except GrafoIngestError:
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}
        if datos is None:
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}

        try:
            redaccion = self._llm.complete(
                _SYSTEM_REDACTOR,
                f"Pregunta: {pregunta}\n\nDatos: {json.dumps(datos, ensure_ascii=False)}",
                json_mode=False)
        except Exception:
            return {"respuesta": _MSG_NO_SE, "fuente": "no-se"}
        respuesta = (redaccion.get("raw") or "").strip() or _MSG_NO_SE
        return {"respuesta": respuesta, "fuente": fuente}
