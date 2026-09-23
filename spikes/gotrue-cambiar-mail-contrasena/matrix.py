#!/usr/bin/env python3
"""K-12 — matriz de escenarios contra la GoTrue descartable (corre EN el VPS, vía run-remote.sh matrix).
Nunca imprime tokens completos ni claves: se redactan."""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, uuid
PORT, MAIL = os.environ["PORT"], os.environ["MAIL"]
BASE = f"http://127.0.0.1:{PORT}/auth/v1"; MAILAPI = f"http://127.0.0.1:{MAIL}/api/v1"
SVC, ANON = os.environ["SERVICE_KEY"], os.environ["ANON_KEY"]
RUN = os.path.join(os.environ["STAGE"], "run-remote.sh")

def http(method, url, body=None, bearer=None, apikey=ANON):
    h = {"apikey": apikey, "Content-Type": "application/json"}
    if bearer: h["Authorization"] = f"Bearer {bearer}"
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
def js(t):
    try: return json.loads(t)
    except Exception: return {"_raw": t[:200]}
def redact(o):
    if isinstance(o, dict): return {k: ("<redacted>" if k in ("access_token","refresh_token") else redact(v)) for k, v in o.items()}
    if isinstance(o, list): return [redact(x) for x in o]
    return o
def show(label, st, body):
    print(f"  [{st}] {label}: {json.dumps(redact(js(body) if isinstance(body,str) else body), ensure_ascii=False)}")
def jwt_claims(tok): p = tok.split(".")[1]; return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
def mails():
    st, b = http("GET", f"{MAILAPI}/messages")
    return [(m["Subject"], [t["Address"] for t in m["To"]]) for m in js(b).get("messages", [])]
def clear_mail(): http("DELETE", f"{MAILAPI}/messages")
def sh(*a): print("   $", *a, "->", subprocess.run(["bash", RUN, *a], capture_output=True, text=True).stdout.strip().splitlines()[-1:] )
def login(email, pw): return http("POST", f"{BASE}/token?grant_type=password", {"email": email, "password": pw})
def mkuser(email, pw):
    st, b = http("POST", f"{BASE}/admin/users", {"email": email, "password": pw, "email_confirm": True}, bearer=SVC, apikey=SVC)
    return st
def fields(o): return {k: o.get(k) for k in ("email", "new_email", "email_change_sent_at", "email_confirmed_at", "updated_at") if k in o}

def scenario(name, autoconfirm, secure, reauth):
    print(f"\n## Escenario {name}: AUTOCONFIRM={autoconfirm} SECURE_EMAIL_CHANGE={secure} REAUTH={reauth}")
    sh("setenv", "GOTRUE_MAILER_AUTOCONFIRM", autoconfirm); sh("setenv", "K12_SECURE_EMAIL_CHANGE", secure); sh("setenv", "K12_REAUTH", reauth)
    sh("recreate")
    tag = uuid.uuid4().hex[:6]; a, b = f"a-{tag}@k12.test", f"b-{tag}@k12.test"; pw = "Original-pass-1"
    print("  crear usuarios (admin, email_confirm=true):", mkuser(a, pw), mkuser(b, pw))
    st, body = login(a, pw); tok = js(body).get("access_token"); print("  login A:", st)
    if not tok: return
    clear_mail()
    # --- password ---
    st, r = http("PUT", f"{BASE}/user", {"password": "abc"}, bearer=tok); show("PUT password corta 'abc'", st, r)
    st, r = http("PUT", f"{BASE}/user", {"password": pw}, bearer=tok); show("PUT password IGUAL a la actual", st, r)
    st, r = http("PUT", f"{BASE}/user", {"password": "Nueva-pass-2"}, bearer=tok); show("PUT password nueva válida (sin nonce)", st, r)
    print("  mails tras password:", mails())
    if st == 200:
        print("  login con vieja:", login(a, pw)[0], "| con nueva:", login(a, "Nueva-pass-2")[0]); pw = "Nueva-pass-2"
    elif reauth == "true":
        clear_mail(); st2, r2 = http("GET", f"{BASE}/reauthenticate", bearer=tok); show("GET /reauthenticate", st2, r2); print("  mails reauth:", mails())
        try:
            st3, b3 = http("GET", f"{MAILAPI}/message/latest"); txt = js(b3).get("Text", ""); import re
            m = re.search(r"\b(\d{6})\b", txt); nonce = m.group(1) if m else None
            print("  nonce hallado en mail:", bool(nonce))
            if nonce:
                st4, r4 = http("PUT", f"{BASE}/user", {"password": "Nueva-pass-2", "nonce": nonce}, bearer=tok); show("PUT password + nonce", st4, r4)
                print("  login con nueva:", login(a, "Nueva-pass-2")[0])
                if st4 == 200: pw = "Nueva-pass-2"
        except Exception as e: print("  nonce err", e)
    # --- login inválido ---
    st, r = login(a, "incorrecta-xyz"); show("token grant con password INCORRECTA", st, r)
    st, r = login("noexiste@k12.test", "x-x-x-x-x"); show("token grant con email inexistente", st, r)
    # --- email ---
    st, body = login(a, pw); tok = js(body).get("access_token")
    if not tok: print("  no pude re-loguear A"); return
    clear_mail(); newmail = f"a2-{tag}@k12.test"
    st, r = http("PUT", f"{BASE}/user", {"email": newmail}, bearer=tok); print("  PUT email nuevo ->", st, fields(js(r)))
    time.sleep(1); print("  mails tras cambio de email:", mails())
    st, r = http("GET", f"{BASE}/user", bearer=tok); print("  GET /user tras PUT:", st, fields(js(r)))
    print("  login con email VIEJO:", login(a, pw)[0], "| con email NUEVO:", login(newmail, pw)[0])
    st, r = http("PUT", f"{BASE}/user", {"email": b}, bearer=tok); show("PUT email YA EN USO por otra cuenta", st, r)
    st, r = http("PUT", f"{BASE}/user", {"email": "no-es-mail"}, bearer=tok); show("PUT email inválido", st, r)
    # --- identidad / jwt ---
    if name == "A":
        st, r = http("GET", f"{BASE}/user", bearer=tok); u = js(r)
        c = jwt_claims(tok); print("\n  JWT claims (subset):", {k: c.get(k) for k in ("iss", "aud", "role", "email", "app_metadata", "user_metadata", "amr", "is_anonymous")})
        print("  GET /user app_metadata:", u.get("app_metadata"), "| identities:", [{k: i.get(k) for k in ("provider", "identity_id")} for i in u.get("identities", [])])

def main():
    print("# K-12 matriz GoTrue v2.186.0 (descartable)")
    print("health:", http("GET", f"{BASE}/health")[0]); print("settings:", json.dumps({k: v for k, v in js(http('GET', f'{BASE}/settings')[1]).items() if k in ("mailer_autoconfirm","disable_signup","external")}))
    for n, ac, se, re_ in [("A","true","true","false"), ("B","true","true","true"), ("C","false","true","false"), ("D","false","false","false"), ("E","true","false","false")]:
        scenario(n, ac, se, re_)
if __name__ == "__main__": main()
