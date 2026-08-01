"""Gate de tests de la autosanación — Fase 3.

**Es la pieza que hace segura a todas las demás.** Medido (S5, 12 corridas con `gpt-4o-mini`,
`temperature=0`, sobre el bug real de `fingerprint.py`): **11 verde, 1 roja**. Y la que falló reportó
`aplicado=True, 1 bloque` — el aplicador la aceptó sin objeciones y dejó la suite roja igual. Un
parche puede estar **perfectamente bien formado y perfectamente mal pensado**, y ninguna validación
de formato distingue una cosa de la otra. Por eso correr la suite no es "una precaución razonable":
es **conclusión medida**. Ver `[[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]]`.

## Las tres reglas que este módulo hace cumplir

1. **El evaluador NO corre en el proceso del evaluado.** pytest se lanza como **subproceso**, nunca
   con `pytest.main()` in-process. Si compartieran proceso, el código bajo evaluación podría alterar
   al evaluador — monkeypatchear un assert, registrar un plugin, tocar `sys.modules`. Es el patrón
   "HackRouter" que documentó METR: un evaluado con acceso al evaluador deja de ser evaluado.

2. **Sin BASELINE verde no hay veredicto.** Antes de tocar nada se corre la suite **sin el parche**.
   Si ya estaba roja, el gate devuelve `NO_EVALUABLE` en vez de culpar al parche. Sin esta pasada, un
   rojo preexistente hace que **todo** parche parezca malo (y peor: si el parche arregla algo pero
   otra cosa sigue rota, se descarta un parche bueno). Es la misma trampa de los instrumentos que
   confirman: un gate sin control no mide el parche, mide el estado del repo.

3. **El veredicto es la SALIDA, no el exit code.** Se reporta cuántos pasaron, fallaron y **cuántos
   se saltaron**. Una suite que reporta "passed" escondiendo 110 skipped se lee como cobertura
   completa y no lo es. Un instrumento que no mira nunca falla: su silencio se lee verde.

## Dónde corre

En el VPS, dentro de una activity del worker. Medido el 2026-07-31: `apps/copiloto` + `motor` pesan
**8 MB** (copia barata), hay 110 archivos de test desplegados y `pytest 9.1.1` en el venv. No hace
falta ssh: el worker ya está en el VPS.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

#: Tope de tiempo de una corrida. Un parche puede colgar la suite (un `while` sin salida, un lock);
#: sin timeout el ciclo se traba para siempre y nadie se entera. La suite local tarda ~35 s.
TIMEOUT_DEFAULT = 600

#: Lo que se copia al sandbox. `motor` va porque sus tests son nuestros (fork duro, CLAUDE.md §2) y
#: su rojo es nuestro problema.
#:
#: `deploy/worker` va porque **sin él la suite no colecta**: `tests/test_provision.py` y
#: `tests/test_mp_tables.py` importan `provision_tables`, que vive ahí. Sin ese subárbol pytest corta
#: la colección con 2 errores y corren **cero** tests — medido el 2026-08-01: 0 recolectados sin él,
#: 1277 passed con él. Es la misma lista que ya usaba `sync-test-backend.sh` para el dev-loop; el
#: sandbox se había quedado con dos de los tres.
SUBARBOLES = ("apps/copiloto", "motor", "deploy/worker")

#: Nombres exactos de variables que apuntan a un servicio externo pero no parecen credenciales.
#: `DATABASE_URL` estaba desde el principio; las demás se sumaron cuando el gate empezó a correr de
#: verdad y activó los tests de integración real (ver `correr_suite`).
_VARS_DE_SERVICIO_EXTERNO = frozenset({
    "DATABASE_URL",
    "COPILOTO_COMPOSIO_USER_ID",   # sin él, los tests de Composio se saltan
    "COPILOTO_CLIENTE_ID",         # activa E2E que hablan con servicios de un tenant real
    "GRAPHITY_BASE_URL",
})

#: Sufijos de credencial. Por patrón a propósito: una integración nueva trae su `X_API_KEY` y queda
#: tapada sola. Una lista cerrada habría que acordarse de actualizarla, y el modo de fallo —tests
#: reales corriendo dentro del gate— es silencioso hasta que manda un mail.
_SUFIJOS_DE_CREDENCIAL = ("_API_KEY", "_TOKEN", "_SECRET", "_PASSWORD", "_CREDENTIALS")

#: Basura que no debe viajar: acelera la copia y evita que un `.pyc` viejo enmascare el parche.
_IGNORAR = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "node_modules", ".venv")

#: `12 passed`, `1 failed`, `3 skipped`, `2 errors`… pytest los lista separados por coma.
_CONTEO = re.compile(r"(\d+)\s+(passed|failed|error|errors|skipped|xfailed|xpassed)")


@dataclass(frozen=True)
class Resumen:
    """Lo que pytest dice que pasó. Separado del subproceso a propósito: es lógica pura y se testea
    sin Postgres, sin VPS y sin correr una suite."""
    pasaron: int = 0
    fallaron: int = 0
    errores: int = 0
    saltados: int = 0
    #: `True` sólo si pytest reportó AL MENOS un test y ninguno rojo. Cero tests NO es verde:
    #: una suite que no colectó nada (import roto, path mal) tiene rc distinto de 0 a veces, pero
    #: un filtro que no matchea sale con 0 tests y podría leerse como éxito.
    @property
    def verde(self) -> bool:
        return self.total_corridos > 0 and self.fallaron == 0 and self.errores == 0

    @property
    def total_corridos(self) -> int:
        return self.pasaron + self.fallaron + self.errores


@dataclass(frozen=True)
class Resultado:
    """Una corrida de la suite."""
    resumen: Resumen
    rc: int
    salida: str
    expiro: bool = False


@dataclass(frozen=True)
class Veredicto:
    """El dictamen del gate sobre un parche."""
    #: `True` sólo si el baseline estaba verde Y con el parche sigue verde.
    aceptado: bool
    motivo: str
    baseline: Resultado | None = None
    parcheado: Resultado | None = None
    #: Tests que pasaban antes y fallan ahora. Es lo que hay que mostrarle al forjador si se
    #: reintenta: feedback LOCALIZADO baja regresiones ~70% frente a "corré los tests".
    regresiones: tuple[str, ...] = field(default_factory=tuple)


def parsear_resumen(salida: str) -> Resumen:
    """Extrae los conteos de la salida de pytest. Puro: sin I/O, sin subprocesos.

    Se lee la ÚLTIMA línea que tenga conteos (el epílogo `=== 1364 passed, 16 skipped in 35s ===`),
    no la primera: el cuerpo de la salida puede mencionar números de otras cosas.
    """
    pasaron = fallaron = errores = saltados = 0
    encontrado = False
    for linea in reversed(salida.splitlines()):
        pares = _CONTEO.findall(linea)
        if not pares:
            continue
        for cantidad, clase in pares:
            n = int(cantidad)
            if clase == "passed":
                pasaron = n
            elif clase == "failed":
                fallaron = n
            elif clase in ("error", "errors"):
                errores = n
            elif clase == "skipped":
                saltados = n
        encontrado = True
        break
    if not encontrado:
        return Resumen()
    return Resumen(pasaron=pasaron, fallaron=fallaron, errores=errores, saltados=saltados)


def nodeids_fallados(salida: str) -> tuple[str, ...]:
    """Los nodeids que pytest listó como FAILED/ERROR, en orden y sin repetir.

    Sirve para el diff de regresiones: qué pasaba antes y no pasa ahora. Un `set` perdería el orden,
    que es justo lo que hace legible el reporte al humano que revisa el PR.
    """
    vistos: dict[str, None] = {}
    for linea in salida.splitlines():
        m = re.match(r"^(?:FAILED|ERROR)\s+(\S+)", linea.strip())
        if m:
            vistos.setdefault(m.group(1), None)
    return tuple(vistos)


def preparar_copia(origen: Path, destino: Path, subarboles: tuple[str, ...] = SUBARBOLES) -> Path:
    """Copia los subárboles necesarios a `destino`. Idempotente: borra y recrea.

    El parche se aplica sobre ESTA copia, nunca sobre el árbol desplegado. Es la diferencia entre
    "propone una reparación" y "muta producción", que es la línea que el ciclo no cruza.
    """
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True)
    for sub in subarboles:
        src = origen / sub
        if not src.is_dir():
            raise FileNotFoundError(f"no existe {src} — ¿el árbol de origen es el correcto?")
        shutil.copytree(src, destino / sub, ignore=_IGNORAR, symlinks=True)
    return destino


def correr_suite(
    copia: Path,
    *,
    python: str,
    args: tuple[str, ...] = ("tests", "../../motor", "-q", "-ra"),
    env_extra: dict[str, str] | None = None,
    timeout: int = TIMEOUT_DEFAULT,
    ejecutor=subprocess.run,
) -> Resultado:
    """Corre la suite EN UN SUBPROCESO sobre la copia.

    `ejecutor` se inyecta para poder testear esta función sin lanzar pytest de verdad. No se usa
    `pytest.main()` a propósito — ver la regla 1 del módulo: el evaluado no puede compartir proceso
    con el evaluador.
    """
    import os

    cwd = copia / "apps" / "copiloto"
    entorno = dict(os.environ)
    entorno["PYTHONPATH"] = os.pathsep.join(
        [str(cwd), str(copia / "motor"), str(copia / "deploy" / "worker")])
    # Sin `DATABASE_URL` los tests contra Postgres se SALTAN. Es deliberado: el gate jamás debe
    # escribir en una base real. Quien quiera cobertura de Postgres pasa una base EFÍMERA por
    # `env_extra` (deploy/copiloto/test-db.sh). El conteo de `saltados` deja el hueco a la vista en
    # vez de esconderlo detrás de un "passed".
    #
    # Y lo mismo para TODO servicio externo, por la misma razón llevada hasta el final. El gate
    # hereda el entorno del worker, que en producción tiene las credenciales de verdad; con ellas
    # puestas se **activan** los tests de integración real. Medido el 2026-08-01: 5 rojos en el
    # baseline (`test_docs`, `test_drive`, `test_gmail`, `test_sheets`, `test_selection_qa`) que en
    # el dev-loop y en el CI se saltan solos porque ahí no hay credenciales.
    #
    # Dos problemas, y el segundo es el grave:
    #   1. Son no-deterministas —dependen de un servicio ajeno y de un LLM—, así que un gate de
    #      no-regresión construido sobre ellos decide por ruido.
    #   2. **Tienen efectos afuera.** `test_gmail::test_send_real_y_readback` manda un mail de
    #      verdad. Un ciclo automático que corre la suite dos veces por cada intento de parche
    #      mandaría mails, escribiría Drive y crearía Docs a espaldas de todos.
    #
    # Por patrón y no por lista cerrada: una integración nueva trae su `X_API_KEY` y queda tapada
    # sola, en vez de reactivar el problema en silencio hasta que alguien lo note.
    for var in list(entorno):
        if var in _VARS_DE_SERVICIO_EXTERNO or any(var.endswith(s) for s in _SUFIJOS_DE_CREDENCIAL):
            entorno.pop(var, None)
    entorno.update(env_extra or {})

    try:
        proc = ejecutor(
            [python, "-m", "pytest", *args],
            cwd=str(cwd), env=entorno, capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        # Un timeout NO es un rojo cualquiera: es "el parche cuelga". Se distingue para que el
        # motivo del rechazo sea legible y no "falló por razones desconocidas".
        return Resultado(resumen=Resumen(), rc=-1, salida=f"la suite superó {timeout}s", expiro=True)

    salida = (proc.stdout or "") + (proc.stderr or "")
    return Resultado(resumen=parsear_resumen(salida), rc=proc.returncode, salida=salida)


def evaluar(baseline: Resultado, parcheado: Resultado) -> Veredicto:
    """Compara las dos corridas y dictamina. Puro: no corre nada, sólo decide.

    El orden de las guardas es el orden del costo de equivocarse. Primero el baseline: si la suite ya
    estaba rota, **no hay nada que este gate pueda afirmar sobre el parche** — ni a favor ni en
    contra. Devolver "rechazado" ahí sería culpar al parche por un rojo ajeno; devolver "aceptado"
    sería peor.
    """
    if baseline.expiro:
        return Veredicto(False, "NO_EVALUABLE: la suite SIN el parche ya expiraba por timeout",
                         baseline, parcheado)
    if baseline.resumen.total_corridos == 0:
        # Causa DISTINTA de "estaba roja", y con un arreglo distinto: acá la suite no llegó a correr
        # (intérprete sin pytest, colección interrumpida, path mal). Las dos daban el mismo mensaje
        # —"ya estaba roja"— y eso mandó la primera investigación al lugar equivocado: el E2E real
        # del 2026-08-01 reportó "ya estaba roja (0 fallaron, 0 errores)", una frase que se
        # contradice sola. Un mensaje que no distingue sus causas hace perder el tiempo justo cuando
        # más importa.
        return Veredicto(
            False,
            "NO_EVALUABLE: la suite del sandbox no corrió NINGÚN test (0 recolectados). No es que "
            "estuviera roja: no llegó a ejecutarse. Mirá el intérprete, la colección y el "
            f"PYTHONPATH. Últimas líneas: {baseline.salida.strip()[-300:]!r}",
            baseline, parcheado)
    if not baseline.resumen.verde:
        return Veredicto(
            False,
            f"NO_EVALUABLE: la suite ya estaba roja SIN el parche "
            f"({baseline.resumen.fallaron} fallaron, {baseline.resumen.errores} errores). "
            f"El gate no puede atribuirle nada al parche.",
            baseline, parcheado)

    if parcheado.expiro:
        return Veredicto(False, "RECHAZADO: con el parche la suite se cuelga (timeout)",
                         baseline, parcheado)

    rotos_antes = set(nodeids_fallados(baseline.salida))
    rotos_ahora = nodeids_fallados(parcheado.salida)
    regresiones = tuple(t for t in rotos_ahora if t not in rotos_antes)

    if not parcheado.resumen.verde:
        return Veredicto(
            False,
            f"RECHAZADO: con el parche la suite queda roja "
            f"({parcheado.resumen.fallaron} fallaron, {parcheado.resumen.errores} errores)",
            baseline, parcheado, regresiones)

    # Verde con el parche, pero corriendo MENOS tests que el baseline: un parche que rompe la
    # colección (import roto en un módulo de test) puede dejar "todo verde" simplemente porque la
    # mitad de la suite dejó de existir. Verde con menos tests no es verde.
    if parcheado.resumen.total_corridos < baseline.resumen.total_corridos:
        return Veredicto(
            False,
            f"RECHAZADO: con el parche corren MENOS tests que sin él "
            f"({parcheado.resumen.total_corridos} vs {baseline.resumen.total_corridos}) — "
            f"probablemente rompió la colección. Verde con menos tests no es verde.",
            baseline, parcheado, regresiones)

    return Veredicto(
        True,
        f"ACEPTADO: {parcheado.resumen.pasaron} pasaron, "
        f"{parcheado.resumen.saltados} saltados (baseline: {baseline.resumen.pasaron} pasaron)",
        baseline, parcheado)
