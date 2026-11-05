#!/usr/bin/env bash
# collect-externo.sh — frentes C1 (puertos), C2 (TLS/cabeceras) y C3 (superficie de API) medidos DESDE AFUERA.
# Read-only: sólo conexiones y GET/HEAD públicos contra infra PROPIA. No muta nada.
# Salida: evidencia/<fecha>/externo/{nmap.txt, nmap.gnmap, headers-<host>.txt, rutas.tsv, resumen.json}
# Control positivo (--self-test): el escaneo debe VER 443 abierto y `curl -I` debe traer Content-Type;
# si no, el instrumento no llegó y NO se acepta ninguna ausencia ("no vi nada" != "no hay nada").
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FECHA="${AUD_FECHA:-$(date +%F)}"
OUT="$RAIZ/docs/copiloto-emprendedor/Auditorias/Seguridad/evidencia/$FECHA/externo"
IP="${AUD_VPS_IP:-178.105.191.1}"
NMAP="${AUD_NMAP:-$(command -v nmap || echo '/c/Program Files (x86)/Nmap/nmap.exe')}"
# Hosts servidos por Caddy (deploy/copiloto/Caddyfile.snippet) — el inventario sale del repo, no de memoria
HOSTS="${AUD_HOSTS:-copilotoemprendedor.duckdns.org copiloto.178-105-191-1.sslip.io mp.178-105-191-1.sslip.io}"
RUTAS="/ /docs /redoc /openapi.json /docs/oauth2-redirect /health /healthz /metrics /admin /me /auth/v1/health /.env /.git/config /debug"
CHEQUEOS=0; FALLAS=0

mkdir -p "$OUT"
ok()   { echo "OK   $*"; CHEQUEOS=$((CHEQUEOS+1)); }
falla(){ echo "FALLA $*"; CHEQUEOS=$((CHEQUEOS+1)); FALLAS=$((FALLAS+1)); }

# --- C1: puertos. Escaneo TCP completo; -Pn porque el firewall puede tragar el ping
c1() {
  echo "[C1] nmap -p- $IP (bg-friendly; puede tardar)"
  "$NMAP" -Pn -sT -p- --min-rate 1000 -T4 -oN "$OUT/nmap.txt" -oG "$OUT/nmap.gnmap" "$IP" >/dev/null 2>&1 || true
  # versión de servicio sólo sobre los abiertos (evita escanear 65k puertos con -sV)
  local abiertos
  abiertos=$(grep -oE '[0-9]+/open' "$OUT/nmap.gnmap" | cut -d/ -f1 | paste -sd, -)
  echo "$abiertos" > "$OUT/puertos-abiertos.txt"
  if [ -n "$abiertos" ]; then
    "$NMAP" -Pn -sT -sV -p "$abiertos" -oN "$OUT/nmap-servicios.txt" "$IP" >/dev/null 2>&1 || true
  fi
  echo "[C1] abiertos: ${abiertos:-NINGUNO}"
}

# --- C2: cabeceras por host
c2() {
  local h
  for h in $HOSTS; do
    curl -sS -m 15 -I "https://$h/" > "$OUT/headers-$h.txt" 2> "$OUT/headers-$h.err" || true
  done
}

# --- C3: rutas de framework / debug / secretos por host principal
c3() {
  local h r code
  : > "$OUT/rutas.tsv"
  for h in $HOSTS; do
    for r in $RUTAS; do
      code=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "https://$h$r" 2>/dev/null || echo 000)
      printf '%s\t%s\t%s\n' "$h" "$r" "$code" >> "$OUT/rutas.tsv"
    done
  done
}

# --- control positivo: ¿el instrumento llegó?
positivo() {
  local h primero
  primero=$(echo "$HOSTS" | awk '{print $1}')
  grep -qE '(^|,)443(,|$)' "$OUT/puertos-abiertos.txt" 2>/dev/null \
    && ok "C1: el escaneo ve 443 abierto (el instrumento llegó)" \
    || falla "C1: NO veo 443 abierto — el escaneo no llegó o el firewall filtra al escáner; ninguna ausencia vale"
  grep -qi '^content-type:' "$OUT/headers-$primero.txt" 2>/dev/null \
    && ok "C2: curl -I trae Content-Type de $primero (la lectura es real)" \
    || falla "C2: sin Content-Type en $primero — el curl falló, no el servidor"
  awk -F'\t' -v h="$primero" '$1==h && $2=="/" && $3==200{f=1} END{exit !f}' "$OUT/rutas.tsv" \
    && ok "C3: / responde 200 en $primero (la ruta base existe)" \
    || falla "C3: / no da 200 en $primero — rutas.tsv no es confiable"
}

resumen() {
  python -I -X utf8 - "$OUT" "$CHEQUEOS" "$FALLAS" <<'PY'
import json, sys, pathlib, re
out = pathlib.Path(sys.argv[1])
def leer(n):
    p = out / n
    return p.read_text(encoding="utf8", errors="replace") if p.exists() else ""
abiertos = [p for p in leer("puertos-abiertos.txt").strip().split(",") if p]
hdr_req = ["strict-transport-security", "content-security-policy", "x-frame-options",
           "x-content-type-options", "referrer-policy", "permissions-policy"]
hosts = {}
for f in sorted(out.glob("headers-*.txt")):
    h = f.name[len("headers-"):-4]
    cab = {l.split(":", 1)[0].strip().lower(): l.split(":", 1)[1].strip()
           for l in f.read_text(encoding="utf8", errors="replace").splitlines() if ":" in l}
    hosts[h] = {"presentes": [k for k in hdr_req if k in cab],
                "ausentes": [k for k in hdr_req if k not in cab],
                "server": cab.get("server"), "via": cab.get("via")}
rutas = {}
for l in leer("rutas.tsv").splitlines():
    h, r, c = l.split("\t")
    rutas.setdefault(h, {})[r] = c
expuestas = {h: {r: c for r, c in d.items() if c.startswith("2") and r not in ("/",)} for h, d in rutas.items()}
json.dump({"puertos_abiertos": abiertos, "cabeceras": hosts, "rutas_2xx_no_raiz": expuestas,
           "rutas": rutas, "chequeos_del_instrumento": int(sys.argv[2]), "fallas_del_instrumento": int(sys.argv[3])},
          open(out / "resumen.json", "w", encoding="utf8"), indent=2, ensure_ascii=False)
print("resumen.json escrito")
PY
}

case "${1:-run}" in
  --self-test|run)
    c1; c2; c3; positivo; resumen
    echo "== instrumento: $CHEQUEOS chequeos, $FALLAS fallas =="
    [ "$FALLAS" -eq 0 ] ;;
  *) echo "uso: collect-externo.sh [run|--self-test]"; exit 2;;
esac
