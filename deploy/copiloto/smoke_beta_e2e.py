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

# 10) CONSOLA -- CONS8, contrato `abierto/..._CONS8-el-cierre-que-prueba-la-consola-contra-el-
# entorno-vivo.md`. 7a (suspender/reactivar) en este bloque; 7b (reintentar) en el bloque 10d,
# más abajo -- los dos ciclos mutar->auditar quedan cubiertos.
ADMIN_ENDPOINTS = ("/admin/salud", "/admin/uso", "/admin/errores", "/admin/soporte", "/admin/auditoria")

# 10a) ADVERSARIAL HOSTIL -- con el token SIN el claim admin (capturado en el paso 2, ANTES de
# otorgar nada abajo). Un JWT ya emitido no cambia si GoTrue actualiza app_metadata después --
# por eso este token, tomado antes del grant, es un no-admin genuino para este control.
if token:
    for path in ADMIN_ENDPOINTS:
        try:
            r = client.get(path, headers=H)
            rec(f"adversarial: no-admin GET {path} → 403", r.status_code == 403, f"status={r.status_code}")
        except Exception as e:
            rec(f"adversarial: no-admin GET {path} → 403", False, repr(e))
    try:
        r = client.post(f"/admin/tenants/{cliente_id}/estado", headers=H, json={"status": "suspended"})
        rec("adversarial: no-admin POST /admin/tenants/{id}/estado → 403", r.status_code == 403, f"status={r.status_code}")
    except Exception as e:
        rec("adversarial: no-admin POST /admin/tenants/{id}/estado → 403", False, repr(e))
else:
    for path in (*ADMIN_ENDPOINTS, "/admin/tenants/{id}/estado"):
        rec(f"adversarial: no-admin {path} → 403", False, "sin token (falló el login del paso 2)")

# 10b) otorgar el claim -- mismo PUT que `asignar-claim-admin.sh`/`onboarding.GoTrueAdmin.
# admin_grant_operador` ya verificaron empíricamente: MERGEA app_metadata, no lo reemplaza
# (docs/copiloto-emprendedor/2026-08-06-RESULT-CONS0b-claim-admin.md). Llamado directo, mismo
# estilo que ya usa el CLEANUP de abajo -- este script se mantiene sin depender de `apps/copiloto`.
admin_token = None
sup = (os.environ.get("SUPABASE_URL") or os.environ.get("COPILOTO_SUPABASE_URL") or "").rstrip("/")
sr = os.environ.get("SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
try:
    if not (sup and sr and cliente_id):
        rec("consola: otorgar claim admin", False, "faltan SUPABASE_URL/SERVICE_ROLE_KEY/cliente_id")
    else:
        gh = {"apikey": sr, "Authorization": f"Bearer {sr}"}
        lookup = httpx.get(f"{sup}/auth/v1/admin/users", headers=gh, params={"filter": EMAIL}, timeout=15)
        lookup.raise_for_status()
        payload = lookup.json()
        users = payload.get("users", []) if isinstance(payload, dict) else payload
        user = next((u for u in (users or []) if (u.get("email") or "").lower() == EMAIL.lower()), None)
        if user is None:
            rec("consola: otorgar claim admin", False, f"'{EMAIL}' no aparece en el lookup de GoTrue")
        else:
            put = httpx.put(f"{sup}/auth/v1/admin/users/{user['id']}", headers=gh,
                            json={"app_metadata": {"copiloto_admin": True}}, timeout=15)
            put.raise_for_status()
            rec("consola: otorgar claim admin", True, f"user_id={user['id']}")
            # re-login: el token viejo no refleja el claim nuevo (snapshot al momento de emitirse).
            r2 = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
            admin_token = r2.json().get("access_token") if r2.status_code == 200 else None
            rec("consola: re-login post-grant", bool(admin_token), f"status={r2.status_code}")
except Exception as e:
    rec("consola: otorgar claim admin", False, repr(e))

# 10c) el camino admin, con control positivo -- el mismo listado que el adversarial de arriba
# rechazó, ahora debe dar 200. El último paso es el que vale: cierra mutar→auditar por HTTP real.
if admin_token:
    AH = {"Authorization": f"Bearer {admin_token}"}
    try:
        r = client.get("/me", headers=AH)
        rec("consola: GET /me → es_admin true", r.status_code == 200 and r.json().get("es_admin") is True,
            f"status={r.status_code} body={r.json() if r.status_code == 200 else r.text[:120]}")
    except Exception as e:
        rec("consola: GET /me → es_admin true", False, repr(e))

    for path in ADMIN_ENDPOINTS:
        try:
            r = client.get(path, headers=AH)
            rec(f"consola: admin GET {path} → 200", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            rec(f"consola: admin GET {path} → 200", False, repr(e))

    try:
        r = client.post(f"/admin/tenants/{cliente_id}/estado", headers=AH, json={"status": "suspended"})
        rec("consola: admin POST /admin/tenants/{id}/estado → 200 (MUTA, 7a)",
            r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        rec("consola: admin POST /admin/tenants/{id}/estado → 200 (MUTA, 7a)", False, repr(e))

    try:
        r = client.get("/admin/auditoria", headers=AH, params={"cliente_id": cliente_id})
        eventos = r.json().get("eventos", []) if r.status_code == 200 else []
        fila = next((e for e in eventos if e.get("accion") == "tenant.estado"), None)
        ok = (fila is not None and fila.get("detalle", {}).get("cliente_id") == cliente_id
              and fila.get("detalle", {}).get("a") == "suspended")
        rec("consola: GET /admin/auditoria → el evento de la mutación aparece, detalle intacto",
            ok, f"status={r.status_code} fila={fila}")
    except Exception as e:
        rec("consola: GET /admin/auditoria → el evento de la mutación aparece, detalle intacto", False, repr(e))
else:
    for step in ("GET /me → es_admin true", *[f"admin GET {p} → 200" for p in ADMIN_ENDPOINTS],
                "admin POST /admin/tenants/{id}/estado → 200 (MUTA, 7a)",
                "GET /admin/auditoria → el evento de la mutación aparece, detalle intacto"):
        rec(f"consola: {step}", False, "sin admin_token (falló el grant o el re-login)")

# 10d) CICLO DEL REINTENTO -- 7b, la acción que muta IRREVERSIBLE de las dos (CONS7b). Nada la
# ejercitaba contra el entorno vivo -- mismo patrón que el 500 de auditoría y el deploy stale: un
# gap de entorno, no de código, invisible a la suite. Si el entorno vivo no tiene ningún trauma
# reintentable, NO se saltea el paso: se fabrica uno (mismo patrón que el resto del script, que ya
# fabrica el tenant sintético) -- saltear por falta de dato daría un smoke verde que no probó nada.
trauma_id_reintento = None
if admin_token:
    fp_reintento = f"smoke-reintento-{uuid.uuid4().hex[:8]}"
    try:
        import json as _json
        import psycopg2 as _psycopg2
        dsn_fab = os.environ.get("DATABASE_URL")
        conn = _psycopg2.connect(dsn_fab); conn.autocommit = True
        with conn.cursor() as cur:
            # copiloto_traumas tiene FORCE RLS -- hay que declarar el tenant ANTES del INSERT
            # (mismo mecanismo que contexto_tenant.declarar_en_conexion) o la policy lo rechaza.
            cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                       (_json.dumps({"cliente_id": cliente_id}),))
            cur.execute(
                """INSERT INTO uc_factory.copiloto_traumas
                        (cliente_id, fingerprint, workflow, error_type, costura, estado, dedupe_count)
                    VALUES (%s, %s, %s, %s, %s, %s, 1) RETURNING id""",
                (cliente_id, fp_reintento, "SmokeTestWorkflow", "SmokeError", "smoke_test", "pendiente"))
            trauma_id_reintento = cur.fetchone()[0]
        conn.close()
        rec("reintento: trauma fabricado (dominio permitido)", trauma_id_reintento is not None,
            f"id={trauma_id_reintento} fingerprint={fp_reintento}")
    except Exception as e:
        rec("reintento: trauma fabricado (dominio permitido)", False, repr(e))

    try:
        r = client.get("/admin/errores", headers=AH, params={"cliente_id": cliente_id})
        filas = r.json().get("errores", []) if r.status_code == 200 else []
        fila = next((f for f in filas if f.get("fingerprint") == fp_reintento), None)
        ok = (fila is not None and fila.get("id") == trauma_id_reintento
              and fila.get("motivo_prohibido") is None)
        rec("reintento: GET /admin/errores trae el trauma con motivo_prohibido=null", ok,
            f"status={r.status_code} fila={fila}")
    except Exception as e:
        rec("reintento: GET /admin/errores trae el trauma con motivo_prohibido=null", False, repr(e))

    if trauma_id_reintento is not None:
        try:
            r = client.post(f"/admin/errores/{trauma_id_reintento}/reintentar", headers=AH)
            rec("reintento: POST /admin/errores/{id}/reintentar → 200 (MUTA, 7b)",
                r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")
        except Exception as e:
            rec("reintento: POST /admin/errores/{id}/reintentar → 200 (MUTA, 7b)", False, repr(e))

        try:
            r = client.get("/admin/auditoria", headers=AH, params={"cliente_id": cliente_id})
            eventos = r.json().get("eventos", []) if r.status_code == 200 else []
            fila = next((e for e in eventos if e.get("accion") == "trauma.reintento"
                        and e.get("detalle", {}).get("trauma_id") == trauma_id_reintento), None)
            ok = fila is not None and fila.get("detalle", {}).get("fingerprint") == fp_reintento
            rec("reintento: GET /admin/auditoria → el evento del REINTENTO aparece, detalle intacto",
                ok, f"status={r.status_code} fila={fila}")
        except Exception as e:
            rec("reintento: GET /admin/auditoria → el evento del REINTENTO aparece, detalle intacto",
                False, repr(e))
    else:
        for step in ("POST /admin/errores/{id}/reintentar → 200 (MUTA, 7b)",
                    "GET /admin/auditoria → el evento del REINTENTO aparece, detalle intacto"):
            rec(f"reintento: {step}", False, "sin trauma reintentable: no se pudo ejercitar")
else:
    for step in ("trauma fabricado (dominio permitido)",
                "GET /admin/errores trae el trauma con motivo_prohibido=null",
                "POST /admin/errores/{id}/reintentar → 200 (MUTA, 7b)",
                "GET /admin/auditoria → el evento del REINTENTO aparece, detalle intacto"):
        rec(f"reintento: {step}", False, "sin admin_token (falló el grant o el re-login)")

# CLEANUP (best-effort)
try:
    import json as _json
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
        if trauma_id_reintento is not None:
            # FORCE RLS -- declarar el tenant antes de borrar, mismo mecanismo que el INSERT de arriba.
            cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                       (_json.dumps({"cliente_id": cliente_id}),))
            cur.execute("delete from uc_factory.copiloto_traumas where id = %s", (trauma_id_reintento,))
            print(f"[cleanup] trauma fabricado borrado={cur.rowcount}")
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
