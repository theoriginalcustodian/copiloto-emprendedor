"""deploy/copiloto/gotrue/migrate_tenants.py — migra los tenants existentes de la GoTrue de fusion a
la GoTrue DEDICADA del copiloto (Opción C, cutover).

Por cada fila de `uc_factory.tenants`: recrea el user (MISMO email, password temporal nuevo) en la
instancia DEDICADA y actualiza `auth_user_id` al id nuevo. PRESERVA `cliente_id` → el tenant NO pierde
su MP/memoria/datos (todo está keyed por cliente_id, no por auth_user_id). Re-setea también el claim
`app_metadata.cliente_id` (paridad; el camino crítico sigue siendo el registry por auth_user_id).

Idempotente: un email ya presente en la dedicada (HTTP 422) NO se re-crea ni se le rota el password
(`admin_create_user` lo tolera y devuelve el existente). La detección "creado vs ya existía" compara el
id nuevo contra el `auth_user_id` que había en la DB ANTES del update.

Sin SMTP los users migrados no pueden auto-resetear el password → se les asigna uno TEMPORAL, que se
escribe SOLO en `--creds-out` (chmod 600), NUNCA en stdout/logs. Cambio de password = deuda diferida
(OTP por WhatsApp).

Env requerido (lo exporta migrate-and-cutover.sh): SUPABASE_URL + SERVICE_ROLE_KEY = la GoTrue DEDICADA
(no fusion); DATABASE_URL = Postgres de fusion (donde vive uc_factory). Corre con el venv del copiloto
y cwd en apps/copiloto (para `from onboarding import GoTrueAdmin`)."""
from __future__ import annotations

import argparse
import os
import secrets
import sys

sys.path.insert(0, os.environ.get("UC_COPILOTO_SRC", "/opt/uc-repos/copiloto/apps/copiloto"))

import psycopg2  # noqa: E402
from onboarding import GoTrueAdmin  # noqa: E402


def _gen_password() -> str:
    # Fuerte + cumple políticas típicas (mayús/minús/dígito/símbolo). Temporal (deuda: reset por OTP).
    return "Tmp-" + secrets.token_urlsafe(18) + "-aA1!"


def _append(path: str, line: str) -> None:
    """Append atómico por línea (600). NUNCA trunca (review M3/A1): un crash a mitad de migración
    conserva lo ya escrito (sin lockout) y una corrida incremental no destruye creds/map previos."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as f:
        f.write(line)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--creds-out", required=True, help="archivo 600 (append-only) email\\tpassword de los creados")
    ap.add_argument("--map-out", required=True,
                    help="archivo 600 (append-only) cliente_id\\told_auth_user_id\\tnew_auth_user_id — para rollback-DB")
    args = ap.parse_args()

    db_url = os.environ["DATABASE_URL"]
    gotrue = GoTrueAdmin.from_env()  # SUPABASE_URL/SERVICE_ROLE_KEY = DEDICADA (exportadas por el caller)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT cliente_id::text, email, auth_user_id FROM uc_factory.tenants ORDER BY email")
        rows = cur.fetchall()

    n_created = 0
    for cliente_id, email, old_uid in rows:
        if not email:
            print(f"SKIP cliente_id={cliente_id}: sin email")
            continue
        pw = _gen_password()
        user = gotrue.admin_create_user(email, pw)  # tolera 422 -> devuelve el existente
        new_uid = user["id"]
        is_new = str(new_uid) != str(old_uid)  # en la dedicada vacía, siempre nuevo en la 1ª corrida

        # Persistir creds + mapeo old->new ANTES del UPDATE (crash-safe): si el UPDATE falla, el user
        # ya existe con esa pw (sin lockout) y el mapeo permite el rollback-DB (restaurar old_uid).
        if is_new:
            _append(args.creds_out, f"{email}\t{pw}\n")
            n_created += 1
        _append(args.map_out, f"{cliente_id}\t{old_uid}\t{new_uid}\n")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE uc_factory.tenants SET auth_user_id=%s WHERE cliente_id=%s",
                (new_uid, cliente_id),
            )
        try:
            gotrue.admin_set_claim(new_uid, cliente_id)
        except Exception as exc:  # noqa: BLE001 — el claim es paridad, no el camino crítico
            print(f"WARN admin_set_claim {email}: {exc}")

        print(f"OK {email}: auth_user_id {old_uid} -> {new_uid} ({'creado' if is_new else 'ya existía (idempotente)'})")

    print(f"migración: {n_created} users nuevos (creds -> {args.creds_out}, 600, NO impresos) · "
          f"mapeo rollback-DB -> {args.map_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
