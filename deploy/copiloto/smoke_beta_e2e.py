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
import os, re, sys, time, uuid
import httpx
from meclaves_check import cargar_claves_declaradas, comparar_claves

BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8099")
EMAIL = f"smoke-{uuid.uuid4().hex[:8]}@beta.local"
PASSWORD = "Smoke-" + uuid.uuid4().hex[:12] + "!"
CHAT_TIMEOUT = int(os.environ.get("SMOKE_CHAT_TIMEOUT", "120"))
# C4.1: el alta quedó detrás de un invite-token fail-closed. El smoke lo lee del MISMO env que el
# server (`copiloto.env`, ya sourceado según el uso de arriba) — cero hardcoding, y si alguien rota
# el token el smoke lo sigue solo.
INVITE_TOKEN = os.environ.get("COPILOTO_INVITE_TOKEN", "")
if not INVITE_TOKEN:
    # Falla ACÁ y no en el paso 1: sin esto el smoke daría un 403 críptico en el alta y los diez
    # pasos siguientes en cascada, y alguien leería "C4.1 rompió prod" en vez de "falta la env".
    # El fail-closed del server es correcto; el instrumento tiene que decir POR QUÉ.
    sys.exit("COPILOTO_INVITE_TOKEN no está en el entorno: sourceá /etc/unreal-copilot/copiloto.env "
             "antes de correr el smoke (el alta está detrás del invite-gate desde C4.1).")

# MECLAVESRUNTIME: el set declarado de /me se lee UNA vez de apps/copiloto/me_contrato.py (MECLAVESCORE).
# Si el lector no encuentra el set, el smoke falla acá con el motivo, no compara contra la nada.
try:
    CLAVES_DECLARADAS = cargar_claves_declaradas()
    if not CLAVES_DECLARADAS:
        raise ValueError("CLAVES_ME vacío")
except Exception as e:
    sys.exit(f"MECLAVESRUNTIME: no pude cargar CLAVES_ME de apps/copiloto/me_contrato.py: {e!r}")

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

# 0) ADVERSARIAL DEL ALTA (C4.1) — va ANTES del alta buena, a propósito.
# Si el gate no existiera, este alta sin invite-token saldría 200 y crearía un tenant real: el caso
# hostil corriendo contra PROD VIVA, no sólo en CI. `CLAUDE.md` §Seguridad lo exige — un control de
# autorización sin test adversarial es un control no verificado, y el happy-path de abajo pasa igual
# con el gate o sin él.
try:
    r = client.post("/auth/signup", json={"email": f"intruso-{uuid.uuid4().hex[:8]}@beta.local",
                                          "password": "Intruso-" + uuid.uuid4().hex[:12] + "!"})
    rec("alta SIN invite-token es rechazada (C4.1)", r.status_code == 403, f"status={r.status_code}")
except Exception as e:
    rec("alta SIN invite-token es rechazada (C4.1)", False, repr(e))

# 1) ALTA
cliente_id = None
try:
    r = client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD,
                                          "invite_token": INVITE_TOKEN})
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
    # MECLAVESRUNTIME: sobra = clave no declarada en el payload real; falta = declarada que no llegó.
    if r.status_code == 200:
        sobra, falta = comparar_claves(j.keys(), CLAVES_DECLARADAS)
        rec("/me: set de claves = CLAVES_ME (MECLAVESRUNTIME)", not sobra and not falta,
            f"sobra_no_declaradas={sobra} faltan_declaradas={falta}")
    else:
        rec("/me: set de claves = CLAVES_ME (MECLAVESRUNTIME)", False, f"sin payload: status={r.status_code}")
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
# H-A4-13: cada /chat arranca un ConversationWorkflow (`wf_id` en la respuesta, `web.py:714`) que el
# smoke nunca cerraba -- quedaban 2 RUNNING por corrida (uno acá, otro en el ReAct de abajo). Se
# guardan los `wf_id` para terminarlos en el CLEANUP de más abajo.
wf_ids_a_terminar = []
sid = f"smoke-{uuid.uuid4().hex[:8]}"
try:
    r = client.post("/chat", headers=H, json={"session_id": sid, "text": "Hola, ¿qué podés hacer por mí? Respondé breve.", "kind": "text"})
    if r.status_code == 200 and r.json().get("accepted"):
        if r.json().get("wf_id"):
            wf_ids_a_terminar.append(r.json()["wf_id"])
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
        if r.json().get("wf_id"):
            wf_ids_a_terminar.append(r.json()["wf_id"])
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
ADMIN_ENDPOINTS = ("/admin/salud", "/admin/uso", "/admin/errores", "/admin/soporte", "/admin/auditoria",
                   "/admin/tenants")

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
# RECUENTO FIJO: esta sección emite SIEMPRE exactamente 2 rec (grant + re-login), pase lo que pase.
# Si el grant falla, el re-login sale ROJO con su causa, en vez de desaparecer y bajar el total
# (un denominador que depende del resultado no es denominador: `SMOKEDENOM`, test-smoke-veredicto.sh).
grant_ok, grant_detalle = False, ""
try:
    if not (sup and sr and cliente_id):
        grant_detalle = "faltan SUPABASE_URL/SERVICE_ROLE_KEY/cliente_id"
    else:
        gh = {"apikey": sr, "Authorization": f"Bearer {sr}"}
        lookup = httpx.get(f"{sup}/auth/v1/admin/users", headers=gh, params={"filter": EMAIL}, timeout=15)
        lookup.raise_for_status()
        payload = lookup.json()
        users = payload.get("users", []) if isinstance(payload, dict) else payload
        user = next((u for u in (users or []) if (u.get("email") or "").lower() == EMAIL.lower()), None)
        if user is None:
            grant_detalle = f"'{EMAIL}' no aparece en el lookup de GoTrue"
        else:
            put = httpx.put(f"{sup}/auth/v1/admin/users/{user['id']}", headers=gh,
                            json={"app_metadata": {"copiloto_admin": True}}, timeout=15)
            put.raise_for_status()
            grant_ok, grant_detalle = True, f"user_id={user['id']}"
except Exception as e:
    grant_detalle = repr(e)
rec("consola: otorgar claim admin", grant_ok, grant_detalle)

relogin_detalle = "sin grant previo: no hay re-login que hacer"
if grant_ok:
    # re-login: el token viejo no refleja el claim nuevo (snapshot al momento de emitirse).
    try:
        r2 = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        admin_token = r2.json().get("access_token") if r2.status_code == 200 else None
        relogin_detalle = f"status={r2.status_code}"
    except Exception as e:
        relogin_detalle = repr(e)
rec("consola: re-login post-grant", bool(admin_token), relogin_detalle)

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

# 11) ARTEFACTO DE LA WEB -- CTA4, contrato `..._CTA4-un-deploy-puede-salir-verde-y-apagar-una-
# funcion.md`. Un deploy exitoso puede hornear VITE_AUTH_URL vacío y apagar el botón "Entrar con
# Google" sin que nada avise -- ningún bloque anterior mira el ARTEFACTO servido, sólo la API.
# `web.py::_mount_spa` sirve `index.html`/`assets/*` mismo-origen en `BASE` (127.0.0.1:8099) --
# mismo `client` que el resto del smoke, sin CORS ni vhost aparte.
AUTH_URL_ESPERADA = os.environ.get("SMOKE_AUTH_URL", "https://copilotoemprendedor.duckdns.org")
AUTH_DOMINIO = AUTH_URL_ESPERADA.split("://", 1)[-1].rstrip("/")
# RECUENTO FIJO: los tres checks de esta sección emiten SIEMPRE su rec, aunque la anterior falle.
# Antes, si index.html no traía <script>, sólo salía 1 rec en vez de 3 (denominador variable).
bundle_path, bundle = "", ""
try:
    r_index = client.get("/index.html")
    m = re.search(r'src="(/assets/[^"]+\.js)"', r_index.text)
    idx_ok = r_index.status_code == 200 and bool(m)
    idx_detalle = f"status={r_index.status_code} match={bool(m)}"
    if idx_ok:
        bundle_path = m.group(1)
        idx_detalle = bundle_path
except Exception as e:
    idx_ok, idx_detalle = False, repr(e)
rec("artefacto: index.html sirve un <script> de /assets", idx_ok, idx_detalle)

try:
    if bundle_path:
        r_bundle = client.get(bundle_path)
        bundle = r_bundle.text
        ocurrencias_dominio = bundle.count(AUTH_DOMINIO)
        bundle_ok = r_bundle.status_code == 200 and ocurrencias_dominio > 0
        bundle_detalle = f"status={r_bundle.status_code} ocurrencias={ocurrencias_dominio}"
    else:
        bundle_ok, bundle_detalle = False, "sin bundle: index.html no lo sirvió"
except Exception as e:
    bundle_ok, bundle_detalle = False, repr(e)
rec(f"artefacto: el bundle contiene la base de auth horneada ({AUTH_DOMINIO})", bundle_ok, bundle_detalle)

# Control NEGATIVO -- un grep roto que matchea todo pasaría como verde sin esto (memoria:
# un-mecanismo-roto-hacia-el-no-no-da-sintoma). Sólo pasa con un bundle REAL leído: contra "" un 0
# sería un pase vacío.
imposible = f"dominio-imposible-{uuid.uuid4().hex}.invalid"
rec("artefacto: control negativo -- string imposible da 0 ocurrencias",
    bool(bundle) and bundle.count(imposible) == 0, f"ocurrencias={bundle.count(imposible)} bundle_len={len(bundle)}")

# 11b) Opcional, barato -- punta a punta contra el vhost PÚBLICO (Caddy -> GoTrue, NO 127.0.0.1:8099
# -- `Caddyfile.snippet`: `handle /auth/v1/authorize* { reverse_proxy 127.0.0.1:9997 }`). Ya
# verificado a mano el día del hallazgo; acá queda automatizado.
try:
    r_auth = httpx.get(f"{AUTH_URL_ESPERADA}/auth/v1/authorize",
                       params={"provider": "google", "redirect_to": f"{AUTH_URL_ESPERADA}/"},
                       follow_redirects=False, timeout=15)
    location = r_auth.headers.get("location", "")
    rec("artefacto: GET /auth/v1/authorize?provider=google → 302 a accounts.google.com",
        r_auth.status_code == 302 and "accounts.google.com" in location,
        f"status={r_auth.status_code} location={location[:120]}")
except Exception as e:
    rec("artefacto: GET /auth/v1/authorize?provider=google → 302 a accounts.google.com", False, repr(e))

# CLEANUP (best-effort)
try:
    import asyncio as _asyncio

    from temporalio.client import Client as _TemporalClient

    async def _terminar_workflows(wf_ids):
        target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
        namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
        c = await _TemporalClient.connect(target, namespace=namespace)
        for wf_id in wf_ids:
            try:
                await c.get_workflow_handle(wf_id).terminate(reason="smoke_beta_e2e cleanup")
                print(f"[cleanup] workflow terminado={wf_id}")
            except Exception as e:
                print(f"[cleanup] no pude terminar workflow {wf_id}: {e!r}")

    if wf_ids_a_terminar:
        _asyncio.run(_terminar_workflows(wf_ids_a_terminar))
except Exception as e:
    print(f"[cleanup] terminación de workflows degradada: {e!r}")

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
CRIT = {"alta (/auth/signup)", "login (/auth/login)", "/me (identidad de tenant)", "chat simple → el agente responde",
        # Crítico y no informativo: si el alta abierta vuelve, es una vulnerabilidad en un repo
        # público, no un check amarillo. Que tumbe el smoke es el punto.
        "alta SIN invite-token es rechazada (C4.1)"}
# Denominador: 37 = ruta completa (token admin, trauma fabricado, bundle, redirect). Medido con un
# httpx de mentira que recorre todo el script (ver scripts/test-smoke-veredicto.py). Si un rec() se
# borra o una rama deja de emitir, el total cambia y el veredicto sale ROJO: un check que desaparece
# no puede pasar como verde.
EXPECTED_TOTAL = 37

def veredicto(results, crit, expected_total):
    """(líneas, exit_code). Dice SIEMPRE los dos números: críticos y no-críticos.
    Exit != 0 sólo por crítico rojo/ausente o por denominador distinto del esperado. Un no-crítico
    rojo se muestra con su nombre y NO cambia el exit (política de CRIT, deliberada)."""
    presentes = {s for s, _, _ in results}
    crit_ok = sum(1 for s, ok, _ in results if s in crit and ok)
    crit_rojos = [s for s, ok, _ in results if s in crit and not ok]
    crit_ausentes = sorted(crit - presentes)
    nc = [(s, ok) for s, ok, _ in results if s not in crit]
    nc_ok = sum(1 for _, ok in nc if ok)
    nc_rojos = [s for s, ok in nc if not ok]
    lineas = [
        f"checks ejecutados: {len(results)} de {expected_total} esperados",
        f"{crit_ok}/{len(crit)} críticos · {nc_ok}/{len(nc)} no-críticos",
    ]
    if crit_rojos or crit_ausentes:
        bloqueos = crit_rojos + [f"AUSENTE: {s}" for s in crit_ausentes]
        lineas.append("VEREDICTO: BLOQUEA BETA (crítico rojo/ausente): " + " · ".join(bloqueos))
        return lineas, 1
    if len(results) != expected_total:
        lineas.append(f"VEREDICTO: DENOMINADOR DISTINTO ({len(results)} != {expected_total}): "
                      "falta o sobra un check; el smoke no vio lo que dice ver")
        return lineas, 1
    lineas.append("VEREDICTO: BETA-READY (críticos verdes)")
    if nc_rojos:
        lineas.append("no-críticos ROJOS (no bloquean, revisar): " + " · ".join(nc_rojos))
    return lineas, 0

print("\n===== RESUMEN SMOKE BETA =====")
_lineas, _code = veredicto(results, CRIT, EXPECTED_TOTAL)
for _l in _lineas:
    print(_l)
sys.exit(_code)
