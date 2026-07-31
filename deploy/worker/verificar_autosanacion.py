"""Verifica el ciclo de auto-reparación **por efecto**, contra el Temporal vivo.

No pregunta "¿el deploy dijo que salió bien?" — eso ya lo dijo el deploy. Pregunta lo único que
importa: **¿el worker conoce el workflow y lo ejecuta?**

## Por qué se dispara de verdad en vez de leer una lista

Temporal no expone "qué workflows tiene registrados este worker". Un `AutosanacionWorkflow` que
nadie registró **no da error**: el Schedule dispara, la ejecución queda encolada esperando un worker
que la tome, y desde afuera se ve igual que "todavía no le tocó". Un chequeo que sólo listara
Schedules diría VERDE con el ciclo completamente muerto.

Por eso el verificador dispara uno y espera el desenlace. Y **cualquier** desenlace del workflow
—`sin_traumas`, `rechazado_por_gate`, `pr_propuesto`— prueba lo mismo: el worker lo tomó y lo corrió
de punta a punta. Lo único que falla es que no termine.

## Controles horneados

1. **Si no hay Schedules, exit 2**, no "todo bien". Cero Schedules es la forma más silenciosa de que
   el ciclo esté apagado, y un verificador que lo lea como éxito es peor que ninguno.
2. **El disparo es idempotente y seguro**: el workflow toma UN trauma y, si no hay ninguno, devuelve
   `sin_traumas` sin tocar nada. En una base sin traumas pendientes esto es un no-op.

Uso:
    TEMPORAL_TARGET=127.0.0.1:7233 python verificar_autosanacion.py [--disparar]

Sin `--disparar` sólo informa el estado de los Schedules (rápido, cero efectos).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

PREFIJO = "autosanacion-"


async def main() -> int:
    from temporalio.client import Client

    ap = argparse.ArgumentParser()
    ap.add_argument("--disparar", action="store_true",
                    help="dispara un Schedule y espera el desenlace: la ÚNICA prueba de que el "
                         "worker tiene el workflow registrado")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--pausar-todo", action="store_true",
                    help="APAGADO DE EMERGENCIA. Pausa todos los Schedules del ciclo. Es el único "
                         "apagado inmediato: la env var COPILOTO_AUTOSANACION_OFF exige reiniciar "
                         "el worker (systemd fija el entorno al arrancar — verificado en "
                         "/proc/<pid>/environ, 2026-07-31)")
    ap.add_argument("--reanudar-todo", action="store_true", help="deshace --pausar-todo")
    args = ap.parse_args()

    client = await Client.connect(os.environ.get("TEMPORAL_TARGET", "localhost:7233"),
                                  namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))

    schedules = []
    async for s in await client.list_schedules():
        if s.id.startswith(PREFIJO):
            schedules.append(s)

    if not schedules:
        print(f"❌ no hay ningún Schedule '{PREFIJO}*'. El ciclo NO está activo para ningún tenant.\n"
              f"   Corré `ensure_autosanacion_schedules.py` (paso 4.6 del deploy).", file=sys.stderr)
        return 2

    print(f"{len(schedules)} Schedule(s) de autosanación:")
    for s in schedules:
        pausado = getattr(getattr(s, "schedule", None), "state", None)
        marca = "⏸ PAUSADO" if getattr(pausado, "paused", False) else "▶ activo"
        print(f"  {marca}  {s.id}")

    if args.pausar_todo or args.reanudar_todo:
        pausar = args.pausar_todo
        verbo = "pausando" if pausar else "reanudando"
        print(f"\n{verbo} {len(schedules)} Schedule(s)…")
        for s in schedules:
            handle = client.get_schedule_handle(s.id)
            if pausar:
                await handle.pause(note="apagado de emergencia del ciclo de auto-reparación")
            else:
                await handle.unpause(note="reanudado a mano")
        # Se relee del servidor en vez de confiar en que los `await` no lanzaron: el efecto se
        # verifica mirando el estado, no contando las llamadas que salieron bien.
        #
        # Con REINTENTO, y no por prolijidad: `list_schedules` sale del store de **Visibility**, que
        # es eventualmente consistente. Medido el 2026-07-31 — la primera versión releía al toque y
        # reportaba "quedaron 16 pausados y se esperaban 19" con los 19 ya pausados; dos segundos
        # después la misma consulta los mostraba todos. El apagado funcionaba y el control decía que
        # no, que es la peor dirección posible para un instrumento de emergencia: haría dudar del
        # apagado justo cuando hay que apagar ([[dato-en-dos-tiempos-lector-de-un-tiempo]]).
        esperados = len(schedules) if pausar else 0
        for intento in range(15):
            await asyncio.sleep(1)
            quedaron = 0
            async for s in await client.list_schedules():
                if s.id.startswith(PREFIJO) and getattr(
                        getattr(getattr(s, "schedule", None), "state", None), "paused", False):
                    quedaron += 1
            if quedaron == esperados:
                print(f"✅ verificado contra el servidor tras {intento + 1}s: "
                      f"{quedaron} pausado(s) de {len(schedules)}")
                return 0
        print(f"❌ tras 15s quedaron {quedaron} pausados y se esperaban {esperados}. No es latencia "
              f"de Visibility: algo no se aplicó.", file=sys.stderr)
        return 1

    if not args.disparar:
        print("\n(sin --disparar: NO se verificó que el worker tenga el workflow registrado —\n"
              " un Schedule activo apuntando a un workflow que nadie registró se ve idéntico)")
        return 0

    async def _ejecuciones() -> list:
        """Las ejecuciones del workflow, **listadas por tipo**.

        NO se arma el `workflow_id` a mano. Temporal le agrega a cada disparo de un Schedule un
        sufijo con el timestamp (`autosanacion-run-<cid>-2026-07-31T23:48:00Z`) para que cada
        ejecución tenga id único. La primera versión de este verificador construía el id sin el
        sufijo, no encontraba nada, y al agotar el timeout informaba *"el síntoma típico de un
        workflow que NADIE registró"* — con el workflow registrado y las ejecuciones en COMPLETED.
        Un instrumento que acusa al sistema de un fallo propio manda a depurar el lugar equivocado.
        """
        salida = []
        async for w in client.list_workflows('WorkflowType = "AutosanacionWorkflow"'):
            salida.append(w)
            if len(salida) >= 20:
                break
        return salida

    antes = {w.id for w in await _ejecuciones()}
    handle = client.get_schedule_handle(schedules[0].id)
    print(f"\n▶ disparando {schedules[0].id} …")
    await handle.trigger()

    # Se espera una ejecución NUEVA y su DESENLACE. Lo nuevo importa: sin comparar contra `antes`,
    # una ejecución vieja ya terminada haría pasar el chequeo sin que este disparo hiciera nada.
    for _ in range(args.timeout):
        await asyncio.sleep(1)
        nuevas = [w for w in await _ejecuciones() if w.id not in antes]
        if not nuevas:
            continue
        w = nuevas[0]
        estado = w.status.name
        if estado == "RUNNING":
            continue
        if estado == "COMPLETED":
            resultado = await client.get_workflow_handle(w.id).result()
            print(f"✅ el worker TIENE el workflow registrado y lo corrió entero.\n"
                  f"   ejecución: {w.id}\n   desenlace: {resultado}")
            return 0
        print(f"❌ la ejecución {w.id} terminó en {estado} — el ciclo corre pero falla",
              file=sys.stderr)
        return 1

    print(f"❌ no apareció ninguna ejecución nueva en {args.timeout}s. Puede ser un workflow que "
          f"nadie registró (queda encolada esperando un worker) — verificalo mirando si hay "
          f"ejecuciones en estado RUNNING antes de concluirlo.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
