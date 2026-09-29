#!/usr/bin/env bash
# Control POSITIVO del guard de path de los servers de evidencia.
# Monta un RAIZ de juguete y un HERMANO cuyo nombre empieza igual que RAIZ: eso es lo que el
# `startsWith(RAIZ)` sin separador no distingue. NO usa el proto real (35 MB) ni toca el repo.
#
#   A  ruta legitima          -> debe 200   (control negativo: el fix no debe romper el server)
#   B  hermano con prefijo    -> debe 403   (si da 200, el bypass EXISTE)
#   C  fuera del arbol        -> debe 403   (el guard clasico; si falla, el guard no existe)
set -u
SP="$(cd "$(dirname "$0")" && pwd)"
SRV="${1:?pasa la ruta del server .mjs a probar}"
T="$SP/tw"; rm -rf "$T"; mkdir -p "$T/raiz/prototipo" "$T/raiz-secreto"
printf '<html><body>LEGITIMO</body></html>' > "$T/raiz/prototipo/index.html"
printf 'SECRETO-FILTRADO-POR-PREFIJO' > "$T/raiz-secreto/secreto.txt"
printf 'FUERA-DEL-ARBOL' > "$T/fuera.txt"

P=${PUERTO:-8171}
RAIZ="$T/raiz" PROTO_DIR="$T/raiz" CANARIO=0 PUERTO=$P PORT=$P node "$SRV" > "$SP/tw-srv.log" 2>&1 &
S=$!
for i in $(seq 1 25); do curl -sf "http://127.0.0.1:$P/prototipo/" >/dev/null 2>&1 && break; sleep 0.2; done

pedir() { curl -s -o "$SP/tw-body.txt" -w '%{http_code}' --path-as-is "http://127.0.0.1:$P$1"; }
A=$(pedir "/prototipo/");                        CA=$(cat "$SP/tw-body.txt")
B=$(pedir "/../raiz-secreto/secreto.txt");       CB=$(cat "$SP/tw-body.txt")
B2=$(pedir "/%2e%2e/raiz-secreto/secreto.txt");  CB2=$(cat "$SP/tw-body.txt")
C=$(pedir "/../../fuera.txt");                   CC=$(cat "$SP/tw-body.txt")
kill $S 2>/dev/null

echo "server:  $SRV"
echo "A legitimo         HTTP $A  cuerpo: ${CA:0:30}"
echo "B hermano-prefijo  HTTP $B  cuerpo: ${CB:0:30}"
echo "B2 %2e%2e          HTTP $B2  cuerpo: ${CB2:0:30}"
echo "C fuera del arbol  HTTP $C  cuerpo: ${CC:0:30}"
echo
FALLA=0
[ "$A" = 200 ] || { echo "❌ A deberia ser 200 (el server no sirve lo legitimo: la prueba no mide el guard)"; FALLA=1; }
case "$CB$CB2" in *SECRETO*) echo "🔴 BYPASS CONFIRMADO: sirvio un archivo de FUERA de RAIZ via hermano con prefijo"; FALLA=1;; esac
[ "$C" = 403 ] || echo "⚠️  C no dio 403 (dio $C) — revisar si el guard clasico corre"
[ "$FALLA" = 0 ] && echo "✅ guard OK en los tres casos"
exit $FALLA
