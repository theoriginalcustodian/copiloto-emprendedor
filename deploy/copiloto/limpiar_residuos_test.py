"""Barre las filas huérfanas que dejaron tests y spikes en la base viva.

Huérfana = su `cliente_id` no corresponde a ningún tenant real. Esas filas son inalcanzables para la
app (todo se filtra por el tenant del token), así que sólo ocupan lugar y ensucian cualquier consulta
diagnóstica — al 2026-07-21 había 539, suficientes para que un muestreo al azar de "credenciales"
devolviera basura de test y me hiciera perseguir un bug de cifrado inexistente.

Entre ellas hay certificados de PRODUCCIÓN generados durante los spikes: no deberían seguir ahí.

DRY-RUN POR DEFECTO. Para borrar de verdad: `--ejecutar`.

    /opt/uc-copiloto-venv/bin/python deploy/copiloto/limpiar_residuos_test.py            # muestra
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/limpiar_residuos_test.py --ejecutar  # borra

Los tenants REALES no se tocan: el criterio es exactamente "no existe en uc_factory.tenants". El
tenant de pruebas de facturación tiene su fila, así que queda intacto — igual se lista al final para
que se vea, no para que se confíe.
"""
from __future__ import annotations

import os
import subprocess
import sys

TABLAS = ("mp_credentials", "mp_payments", "afip_credentials", "afip_perfil",
          "afip_secret_handoff", "afip_comprobantes", "copiloto_metering",
          "copiloto_web_replies")
UNIT = "uc-copiloto-web.service"


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(
        ["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no está corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


_heredar_env_del_proceso(UNIT)

import psycopg2  # noqa: E402

HUERFANA = ("NOT EXISTS (SELECT 1 FROM uc_factory.tenants t "
            "WHERE t.cliente_id = x.cliente_id)")


def main() -> int:
    ejecutar = "--ejecutar" in sys.argv
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()

    print("MODO: " + ("BORRADO REAL" if ejecutar else "dry-run (nada se borra)"))
    print()

    total = 0
    for tabla in TABLAS:
        cur.execute(f"SELECT count(*) FROM uc_factory.{tabla} x WHERE {HUERFANA}")
        huerfanas = cur.fetchone()[0]
        cur.execute(f"SELECT count(*) FROM uc_factory.{tabla}")
        todas = cur.fetchone()[0]
        marca = " " if huerfanas == 0 else "→"
        print(f" {marca} {tabla:<24} {huerfanas:>4} huérfanas de {todas}")
        total += huerfanas
        if ejecutar and huerfanas:
            cur.execute(f"DELETE FROM uc_factory.{tabla} x WHERE {HUERFANA}")

    print()
    if ejecutar:
        print(f"BORRADAS: {total} filas")
    else:
        print(f"SE BORRARÍAN: {total} filas   (volvé a correr con --ejecutar)")

    print("\n=== lo que queda, por tenant real ===")
    cur.execute("""SELECT t.email,
                          (SELECT count(*) FROM uc_factory.afip_credentials a
                             WHERE a.cliente_id = t.cliente_id) AS afip,
                          (SELECT count(*) FROM uc_factory.afip_comprobantes c
                             WHERE c.cliente_id = t.cliente_id) AS comprobantes,
                          (SELECT count(*) FROM uc_factory.mp_credentials m
                             WHERE m.cliente_id = t.cliente_id) AS mp
                     FROM uc_factory.tenants t ORDER BY t.email""")
    print(f"  {'email':<42} {'cert':>4} {'comprob':>8} {'mp':>4}")
    for email, afip, comprobantes, mp in cur.fetchall():
        print(f"  {str(email):<42} {afip:>4} {comprobantes:>8} {mp:>4}")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
