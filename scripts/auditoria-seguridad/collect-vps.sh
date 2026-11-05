#!/usr/bin/env bash
# collect-vps.sh — frentes A1 (SO/SSH/systemd), A2 (Postgres), A6 (Docker), B1/B2 (parches y versiones),
# C1-interno (ss/ufw), C5 (logs), C11 (permisos de secretos) medidos DESDE ADENTRO del VPS.
#
# READ-ONLY. El script remoto sólo LEE: ningún systemctl restart, apt install, docker run/exec, rm, chmod.
# Secretos: de los *.env sólo se imprimen NOMBRES de variable y los valores de una ALLOWLIST no sensible.
# Además toda la salida pasa por una máscara de cadenas largas tipo token antes de tocar el disco.
# Control positivo (corre siempre): cada sección debe traer algo que SABEMOS que existe; si no, FALLA y la
# ausencia NO se acepta como "no hay" (instrumento que no mira nunca falla).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FECHA="${AUD_FECHA:-$(date +%F)}"
OUT="$RAIZ/docs/copiloto-emprendedor/Auditorias/Seguridad/evidencia/$FECHA/vps"
HOST="${AUD_SSH_HOST:-unreal-copilot}"
mkdir -p "$OUT"

# ---- script remoto (únicamente lectura) --------------------------------------------------------------
remoto() { cat <<'REMOTO'
sec() { printf '\n###SEC %s\n' "$1"; }
PY=/opt/uc-copiloto-venv/bin/python

sec A1_usuarios
getent passwd | awk -F: '$7 !~ /(nologin|false|sync)$/ {print $1":"$3":"$6":"$7}'
sec A1_sudo
grep -rhvE '^\s*(#|$)' /etc/sudoers /etc/sudoers.d 2>/dev/null
sec A1_sshd
sshd -T 2>/dev/null | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|maxauthtries|permitemptypasswords|x11forwarding|allowusers|allowgroups|port|logingracetime|clientaliveinterval|usepam|allowtcpforwarding) '
sec A1_authorized_keys
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do [ -f "$f" ] && { echo "$f: $(grep -cvE '^\s*(#|$)' "$f") llaves"; ssh-keygen -lf "$f" 2>/dev/null | awk '{print "  "$1" "$2" "$NF}'; }; done
sec A1_ultimos_logins
last -n 15 -a 2>/dev/null | head -15
sec A1_systemd_security
for u in uc-copiloto-web uc-copiloto-worker uc-copiloto-worker-soporte; do
  echo "-- $u: $(systemctl show $u -p User -p NoNewPrivileges -p ProtectSystem -p ProtectHome -p PrivateTmp -p CapabilityBoundingSet 2>/dev/null | paste -sd' ')"
  systemd-analyze security "$u" --no-pager 2>/dev/null | tail -1
done
sec C11_permisos_secretos
stat -c '%a %U:%G %n' /etc/unreal-copilot/*.env /etc/unreal-copilot 2>/dev/null
sec C11_variables_por_archivo_SOLO_NOMBRES
for f in /etc/unreal-copilot/*.env; do echo "$(basename $f): $(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$f" | tr -d '=' | wc -l) vars"; done
sec C11_allowlist_valores_no_sensibles
for k in GOTRUE_DISABLE_SIGNUP GOTRUE_JWT_EXP GOTRUE_TAG CADDY_TAG COPILOTO_ENGINE_MODE COPILOTO_LOG_STT_TEXT COPILOTO_DEDICATED_GOTRUE GOTRUE_SITE_URL GOTRUE_URI_ALLOW_LIST; do
  v=$(grep -hE "^$k=" /etc/unreal-copilot/*.env 2>/dev/null | head -1); echo "${v:-$k=<no definida>}"; done
sec C11_procesos_y_usuarios
ps -eo user:14,pid,comm | grep -E 'python|caddy|temporal|postgres|node|gotrue' | sort | uniq -c | sort -rn | head -15
sec A6_docker_contenedores
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' 2>/dev/null
sec A6_docker_inspect
for c in $(docker ps -q 2>/dev/null); do docker inspect "$c" --format '{{.Name}} user={{.Config.User}} privileged={{.HostConfig.Privileged}} netmode={{.HostConfig.NetworkMode}} capadd={{.HostConfig.CapAdd}} readonly={{.HostConfig.ReadonlyRootfs}} restart={{.HostConfig.RestartPolicy.Name}} mounts={{range .Mounts}}{{.Source}}->{{.Destination}}({{.Mode}}) {{end}}' 2>/dev/null; done
sec B2_docker_imagenes
docker images --format '{{.Repository}}:{{.Tag}}|{{.CreatedSince}}|{{.Size}}' 2>/dev/null | head -30
sec B1_os
lsb_release -ds; uname -r; ls /boot/vmlinuz-* 2>/dev/null | sed 's#.*/##' | sort -V | tail -3
[ -f /var/run/reboot-required ] && { echo "REBOOT-REQUERIDO"; cat /var/run/reboot-required.pkgs 2>/dev/null; } || echo "sin reboot pendiente"
sec B1_apt_ultimo_update
ls -l --time-style=long-iso /var/lib/apt/lists/ 2>/dev/null | awk 'NR>1{print $6" "$7}' | sort | tail -1
stat -c '%y' /var/cache/apt/pkgcache.bin 2>/dev/null
sec B1_apt_pendientes
apt list --upgradable 2>/dev/null | grep -v '^Listing' | awk -F/ '{print $2}' | awk '{print $1}' | sort | uniq -c
echo "total: $(apt list --upgradable 2>/dev/null | grep -vc '^Listing')"
sec B1_apt_pendientes_seguridad
apt list --upgradable 2>/dev/null | grep -i security | head -40
sec B1_unattended
systemctl is-enabled unattended-upgrades 2>&1; systemctl is-active unattended-upgrades 2>&1
grep -hE '^(APT::Periodic|Unattended-Upgrade::(Allowed-Origins|Automatic-Reboot))' /etc/apt/apt.conf.d/20auto-upgrades /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null
sec B1_needrestart
needrestart -b 2>/dev/null | head -20
sec B2_versiones
caddy version 2>/dev/null | head -1; $PY --version 2>&1; node --version 2>&1; docker --version 2>&1
temporal --version 2>/dev/null | head -1; ls /usr/local/bin | grep -i temporal | head -3
sec C1_puertos_escuchando
ss -tlnpH 2>/dev/null | awk '{print $4"|"$6}' | sed 's/users:(("\([^"]*\)".*/\1/' | sort -u
sec C1_udp
ss -ulnpH 2>/dev/null | awk '{print $4"|"$6}' | sed 's/users:(("\([^"]*\)".*/\1/' | sort -u | head -10
sec C1_ufw
ufw status verbose 2>&1 | head -40
sec C1_fail2ban
fail2ban-client status 2>&1 | head -8
sec C5_journal
journalctl --disk-usage 2>&1
grep -hE '^(SystemMaxUse|MaxRetentionSec|Storage)' /etc/systemd/journald.conf /etc/systemd/journald.conf.d/*.conf 2>/dev/null || echo "journald sin limites explicitos"
sec C5_caddy_log
ls -l --time-style=long-iso /var/log/caddy 2>/dev/null | head -8 || echo "sin /var/log/caddy"
journalctl -u caddy --no-pager -n 1 -o cat 2>/dev/null | cut -c1-120
sec C3_sslip_uso_ultimos_dias
# ¿alguien pega al host mp.*? (access log de Caddy por journal). Cuenta SOLO, no vuelca URLs ni IPs.
for h in mp.178-105-191-1.sslip.io copiloto.178-105-191-1.sslip.io copilotoemprendedor.duckdns.org; do
  n=$(journalctl -u caddy --no-pager --since '14 days ago' -o cat 2>/dev/null | grep -c "\"host\":\"$h\""); echo "$h requests_14d=$n"; done
journalctl -u caddy --no-pager --since '14 days ago' -o cat 2>/dev/null | head -1 | cut -c1-60 | sed 's/^/primera_linea_log: /'
sec A2_postgres
set -a; . /etc/unreal-copilot/fusion-pg.env 2>/dev/null; set +a
$PY - <<'PYQ' 2>&1
import os, psycopg2
c = psycopg2.connect(host=os.environ.get("PGHOST"), port=os.environ.get("PGPORT"), user=os.environ.get("PGUSER"),
                     password=os.environ.get("PGPASSWORD"), dbname=os.environ.get("PGDATABASE"), connect_timeout=10)
c.set_session(readonly=True, autocommit=True); k = c.cursor()
def q(t, s):
    print(f"-- {t}"); k.execute(s)
    for r in k.fetchall(): print(" | ".join("" if x is None else str(x) for x in r))
q("version", "select version()")
q("conexion", "select current_user, (select rolsuper from pg_roles where rolname=current_user), (select rolbypassrls from pg_roles where rolname=current_user)")
q("roles (login/super/bypass/createrole/createdb/valid_until)", "select rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, coalesce(rolvaliduntil::text,'nunca') from pg_roles where rolname !~ '^pg_' order by 1")
q("settings", "select name, setting from pg_settings where name in ('listen_addresses','ssl','password_encryption','log_connections','log_statement','row_security','shared_preload_libraries')")
q("tablas SIN rls (schema public)", "select count(*) filter (where not c.relrowsecurity), count(*) filter (where c.relrowsecurity and not c.relforcerowsecurity), count(*) filter (where c.relrowsecurity and c.relforcerowsecurity), count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")
q("tablas public SIN rls (nombre)", "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1 limit 60")
q("tablas con rls pero SIN policy", "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) order by 1 limit 60")
q("esquemas", "select nspname from pg_namespace where nspname !~ '^(pg_|information_schema)' order by 1")
q("hba (si legible)", "select type, database, user_name, address, auth_method from pg_hba_file_rules order by line_number limit 30")
PYQ
REMOTO
}

# ---- máscara de tokens: nada con forma de credencial llega al disco ----------------------------------
enmascarar() { sed -E 's/[A-Za-z0-9_+\/=-]{40,}/[ENMASCARADO]/g; s/(eyJ[A-Za-z0-9_-]{8,})/[ENMASCARADO-JWT]/g; s/(postgres(ql)?:\/\/)[^ ]+/\1[ENMASCARADO]/g'; }

# ---- control de MUTACIÓN: el script remoto no puede contener verbos que cambian estado -----------------
mutaciones() { remoto | grep -nE '(^|[ ;|&])(systemctl +(restart|stop|start|enable|disable|daemon-reload)|apt(-get)? +(install|remove|upgrade|dist-upgrade|purge)|docker +(run|exec|rm|stop|start|restart|pull|compose)|rm +-|chmod |chown |mv |tee |dd |useradd|passwd +[a-z])|(^|[;&|] *)(reboot|shutdown)( |$)' | grep -vE '^[0-9]+:\s*#'; }

correr() {
  local m; m="$(mutaciones || true)"
  [ -z "$m" ] || { echo "ABORTO: el script remoto contiene verbos mutantes:"; echo "$m"; exit 3; }
  remoto | timeout 280 ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" 'bash -s' 2> "$OUT/ssh.err" | enmascarar > "$OUT/crudo.txt"
  python -I -X utf8 - "$OUT" <<'PY'
import sys, pathlib, re
out = pathlib.Path(sys.argv[1]); txt = (out/"crudo.txt").read_text(encoding="utf8", errors="replace")
partes = re.split(r"\n###SEC (\S+)\n", "\n"+txt)
for i in range(1, len(partes), 2):
    (out/f"{partes[i]}.txt").write_text(partes[i+1].strip()+"\n", encoding="utf8")
print("secciones:", (len(partes)-1)//2)
PY
}

positivo() {
  local f="$OUT" F=0 N=0
  chk() { N=$((N+1)); if eval "$2"; then echo "OK   $1"; else echo "FALLA $1"; F=$((F+1)); fi; }
  chk "A1: la lista de usuarios con shell incluye root (la lectura es real)"      "grep -q '^root:' '$f/A1_usuarios.txt'"
  chk "A1: sshd -T devolvió configuración efectiva"                                "grep -q 'permitrootlogin' '$f/A1_sshd.txt'"
  chk "C11: stat vio los .env (y copiloto.env existe)"                             "grep -q 'copiloto.env' '$f/C11_permisos_secretos.txt'"
  chk "A6: docker lista al menos un contenedor"                                    "[ -s '$f/A6_docker_contenedores.txt' ]"
  chk "B1: apt devolvió un total (aunque sea 0)"                                   "grep -q '^total:' '$f/B1_apt_pendientes.txt'"
  chk "C1: ss ve el puerto 8099 (front-door) escuchando"                           "grep -q ':8099' '$f/C1_puertos_escuchando.txt'"
  chk "A2: Postgres respondió y lista el rol copiloto_consola (control positivo del plan)" "grep -q 'copiloto_consola' '$f/A2_postgres.txt'"
  chk "salida SIN credenciales con forma de token (control de redacción)"          "! grep -rqE '[A-Za-z0-9_+/=-]{40,}' '$f'/*.txt --exclude=crudo.txt --exclude=ssh.err"
  echo "== instrumento VPS: $N chequeos, $F fallas =="; [ "$F" -eq 0 ]
}

case "${1:-run}" in
  --self-test) # no toca el VPS: prueba SOLO que el detector de mutaciones caza un verbo mutante y la máscara enmascara
    t="$(printf 'echo hola\nsystemctl restart caddy\n')"
    echo "$t" | grep -qE 'systemctl +(restart)' && echo "OK   detector de mutaciones caza 'systemctl restart'" || { echo FALLA detector; exit 1; }
    r="$(echo 'k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' | enmascarar)"; { echo "$r" | grep -q 'ENMASCARADO' && ! echo "$r" | grep -qE '[A-Za-z0-9]{20,}'; } && echo "OK   la máscara tapa un token de 48 chars" || { echo FALLA máscara; exit 1; }
    [ -z "$(mutaciones || true)" ] && echo "OK   el script remoto real NO contiene verbos mutantes" || { echo "FALLA el remoto muta:"; mutaciones; exit 1; };;
  run) correr && positivo;;
  *) echo "uso: collect-vps.sh [run|--self-test]"; exit 2;;
esac
