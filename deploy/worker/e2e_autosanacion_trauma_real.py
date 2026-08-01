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


def _depositar(cliente_id: str, fingerprint: str) -> int:
    """Inserta el trauma directo (superuser, sin RLS): es el papel del BORDE, que acá no existe."""
    import json
    conn = _conectar()
    conn.autocommit = True
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


def _limpiar(trauma_id: int) -> None:
    conn = _conectar()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLA} WHERE id = %s", (trauma_id,))
            print(f"  limpieza: {cur.rowcount} fila(s) borrada(s)")
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
        _limpiar(trauma_id)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
