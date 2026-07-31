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

**Lo que queda pendiente y hay que decir en voz alta:** el paso que convertiría esto en reparación
demostrable es que el ciclo escriba primero un **test que reproduzca el trauma**, y recién después
lo arregle. No está construido. Sin él, "aceptado por el gate" significa *no rompió nada*, y eso es
menos de lo que la palabra sugiere. Está marcado como deuda visible, con dueño, en la memoria del
repo.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

from temporalio import activity

from autosanacion_gates import puede_reparar
from auditor_parches import auditar as _auditar
from auditor_parches import verificar_auditor
from contexto_tenant import tenant
from forjador_parches import aplicar_bloques, prompt_de_forja
from sandbox_tests import correr_suite, evaluar, preparar_copia
from trauma_store import PENDIENTE, TABLA, TraumaStore

#: `warning` y no `info`, por la misma razón que `log_estructurado`: sin `basicConfig`, el
#: `lastResort` de logging sólo emite `warning+` a stderr, y en el unit del worker eso es journald.
#: Un aviso en `.info` no llega — es un log que no existe.
_log = logging.getLogger("copiloto")

_conn_factory = None
_llm_client = None
#: Raíz del repo desplegado. Se inyecta para no derivarla del `__file__` de este módulo: el sandbox
#: copia el árbol a otro lado y el path tiene que seguir siendo el del repo, no el de la copia.
_raiz_repo: Path | None = None


def set_autosanacion_deps(conn_factory, llm_client=None, raiz_repo=None) -> None:  # noqa: ANN001
    """Inyecta las dependencias. SYNC, se llama en el composition root del worker.

    `llm_client` opcional: un worker sin LLM cableado sigue arrancando y el ciclo se apaga solo con
    un motivo legible, en vez de reventar en la mitad. Es el mismo criterio que el resto de las
    activities de este repo para las dependencias que pueden faltar.
    """
    global _conn_factory, _llm_client, _raiz_repo
    _conn_factory = conn_factory
    _llm_client = llm_client
    _raiz_repo = Path(raiz_repo) if raiz_repo else Path(__file__).resolve().parents[2]


def _store(cliente_id: str) -> TraumaStore:
    return TraumaStore(_conn_factory, cliente_id)


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
async def tomar_trauma_para_reparar(cliente_id: str) -> dict | None:
    """Toma UN trauma pendiente y lo deja `en_proceso`. `None` si no hay.

    Uno y no un lote: cada ejecución del workflow repara como mucho uno, así que tomar más los
    dejaría `en_proceso` sin que nadie los trabaje — colgados hasta que `rescatar_colgados` los
    devuelva media hora después.
    """
    with tenant(cliente_id):
        tomados = _store(cliente_id).tomar(limite=1)
    if not tomados:
        return None
    # `cliente_id` se inyecta acá porque `tomar()` NO lo devuelve entre sus columnas — y todo lo que
    # sigue lo necesita: el conteo del tope, y sobre todo el `_soltar` del workflow, que sin dueño
    # no puede devolver el trauma a `pendiente`. Sin esto viajaba vacío: la query comparaba
    # `cliente_id = ''` contra un uuid (InvalidTextRepresentation, tragado por el except) y el ciclo
    # se apagaba solo informando "tope diario alcanzado". Dos fallos con una sola causa, y ninguno
    # de los dos mencionaba al dueño ausente.
    return {**_serializable(tomados[0]), "cliente_id": cliente_id}


# ======================================================================================
# 2 — gates
# ======================================================================================
def _reparaciones_de_hoy(cliente_id: str) -> int:
    """Cuántas reparaciones se propusieron hoy para este tenant. Ante un fallo devuelve el tope, no
    cero: si la cuenta no se puede hacer, lo seguro es frenar, no seguir de largo."""
    if not cliente_id:
        # Fail-closed y ruidoso. Sin dueño no hay cuenta posible, y devolver 0 dejaría el tope sin
        # efecto justo cuando el ciclo perdió de vista a quién le está reparando.
        _log.warning(json.dumps({"evento": "autosanacion_sin_tenant",
                                 "efecto": "no se puede contar el tope; el ciclo NO repara"}))
        from autosanacion_gates import tope_diario
        return tope_diario()
    conn = None
    try:
        with tenant(cliente_id):
            conn = _conn_factory()
            with conn.cursor() as cur:
                cur.execute(f"SELECT count(*) FROM {TABLA} WHERE cliente_id = %s "
                            f"AND estado = 'reparacion_propuesta' AND updated_at::date = %s",
                            (cliente_id, date.today()))
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
        reparaciones_hoy=_reparaciones_de_hoy(trauma.get("cliente_id", "")),
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
            "parche": texto, "archivo": origen["archivo"], "no_romper": no_romper}


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
    veredicto = _auditar(_llm_client, forja.get("parche", ""), contexto)
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

    Y lo que este gate **no** puede afirmar acá: que el parche arregle el trauma. No hay test del
    bug (docstring del módulo). Esto es no-regresión.
    """
    forja = payload["forja"]
    if not forja.get("aplicado"):
        return {"aceptado": False, "motivo": "no hay parche que probar", "regresiones": []}

    with tempfile.TemporaryDirectory() as td:
        copia = preparar_copia(_raiz_repo, Path(td) / "sandbox")
        python = os.environ.get("COPILOTO_SANDBOX_PYTHON", "python3")

        baseline = correr_suite(copia, python=python)
        destino = copia / "apps" / "copiloto" / Path(forja["archivo"]).name
        if not destino.exists():
            # El parche apunta a un archivo que la copia no tiene (p. ej. vive en `motor/`). Se
            # busca por la ruta relativa completa antes de rendirse.
            destino = copia / forja["archivo"]
        if not destino.exists():
            return {"aceptado": False, "regresiones": [],
                    "motivo": f"{forja['archivo']} no está en el sandbox: no se puede probar"}
        destino.write_text(forja["contenido"], encoding="utf-8")

        parcheado = correr_suite(copia, python=python)
        veredicto = evaluar(baseline, parcheado)
        return {"aceptado": veredicto.aceptado, "motivo": veredicto.motivo,
                "regresiones": list(veredicto.regresiones)}


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

    artefactos = Path(os.environ.get("COPILOTO_AUTOSANACION_ARTEFACTOS", "/tmp/autosanacion"))
    artefactos.mkdir(parents=True, exist_ok=True)
    destino = artefactos / f"trauma-{trauma.get('id')}-{trauma.get('fingerprint')}.patch"
    destino.write_text(
        f"# trauma {trauma.get('id')} · {trauma.get('error_type')} en {forja['archivo']}\n"
        f"# operación: {trauma.get('workflow')} · veces: {trauma.get('dedupe_count')}\n"
        f"# ATENCIÓN: el gate verificó NO-REGRESIÓN, no que esto arregle el bug — no hay test que lo\n"
        f"# reproduzca. Revisá el cambio, no el veredicto verde.\n\n{forja.get('parche', '')}\n",
        encoding="utf-8")

    if not _hay_gh():
        return {"url": destino.as_posix(), "modo": "artefacto"}
    return _abrir_pr(destino, forja, trauma)


def _hay_gh() -> bool:
    try:
        return subprocess.run(["gh", "auth", "status"], capture_output=True,
                              timeout=15).returncode == 0
    except (OSError, subprocess.SubprocessError):
        # `gh` no instalado, sin PATH, o sin credenciales. Los tres significan lo mismo para el
        # llamador —no hay canal de PR— y ninguno es un error: el ciclo degrada a artefacto, que es
        # un camino previsto y no una falla. Loguear acá gritaria en el caso NORMAL del VPS del
        # worker, que deliberadamente NO tiene credenciales de GitHub.
        return False


def _abrir_pr(artefacto: Path, forja: dict, trauma: dict) -> dict:
    """Abre el PR con `gh`. Ante cualquier fallo degrada al artefacto en vez de lanzar: perder la
    propuesta por un problema de red sería el peor resultado posible del ciclo entero."""
    rama = f"autosanacion/trauma-{trauma.get('id')}"
    cuerpo = (f"Reparación **propuesta automáticamente** para el trauma `{trauma.get('id')}`.\n\n"
              f"- error: `{trauma.get('error_type')}` en `{forja['archivo']}`\n"
              f"- operación: `{trauma.get('workflow')}` · ocurrencias: {trauma.get('dedupe_count')}\n\n"
              f"⚠️ El gate verificó **no-regresión** (la suite completa sigue verde), **no** que esto "
              f"arregle el bug: no existe un test que lo reproduzca. Revisá el cambio.\n")
    try:
        subprocess.run(["git", "-C", str(_raiz_repo), "checkout", "-b", rama],
                       capture_output=True, timeout=30, check=True)
        subprocess.run(["git", "-C", str(_raiz_repo), "add", forja["archivo"]],
                       capture_output=True, timeout=30, check=True)
        subprocess.run(["git", "-C", str(_raiz_repo), "commit", "-m",
                        f"fix(autosanacion): {trauma.get('error_type')} en {forja['archivo']}"],
                       capture_output=True, timeout=30, check=True)
        salida = subprocess.run(
            ["gh", "pr", "create", "--title",
             f"fix(autosanacion): {trauma.get('error_type')} en {forja['archivo']}",
             "--body", cuerpo, "--head", rama],
            capture_output=True, text=True, timeout=60, check=True)
        return {"url": (salida.stdout or "").strip(), "modo": "pr"}
    except (OSError, subprocess.SubprocessError) as exc:
        return {"url": artefacto.as_posix(), "modo": "artefacto",
                "motivo": f"no se pudo abrir el PR ({exc}); la propuesta quedó como artefacto"}


# ======================================================================================
# 7 — marcar
# ======================================================================================
@activity.defn
async def marcar_trauma(payload: dict) -> None:
    """Mueve el trauma de estado, con la nota de por qué.

    Es la activity que **cierra el ciclo en todos los caminos**, incluidos los rechazos: un trauma
    que se tomó y no se devuelve queda `en_proceso` para siempre, invisible para el próximo disparo
    (no está `pendiente`) y sin que nadie lo repare.
    """
    cliente_id = payload.get("cliente_id") or ""
    estado = payload.get("estado", PENDIENTE)
    # `with tenant(...)` explícito: con RLS forzado, un UPDATE sin tenant declarado no ve la fila y
    # **no falla** — afecta 0 filas y devuelve éxito. El trauma quedaría `en_proceso` para siempre y
    # el ciclo lo reportaría como soltado. Un fallo que no protesta es el que hay que blindar.
    with tenant(cliente_id):
        conn = _conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {TABLA} SET estado = %s, updated_at = now(), "
                            f"contexto = coalesce(contexto, '{{}}'::jsonb) || %s::jsonb "
                            f"WHERE id = %s",
                            (estado, json.dumps({"ultima_nota": payload.get("nota", "")}),
                             payload.get("id")))
                if cur.rowcount != 1:
                    # Se afirma en voz alta en vez de degradar en silencio: 0 filas acá significa
                    # tenant equivocado o id inexistente, y las dos cosas dejan un trauma colgado.
                    raise RuntimeError(
                        f"marcar_trauma tocó {cur.rowcount} filas para id={payload.get('id')} "
                        f"tenant={cliente_id!r}: el trauma quedaría colgado en `en_proceso`")
        finally:
            _cerrar(conn)


ACTIVITIES_AUTOSANACION: list[Any] = [
    tomar_trauma_para_reparar, evaluar_gates_de_reparacion, forjar_parche,
    auditar_parche, probar_parche_en_sandbox, proponer_pr_de_reparacion, marcar_trauma,
]
