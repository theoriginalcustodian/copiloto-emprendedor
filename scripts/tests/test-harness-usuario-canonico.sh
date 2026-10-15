#!/usr/bin/env bash
# Control del guard de usuario canónico de `leer_credencial()` en `scripts/evidencia_device.py`.
#
# EL DEFECTO (2026-10-15): el login del harness escribió `sprint-e2e-…@copiloto.test` en vez de
# `e2e-device@copiloto.test`. `leer_credencial()` aceptaba cualquier usuario del archivo de secretos y el
# desvío entró mudo. La orden del operador es «un solo usuario de prueba canónico, a fuego».
#
# LAS DOS MITADES:
#   1. usuario canónico            -> devuelve (usuario, clave)
#   2. usuario NO canónico / vacío -> UsuarioNoCanonico, y el mensaje nombra LOS DOS usuarios
#   + CONTROL DEL CONTROL: la lógica VIEJA (sin guard) tiene que aceptar el usuario equivocado. Si no,
#     el fixture no reproduce el defecto y el verde de la mitad 2 no probaría nada.
#
# ⚠️ ALCANCE: el archivo es un fixture en un tmp; NO se abre el secreto real del operador.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -r "$RAIZ/scripts/evidencia_device.py" ] || { echo "FALLA: no existe scripts/evidencia_device.py"; exit 1; }

python3 -I -X utf8 - "$RAIZ/scripts" <<'PY'
import sys, tempfile
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import evidencia_device as e

fallos = 0
def check(desc, ok):
    global fallos
    if ok: print("  ok   " + desc)
    else: print("  FALLA " + desc); fallos += 1

def archivo(contenido):
    d = Path(tempfile.mkdtemp()); f = d / "cred.env"; f.write_text(contenido, encoding="utf-8"); return f

def viejo(ruta):  # la lógica de ANTES del guard (leía `usuario|clave` de un archivo propio)
    u, _, c = ruta.read_text(encoding="utf-8").strip().partition("|"); return u, c

def env(email, clave="clave"):  # formato real de `.env.e2e`: líneas CLAVE=valor
    return "\n".join(["# comentario", f"E2E_DEVICE_EMAIL={email}", f"E2E_DEVICE_PASSWORD={clave}", "E2E_DEVICE_CLIENTE_ID=x", ""])

CANON = e.EMAIL_CANONICO
check("0  el canónico es el de la orden del operador", CANON == "e2e-device@copiloto.test")
check("1  canónico -> (usuario, clave)", e.leer_credencial(archivo(env(CANON))) == (CANON, "clave"))

AJENO = "sprint-e2e-202607210019@copiloto.test"
f = archivo(f"{AJENO}|clave\n")
check("CC la lógica vieja ACEPTABA el usuario equivocado", viejo(f)[0] == AJENO)
for desc, cont in (("2a usuario ajeno", env(AJENO)), ("2b archivo vacío", ""), ("2c sin la clave E2E_DEVICE_EMAIL", "E2E_DEVICE_PASSWORD=x"),
                   ("2d canónico con mayúsculas", env(CANON.upper())), ("2e formato viejo usuario|clave", f"{CANON}|clave")):
    try:
        e.leer_credencial(archivo(cont)); check(desc + " -> UsuarioNoCanonico", False)
    except e.UsuarioNoCanonico as exc:
        check(desc + " -> UsuarioNoCanonico", True)
        if desc.startswith("2a"):
            check("2a el mensaje nombra los DOS usuarios", AJENO in str(exc) and CANON in str(exc))
check("4  el origen es .env.e2e del repo, no el archivo de ~/.claude/secrets", e.ruta_env_e2e().name == ".env.e2e" and "secrets" not in str(e.ruta_env_e2e()))
sys.exit(1 if fallos else 0)
PY
