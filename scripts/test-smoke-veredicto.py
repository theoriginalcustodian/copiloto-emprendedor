#!/usr/bin/env python3
"""Controles del veredicto del smoke de la beta (deploy/copiloto/smoke_beta_e2e.py).

Tres cosas, en este orden:
  1. `veredicto()` por AST (el script hace HTTP al importarse, no se importa): casos con los 37 reales.
  2. El denominador MEDIDO: el script completo corre contra un httpx de mentira (sin red, sin prod)
     y tiene que emitir exactamente EXPECTED_TOTAL checks en la ruta feliz.
  3. Control positivo sobre el script real: borrar UN rec() ⇒ ROJO (denominador).

Uso: python scripts/test-smoke-veredicto.py
"""
import ast
import os
import shutil
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SMOKE = os.path.join(ROOT, "deploy", "copiloto", "smoke_beta_e2e.py")
fallos = 0


def chk(nombre, cond, detalle=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  -- {detalle}"))
    if not cond:
        fallos += 1


# --- 1) veredicto() por AST -------------------------------------------------------------------
tree = ast.parse(open(SMOKE, encoding="utf-8").read())
keep = [n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name == "veredicto")
        or (isinstance(n, ast.Assign) and any(getattr(t, "id", "") in ("CRIT", "EXPECTED_TOTAL") for t in n.targets))]
ns = {}
exec(compile(ast.Module(body=keep, type_ignores=[]), SMOKE, "exec"), ns)
veredicto, CRIT, EXPECTED = ns["veredicto"], ns["CRIT"], ns["EXPECTED_TOTAL"]
chk("AST: CRIT tiene 5 nombres y EXPECTED_TOTAL = 37", len(CRIT) == 5 and EXPECTED == 37, f"{len(CRIT)} / {EXPECTED}")


def caso(mutar):
    res = [(n, True, "") for n in CRIT] + [(f"no-critico-{i}", True, "") for i in range(EXPECTED - len(CRIT))]
    return mutar(list(res))


def run(res):
    return veredicto(res, CRIT, EXPECTED)


lin, cod = run(caso(lambda r: r))
chk("37 en verde ⇒ exit 0, BETA-READY, '5/5 críticos · 32/32 no-críticos'",
    cod == 0 and "BETA-READY" in " ".join(lin) and "5/5 críticos · 32/32 no-críticos" in lin[1], f"{cod} {lin}")

lin, cod = run(caso(lambda r: [(s, ok and s != "login (/auth/login)", d) for s, ok, d in r]))
chk("crítico login rojo ⇒ exit 1, BLOQUEA",
    cod == 1 and "BLOQUEA" in " ".join(lin) and "login (/auth/login)" in " ".join(lin), f"{cod} {lin}")

lin, cod = run(caso(lambda r: [(s, ok and not s.startswith("no-critico-"), d) for s, ok, d in r]))
chk("32 no-críticos rojos ⇒ exit 0 (política), contadores lo dicen y nombra los rojos",
    cod == 0 and "5/5 críticos · 0/32 no-críticos" in lin[1] and "no-critico-0" in " ".join(lin)
    and "BETA-READY" in " ".join(lin), f"{cod} {lin}")

lin, cod = run(caso(lambda r: [x for x in r if x[0] != "no-critico-7"]))
chk("un rec no-crítico borrado ⇒ exit 1, DENOMINADOR",
    cod == 1 and "DENOMINADOR" in " ".join(lin), f"{cod} {lin}")

lin, cod = run(caso(lambda r: [x for x in r if x[0] != "login (/auth/login)"]))
chk("un crítico ausente ⇒ exit 1, AUSENTE",
    cod == 1 and "AUSENTE: login (/auth/login)" in " ".join(lin), f"{cod} {lin}")

ultima = lin[-1]
chk("la última línea nunca dice que 'los 37 pasaron'", "pasaron" not in ultima.lower(), ultima)


# --- 2) denominador MEDIDO con el script completo y un httpx de mentira -----------------------
STUB = '''
import json as _j
import os as _os
class _R:
    def __init__(self, code=200, data=None, text=None, ctype="application/json", headers=None):
        self.status_code = code; self._d = data if data is not None else {}
        self.text = text if text is not None else _j.dumps(self._d)
        self.headers = {"content-type": ctype, **(headers or {})}
    def json(self): return self._d
    def raise_for_status(self): pass
BODY = {"cliente_id": "c1", "access_token": "t", "refresh_token": "r", "es_admin": True,
        "services": [1], "url": "http://x", "accepted": True, "wf_id": "w1",
        "replies": [{"reply_text": "hola"}], "eventos": [{"accion": "tenant.estado", "detalle": {"cliente_id": "c1", "a": "suspended"}}],
        "errores": []}
class Client:
    def __init__(self, base_url=None, timeout=None): pass
    def get(self, path, params=None, headers=None):
        if path == "/index.html":
            if _os.environ.get("STUB_MODE") == "INDEX_SIN_SCRIPT":
                return _R(text="<html>sin script</html>", ctype="text/html")
            return _R(text='<script src="/assets/a.js"></script>', ctype="text/html")
        if path.startswith("/assets/"): return _R(text="x copilotoemprendedor.duckdns.org x", ctype="application/javascript")
        return _R(data=BODY)
    def post(self, path, json=None, headers=None):
        if path == "/auth/signup" and not (json or {}).get("invite_token"):
            return _R(403, {"detail": "invite"})
        return _R(data=BODY)
def get(url, headers=None, params=None, timeout=None, follow_redirects=None):
    if "/auth/v1/authorize" in url: return _R(302, text="", headers={"location": "https://accounts.google.com/o"})
    return _R(data={"users": [{"id": "u1", "email": (params or {}).get("filter", "")}]})
def put(url, headers=None, json=None, timeout=None): return _R()
def request(method, url, headers=None, timeout=None): return _R()
'''


def correr_script(smoke_path, env_extra=None):
    d = tempfile.mkdtemp()
    try:
        open(os.path.join(d, "httpx.py"), "w", encoding="utf-8").write(STUB)
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": d, "COPILOTO_INVITE_TOKEN": "tok-de-prueba",
               "SUPABASE_URL": "https://sup.test", "SERVICE_ROLE_KEY": "k-de-prueba"}
        env.update(env_extra or {})
        p = subprocess.run([sys.executable, smoke_path], capture_output=True, encoding="utf-8", env=env, timeout=120)
        return p.returncode, p.stdout + p.stderr
    finally:
        shutil.rmtree(d, ignore_errors=True)


rc, out = correr_script(SMOKE)
chk("ruta feliz medida: 37 checks ejecutados y exit 0",
    f"checks ejecutados: {EXPECTED} de {EXPECTED}" in out and rc == 0, f"rc={rc}\n{out[-1500:]}")
# Sólo el conteo: el stub no reproduce los 403 ni el trauma, así que los no-críticos quedan rojos a propósito
# y nombrados. Lo que se mide acá es el DENOMINADOR, no el estado de cada check.
chk("ruta feliz: los 5 críticos verdes en el stub y veredicto con los dos números",
    "5/5 críticos" in out and "no-críticos ROJOS" in out and "BETA-READY" in out, out[-800:])

# --- 2b) recuento FIJO: una rama que falla NO cambia el denominador (37), la falla sale roja con nombre
rc3, out3 = correr_script(SMOKE, {"SUPABASE_URL": ""})  # grant admin sin credenciales => rama de falla
chk("grant admin falla: sigue 37 de 37 (recuento fijo), exit 0 (no-crítico)",
    f"checks ejecutados: {EXPECTED} de {EXPECTED}" in out3 and rc3 == 0, f"rc={rc3}\n{out3[-600:]}")
chk("grant admin falla: el rojo sale NOMBRADO (grant y re-login)",
    "FAIL] consola: otorgar claim admin" in out3 and "FAIL] consola: re-login post-grant" in out3, out3[-600:])

rc4, out4 = correr_script(SMOKE, {"STUB_MODE": "INDEX_SIN_SCRIPT"})  # artefacto sin <script>
chk("artefacto sin <script>: sigue 37 de 37 (no baja a 35)",
    f"checks ejecutados: {EXPECTED} de {EXPECTED}" in out4 and rc4 == 0, f"rc={rc4}\n{out4[-600:]}")
chk("artefacto sin <script>: index, bundle y control negativo salen rojos con nombre",
    all(f"FAIL] {n}" in out4 for n in ("artefacto: index.html sirve un <script> de /assets",
                                       "artefacto: control negativo -- string imposible da 0 ocurrencias")),
    out4[-600:])

# --- 3) control positivo sobre el script REAL: borrar un rec() ⇒ ROJO -------------------------
LINEA = '    rec("/catalog", r.status_code == 200 and len(svcs) > 0, f"status={r.status_code} n_services={len(svcs)}")'
src = open(SMOKE, encoding="utf-8").read()
chk("precondición: la línea a borrar existe exactamente una vez", src.count(LINEA) == 1, src.count(LINEA))
tmpd = tempfile.mkdtemp()
try:
    mutado = os.path.join(tmpd, "smoke_sin_rec.py")
    open(mutado, "w", encoding="utf-8").write(src.replace(LINEA + "\n", ""))
    rc2, out2 = correr_script(mutado)
    chk("control positivo: borrar un rec() del script real ⇒ exit 1 y DENOMINADOR",
        rc2 == 1 and "DENOMINADOR" in out2 and "checks ejecutados: 36 de 37" in out2, f"rc={rc2}\n{out2[-800:]}")
finally:
    shutil.rmtree(tmpd, ignore_errors=True)

print("==> OK" if fallos == 0 else f"==> {fallos} FALLO(S)")
sys.exit(1 if fallos else 0)
