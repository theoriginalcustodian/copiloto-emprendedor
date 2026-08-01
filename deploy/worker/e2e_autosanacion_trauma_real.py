"""E2E real: un trauma atraviesa los 6 pasos del ciclo, en el Temporal vivo.

Es lo único que faltaba para poder decir *"el autohealing funciona de punta a punta"*. Todo lo
demás está verde **por mitades**: las costuras (tomar → gates → soltar) contra Postgres real, y
forjar → auditar → probar contra el LLM real pero **fuera de Temporal**. Entre las dos mitades queda
la costura que ninguna prueba — y este repo ya pagó cuatro veces que *cada lado verifique su mitad y
la junta no sea de nadie*.

## Qué hace, y por qué así

1. Deposita **un** trauma con la forma exacta que dejan las costuras (`categoria` + `origen`), sobre
   un archivo **real** del repo y **fuera** de los dominios prohibidos.
2. Dispara el Schedule de ese tenant y espera el desenlace.
3. **Limpia siempre**, incluso si algo falla: el trauma sale de la DLQ de producción sí o sí.

**El desenlace esperado NO es `pr_propuesto`.** Cualquiera de estos prueba que la cadena entera
corrió: `pr_propuesto`, `rechazado_por_auditor`, `rechazado_por_tests`, `sin_parche`. Lo que
**falla** es `sin_traumas` (no lo tomó), `rechazado_por_gate` (no llegó a forjar) o que no termine.
Exigir `pr_propuesto` mediría al modelo, no al ciclo — y el ciclo es lo que está en duda.

## El archivo que se usa

`fingerprint.py`: chico, sin dominio prohibido, cubierto por tests, y **el mismo que el banco C0**.
Un parche sobre él que rompa algo lo caza el gate de no-regresión. Y aunque el ciclo proponga, no
mergea nada — Zero-Mutation.

Uso:
    DATABASE_URL=... TEMPORAL_TARGET=127.0.0.1:7233 python e2e_autosanacion_trauma_real.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

SCHEMA = "uc_factory"
TABLA = f"{SCHEMA}.copiloto_traumas"
ARCHIVO = "apps/copiloto/fingerprint.py"

#: Los que prueban que la cadena entera corrió. `sin_traumas` y `rechazado_por_gate` NO están: el
#: primero significa que no lo tomó y el segundo que no llegó ni a forjar.
DESENLACES_QUE_PRUEBAN = ("pr_propuesto", "rechazado_por_auditor", "rechazado_por_tests",
                          "sin_parche")


def _conectar():  # noqa: ANN202
    import psycopg2
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _dos_tenants() -> tuple[str, str]:
    """DOS tenants activos: el E2E necesita el MISMO bug sufrido por dos emprendedores distintos.

    Es el control del rediseño del 2026-08-01. Con un solo tenant, un ciclo por tenant y un ciclo
    global se ven **idénticos**: los dos toman un trauma y proponen un parche. La diferencia sólo
    aparece cuando el mismo defecto tiene dos ocurrencias con dueños distintos — ahí el ciclo viejo
    habría abierto dos PRs iguales (uno por Schedule) y el nuevo tiene que abrir uno.
    """
    conn = _conectar()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants "
                        f"WHERE status = 'active' ORDER BY cliente_id LIMIT 2")
            filas = cur.fetchall()
    finally:
        conn.close()
    if len(filas) < 2:
        raise SystemExit(f"❌ hacen falta 2 tenants activos para el control cross-tenant; "
                         f"hay {len(filas)}")
    return filas[0][0], filas[1][0]


def _intentos_de(trauma_id: int, cliente_id: str) -> tuple[int, str]:
    """`(intentos, estado)` de una fila, leída **declarando su tenant**.

    A propósito NO se usa la conexión con `BYPASSRLS` del ciclo: medir con el mismo instrumento que
    se está evaluando hace que un fallo de ese instrumento se vea como un resultado. Acá se lee por
    el camino normal —una conexión por tenant, como cualquier otro código de la app— así que si el
    rol del ciclo estuviera roto, esta medición lo mostraría en vez de acompañarlo.
    """
    conn = _conectar()
    conn.autocommit = True
    _declarar_tenant(conn, cliente_id)
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT intentos, estado FROM {TABLA} WHERE id = %s", (trauma_id,))
            fila = cur.fetchone()
            if not fila:
                raise SystemExit(f"❌ el trauma {trauma_id} no se ve declarando su propio tenant: "
                                 f"la medición no es confiable")
            return int(fila[0]), fila[1]
    finally:
        conn.close()


def _declarar_tenant(conn, cliente_id: str) -> None:
    """Hace lo que hace el BORDE en producción: decirle a la conexión de quién es la operación.

    La primera versión insertaba directo, con el comentario *"superuser, sin RLS"*. **Era falso y
    nadie lo había verificado**: el rol de `DATABASE_URL` no es superuser, `copiloto_traumas` tiene
    `FORCE ROW LEVEL SECURITY`, y el `INSERT` murió con *"new row violates row-level security
    policy"*. Que fallara ruidosamente fue suerte del `RETURNING`: un `UPDATE` en la misma situación
    habría tocado **0 filas y devuelto éxito**.

    El mecanismo es el mismo que `contexto_tenant.aplicar_tenant`: la GUC `request.jwt.claims` con
    `set_config(..., false)` —equivalente a `SET`, no a `SET LOCAL`, porque acá también se corre en
    autocommit y un `SET LOCAL` moriría al terminar esa sentencia.

    Se replica en vez de importarse porque `deploy/worker/` no tiene `apps/copiloto` en el path y
    montarlo para dos líneas traería el módulo entero. **La constante va acá abajo con su nombre
    completo**, así un `grep request.jwt.claims` encuentra los dos lugares.
    """
    import json
    with conn.cursor() as cur:
        cur.execute("SELECT set_config(%s, %s, false)",
                    ("request.jwt.claims", json.dumps({"cliente_id": cliente_id})))


def _depositar(cliente_id: str, fingerprint: str) -> int:
    """Deposita el trauma declarando el tenant, igual que el borde."""
    import json
    conn = _conectar()
    conn.autocommit = True
    _declarar_tenant(conn, cliente_id)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""INSERT INTO {TABLA} (cliente_id, fingerprint, workflow, error_type, costura,
                                         contexto, estado, dedupe_count)
                    VALUES (%s, %s, %s, %s, %s, %s, 'pendiente', 1) RETURNING id""",
                (cliente_id, fingerprint, "E2E autosanacion (trauma fabricado)", "KeyError",
                 "http_handler",
                 json.dumps({"categoria": "business_error",
                             "origen": {"archivo": ARCHIVO, "linea": 30,
                                        "funcion": "fingerprint_de_error"},
                             "e2e_fabricado": True})))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _limpiar(trauma_id: int, cliente_id: str) -> None:
    """Saca el trauma fabricado de la DLQ real. **Declara el tenant, o no borra nada y dice que sí.**

    Sin la GUC, este `DELETE` bajo `FORCE RLS` no falla: afecta **0 filas y devuelve éxito**. El
    `INSERT` de arriba al menos protestó porque tenía `RETURNING`; un borrado silencioso habría
    dejado el trauma fabricado en la cola de producción, listo para que el ciclo lo tomara mañana a
    las 04:00 como si fuera un error real. Por eso el conteo se imprime y se grita si es 0.
    """
    conn = _conectar()
    conn.autocommit = True
    _declarar_tenant(conn, cliente_id)
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLA} WHERE id = %s", (trauma_id,))
            print(f"  limpieza: {cur.rowcount} fila(s) borrada(s)")
            if cur.rowcount != 1:
                print(f"  ⚠️  ATENCIÓN: el trauma {trauma_id} NO se borró — queda en la DLQ real. "
                      f"Borralo a mano.", file=sys.stderr)
    finally:
        conn.close()


async def main() -> int:
    from temporalio.client import Client

    tenant_a, tenant_b = _dos_tenants()
    fingerprint = f"e2e{uuid.uuid4().hex[:5]}"
    # El MISMO fingerprint para los dos: un solo bug de nuestro código, dos ocurrencias con dueños
    # distintos. El índice único de la DLQ es `(cliente_id, fingerprint)`, así que conviven.
    trauma_a = _depositar(tenant_a, fingerprint)
    trauma_b = _depositar(tenant_b, fingerprint)
    print(f"MISMO bug ({fingerprint}) depositado 2 veces sobre {ARCHIVO}:\n"
          f"  trauma {trauma_a} → tenant {tenant_a}\n"
          f"  trauma {trauma_b} → tenant {tenant_b}")

    try:
        client = await Client.connect(os.environ.get("TEMPORAL_TARGET", "localhost:7233"))

        async def ejecuciones() -> set:
            vistas = set()
            async for w in client.list_workflows('WorkflowType = "AutosanacionWorkflow"'):
                vistas.add(w.id)
                if len(vistas) >= 30:
                    break
            return vistas

        antes = await ejecuciones()
        # UN solo Schedule para toda la app — ya no hay uno por tenant que disparar.
        await client.get_schedule_handle("autosanacion-global").trigger()
        print("Schedule global disparado; esperando el desenlace…")

        for segundo in range(600):
            await asyncio.sleep(2)
            nuevas = await ejecuciones() - antes
            if not nuevas:
                continue
            wf = client.get_workflow_handle(next(iter(nuevas)))
            desc = await wf.describe()
            if desc.status.name == "RUNNING":
                if segundo % 15 == 0:
                    print(f"  … corriendo ({segundo * 2}s)")
                continue
            if desc.status.name != "COMPLETED":
                print(f"❌ terminó en {desc.status.name}", file=sys.stderr)
                return 1
            resultado = await wf.result()
            estado = resultado.get("estado")
            print(f"\ndesenlace: {resultado}")
            # Un desenlace `NO_EVALUABLE` NO prueba nada, aunque el estado esté en la lista: el gate
            # devuelve `rechazado_por_tests` tanto cuando midió y rechazó como cuando **no pudo
            # medir**. La primera corrida real (2026-08-01) salió "✅" con el gate mudo —pytest ni
            # arrancaba— y el criterio no lo distinguió. Un mecanismo que falla hacia el "no" se ve
            # igual que uno que funciona y dice que no.
            if "NO_EVALUABLE" in str(resultado.get("motivo", "")):
                print(f"❌ el gate de tests NO PUDO MEDIR ({resultado.get('motivo')}). La cadena "
                      f"llegó al paso 5, pero el paso 5 no hizo su trabajo: esto NO es un E2E "
                      f"verde.", file=sys.stderr)
                return 1
            # `pr_propuesto` NO alcanza: hasta el 2026-08-01 ese estado salía igual con un PR
            # abierto en GitHub que con un `.patch` en un /tmp que nadie visita, y el camino de PR
            # estuvo roto todo ese tiempo sin que nada protestara. Si HAY repo declarado, el modo
            # tiene que ser `pr`; si no lo hay, el artefacto es el desenlace correcto y se dice.
            if estado == "pr_propuesto":
                modo = resultado.get("modo")
                hay_repo = bool(os.environ.get("COPILOTO_AUTOSANACION_REPO_GIT", "").strip())
                print(f"  modo de la propuesta: {modo!r} (repo declarado: {hay_repo})")
                if hay_repo and modo != "pr":
                    print(f"❌ hay repo de trabajo declarado pero la propuesta salió como {modo!r}: "
                          f"{resultado.get('motivo')}\n"
                          f"   El ciclo llegó al final y no abrió PR — el trabajo queda en un /tmp "
                          f"que nadie mira. Esto NO es un E2E verde.", file=sys.stderr)
                    return 1

            if estado not in DESENLACES_QUE_PRUEBAN:
                print(f"❌ desenlace '{estado}': el ciclo NO llegó a forjar. "
                      f"Esperado uno de {DESENLACES_QUE_PRUEBAN}", file=sys.stderr)
                return 1

            # ── EL CONTROL DEL REDISEÑO ────────────────────────────────────────────────────────
            # Vale cualquiera sea el desenlace, porque no depende del LLM: el ciclo tiene que haber
            # tocado UNA de las dos ocurrencias del mismo bug, no las dos. `intentos` lo cuenta
            # `tomar_un_bug_distinto` al tomarlo, y sobrevive a que el trauma se suelte después.
            #
            # Sin este control, un E2E verde no distinguiría el rediseño de la topología vieja: con
            # UNA sola ocurrencia los dos se ven igual. Y el modo de fallo que caza es silencioso —
            # si el agrupado por bug no funcionara, no habría error: habría dos PRs idénticos, y eso
            # se descubre recién cuando alguien los mira.
            intentos_a, estado_a = _intentos_de(trauma_a, tenant_a)
            intentos_b, estado_b = _intentos_de(trauma_b, tenant_b)
            tomados = [n for n in (intentos_a, intentos_b) if n >= 1]
            print(f"\ncontrol cross-tenant (mismo fingerprint, 2 dueños):\n"
                  f"  trauma {trauma_a} ({tenant_a[:8]}…): intentos={intentos_a} estado={estado_a}\n"
                  f"  trauma {trauma_b} ({tenant_b[:8]}…): intentos={intentos_b} estado={estado_b}")
            if len(tomados) == 2:
                print("❌ el ciclo tomó LAS DOS ocurrencias del MISMO bug. Tenía que tomar una: "
                      "el agrupado por fingerprint no está funcionando y el humano recibiría un PR "
                      "por cada tenant afectado.", file=sys.stderr)
                return 1
            if len(tomados) == 0:
                # No es lo mismo que el fallo de arriba y no se puede reportar igual: significa que
                # el ciclo tomó OTRO bug (la DLQ real tenía pendientes con más `dedupe_count`). El
                # desenlace de arriba es legítimo, pero no dice nada sobre el agrupado — y darlo por
                # verde sería exactamente el veredicto que cubre dos realidades opuestas.
                print("❌ el ciclo no tocó ninguna de las 2 ocurrencias fabricadas: tomó otro bug "
                      "de la DLQ real. La cadena corrió, pero este E2E NO midió el agrupado "
                      "cross-tenant. Volvé a correrlo con la DLQ vacía.", file=sys.stderr)
                return 1

            # Y si se llegó a proponer PR, el hermano tiene que haber quedado cerrado también — si
            # no, mañana el ciclo lo toma y forja el mismo parche otra vez, un día por tenant.
            if estado == "pr_propuesto" and "reparacion_propuesta" not in (estado_a, estado_b):
                print("❌ se propuso el PR pero ninguna fila quedó en `reparacion_propuesta`",
                      file=sys.stderr)
                return 1
            if estado == "pr_propuesto" and (estado_a, estado_b) != ("reparacion_propuesta",) * 2:
                print(f"❌ se propuso el PR pero el HERMANO quedó en {estado_a!r}/{estado_b!r}: "
                      f"mañana el ciclo lo vuelve a tomar y propone el mismo parche de nuevo.",
                      file=sys.stderr)
                return 1

            print(f"\n✅ E2E REAL: la cadena entera corrió (desenlace '{estado}') y el ciclo trató "
                  f"a las 2 ocurrencias como UN solo bug.\n"
                  f"   gates → forja → auditor → gate de tests, una vez para toda la app.")
            return 0

        print("❌ no terminó en 20 minutos", file=sys.stderr)
        return 1
    finally:
        # Siempre, pase lo que pase: los traumas son fabricados y no pueden quedar en la DLQ real.
        _limpiar(trauma_a, tenant_a)
        _limpiar(trauma_b, tenant_b)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
