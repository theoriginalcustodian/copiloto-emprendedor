"""Las activities de `AutosanacionWorkflow` — todo lo que toca el mundo real.

El workflow no puede leer env, ni consultar la base, ni llamar al LLM, ni tocar el filesystem sin
romper el replay. Todo eso vive acá.

---

## Lo que el banco C0 midió, y lo que producción va a pedir (NO son lo mismo)

Esto hay que tenerlo escrito porque es la diferencia entre una medición y una promesa.

El banco midió al forjador reparando **un bug que rompe tests**: se quita `& 0xFFFFFFFF` de
`fingerprint.py`, la suite se pone roja, el modelo la pone verde. Ahí el gate puede afirmar algo
fuerte —*el parche ARREGLA el bug*— porque hay un test que antes fallaba y ahora pasa.

Un trauma de producción **no se parece a eso**. Es un `KeyError` con un dato que nadie contempló, a
las tres de la mañana, en un camino que **ningún test ejercita** — si lo ejercitara, el CI lo habría
cazado antes del deploy. No hay test rojo que poner verde.

Entonces el gate de tests, acá, sólo puede afirmar lo segundo: **que el parche no rompe nada de lo
que ya funcionaba**. Es no-regresión, no demostración de arreglo. Confundir las dos sería vender el
12/12 del banco como si aplicara a producción, y no aplica.

Por eso el diseño no cambia pero su lectura sí:

- el ciclo **propone**, y el PR lo revisa una persona — que es exactamente lo que Zero-Mutation ya
  exigía, sólo que ahora se entiende *por qué* no es una formalidad;
- el `no_romper` que viaja al forjador es lo que hace de contrapeso: sin test del bug, la única
  defensa contra un parche que "arregla" rompiendo otra cosa es la suite completa;
- y el gate por categoría (`CATEGORIAS_REPARABLES`) recorta la superficie a `business_error`, que es
  donde un parche de código tiene sentido. Un timeout no se repara: se reintenta.

## Y desde el 2026-08-01 el gate SÍ puede afirmar "arregla" — cuando hay test

Lo que acá arriba figuraba como deuda pendiente está construido. El forjador produce, junto al
parche, **un test que reproduce el bug**, y el gate lo corre **dos veces**: sin el parche (donde
debe FALLAR) y con el parche (donde debe PASAR). Eso —y sólo eso— convierte *no rompió nada* en
*arregló el bug*.

Lo detonó un caso real: el PR #179, primer PR que el ciclo abrió solo, pasó CI 5/5 con un parche
**semánticamente equivalente al original**. Un no-op no rompe nada, así que la no-regresión lo
aprueba con honores. El riesgo estaba escrito acá desde el principio; el #179 lo hizo medible.

**Los cinco desenlaces, y por qué son cinco y no dos** (`sandbox_tests`): `arreglo_demostrado` ·
`parche_no_arregla` (el ÚNICO que rechaza) · `test_no_reproduce` · `test_invalido` ·
`sin_test_de_reproduccion`. Las tres últimas son fallas del **instrumento**, no del parche, y no
pueden tumbarlo: si un forjador flojo escribiendo tests pudiera rechazar parches buenos, el ciclo se
apagaría por la puerta de atrás — y un mecanismo que falla hacia el "no" no da síntoma
([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]). Cuando no hay demostración, el ciclo **igual
propone**, pero el PR, el commit y el artefacto lo dicen en la primera línea.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

from temporalio import activity

from autosanacion_gates import puede_reparar
from auditor_parches import auditar as _auditar
from auditor_parches import verificar_auditor
from forjador_parches import aplicar_bloques, extraer_test, prompt_de_forja
from sandbox_tests import (SIN_TEST, TIMEOUT_TEST_REPRO, correr_suite, evaluar,
                           evaluar_reproduccion, nombre_de_test_de_reproduccion, preparar_copia)
from trauma_store import PENDIENTE, TABLA, TraumaStore

#: `warning` y no `info`, por la misma razón que `log_estructurado`: sin `basicConfig`, el
#: `lastResort` de logging sólo emite `warning+` a stderr, y en el unit del worker eso es journald.
#: Un aviso en `.info` no llega — es un log que no existe.
_log = logging.getLogger("copiloto")

#: La conexión del ciclo. **NO es la del worker.** Va con el rol `copiloto_autosanacion`
#: (`BYPASSRLS`, con permisos sobre una sola tabla: la DLQ), porque desde 2026-08-01 el ciclo es UNO
#: para toda la app y tiene que ver los traumas de todos los tenants para agruparlos por bug.
#: El nombre lleva el `_dlq` a propósito: pasarle acá la `conn_factory` de tenant del worker no
#: rompe nada visible — devuelve lo de un solo tenant y el agrupado por bug queda mudo.
_conn_dlq = None
_llm_client = None
#: Raíz del repo desplegado. Se inyecta para no derivarla del `__file__` de este módulo: el sandbox
#: copia el árbol a otro lado y el path tiene que seguir siendo el del repo, no el de la copia.
_raiz_repo: Path | None = None


def set_autosanacion_deps(conn_dlq, llm_client=None, raiz_repo=None) -> None:  # noqa: ANN001
    """Inyecta las dependencias. SYNC, se llama en el composition root del worker.

    `conn_dlq` **no es la `conn_factory` del worker**: es la del rol `copiloto_autosanacion`
    (`BYPASSRLS`), la única que ve la DLQ entera. Ver `deploy/copiloto/provision-rol-autosanacion.sh`.

    `llm_client` opcional: un worker sin LLM cableado sigue arrancando y el ciclo se apaga solo con
    un motivo legible, en vez de reventar en la mitad. Es el mismo criterio que el resto de las
    activities de este repo para las dependencias que pueden faltar.
    """
    global _conn_dlq, _llm_client, _raiz_repo
    _conn_dlq = conn_dlq
    _llm_client = llm_client
    _raiz_repo = Path(raiz_repo) if raiz_repo else Path(__file__).resolve().parents[2]


def _store() -> TraumaStore:
    """El store de la DLQ **sin tenant**: el ciclo trabaja sobre toda la app, no sobre un cliente."""
    return TraumaStore(_conn_dlq)


def _cerrar(conn) -> None:  # noqa: ANN001
    """Cierra la conexión sin que un fallo al cerrar tape el resultado real.

    Degradar acá es correcto y es el caso (c) del censo de `except`: esto corre en el `finally`, o
    sea **después** de que la operación ya terminó (bien o mal). Un error al cerrar —la conexión ya
    se cayó, el socket murió— no cambia nada de lo que pasó antes, y dejarlo propagar reemplazaría
    el resultado verdadero (o el error verdadero) por uno de limpieza que no le sirve a nadie.

    Un solo lugar en vez de repetir el `try/except/pass` en cada activity: así el criterio se lee
    una vez y no hay que confiar en que cada llamador lo repita igual.
    """
    if conn is None:
        return
    try:
        conn.close()
    except Exception:  # noqa: BLE001 — ver docstring: falla de limpieza post-operación
        pass


def _serializable(fila: dict) -> dict:
    """Temporal serializa el payload a JSON: los `datetime` de psycopg2 no pasan.

    Se convierten acá y no en el workflow porque el workflow no puede tocar tipos que dependan del
    driver — y porque un `TypeError` de serialización aparecería recién al cerrar la activity, con
    el trauma ya en `en_proceso` y sin nadie que lo suelte.
    """
    return {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in fila.items()}


def _contexto_de(trauma: dict) -> dict:
    """El `contexto` del trauma como dict, siempre. `{}` si no se puede leer.

    Un solo lugar: `_origen_de` y el gate lo necesitan igual, y tenerlo duplicado significaba dos
    `except` haciendo lo mismo — que es como se desincronizan (uno se arregla, el otro no).

    Que un `contexto` ilegible degrade a `{}` es correcto (caso (c) del censo): un trauma viejo o
    con un jsonb corrupto no es reparable, y el gate lo rechaza por falta de `origen`. Propagar
    convertiría un dato malo de UNA fila en la caída del ciclo entero para ese tenant.
    """
    contexto = trauma.get("contexto") or {}
    if isinstance(contexto, str):
        try:
            contexto = json.loads(contexto)
        except (ValueError, TypeError):
            # Caso (c) del censo: un jsonb corrupto o de otra época degrada a `{}` y el gate rechaza
            # el trauma por falta de `origen`. Propagar tumbaría el ciclo del tenant por UNA fila.
            return {}
    return contexto if isinstance(contexto, dict) else {}


def _origen_de(trauma: dict) -> dict | None:
    """El `{archivo, linea, funcion}` que dejó la costura, o `None`.

    El `contexto` viene de un `jsonb`: psycopg2 lo devuelve ya deserializado, pero un trauma viejo
    —depositado antes de que existiera `origen_en_el_codigo`— simplemente no lo trae. Ese caso no es
    un error: es un trauma que no se puede reparar, y se rechaza en el gate con ese motivo.
    """
    origen = _contexto_de(trauma).get("origen")
    return origen if isinstance(origen, dict) and origen.get("archivo") else None


# ======================================================================================
# 1 — tomar
# ======================================================================================
@activity.defn
async def tomar_trauma_para_reparar() -> dict | None:
    """Toma UN trauma pendiente **de toda la app** y lo deja `en_proceso`. `None` si no hay.

    Sin argumento: desde 2026-08-01 el ciclo no es de nadie en particular. Antes recibía un
    `cliente_id` y el aislamiento lo ponía RLS; hoy elige **un bug distinto**, no una ocurrencia
    (`tomar_un_bug_distinto`), porque el índice único de la DLQ es `(cliente_id, fingerprint)` y un
    solo defecto que pega en N tenants deja N filas idénticas salvo el dueño. Sin agrupar, el ciclo
    propondría N veces el mismo PR.

    Uno y no un lote: cada ejecución del workflow repara como mucho uno, así que tomar más los
    dejaría `en_proceso` sin que nadie los trabaje — colgados hasta que `rescatar_colgados` los
    devuelva media hora después.

    El `cliente_id` sigue viajando en el dict, pero ahora sale de **la fila** (`tomar_un_bug_distinto`
    lo devuelve entre sus columnas) en vez de inyectarlo el llamador desde su propio argumento. Es
    el mismo dato con una fuente honesta: el dueño de la ocurrencia que se está reparando.
    """
    tomado = _store().tomar_un_bug_distinto()
    if not tomado:
        return None
    return _serializable(tomado)


# ======================================================================================
# 2 — gates
# ======================================================================================
def _reparaciones_de_hoy() -> int:
    """Cuántas reparaciones se propusieron hoy **en toda la app**. Ante un fallo devuelve el tope, no
    cero: si la cuenta no se puede hacer, lo seguro es frenar, no seguir de largo.

    Global y no por tenant, por la misma razón que el ciclo (2026-08-01): el tope existe para acotar
    cuántos PRs le caen encima al humano que los revisa, y ese humano es uno solo. Un tope de 5 por
    tenant con 5.000 tenants no es un tope: es 25.000 PRs con nombre de límite.
    """
    conn = None
    try:
        conn = _conn_dlq()
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM {TABLA} "
                        f"WHERE estado = 'reparacion_propuesta' AND updated_at::date = %s",
                        (date.today(),))
            return int(cur.fetchone()[0])
    except Exception as exc:  # noqa: BLE001
        # Degradar al tope es lo seguro, pero degradar EN SILENCIO no: el ciclo se apagaría solo con
        # el motivo "tope diario alcanzado (5/5)" y nadie sabría que en realidad la query nunca
        # corrió. Ya pasó en el primer E2E de este módulo y costó una vuelta entera de diagnóstico
        # sobre el gate equivocado.
        from autosanacion_gates import tope_diario
        _log.warning(json.dumps({"evento": "autosanacion_conteo_fallido",
                                 "error_type": type(exc).__name__,
                                 "efecto": "se asume el tope alcanzado y el ciclo NO repara"},
                                ensure_ascii=False))
        return tope_diario()
    finally:
        _cerrar(conn)


@activity.defn
async def evaluar_gates_de_reparacion(trauma: dict) -> dict:
    """Los gates, en orden de costo. Devuelve `{permitido, motivo, archivo}`.

    Es activity y no lógica del workflow porque `puede_reparar` lee `os.environ` en **cada** decisión
    —el kill switch tiene que surtir efecto sin reiniciar el worker— y leer env dentro de un workflow
    rompe el determinismo del replay.
    """
    origen = _origen_de(trauma)
    if not origen:
        # Antes que cualquier otro gate: sin archivo no hay nada que reparar, y el rechazo cuesta
        # cero. Es el caso de todo trauma depositado antes de que las costuras guardaran el origen.
        return {"permitido": False, "archivo": None,
                "motivo": "el trauma no registró archivo:línea — no es reparable, sólo contable"}

    contexto = _contexto_de(trauma)

    decision = puede_reparar(
        # La ruta que se chequea es el ARCHIVO real, no el nombre del workflow: `dominio_prohibido`
        # compara por substring y un workflow puede llamarse cualquier cosa mientras el código que
        # falló vive en `afip_gateway.py`. Chequear el rótulo en vez del código sería confiar en el
        # nombre, que es justo como se cuela un permiso que no debía darse.
        ruta=origen["archivo"],
        reparaciones_hoy=_reparaciones_de_hoy(),
        categoria=contexto.get("categoria"))
    return {"permitido": decision.permitido, "motivo": decision.motivo,
            "archivo": origen["archivo"]}


# ======================================================================================
# 3 — forjar
# ======================================================================================
def _evidencia_del_fallo(trauma: dict, origen: dict) -> str:
    """El contexto del fallo, en el lugar donde el banco pone la salida de pytest.

    No hay salida de pytest para un trauma de producción (ver el docstring del módulo). Lo que sí
    hay es dónde, qué tipo y cuántas veces — y el "cuántas veces" no es decorativo: un error con
    `dedupe_count` alto es sistemático, no una casualidad de un dato raro.

    **Lo que NO va acá:** el mensaje de la excepción. No se guardó nunca, a propósito (PII, datos
    fiscales), y el forjador tiene que arreglárselas con la ubicación y el tipo. Es menos contexto
    del que tenía en el banco, y por eso el gate de no-regresión y la revisión humana del PR pesan
    más, no menos.
    """
    return (f"El error ocurrió EN PRODUCCIÓN. No hay salida de pytest: ningún test ejercita este "
            f"camino (si lo hiciera, el CI lo habría cazado antes del deploy).\n\n"
            f"  tipo de error : {trauma.get('error_type')}\n"
            f"  archivo       : {origen['archivo']}\n"
            f"  línea         : {origen.get('linea')}\n"
            f"  función       : {origen.get('funcion')}\n"
            f"  operación     : {trauma.get('workflow')}\n"
            f"  veces         : {trauma.get('dedupe_count')} "
            f"({'sistemático' if (trauma.get('dedupe_count') or 0) > 1 else 'una sola vez'})\n\n"
            f"El mensaje de la excepción NO está disponible (se excluye por PII). Repará la causa "
            f"que ese tipo de error implica en esa línea.")


@activity.defn
async def forjar_parche(trauma: dict) -> dict:
    """Pide el parche y lo aplica en memoria. Devuelve `{aplicado, motivo, contenido, parche, archivo}`.

    Aplicar acá y no en el workflow: `aplicar_bloques` necesita el archivo real del disco, y el
    resultado —si el fragmento citado no existe o es ambiguo— es información que el reintento usa.
    """
    if _llm_client is None:
        return {"aplicado": False, "motivo": "no hay cliente LLM cableado en el worker"}

    origen = _origen_de(trauma)
    if not origen:
        return {"aplicado": False, "motivo": "el trauma no registró archivo:línea"}

    ruta = (_raiz_repo / origen["archivo"]) if _raiz_repo else Path(origen["archivo"])
    try:
        contenido = ruta.read_text(encoding="utf-8")
    except OSError as exc:
        # El archivo puede haberse renombrado o borrado entre el fallo y la reparación. No es un
        # error del ciclo: es un trauma que ya no aplica.
        return {"aplicado": False, "motivo": f"no se pudo leer {origen['archivo']}: {exc}"}

    no_romper = (f"la firma pública de {origen.get('funcion') or 'las funciones'} en "
                 f"{origen['archivo']}, y cualquier comportamiento que los tests ya verifican")
    prompt = prompt_de_forja(archivo=origen["archivo"], contenido=contenido,
                             salida_pytest=_evidencia_del_fallo(trauma, origen),
                             no_romper=no_romper)
    respuesta = _llm_client.chat.completions.create(
        model=os.environ.get("COPILOTO_FORJADOR_MODELO", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}], temperature=0)
    texto = respuesta.choices[0].message.content or ""

    aplicacion = aplicar_bloques(texto, contenido)
    return {"aplicado": aplicacion.ok, "motivo": aplicacion.detalle,
            "contenido": aplicacion.contenido if aplicacion.ok else "",
            "parche": texto, "archivo": origen["archivo"], "no_romper": no_romper,
            # El test de reproducción viaja junto al parche. Puede ser `None`: el prompt pide
            # explícitamente NO inventar uno si no se puede escribir un test que falle hoy, y esa
            # abstención es información honesta — no un fallo del forjador.
            "test_reproduccion": extraer_test(texto)}


# ======================================================================================
# 4 — auditar
# ======================================================================================
@activity.defn
async def auditar_parche(payload: dict) -> dict:
    """Auditor adversarial. Devuelve `{aprobado, motivo}`.

    **Antes de auditar, se audita al auditor.** `verificar_auditor` le pasa tres parches rotos
    conocidos: si aprueba alguno, el ciclo se apaga en vez de confiar en un juez que dejó de juzgar.
    Un auditor degradado no da síntoma —sigue contestando, sólo que aprueba todo— y su falla se
    manifestaría recién como un parche malo mergeado.
    """
    if _llm_client is None:
        return {"aprobado": False, "motivo": "no hay cliente LLM cableado en el worker"}

    sano, fallos = verificar_auditor(_llm_client)
    if not sano:
        return {"aprobado": False,
                "motivo": f"el AUDITOR está degradado: aprobó parches que debía rechazar ({fallos}). "
                          f"No se audita nada hasta que esto se resuelva"}

    trauma, forja = payload["trauma"], payload["forja"]
    contexto = (f"archivo {forja.get('archivo')}; error {trauma.get('error_type')} en "
                f"{trauma.get('workflow')}; no romper: {forja.get('no_romper', '')}")
    #: La MISMA evidencia que recibió el forjador. Sin esto el auditor juzgaba *"¿arregla la causa?"*
    #: sin conocerla, y rechazaba reparaciones correctas cuya forma es reponer lógica borrada — medido
    #: contra el caso del MRO: 3 intentos, 3 rechazos al parche bueno. Ver `auditor_parches.auditar`.
    evidencia = _evidencia_del_fallo(trauma, _origen_de(trauma) or {})
    veredicto = _auditar(_llm_client, forja.get("parche", ""), contexto, evidencia=evidencia)
    return {"aprobado": bool(getattr(veredicto, "aprobado", False)),
            "motivo": getattr(veredicto, "motivo", "")}


# ======================================================================================
# 5 — el gate de tests
# ======================================================================================
@activity.defn
async def probar_parche_en_sandbox(payload: dict) -> dict:
    """Baseline y parcheado, los dos en una copia. Devuelve `{aceptado, motivo, regresiones}`.

    Tres reglas que el gate hace cumplir y conviene no perder de vista:

    1. pytest corre como **subproceso**, nunca `pytest.main()` — el evaluador no puede vivir en el
       proceso del evaluado (METR/HackRouter);
    2. **sin baseline verde no hay veredicto**: si la suite ya estaba roja, el resultado es
       NO_EVALUABLE, no "rechazado". Culpar al parche de una rotura previa manda a corregir lo que
       no está mal;
    3. verde con **menos** tests que el baseline se rechaza: borrar el test que molesta pone la
       suite verde y no arregla nada.

    Y desde el 2026-08-01 contesta **dos** preguntas, no una:

    - **¿arregla?** — el test de reproducción corrido sin el parche (debe fallar) y con él (debe
      pasar). Es lo único que distingue un arreglo de un no-op; la suite verde no puede.
    - **¿rompe?** — la no-regresión de siempre, con las tres reglas de arriba.

    El orden importa: la reproducción va **primero**, porque necesita el árbol todavía sin parchear.
    """
    forja = payload["forja"]
    if not forja.get("aplicado"):
        return {"aceptado": False, "motivo": "no hay parche que probar", "regresiones": []}

    with tempfile.TemporaryDirectory() as td:
        copia = preparar_copia(_raiz_repo, Path(td) / "sandbox")
        #: `sys.executable` y NO `"python3"`. Medido en el primer E2E real (2026-08-01): el worker
        #: corre bajo systemd con `PATH=/usr/local/sbin:…:/usr/bin` —sin el venv—, así que `python3`
        #: resolvía a `/usr/bin/python3`, que **no tiene pytest**. El gate arrancaba, moría con
        #: `No module named pytest`, no dejaba ninguna línea de conteo, y `evaluar` lo leía como
        #: "la suite ya estaba roja" → `NO_EVALUABLE`. Es decir: **el gate de no-regresión nunca
        #: corrió un solo test en producción**, y no dio síntoma porque falla hacia RECHAZAR.
        #: El intérprete del propio proceso es el correcto por construcción y no puede driftear con
        #: el `PATH`; la env var queda como override explícito.
        python = os.environ.get("COPILOTO_SANDBOX_PYTHON") or sys.executable

        baseline = correr_suite(copia, python=python)
        destino = copia / "apps" / "copiloto" / Path(forja["archivo"]).name
        if not destino.exists():
            # El parche apunta a un archivo que la copia no tiene (p. ej. vive en `motor/`). Se
            # busca por la ruta relativa completa antes de rendirse.
            destino = copia / forja["archivo"]
        if not destino.exists():
            return {"aceptado": False, "regresiones": [],
                    "motivo": f"{forja['archivo']} no está en el sandbox: no se puede probar"}

        # --- ¿ARREGLA? (antes de preguntar si rompe) -------------------------------------------
        # Se corre PRIMERO porque es la pregunta que la suite no puede contestar, y porque necesita
        # el árbol SIN el parche: una vez escrito el archivo parcheado ya no se puede volver atrás
        # sin rehacer la copia.
        repro = _probar_reproduccion(copia, python, forja, payload.get("trauma") or {},
                                     contenido_original=destino.read_text(encoding="utf-8"),
                                     destino=destino)

        destino.write_text(forja["contenido"], encoding="utf-8")

        parcheado = correr_suite(copia, python=python)
        veredicto = evaluar(baseline, parcheado)

        # El rechazo por "no arregla" manda sobre el de no-regresión: un parche que no arregla nada
        # no mejora por no romper nada.
        aceptado = veredicto.aceptado and not repro["rechaza"]
        motivo = veredicto.motivo if aceptado or not repro["rechaza"] else repro["motivo"]
        return {"aceptado": aceptado, "motivo": motivo,
                "regresiones": list(veredicto.regresiones),
                "arreglo_demostrado": repro["demostrado"],
                "reproduccion": repro}


def _probar_reproduccion(copia: Path, python: str, forja: dict, trauma: dict, *,
                         contenido_original: str, destino: Path) -> dict:
    """Corre el test de reproducción SIN el parche y CON el parche. Devuelve el dict de `Reproduccion`.

    Deja la copia como la encontró (restaura el archivo original) para que la corrida de
    no-regresión que viene después no herede el parche de acá.
    """
    contenido_test = forja.get("test_reproduccion")
    if not contenido_test:
        return {"estado": SIN_TEST, "motivo": "el forjador no produjo test de reproducción: el "
                                              "gate sólo puede afirmar no-regresión",
                "demostrado": False, "rechaza": False}

    # El NOMBRE lo pone el ciclo, nunca el modelo: un path elegido por un LLM puede salirse del
    # árbol o pisar un test existente, y este archivo termina commiteado en un repo real.
    ruta_rel = f"tests/{nombre_de_test_de_reproduccion(trauma)}"
    archivo_test = copia / "apps" / "copiloto" / ruta_rel
    archivo_test.write_text(contenido_test, encoding="utf-8")
    try:
        sin_parche = correr_suite(copia, python=python, args=(ruta_rel, "-q", "-ra"),
                                  timeout=TIMEOUT_TEST_REPRO)
        destino.write_text(forja["contenido"], encoding="utf-8")
        con_parche = correr_suite(copia, python=python, args=(ruta_rel, "-q", "-ra"),
                                  timeout=TIMEOUT_TEST_REPRO)
    finally:
        destino.write_text(contenido_original, encoding="utf-8")   # la copia queda como estaba

    dictamen = evaluar_reproduccion(sin_parche, con_parche)
    _log.info(json.dumps({"evento": "autosanacion_reproduccion",
                          "estado": dictamen.estado, "demostrado": dictamen.demostrado,
                          "archivo_test": ruta_rel}, ensure_ascii=False))
    return {"estado": dictamen.estado, "motivo": dictamen.motivo,
            "demostrado": dictamen.demostrado, "rechaza": dictamen.rechaza,
            "archivo_test": ruta_rel}


# ======================================================================================
# 6 — proponer (NUNCA mergear)
# ======================================================================================
@activity.defn
async def proponer_pr_de_reparacion(payload: dict) -> dict:
    """Deja el parche donde un humano pueda revisarlo. Devuelve `{url, modo}`.

    **Zero-Mutation:** propone y nunca mergea. Y no miente con el PR — si el parche no cambió nada,
    no se abre nada: un PR vacío que dice "reparé X" es peor que no reparar, porque le enseña al
    revisor a aprobar sin mirar.

    Si `gh` no está disponible (el VPS del worker no necesariamente tiene credenciales de GitHub, y
    dárselas para esto sería ampliarle el alcance a un proceso automático), el parche se guarda como
    **artefacto** y se devuelve su ruta. Degradar así es deliberado: lo importante es que la
    propuesta quede registrada y revisable, no el canal por el que llega.
    """
    forja, trauma = payload["forja"], payload["trauma"]
    ruta = (_raiz_repo / forja["archivo"]) if _raiz_repo else Path(forja["archivo"])
    try:
        actual = ruta.read_text(encoding="utf-8")
    except OSError as exc:
        # No se puede comparar => no se puede DEMOSTRAR que hubo mutación, y Zero-Mutation exige
        # demostrarlo, no suponerlo. La versión anterior degradaba a `actual = ""`, que era peor que
        # inútil: con el archivo ilegible, `"" != contenido` daba verdadero y el ciclo proponía un PR
        # sobre un archivo que ni siquiera pudo abrir.
        _log.warning(json.dumps({"evento": "autosanacion_no_se_pudo_leer_el_destino",
                                 "archivo": forja.get("archivo"),
                                 "error_type": type(exc).__name__,
                                 "efecto": "no se propone nada"}, ensure_ascii=False))
        return {"url": "", "modo": "sin_cambios",
                "motivo": f"no se pudo leer {forja.get('archivo')}: sin poder comparar, no se "
                          f"puede afirmar que el parche cambie algo"}
    if actual == forja.get("contenido"):
        return {"url": "", "modo": "sin_cambios",
                "motivo": "el parche no produjo mutaciones; no se abre nada"}

    prueba = payload.get("prueba") or {}
    artefactos = Path(os.environ.get("COPILOTO_AUTOSANACION_ARTEFACTOS", "/tmp/autosanacion"))
    artefactos.mkdir(parents=True, exist_ok=True)
    destino = artefactos / f"trauma-{trauma.get('id')}-{trauma.get('fingerprint')}.patch"
    destino.write_text(
        f"# trauma {trauma.get('id')} · {trauma.get('error_type')} en {forja['archivo']}\n"
        f"# operación: {trauma.get('workflow')} · veces: {trauma.get('dedupe_count')}\n"
        f"# {_leyenda_de_evidencia(prueba)}\n\n{forja.get('parche', '')}\n",
        encoding="utf-8")

    # DOS condiciones, no una: `gh` autenticado NO alcanza. Hace falta además un repo de trabajo
    # declarado y distinto del desplegado — si no, el ciclo ramificaría sobre producción.
    repo_pr = _repo_para_pr()
    if repo_pr is None or not _hay_gh():
        return {"url": destino.as_posix(), "modo": "artefacto"}
    return _abrir_pr(repo_pr, destino, forja, trauma, prueba)


def _leyenda_de_evidencia(prueba: dict) -> str:
    """La línea que le dice al revisor QUÉ quedó probado. Nunca la misma para los dos casos.

    Es el arreglo del problema que dejó pasar el PR #179: un parche no-op con la suite verde se lee
    idéntico a uno correcto si el veredicto no distingue *arregla* de *no rompe*.
    """
    if prueba.get("arreglo_demostrado"):
        return ("✅ ARREGLO DEMOSTRADO: hay un test que FALLA sin este parche y PASA con él, y va "
                "incluido. El gate corrió las dos veces.")
    motivo = (prueba.get("reproduccion") or {}).get("motivo", "no hay test de reproducción")
    return (f"⚠️ ARREGLO **NO** DEMOSTRADO — el gate sólo verificó NO-REGRESIÓN ({motivo}). "
            f"Que la suite esté verde no dice que esto arregle nada: revisá el cambio, no el "
            f"veredicto.")


#: Repo de trabajo donde el ciclo puede crear ramas. **Tiene que ser distinto del repo desplegado.**
#: Sin esta variable NO se abre ningún PR: se deja el artefacto y listo.
ENV_REPO_GIT = "COPILOTO_AUTOSANACION_REPO_GIT"

#: Etiqueta de los PRs que abre el ciclo. Se aplica best-effort después de crear el PR (ver
#: `_abrir_pr`), y la crea el provisionado del clon de trabajo.
ETIQUETA_PR = os.environ.get("COPILOTO_AUTOSANACION_ETIQUETA_PR", "autosanacion")


def _repo_para_pr() -> Path | None:
    """El clon donde se puede ramificar, o `None` si no hay uno declarado y seguro.

    **Por qué existe, y por qué el default es `None`** (hallazgo del 2026-07-31, antes de correr el
    primer E2E real): el VPS del worker **tiene `gh` autenticado** —se verificó con `gh auth
    status`— y la versión anterior de `_abrir_pr` corría `git checkout -b` sobre `_raiz_repo`, que
    es **el repo del que corre el servicio vivo**. Un proceso automático creándole ramas al código
    en producción es exactamente lo que Zero-Mutation existe para impedir.

    Hoy no explotaba por un accidente: `/opt/uc-repos/copiloto` no es un repo git, así que el
    `checkout` fallaba y el ciclo degradaba a artefacto. Depender de eso es depender de que nadie
    cambie la forma de desplegar — la misma clase de "zafa por accidente" que este repo ya
    documentó ([[la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control]]).

    Ahora el camino peligroso es **imposible por construcción**: hace falta declarar un repo
    distinto del desplegado, y si coincide se rechaza.
    """
    declarado = os.environ.get(ENV_REPO_GIT, "").strip()
    if not declarado:
        return None
    ruta = Path(declarado)
    if _raiz_repo and ruta.resolve() == Path(_raiz_repo).resolve():
        _log.warning(json.dumps({"evento": "autosanacion_repo_pr_es_el_desplegado",
                                 "efecto": "NO se abre PR; el ciclo jamás rama sobre producción"}))
        return None
    if not (ruta / ".git").exists():
        return None
    return ruta


def _hay_gh() -> bool:
    try:
        return subprocess.run(["gh", "auth", "status"], capture_output=True,
                              timeout=15).returncode == 0
    except (OSError, subprocess.SubprocessError):
        # `gh` no instalado, sin PATH, o sin credenciales. Los tres significan lo mismo para el
        # llamador —no hay canal de PR— y ninguno es un error: el ciclo degrada a artefacto, que es
        # un camino previsto y no una falla. Loguear acá gritaría en el caso NORMAL de un worker
        # que deliberadamente no tiene credenciales de GitHub.
        return False


def _abrir_pr(repo: Path, artefacto: Path, forja: dict, trauma: dict, prueba: dict | None = None) -> dict:
    """Abre el PR con `gh`. Ante cualquier fallo degrada al artefacto en vez de lanzar: perder la
    propuesta por un problema de red sería el peor resultado posible del ciclo entero.

    ## Este camino NUNCA había funcionado (2026-08-01)

    Faltaban dos pasos, y un tercer defecto tapaba a los dos:

    1. **Nadie escribía el archivo parcheado en el clon.** Se hacía `git add <archivo>` sobre un
       clon prístino: no quedaba nada staged, `git commit` salía con error y el `except` degradaba a
       artefacto. El contenido reparado vivía en `forja["contenido"]` y no se copiaba a ningún lado.
    2. **Faltaba `git push` de la rama.** `gh pr create --head <rama>` necesita que exista en el
       remoto; sin eso tampoco habría abierto nada.
    3. **El `except` se comía el motivo.** Con `capture_output=True` + `check=True` el `stderr` real
       queda dentro del `CalledProcessError`, y `f"{exc}"` sólo dice *"Command … returned non-zero
       exit status 1"*. El diagnóstico verdadero —*"nothing to commit"*— no se imprimió nunca.

    **Y no dio síntoma porque el camino jamás se ejercitó**: `COPILOTO_AUTOSANACION_REPO_GIT` no
    estaba seteada en producción, así que el ciclo salía por el artefacto **antes** de llegar acá.
    Un camino muerto no se rompe: espera. Es la forma de
    `memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`, con el agravante de que acá el
    degradado es un desenlace **legítimo** — ni siquiera se veía raro.
    """
    prueba = prueba or {}
    demostrado = bool(prueba.get("arreglo_demostrado"))
    rama = f"autosanacion/trauma-{trauma.get('id')}"
    cuerpo = (f"Reparación **propuesta automáticamente** para el trauma `{trauma.get('id')}`.\n\n"
              f"- error: `{trauma.get('error_type')}` en `{forja['archivo']}`\n"
              f"- operación: `{trauma.get('workflow')}` · ocurrencias: {trauma.get('dedupe_count')}\n\n"
              f"{_leyenda_de_evidencia(prueba)}\n")

    def _git(*args: str, timeout: int = 30) -> subprocess.CompletedProcess:
        return subprocess.run(["git", "-C", str(repo), *args],
                              capture_output=True, text=True, timeout=timeout, check=True)

    try:
        # Base limpia. El clon es sólo del ciclo, así que descartar es seguro — y necesario: si un
        # intento anterior se cayó a mitad, el árbol arrastra su parche y el PR nuevo lo incluiría.
        _git("checkout", "--force", "main")
        _git("fetch", "--quiet", "origin", "main", timeout=60)
        _git("reset", "--hard", "--quiet", "origin/main")
        # `-B`, no `-b`: un reintento sobre el mismo trauma reusa la rama en vez de morir con
        # "already exists" — que es un fallo de reintento disfrazado de fallo de reparación.
        _git("checkout", "-B", rama)

        # EL PASO QUE FALTABA. Sin esto no hay diff, y sin diff no hay commit ni PR.
        destino_en_repo = repo / forja["archivo"]
        destino_en_repo.parent.mkdir(parents=True, exist_ok=True)
        destino_en_repo.write_text(forja["contenido"], encoding="utf-8")

        _git("add", "--", forja["archivo"])

        # El test de reproducción va EN EL MISMO COMMIT, y sólo si el gate lo validó. Un test que no
        # falla sin el parche no se commitea: sería un test decorativo que da falsa confianza al
        # revisor, exactamente lo contrario de lo que este archivo existe para dar.
        if demostrado and forja.get("test_reproduccion"):
            ruta_test = f"apps/copiloto/{(prueba.get('reproduccion') or {}).get('archivo_test')}"
            destino_test = repo / ruta_test
            destino_test.parent.mkdir(parents=True, exist_ok=True)
            destino_test.write_text(forja["test_reproduccion"], encoding="utf-8")
            _git("add", "--", ruta_test)
        # Control positivo antes de commitear: si no hay nada staged, el parche no llegó al árbol y
        # el PR saldría vacío. Un PR vacío que dice "reparé X" es peor que no reparar — le enseña al
        # revisor a aprobar sin mirar. Se dice con nombre propio en vez de esperar el error de git.
        if subprocess.run(["git", "-C", str(repo), "diff", "--cached", "--quiet"],
                          capture_output=True, timeout=30).returncode == 0:
            return {"url": artefacto.as_posix(), "modo": "sin_cambios",
                    "motivo": "el parche no produjo ninguna diferencia contra origin/main; "
                              "no se abre PR"}

        # El mensaje dice si el arreglo está demostrado: el revisor lo ve en `git log` sin abrir el
        # PR, y queda en la historia del repo cuando el cuerpo del PR ya no esté a mano.
        _git("commit", "-m",
             f"fix(autosanacion): {trauma.get('error_type')} en {forja['archivo']}",
             "-m", ("Arreglo DEMOSTRADO: incluye un test que falla sin el parche y pasa con él."
                    if demostrado else
                    "Arreglo NO demostrado: sólo se verificó no-regresión. Revisar el cambio."))
        _git("push", "--force-with-lease", "--set-upstream", "origin", rama, timeout=120)

        salida = subprocess.run(
            ["gh", "pr", "create", "--title",
             f"fix(autosanacion): {trauma.get('error_type')} en {forja['archivo']}",
             "--body", cuerpo, "--head", rama],
            capture_output=True, text=True, timeout=60, check=True,
            cwd=str(repo))   # `gh` resuelve el repo desde el cwd; sin esto usaba el del proceso
        url = (salida.stdout or "").strip()

        # Etiqueta best-effort, y DESPUÉS de crear el PR a propósito: pasada dentro de `gh pr
        # create`, una etiqueta inexistente hace fallar el comando entero y un PR perfectamente
        # válido degradaría a artefacto por un detalle cosmético. Acá el peor caso es un PR sin
        # etiqueta. Sirve para distinguir de un vistazo lo que propuso el ciclo de lo que propuso
        # una persona; NO notifica a nadie —el PR lo abre el mismo usuario del token y GitHub no
        # permite asignarse como reviewer a uno mismo—, así que enterarse sigue siendo ir a mirar.
        subprocess.run(["gh", "pr", "edit", url, "--add-label", ETIQUETA_PR],
                       capture_output=True, timeout=30, cwd=str(repo))
        return {"url": url, "modo": "pr"}
    except (OSError, subprocess.SubprocessError) as exc:
        # El `stderr` va EN el motivo. Sin él, "returned non-zero exit status 1" es todo lo que
        # queda de un fallo que sí sabía explicarse — y este camino se pasó semanas roto por eso.
        detalle = getattr(exc, "stderr", None) or getattr(exc, "stdout", None) or ""
        if isinstance(detalle, bytes):
            detalle = detalle.decode("utf-8", "replace")
        _log.warning(json.dumps({"evento": "autosanacion_pr_fallido",
                                 "error_type": type(exc).__name__,
                                 "detalle": str(detalle)[:500],
                                 "efecto": "la propuesta queda como artefacto"}, ensure_ascii=False))
        return {"url": artefacto.as_posix(), "modo": "artefacto",
                "motivo": f"no se pudo abrir el PR ({exc}): {str(detalle).strip()[:300]}; "
                          f"la propuesta quedó como artefacto"}


# ======================================================================================
# 7 — marcar
# ======================================================================================
@activity.defn
async def marcar_trauma(payload: dict) -> None:
    """Mueve el trauma de estado, con la nota de por qué.

    Es la activity que **cierra el ciclo en todos los caminos**, incluidos los rechazos: un trauma
    que se tomó y no se devuelve queda `en_proceso` para siempre, invisible para el próximo disparo
    (no está `pendiente`) y sin que nadie lo repare.

    ## Los hermanos del mismo bug (2026-08-01)

    Cuando el desenlace es `reparacion_propuesta` y el payload trae `fingerprint`, se marcan también
    **las otras filas pendientes con ese mismo fingerprint** — el mismo defecto sufrido por otros
    tenants. Sin esto la deduplicación duraría un solo disparo: mañana el ciclo tomaría un hermano,
    forjaría el MISMO parche y abriría el MISMO PR, un día por tenant afectado. Se hace al cerrar y
    no al tomar a propósito: si el ciclo se cae a mitad de camino, los hermanos quedan intactos y el
    próximo intento los encuentra.
    """
    estado = payload.get("estado", PENDIENTE)
    # Sin `with tenant(...)`: la conexión del ciclo salta RLS (`BYPASSRLS`) y ve la fila sea de quien
    # sea, que es justo lo que hace falta cuando el trauma que se está cerrando puede ser de
    # cualquier emprendedor. El guard que importa NO se fue: sigue siendo el `rowcount != 1` de abajo
    # — un UPDATE que no ve la fila no falla, afecta 0 filas y devuelve éxito.
    conn = _conn_dlq()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {TABLA} SET estado = %s, updated_at = now(), "
                        f"contexto = coalesce(contexto, '{{}}'::jsonb) || %s::jsonb "
                        f"WHERE id = %s",
                        (estado, json.dumps({"ultima_nota": payload.get("nota", "")}),
                         payload.get("id")))
            if cur.rowcount != 1:
                # Se afirma en voz alta en vez de degradar en silencio: 0 filas acá significa que el
                # id no existe (o que la conexión no es la del rol con BYPASSRLS y sigue sujeta a
                # RLS), y las dos cosas dejan un trauma colgado en `en_proceso`.
                raise RuntimeError(
                    f"marcar_trauma tocó {cur.rowcount} filas para id={payload.get('id')} "
                    f"(dueño={payload.get('cliente_id')!r}): el trauma quedaría colgado "
                    f"en `en_proceso`")

            fingerprint = payload.get("fingerprint")
            if estado == "reparacion_propuesta" and fingerprint:
                cur.execute(f"UPDATE {TABLA} SET estado = %s, updated_at = now(), "
                            f"contexto = coalesce(contexto, '{{}}'::jsonb) || %s::jsonb "
                            f"WHERE fingerprint = %s AND estado = %s AND id <> %s",
                            (estado,
                             json.dumps({"ultima_nota": f"mismo bug que el trauma "
                                                        f"{payload.get('id')}: "
                                                        f"{payload.get('nota', '')}"}),
                             fingerprint, PENDIENTE, payload.get("id")))
                if cur.rowcount:
                    _log.warning(json.dumps(
                        {"evento": "autosanacion_hermanos_cerrados", "fingerprint": fingerprint,
                         "hermanos": cur.rowcount,
                         "efecto": "el mismo bug en otros tenants NO se vuelve a proponer"},
                        ensure_ascii=False))
    finally:
        _cerrar(conn)


ACTIVITIES_AUTOSANACION: list[Any] = [
    tomar_trauma_para_reparar, evaluar_gates_de_reparacion, forjar_parche,
    auditar_parche, probar_parche_en_sandbox, proponer_pr_de_reparacion, marcar_trauma,
]
