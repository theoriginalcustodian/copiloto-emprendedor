#!/usr/bin/env bash
# deploy/copiloto/verificar-rls.sh — ¿el RLS está aplicando de verdad en producción? READ-ONLY.
#
# POR QUÉ EXISTE: el 2026-07-31 se descubrió que las 77 tablas tenían RLS activado y **ninguna
# filtraba**. Nada falló, nada avisó: `pg_tables.rowsecurity` decía `t` en las 77 y el aislamiento no
# existía. Un chequeo de configuración habría confirmado el estado equivocado — por eso este script
# **mide por efecto**, no por catálogo: se conecta SIN declarar tenant y cuenta filas. Si ve alguna,
# el RLS no está aplicando, diga lo que diga el catálogo.
#
# Las tres trampas que este control caza de una sola vez (las tres se pisaron ese día):
#   1. el DUEÑO de la tabla está exento de sus propias policies salvo `FORCE`
#   2. un rol SUPERUSER o con BYPASSRLS saltea el RLS **incluso con `FORCE`**
#   3. `USING` sin `WITH CHECK` filtra la lectura y deja **escribir** con el cliente_id de otro
#
# Uso:  bash deploy/copiloto/verificar-rls.sh            # contra el VPS (default)
# Parametrizable: UC_DEPLOY_HOST, UC_VENV, UC_ENV_FILE.
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
ENV_FILE="${UC_ENV_FILE:-/etc/unreal-copilot/fusion-pg.env}"

ssh "$HOST" "set -a; . '$ENV_FILE' 2>/dev/null; set +a; '$VENV/bin/python' - " <<'PY'
import os, json, psycopg2

c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
cur = c.cursor()

def q(sql, args=()):
    cur.execute(sql, args); return cur.fetchall()

print("=" * 78)
print("1. EL ROL — si puede saltear RLS, todo lo demás es decorativo")
print("=" * 78)
(usuario, es_super, bypassa), = q(
    "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
print(f"   usuario={usuario}  superuser={es_super}  bypassrls={bypassa}")
if es_super or bypassa:
    print("   ⚠️  ESTE ROL SALTEA EL RLS. Ninguna medición de abajo significa nada.")

print()
print("=" * 78)
print("2. EL CATÁLOGO — lo que la base DICE (no alcanza, ver el punto 3)")
print("=" * 78)
(force, rls, total), = q("""SELECT count(*) FILTER (WHERE relforcerowsecurity),
                                   count(*) FILTER (WHERE relrowsecurity), count(*)
                            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                            WHERE n.nspname = 'uc_factory' AND c.relkind = 'r'""")
print(f"   tablas={total}   con RLS={rls}   con FORCE={force}")
sin_check = q("""SELECT c.relname FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname='uc_factory' AND c.relforcerowsecurity
                   AND p.polcmd = '*' AND p.polwithcheck IS NULL""")
print(f"   policies FOR ALL con FORCE y SIN 'WITH CHECK': {len(sin_check)}"
      + (f"  → {[t for (t,) in sin_check][:6]}" if sin_check else "  ✔"))

# `tenants` es la tabla que RESUELVE el tenant: se lee ANTES de poder declararlo. Con FORCE,
# resolve_cliente_id() devuelve None y la app responde 403 a TODOS. Debe estar SIN force.
t = q("""SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname='uc_factory' AND c.relname='tenants'""")
estado_tenants = t[0][0] if t else None
print(f"   tenants con FORCE: {estado_tenants}"
      + ("   ❌ ROMPE EL LOGIN DE TODOS" if estado_tenants else "   ✔ correcto (debe ser False)"))

print()
print("=" * 78)
print("3. POR EFECTO — sin declarar tenant, ¿cuántas filas ve? (esto es lo que vale)")
print("=" * 78)
cur.execute("SELECT set_config('request.jwt.claims', '', false)")
fugas = 0
for tabla in ("copiloto_gastos", "copiloto_presupuestos", "afip_comprobantes",
              "mp_credentials", "copiloto_cobros"):
    try:
        (filas,), = q(f"SELECT count(*) FROM uc_factory.{tabla}")
        (tenants_visibles,), = q(
            f"SELECT count(DISTINCT cliente_id) FROM uc_factory.{tabla}")
    except psycopg2.Error as exc:
        print(f"   {tabla:<24} error: {str(exc).splitlines()[0]}")
        continue
    marca = "✔ aísla" if filas == 0 else "❌ FUGA"
    if filas:
        fugas += 1
    print(f"   {tabla:<24} filas={filas:<6} tenants_visibles={tenants_visibles:<4} {marca}")

print()
if fugas:
    print(f"   ❌ {fugas} tabla(s) devolvieron filas SIN tenant declarado: el RLS NO está aplicando.")
else:
    print("   ✔ ninguna tabla devolvió filas sin tenant declarado.")

# CONTROL POSITIVO del propio instrumento: si declarando un tenant real TAMPOCO se ve nada, el cero
# de arriba no prueba aislamiento — prueba que la consulta está rota. Un cero sin este control es
# una pregunta, no un hallazgo.
print()
print("=" * 78)
print("4. CONTROL POSITIVO — declarando un tenant real, ¿ve lo suyo?")
print("=" * 78)
# ⚠️ Este bloque tuvo un bug que vale más que el bloque: buscaba el tenant con un EXISTS sobre
# `copiloto_gastos` **sin declarar tenant**. Con FORCE eso da 0 y el control positivo se auto-anulaba
# ("no hay ningún tenant con gastos") justo cuando el mecanismo empezaba a funcionar — el instrumento
# roto por lo mismo que venía a medir. Ahora los candidatos salen de `tenants` (la tabla exenta) y el
# conteo se hace YA con el tenant declarado, que es como lo hace la app.
candidatos = q("SELECT cliente_id::text FROM uc_factory.tenants LIMIT 25")
visto = None
for (cid,) in candidatos:
    cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                (json.dumps({"cliente_id": cid}),))
    (propias,), = q("SELECT count(*) FROM uc_factory.copiloto_gastos")
    if propias:
        visto = (cid, propias)
        break
if visto:
    cid, propias = visto
    print(f"   tenant {cid[:8]}…  ve {propias} gasto(s) propios  ✔"
          "  (los ceros de arriba SÍ significan aislamiento)")
else:
    print("   ❌ NINGÚN tenant ve gastos propios. Los ceros de arriba NO prueban aislamiento:")
    print("      con FORCE activo, esto es lo que se vería si la app hubiera dejado de ver sus")
    print("      propios datos. Revisar que el borde declare el tenant antes de sacar conclusiones.")

# CONS0a (2026-08-06): el camino cross-tenant de la Consola de Operador es un rol nuevo con
# BYPASSRLS (deploy/copiloto/provision-rol-consola.sh), no una policy ni una vista. Este verificador
# tiene que conocer ese camino tan bien como conoce el de la app normal -- un rol BYPASSRLS mal
# acotado es exactamente el agujero que RLS existe para tapar, y el catálogo lo delata sin
# necesitar la contraseña del rol.
print()
print("=" * 78)
print("5. ROL DE LA CONSOLA (copiloto_consola) — BYPASSRLS acotado, medido contra el catálogo")
print("=" * 78)
(existe,) = q("SELECT count(*) FROM pg_roles WHERE rolname = 'copiloto_consola'")[0]
if not existe:
    print("   ⚠️  el rol 'copiloto_consola' no existe todavía -- correr provision-rol-consola.sh")
else:
    (bypassa, es_super), = q(
        "SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'copiloto_consola'")
    print(f"   bypassrls={bypassa}  superuser={es_super}"
          + ("" if bypassa and not es_super else "   ❌ atributos inesperados"))
    grants = q("""SELECT c.relname, a.privilege_type
                  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  CROSS JOIN LATERAL aclexplode(c.relacl) AS a JOIN pg_roles r ON r.oid = a.grantee
                  WHERE n.nspname = 'uc_factory' AND r.rolname = 'copiloto_consola'
                  ORDER BY 1, 2""")
    por_tabla: dict = {}
    for tabla, permiso in grants:
        por_tabla.setdefault(tabla, set()).add(permiso)
    esperado = {"copiloto_metering": {"SELECT"}, "copiloto_feedback": {"SELECT"}, "copiloto_traumas": {"SELECT"}}
    if por_tabla == esperado:
        print(f"   grants={por_tabla}  ✔ exactamente SELECT en las 3 tablas declaradas, nada más")
    else:
        print(f"   grants={por_tabla}  ❌ no coincide con lo declarado: {esperado}")
PY
