"""`AutosanacionWorkflow` — el ciclo de la Fase 3: un trauma de la DLQ → un PR propuesto.

Calca la forma de `mi_dia_schedule_workflow.py` (hito 7), que ya está en producción: un Schedule por
tenant dispara una ejecución NUEVA y CORTA; no hay estado que sobreviva entre corridas. Cada intento
de reparación es su propia ejecución con su propio historial, así que "por qué el martes no reparó
nada" se contesta mirando Temporal, sin acoplar el intento de hoy al de ayer.

## Determinismo

Acá NO vive ni una decisión que dependa del mundo: ni env vars, ni relojes, ni SQL, ni llamadas al
LLM, ni el filesystem. **Todo eso son activities.** Ojo con una que parece inofensiva: los gates de
`autosanacion_gates` leen `os.environ` en CADA decisión (a propósito — el kill switch tiene que
surtir efecto sin reiniciar el worker). Leer env dentro del workflow lo volvería no-determinista en
el replay, así que también van por activity.

## Zero-Mutation — la línea que este ciclo no cruza

El workflow **propone un PR y nunca mergea**. Y no miente con el PR: si el parche no produjo
mutaciones, no se abre nada. Un PR vacío que dice "reparé X" es peor que no reparar, porque le
enseña al humano a aprobar sin mirar.

## El orden de los pasos es el orden del costo

Primero lo barato y local (gates: kill switch, dominio prohibido, tope diario), después lo que
cuesta plata (forjar, auditar) y al final lo que cuesta minutos (correr la suite). Rechazar en el
paso 1 cuesta microsegundos; descubrir en el paso 5 que el archivo era del dominio fiscal habría
costado dos llamadas al LLM y una corrida completa de tests, para llegar al mismo "no".
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

#: Consultas a la DLQ y decisiones de gate: rápidas y reintentables sin costo.
TIMEOUT_CORTO = timedelta(seconds=60)
REINTENTO_CORTO = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=2))

#: Llamadas al LLM. `maximum_attempts=2` a propósito: cada reintento CUESTA, y un 429 por cuota
#: agotada no se arregla reintentando en el mismo minuto. Ya nos pasó que un `429
#: insufficient_quota` matara un workflow entero en silencio — con tope bajo, el fallo se ve rápido
#: en vez de quemar cuota contra una pared.
TIMEOUT_LLM = timedelta(minutes=5)
REINTENTO_LLM = RetryPolicy(maximum_attempts=2, initial_interval=timedelta(seconds=10))

#: La suite completa. UN solo intento: si la corrida se cayó por infraestructura, reintentarla cuesta
#: otros 10 minutos y el ciclo no tiene apuro — lo toma el disparo de mañana.
TIMEOUT_SUITE = timedelta(minutes=20)
SIN_REINTENTO = RetryPolicy(maximum_attempts=1)


@workflow.defn
class AutosanacionWorkflow:
    """Un disparo = un intento de reparación para **toda la app**. Devuelve siempre un dict con
    `estado`, nunca lanza por un "no": un rechazo de gate es un resultado legítimo del ciclo, no un
    fallo, y hacerlo excepción llenaría Temporal de ejecuciones rojas que no son errores.

    ## Sin `cliente_id` (2026-08-01, decisión del operador)

    Antes recibía un tenant y había un Schedule por emprendedor. Estaba mal por dos motivos, y el
    segundo es el de fondo:

    1. **Escala.** 19 Schedules hoy; 5.000 procesos a las 04:00 el día que haya 5.000 emprendedores,
       cada uno corriendo la suite completa dos veces para llegar al mismo parche.
    2. **Concepto.** El ciclo repara **nuestro código**, no los datos del emprendedor. Un `KeyError`
       en `fingerprint.py` es el mismo defecto lo haya pegado el tenant A o el Z: el tenant es un
       atributo de la *ocurrencia*, la unidad de reparación es el *bug*. Partir el ciclo por tenant
       era partirlo por un eje que no es el del problema.

    El tenant no desapareció: sale de la fila del trauma y viaja en el dict, porque cerrar o soltar
    una ocurrencia sigue necesitando saber de quién es.
    """

    @workflow.run
    async def run(self) -> dict:
        trauma = await workflow.execute_activity(
            "tomar_trauma_para_reparar",
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)
        if not trauma:
            return {"estado": "sin_traumas"}

        # Paso 1 — los gates, antes de gastar un centavo. `puede_reparar` lee env (kill switch, tope)
        # y consulta la base (índice único), así que es activity aunque "parezca" lógica pura.
        decision = await workflow.execute_activity(
            "evaluar_gates_de_reparacion", trauma,
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)
        if not decision.get("permitido"):
            motivo = decision.get("motivo", "rechazado por gate")
            # Pedir ayuda ANTES de mover el estado: si el issue falla, el trauma queda como estaba y
            # el próximo ciclo lo reintenta. Al revés —descartar y después fallar el aviso— dejaría
            # un error cerrado del que nadie se enteró nunca, que es exactamente el agujero que este
            # escalón viene a tapar.
            aviso = {}
            if decision.get("necesita_humano"):
                aviso = await workflow.execute_activity(
                    "abrir_issue_de_trauma", {"trauma": trauma, "motivo": motivo},
                    start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)
            # Un rechazo PERMANENTE se cierra; uno transitorio se suelta. El default `True` mantiene
            # el comportamiento anterior para todo gate que no declare lo contrario: se reintenta de
            # más, nunca se descarta de menos. Ver el docstring de `Decision`.
            if decision.get("reintentable", True):
                await self._soltar(trauma, motivo)
            else:
                await self._descartar(trauma, motivo)
            return {"estado": "rechazado_por_gate", "motivo": decision.get("motivo"),
                    "reintentable": decision.get("reintentable", True),
                    # El desenlace dice si se avisó o no: sin esto, "rechazado_por_gate" cubriría
                    # por igual un error escalado a una persona y uno que se tragó el silencio.
                    "aviso": aviso.get("modo", "no_aplica"),
                    "trauma_id": trauma.get("id")}

        # Paso 2 — forjar. El contexto (archivo real + salida real de pytest) lo arma la activity:
        # leer el archivo es I/O y la salida de pytest sale de una corrida, nada de eso puede vivir acá.
        forja = await workflow.execute_activity(
            "forjar_parche", trauma,
            start_to_close_timeout=TIMEOUT_LLM, retry_policy=REINTENTO_LLM)
        if not forja.get("aplicado"):
            await self._soltar(trauma, f"el forjador no produjo un parche aplicable: {forja.get('motivo')}")
            return {"estado": "sin_parche", "motivo": forja.get("motivo"), "trauma_id": trauma.get("id")}

        # Paso 3 — auditor adversarial, ANTES de correr la suite. Un parche que toca lo que no debe
        # se rechaza sin pagar 10 minutos de tests. `verificar_auditor` (los 3 parches rotos
        # congelados) corre dentro de esta activity: si el auditor aprueba alguno de los tres, el
        # ciclo se apaga solo en vez de confiar en un juez que dejó de juzgar.
        veredicto = await workflow.execute_activity(
            "auditar_parche", {"trauma": trauma, "forja": forja},
            start_to_close_timeout=TIMEOUT_LLM, retry_policy=REINTENTO_LLM)
        if not veredicto.get("aprobado"):
            await self._soltar(trauma, f"auditor: {veredicto.get('motivo')}")
            return {"estado": "rechazado_por_auditor", "motivo": veredicto.get("motivo"),
                    "trauma_id": trauma.get("id")}

        # Paso 4 — el gate de tests. Sandbox + baseline + suite, evaluador fuera del proceso evaluado.
        # Es el único paso que puede afirmar que el parche FUNCIONA; los anteriores sólo pueden
        # afirmar que no está descartado.
        prueba = await workflow.execute_activity(
            "probar_parche_en_sandbox", {"trauma": trauma, "forja": forja},
            start_to_close_timeout=TIMEOUT_SUITE, retry_policy=SIN_REINTENTO)
        if not prueba.get("aceptado"):
            await self._soltar(trauma, f"gate de tests: {prueba.get('motivo')}")
            return {"estado": "rechazado_por_tests", "motivo": prueba.get("motivo"),
                    "regresiones": prueba.get("regresiones", []), "trauma_id": trauma.get("id")}

        # Paso 5 — proponer. NUNCA mergear.
        pr = await workflow.execute_activity(
            "proponer_pr_de_reparacion", {"trauma": trauma, "forja": forja, "prueba": prueba},
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)

        # `fingerprint` va en el payload SÓLO en este camino: es el que cierra también a los hermanos
        # —el mismo bug sufrido por otros tenants— para que mañana el ciclo no vuelva a forjar el
        # mismo parche y abrir el mismo PR, un día por tenant afectado. En los caminos de rechazo NO
        # se manda: ahí sólo se suelta la ocurrencia que se tomó, y los hermanos siguen pendientes.
        await workflow.execute_activity(
            "marcar_trauma", {"id": trauma.get("id"), "estado": "reparacion_propuesta",
                              "nota": pr.get("url", ""), "cliente_id": trauma.get("cliente_id"),
                              "fingerprint": trauma.get("fingerprint")},
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)
        # `modo` viaja en el desenlace, y no es cosmético: sin él `pr_propuesto` cubre DOS realidades
        # opuestas —un PR abierto en GitHub y un `.patch` tirado en un /tmp que nadie visita— y las
        # dos se leen igual desde afuera. Así el camino de PR estuvo roto sin que nada protestara
        # (2026-08-01). Un resultado que puede significar dos cosas contrarias no es un resultado.
        return {"estado": "pr_propuesto", "url": pr.get("url"), "modo": pr.get("modo"),
                "motivo": pr.get("motivo"), "trauma_id": trauma.get("id"),
                # Por la MISMA razón que `modo`, un nivel más adentro: sin esto, "el ciclo abrió un
                # PR" cubre por igual un arreglo probado y un cambio que no arregla nada (PR #179).
                # El desenlace tiene que decir cuál de los dos fue.
                "arreglo_demostrado": bool(prueba.get("arreglo_demostrado")),
                "reproduccion": (prueba.get("reproduccion") or {}).get("estado")}

    async def _soltar(self, trauma: dict, motivo: str) -> None:
        """Devuelve el trauma a `pendiente` con la nota del rechazo.

        Sin esto, `tomar()` lo dejó en `en_proceso` y quedaría colgado para siempre: el próximo
        disparo no lo ve (no está pendiente) y nadie lo repara nunca. `rescatar_colgados` lo salvaría
        recién tras el timeout — soltarlo explícito es el camino barato, y además deja escrito POR QUÉ
        se rechazó, que es lo que hace revisable al ciclo.

        El `cliente_id` sale del **trauma**, no del argumento del workflow: es el dueño de la fila, y
        es lo que la activity necesita para declarar el tenant. Sin él, con RLS forzado el UPDATE
        afecta 0 filas **sin fallar** y el trauma queda colgado igual — con el ciclo reportando que
        lo soltó.
        """
        await workflow.execute_activity(
            "marcar_trauma", {"id": trauma.get("id"), "estado": "pendiente", "nota": motivo,
                              "cliente_id": trauma.get("cliente_id")},
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)

    async def _descartar(self, trauma: dict, motivo: str) -> None:
        """Cierra el trauma como `descartado`: nunca más vuelve a la cola.

        Es el hermano de `_soltar` para los rechazos cuya respuesta **no puede cambiar** — hoy, el
        canario. Soltar uno de esos lo deja circulando para siempre: medido en prod el 2026-08-02,
        las corridas de las 02, 04, 06 y 08 salieron todas `rechazado_por_gate` con el mismo
        `trauma_id: 14`. Y como el ciclo toma UN trauma por corrida ordenado por `dedupe_count DESC`,
        y cada prueba de vida del canario comparte fingerprint (⇒ su `dedupe_count` crece), el
        vigilante habría terminado quedándose con todas las corridas y tapando a los bugs reales.

        `descartado`, no `resuelto`: nada se reparó. La fila queda —con su nota— porque **la fila ES
        lo que el canario viene a producir**: `verificar-autosanacion.py` lee su `created_at` para
        saber hace cuánto se probó el camino detección→DLQ de punta a punta. Borrarla destruiría la
        prueba de vida; dejarla pendiente rompería el ciclo. Cerrarla conserva las dos cosas.
        """
        await workflow.execute_activity(
            "marcar_trauma", {"id": trauma.get("id"), "estado": "descartado", "nota": motivo,
                              "cliente_id": trauma.get("cliente_id")},
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_CORTO)
