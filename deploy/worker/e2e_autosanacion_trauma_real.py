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


def _tenant_con_schedule() -> str:
    conn = _conectar()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants "
                        f"WHERE status = 'active' LIMIT 1")
            fila = cur.fetchone()
    finally:
        conn.close()
    if not fila:
        raise SystemExit("❌ no hay tenants activos: no hay dónde correr el E2E")
    return fila[0]


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

    cliente_id = _tenant_con_schedule()
    fingerprint = f"e2e{uuid.uuid4().hex[:5]}"
    trauma_id = _depositar(cliente_id, fingerprint)
    print(f"trauma {trauma_id} depositado para {cliente_id} sobre {ARCHIVO}")

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
        await client.get_schedule_handle(f"autosanacion-{cliente_id}").trigger()
        print("Schedule disparado; esperando el desenlace…")

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
            if estado in DESENLACES_QUE_PRUEBAN:
                print(f"✅ E2E REAL: la cadena entera corrió (desenlace '{estado}').\n"
                      f"   El trauma pasó por gates → forja → auditor → gate de tests.")
                return 0
            print(f"❌ desenlace '{estado}': el ciclo NO llegó a forjar. "
                  f"Esperado uno de {DESENLACES_QUE_PRUEBAN}", file=sys.stderr)
            return 1

        print("❌ no terminó en 20 minutos", file=sys.stderr)
        return 1
    finally:
        # Siempre, pase lo que pase: el trauma es fabricado y no puede quedar en la DLQ real.
        _limpiar(trauma_id, cliente_id)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
