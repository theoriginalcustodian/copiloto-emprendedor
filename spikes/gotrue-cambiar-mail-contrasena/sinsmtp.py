#!/usr/bin/env python3
"""K-12 extra 5: config REAL de prod (SMTP_HOST vacío, AUTOCONFIRM=true): ¿qué hace PUT /user {email}?"""
import os, sys, time, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matrix import *
sh("setenv","GOTRUE_SMTP_HOST",""); sh("setenv","GOTRUE_MAILER_AUTOCONFIRM","true"); sh("setenv","K12_SECURE_EMAIL_CHANGE","true"); sh("setenv","K12_REAUTH","false"); sh("recreate")
t=uuid.uuid4().hex[:6]; e=f"s-{t}@k12.test"; mkuser(e,"Original-pass-1"); tok=js(login(e,"Original-pass-1")[1])["access_token"]
st,r=http("PUT",f"{BASE}/user",{"email":f"s2-{t}@k12.test"},bearer=tok); show("PUT email SIN SMTP",st,r)
st,r=http("GET",f"{BASE}/user",bearer=tok); print("  GET /user tras:",fields(js(r)))
st,r=http("PUT",f"{BASE}/user",{"password":"Nueva-pass-2"},bearer=tok); show("PUT password SIN SMTP (status)",st,{"ok":st==200})
