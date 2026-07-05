#!/usr/bin/env python3
"""E2E smoke de BETA del Copiloto — driveá la API VIVA como un amigo sintético (black-box HTTP,
loopback). Provisiona un tenant `smoke-<rand>@beta.local`, recorre la ruta completa del usuario y
hace cleanup. Exit != 0 si falla un CRÍTICO (alta/login/me/chat-responde).

Corre EN EL VPS con el venv del copiloto + los env sourceados (DATABASE_URL + SUPABASE_URL +
service_role para el cleanup). Cero deps extra: httpx + psycopg2 ya están en el venv.

Uso (en el VPS):
    set -a; . /etc/unreal-copilot/copiloto.env; . /etc/unreal-copilot/fusion-pg.env; \\
            . /etc/unreal-copilot/fusion-supabase.env; set +a
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/smoke_beta_e2e.py

Parametrizable por env: SMOKE_BASE (default http://127.0.0.1:8099) · SMOKE_CHAT_TIMEOUT (default 120).
Hace 2 chats con LLM real (COGS ~centavos). Correr antes de abrir la app a testers / tras cada deploy.
"""
import os, sys, time, uuid
import httpx

BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8099")
EMAIL = f"smoke-{uuid.uuid4().hex[:8]}@beta.local"
PASSWORD = "Smoke-" + uuid.uuid4().hex[:12] + "!"
CHAT_TIMEOUT = int(os.environ.get("SMOKE_CHAT_TIMEOUT", "120"))

client = httpx.Client(base_url=BASE, timeout=30.0)
results = []
def rec(step, ok, detail=""):
    results.append((step, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {step}" + (f" — {detail}" if detail else ""), flush=True)

def reply_text_of(row):
    for k in ("reply_text", "text"):
        v = (row.get(k) or "").strip() if isinstance(row.get(k), str) else ""
        if v:
            return v
    return ""

def poll_reply(token, session_id, after_id=0, timeout=CHAT_TIMEOUT):
    deadline = time.time() + timeout
    h = {"Authorization": f"Bearer {token}"}
    while time.time() < deadline:
        try:
            r = client.get("/reply", params={"session_id": session_id, "after_id": after_id}, headers=h)
            if r.status_code == 200:
                texts = [t for t in (reply_text_of(x) for x in r.json().get("replies", [])) if t]
                if texts:
                    return " | ".join(texts)
        except Exception:
            pass
        time.sleep(2)
    return None

# 1) ALTA
cliente_id = None
try:
    r = client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    cliente_id = j.get("cliente_id")
    rec("alta (/auth/signup)", r.status_code == 200 and bool(cliente_id), f"status={r.status_code} cliente_id={cliente_id}")
except Exception as e:
    rec("alta (/auth/signup)", False, repr(e))

# 2) LOGIN
token = refresh = None
try:
    r = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code == 200:
        token = r.json().get("access_token"); refresh = r.json().get("refresh_token")
    rec("login (/auth/login)", bool(token), f"status={r.status_code} token_len={len(token or '')}")
except Exception as e:
    rec("login (/auth/login)", False, repr(e))
H = {"Authorization": f"Bearer {token}"} if token else {}

# 3) /me
try:
    r = client.get("/me", headers=H)
    j = r.json() if r.status_code == 200 else {}
    rec("/me (identidad de tenant)", r.status_code == 200 and j.get("cliente_id") == cliente_id, f"status={r.status_code} me={j}")
except Exception as e:
    rec("/me (identidad de tenant)", False, repr(e))

# 4) /catalog
try:
    r = client.get("/catalog", headers=H)
    svcs = r.json().get("services", []) if r.status_code == 200 else []
    rec("/catalog", r.status_code == 200 and len(svcs) > 0, f"status={r.status_code} n_services={len(svcs)}")
except Exception as e:
    rec("/catalog", False, repr(e))

# 5) /warm (best-effort)
try:
    r = client.post("/warm", headers=H)
    rec("/warm (memoria)", r.status_code == 200, f"status={r.status_code} {r.json() if r.status_code==200 else r.text[:80]}")
except Exception as e:
    rec("/warm (memoria)", False, repr(e))

# 6) CHAT simple → el agente responde E2E (CRÍTICO)
sid = f"smoke-{uuid.uuid4().hex[:8]}"
try:
    r = client.post("/chat", headers=H, json={"session_id": sid, "text": "Hola, ¿qué podés hacer por mí? Respondé breve.", "kind": "text"})
    if r.status_code == 200 and r.json().get("accepted"):
        reply = poll_reply(token, sid)
        rec("chat simple → el agente responde", bool(reply), f"reply={(reply or '(sin respuesta en %ds)' % CHAT_TIMEOUT)[:140]}")
    else:
        rec("chat simple → el agente responde", False, f"POST /chat status={r.status_code} body={r.text[:120]}")
except Exception as e:
    rec("chat simple → el agente responde", False, repr(e))

# 7) CHAT ReAct multi-paso
sid2 = f"smoke-{uuid.uuid4().hex[:8]}"
try:
    r = client.post("/chat", headers=H, json={"session_id": sid2, "text": "Agendá una reunión con Juan mañana a las 10 y mandale un mail con el resumen.", "kind": "text"})
    if r.status_code == 200 and r.json().get("accepted"):
        reply = poll_reply(token, sid2)
        rec("chat ReAct (multi-paso) → responde coherente", bool(reply), f"reply={(reply or '(sin respuesta)')[:160]}")
    else:
        rec("chat ReAct (multi-paso) → responde coherente", False, f"POST /chat status={r.status_code}")
except Exception as e:
    rec("chat ReAct (multi-paso) → responde coherente", False, repr(e))

# 8) connect URLs (no crítico: dependen de gateways externos)
for name, path, params in [("composio/gmail", "/composio/connect", {"service": "gmail"}), ("mercadopago", "/mp/connect", {})]:
    try:
        r = client.get(path, headers=H, params=params)
        ok = r.status_code == 200 and str(r.json().get("url", "")).startswith("http")
        rec(f"connect {name} → URL OAuth", ok, f"status={r.status_code}")
    except Exception as e:
        rec(f"connect {name} → URL OAuth", False, repr(e))

# 9) refresh
try:
    if refresh:
        r = client.post("/auth/refresh", json={"refresh_token": refresh})
        rec("/auth/refresh (sesión persistente)", r.status_code == 200 and "access_token" in r.json(), f"status={r.status_code}")
    else:
        rec("/auth/refresh (sesión persistente)", False, "sin refresh token")
except Exception as e:
    rec("/auth/refresh (sesión persistente)", False, repr(e))

# CLEANUP (best-effort)
try:
    import psycopg2
    dsn = os.environ.get("DATABASE_URL")
    sup = (os.environ.get("SUPABASE_URL") or os.environ.get("COPILOTO_SUPABASE_URL") or "").rstrip("/")
    sr = os.environ.get("SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    auth_id = None
    if dsn:
        c = psycopg2.connect(dsn); c.autocommit = True; cur = c.cursor()
        cur.execute("select auth_user_id::text from uc_factory.tenants where email=%s", (EMAIL,))
        row = cur.fetchone(); auth_id = row[0] if row else None
        cur.execute("delete from uc_factory.tenants where email=%s", (EMAIL,))
        print(f"[cleanup] tenant rows borrados={cur.rowcount}")
    if auth_id and sup and sr:
        httpx.request("DELETE", f"{sup}/auth/v1/admin/users/{auth_id}",
                      headers={"Authorization": f"Bearer {sr}", "apikey": sr}, timeout=15)
        print(f"[cleanup] gotrue user {auth_id} borrado")
except Exception as e:
    print(f"[cleanup] degradado (limpiar a mano {EMAIL}): {e!r}")

# RESUMEN
CRIT = {"alta (/auth/signup)", "login (/auth/login)", "/me (identidad de tenant)", "chat simple → el agente responde"}
fails = [s for s, ok, _ in results if not ok]
crit_fails = [s for s in fails if s in CRIT]
print("\n===== RESUMEN SMOKE BETA =====")
print(f"total={len(results)} pass={sum(1 for _, ok, _ in results if ok)} fail={len(fails)}")
if fails:
    print("FALLARON: " + " · ".join(fails))
print("VEREDICTO: " + ("BETA-READY (criticos verdes)" if not crit_fails else "BLOQUEA BETA (critico rojo): " + " · ".join(crit_fails)))
sys.exit(1 if crit_fails else 0)
