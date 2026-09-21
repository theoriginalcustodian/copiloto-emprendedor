#!/usr/bin/env python3
"""K-12 extra: (1) reauth con sesiÃ³n vieja, (2) flujo de confirmaciÃ³n de cambio de email (link del mail)."""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matrix import *
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
def click(link):
    # HALLAZGO: GoTrue arma el link como API_EXTERNAL_URL + "/verify" (sin /auth/v1). Con el proxy de este stack
    # el link crudo cae en 200 vacío; hay que reescribirlo a /auth/v1/verify para ejercitarlo.
    if "/auth/v1/verify" not in link:
        raw = urllib.request.urlopen(link, timeout=20); print("   (link crudo /verify ->", raw.status, repr(raw.read()[:40]), ")")
        link = link.replace(":9971/verify", ":9971/auth/v1/verify")
    op = urllib.request.build_opener(NoRedir)
    try: r = op.open(link, timeout=20); return r.status, r.read().decode()[:200]
    except urllib.error.HTTPError as e: return e.code, (e.headers.get("Location") or "")[:120].split("#")[0] + "#<fragment redactado>"
def links():
    out = []
    for m in js(http("GET", f"{MAILAPI}/messages")[1]).get("messages", []):
        t = js(http("GET", f"{MAILAPI}/message/{m['ID']}")[1]).get("Text", "")
        out.append(([x["Address"] for x in m["To"]], re.findall(r"https?://\S+", t)))
    return out
def psql(sql): return subprocess.run(["docker","exec",f"{os.environ['P']}-db-1","psql","-U","postgres","-tAc",sql],capture_output=True,text=True).stdout.strip()
def cfg(ac, secure, reauth):
    sh("setenv","GOTRUE_MAILER_AUTOCONFIRM",ac); sh("setenv","K12_SECURE_EMAIL_CHANGE",secure); sh("setenv","K12_REAUTH",reauth); sh("recreate")
def newuser():
    t = uuid.uuid4().hex[:6]; e = f"x-{t}@k12.test"; mkuser(e, "Original-pass-1"); return e, t
print("# EXTRA 1: REAUTH=true con sesiÃ³n ANTIGUA (last_sign_in_at/sessions retrocedidos 3 dÃ­as vÃ­a SQL en la DB descartable)")
cfg("true","true","true"); e,t = newuser(); tok = js(login(e,"Original-pass-1")[1])["access_token"]
print("  env en contenedor:", subprocess.run(["docker","exec",f"{os.environ['P']}-auth-1","printenv","GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION"],capture_output=True,text=True).stdout.strip())
psql(f"update auth.users set last_sign_in_at=now()-interval '3 days' where email='{e}'; update auth.sessions set created_at=now()-interval '3 days' where user_id=(select id from auth.users where email='{e}')")
st,r = http("PUT", f"{BASE}/user", {"password":"Nueva-pass-2"}, bearer=tok); show("PUT password sesiÃ³n vieja sin nonce", st, r)
clear_mail(); st,r = http("GET", f"{BASE}/reauthenticate", bearer=tok); show("GET /reauthenticate", st, r); time.sleep(1); print("  mails:", mails())
txt = js(http("GET", f"{MAILAPI}/message/latest")[1]).get("Text",""); m = re.search(r"\b(\d{6})\b", txt); print("  nonce en mail:", bool(m))
if m:
    st,r = http("PUT", f"{BASE}/user", {"password":"Nueva-pass-2","nonce":m.group(1)}, bearer=tok); show("PUT password + nonce", st, r)
    st,r = http("PUT", f"{BASE}/user", {"password":"Otra-pass-3","nonce":"000000"}, bearer=tok); show("PUT password nonce invÃ¡lido", st, r)

print("\n# EXTRA 2: confirmaciÃ³n del cambio de email por link â€” SECURE=false (1 mail al nuevo)")
cfg("true","false","false"); e,t = newuser(); tok = js(login(e,"Original-pass-1")[1])["access_token"]; clear_mail(); n=f"n-{t}@k12.test"
print("  PUT:", http("PUT", f"{BASE}/user", {"email": n}, bearer=tok)[0]); time.sleep(1)
for to, ls in links():
    print("  mail a", to, "links:", [re.sub(r"token=[^&]+","token=<r>",l) for l in ls])
    for l in ls:
        if "verify" in l: print("  click ->", click(l))
st,r = http("GET", f"{BASE}/user", bearer=tok); print("  GET /user (token viejo):", st, fields(js(r)))
print("  login viejo:", login(e,"Original-pass-1")[0], "| login nuevo:", login(n,"Original-pass-1")[0])

print("\n# EXTRA 3: SECURE=true (2 mails) â€” click en uno solo, luego en ambos")
cfg("true","true","false"); e,t = newuser(); tok = js(login(e,"Original-pass-1")[1])["access_token"]; clear_mail(); n=f"n-{t}@k12.test"
http("PUT", f"{BASE}/user", {"email": n}, bearer=tok); time.sleep(1); L = links()
vl = [(to,[l for l in ls if "verify" in l][0]) for to,ls in L]
print("  mails a:", [to for to,_ in vl])
print("  click #1 ->", vl[0][0], click(vl[0][1])); r = js(http("GET", f"{BASE}/user", bearer=tok)[1]); print("  tras 1 click:", fields(r))
print("  click #2 ->", vl[1][0], click(vl[1][1])); r = js(http("GET", f"{BASE}/user", bearer=tok)[1]); print("  tras 2 clicks:", fields(r))
print("  login viejo:", login(e,"Original-pass-1")[0], "| login nuevo:", login(n,"Original-pass-1")[0])
print("\n# EXTRA 4: cambio de email con redirect_to fuera de allow-list")
e,t = newuser(); tok = js(login(e,"Original-pass-1")[1])["access_token"]
show("PUT ?redirect_to=https://evil.example", *http("PUT", f"{BASE}/user?redirect_to=https://evil.example/x", {"email": f"z-{t}@k12.test"}, bearer=tok))
