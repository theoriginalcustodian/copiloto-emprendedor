#!/usr/bin/env bash
# test-gate-triada-y-candado.sh — el job backend de gate.sh no puede correr sobre un stage ajeno.
#
# Caso raíz (2026-09-22): tres gates desde worktrees DETACHED (`_ctl/verify-<sha>`) cayeron callados a
# la tríada legacy y se pisaron el stage del VPS — 18 ConnectionRefused, y una corrida que pudo
# testear el código de otro SHA. Los casos:
#
#   1. NEGATIVO  worktree detached sin sesión + job backend -> exit 2, sin recibo, sin tocar el stage.
#   2. POSITIVO  el mismo árbol con UC_SESION -> el backend corre, ok, y el candado queda suelto.
#                Sin el 2, el 1 pasaría también si gate.sh rechazara todo.
#   3. NEGATIVO  candado fresco de OTRO dueño -> el backend NO corre (el stub de sync no se invoca),
#                queda failed, y el candado ajeno sigue en pie (nadie suelta lo que no es suyo).
#   4. VENCIDO   candado más viejo que el TTL -> se toma, corre, ok.
#   5. CARRERA   dos gates simultáneos de la MISMA tríada -> ambos ok y sus ventanas NO se solapan.
#
# Todo en un repo temporal con stubs (deploy/copiloto/*.sh) y GATE_SSH = shim local: no toca red ni VPS.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-gate-triada-y-candado"
command -v jq >/dev/null || { echo "  ℹ️  sin jq (gate.sh lo exige) — no se puede ejercitar"; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
R="$T/verify-abc123"                      # nombre de un `_ctl/verify-<sha>`: no delata sesión
mkdir -p "$R/scripts/ci" "$R/deploy/copiloto" "$T/bin"
cp "$ROOT/scripts/gate.sh" "$R/scripts/"
cp "$ROOT/scripts/ci/sesion-env.sh" "$ROOT/scripts/ci/candado-stage.sh" "$R/scripts/ci/"
printf '#!/usr/bin/env bash\necho "export STUB_DB=1"\n' > "$R/deploy/copiloto/test-db.sh"
# H-A3-11: gate.sh también provisiona GoTrue de test efímera antes del sync -- sin este stub el
# fixture pega contra el script real (ausente acá) y el backend falla ANTES de llegar al stub de sync.
printf '#!/usr/bin/env bash\necho "export STUB_GOTRUE=1"\n' > "$R/deploy/copiloto/test-gotrue.sh"
# el stub de sync deja constancia de su ventana [inicio, fin] y tarda STUB_SYNC_SEG
cat > "$R/deploy/copiloto/sync-test-backend.sh" <<'EOF'
#!/usr/bin/env bash
ini=$(date +%s%N); sleep "${STUB_SYNC_SEG:-0}"; fin=$(date +%s%N)
echo "$ini $fin" >> "$STUB_VENTANAS"
EOF
# El shim deja una bitácora por llamada remota (hora, pid, si el candado existía ANTES, resultado): si el caso 5 falla
# en CI (dos gates dijeron «tomado»), la bitácora muestra si los mkdir fueron realmente simultáneos o si el candado
# desapareció entre medio. No cambia lo que devuelve: sólo observa.
cat > "$T/bin/ssh-local" <<'EOF'
#!/usr/bin/env bash
shift
pre=$([ -d "$LOCK_DBG" ] && echo existe || echo libre)
# mtime crudo del candado y reloj de ESTA llamada: la edad que calcularía candado-stage.sh (ahora - mtime) queda
# a la vista. «Lo vencí porque lo vi viejo» (TTL con mtime/reloj raro) se distingue así de «no había candado».
mt=$(stat -c %Y "$LOCK_DBG" 2>/dev/null || echo -); ahora=$(date +%s)
t0=$(date +%s%N); out=$(bash -c "$1"); rc=$?
echo "$t0 $(date +%s%N) pid=$$ lock_antes=$pre mtime=$mt ahora=$ahora rc=$rc out=${out:0:60}" >> "$SSH_LOG"
printf '%s\n' "$out"; exit $rc
EOF
chmod +x "$T/bin/ssh-local"
git -C "$R" init -q && git -C "$R" -c core.autocrlf=false add -A && git -C "$R" -c user.name=t -c user.email=t@t commit -qm t \
  && git -C "$R" checkout -q --detach
STAGE="$T/stage-be"; LOCK="$STAGE.gate-lock"; export STUB_VENTANAS="$T/ventanas.txt"
export LOCK_DBG="$LOCK" SSH_LOG="$T/ssh.log"; : > "$SSH_LOG"

gate() {  # gate <salida> [VAR=valor ...] -- corre gate.sh backend en el repo temporal, entorno limpio
  local out="$1"; shift
  env -u UC_SESION -u UC_TESTDB_NAME -u UC_TESTDB_PORT -u UC_TEST_STAGE -u UC_TRIADA_PROPIA \
    GATE_SSH="$T/bin/ssh-local" GATE_RECIBO_DIR="$T/rec" "$@" bash "$R/scripts/gate.sh" backend >"$out" 2>&1
}

# 1. NEGATIVO: detached sin sesión
rm -rf "$T/rec"; : > "$STUB_VENTANAS"
gate "$T/o1"; rc=$?
if [ "$rc" -eq 2 ] && ! ls "$T"/rec/*.json >/dev/null 2>&1 && [ ! -s "$STUB_VENTANAS" ] && grep -q "UC_SESION=" "$T/o1"; then
  ok "1 NEGATIVO · detached sin sesión -> exit 2, sin recibo, el sync no corrió, y dice cómo invocarlo"
else fail "1 NEGATIVO · rc=$rc recibo=$(ls "$T"/rec 2>/dev/null) ventanas=$(wc -l < "$STUB_VENTANAS") salida=<$(cat "$T/o1")>"; fi

# 2. POSITIVO: el mismo árbol con la sesión explícita
rm -rf "$T/rec"; : > "$STUB_VENTANAS"
gate "$T/o2" UC_SESION=backend UC_TEST_STAGE="$STAGE"; rc=$?
SHA="$(git -C "$R" rev-parse HEAD)"
if [ "$rc" -eq 0 ] && [ "$(jq -r '.jobs.backend' "$T/rec/$SHA.json" 2>/dev/null)" = "ok" ] && [ -s "$STUB_VENTANAS" ] && [ ! -d "$LOCK" ]; then
  ok "2 POSITIVO · con UC_SESION corre, recibo backend=ok, y el candado quedó suelto"
else fail "2 POSITIVO · rc=$rc lock=$([ -d "$LOCK" ] && echo QUEDÓ || echo suelto) salida=<$(tail -5 "$T/o2")>"; fi

# 3. NEGATIVO: candado fresco de otro dueño
rm -rf "$T/rec"; : > "$STUB_VENTANAS"; mkdir -p "$LOCK"; echo "otra-pc-999-1 deadbeef" > "$LOCK/owner"
gate "$T/o3" UC_SESION=backend UC_TEST_STAGE="$STAGE" UC_GATE_LOCK_WAIT=0; rc=$?
if [ "$rc" -eq 1 ] && [ "$(jq -r '.jobs.backend' "$T/rec/$SHA.json" 2>/dev/null)" = "failed" ] && [ ! -s "$STUB_VENTANAS" ] \
   && grep -q '^otra-pc-999-1 ' "$LOCK/owner" 2>/dev/null; then
  ok "3 NEGATIVO · candado ajeno -> backend failed SIN correr el sync, y el candado ajeno sigue en pie"
else fail "3 NEGATIVO · rc=$rc ventanas=$(wc -l < "$STUB_VENTANAS") owner=<$(cat "$LOCK/owner" 2>/dev/null)> salida=<$(tail -5 "$T/o3")>"; fi

# 4. VENCIDO: el mismo candado ajeno, pero más viejo que el TTL
rm -rf "$T/rec"; : > "$STUB_VENTANAS"; touch -d '2 hours ago' "$LOCK"
gate "$T/o4" UC_SESION=backend UC_TEST_STAGE="$STAGE" UC_GATE_LOCK_WAIT=0 UC_GATE_LOCK_TTL=60; rc=$?
if [ "$rc" -eq 0 ] && [ -s "$STUB_VENTANAS" ] && [ ! -d "$LOCK" ] && grep -q "VENCIDO" "$T/o4"; then
  ok "4 VENCIDO · candado de un gate muerto -> se toma, corre y se suelta"
else fail "4 VENCIDO · rc=$rc lock=$([ -d "$LOCK" ] && echo QUEDÓ || echo suelto) salida=<$(tail -5 "$T/o4")>"; fi

# 5.0 ATOMICIDAD de mkdir en ESTE filesystem. Todo el candado descansa en que, de dos mkdir simultáneos sobre el
# mismo path, uno falle. En CI el caso 5 dio DOS `TOMADO` con el candado `libre` en ambas llamadas (bitácora, run
# 42233323351, dos mkdir con 1 µs de diferencia): o el código del candado, o un filesystem que no lo garantiza. Este
# microtest separa las dos: sin gate.sh ni candado de por medio, 400 pares de `mkdir` a la vez sobre el mismo path.
dobles=0
for i in $(seq 1 400); do
  d="$T/atom-$i"
  ( mkdir "$d" 2>/dev/null && : > "$d.a" ) & ( mkdir "$d" 2>/dev/null && : > "$d.b" ) & wait
  [ -e "$d.a" ] && [ -e "$d.b" ] && dobles=$((dobles + 1))
done
if [ "$dobles" -eq 0 ]; then ok "5.0 ATOMICIDAD · 400 pares de mkdir simultáneos: nunca dos ganadores"
else
  # Separa HERRAMIENTA de KERNEL: el mismo experimento con la syscall mkdir(2) directa (python os.mkdir). Si el kernel
  # da 0 dobles y el binario `mkdir` da muchos, el defecto es del binario (p. ej. coreutils reimplementado), no del fs.
  kd=-; if command -v python3 >/dev/null; then kd=0
    for i in $(seq 1 150); do
      d="$T/katom-$i"
      ( python3 -c 'import os,sys; os.mkdir(sys.argv[1])' "$d" 2>/dev/null && : > "$d.a" ) & \
      ( python3 -c 'import os,sys; os.mkdir(sys.argv[1])' "$d" 2>/dev/null && : > "$d.b" ) & wait
      [ -e "$d.a" ] && [ -e "$d.b" ] && kd=$((kd + 1))
    done; fi
  fail "5.0 ATOMICIDAD · el binario mkdir dio DOS ganadores en $dobles/400 pares; syscall mkdir(2) vía python: $kd/150 · mkdir=$(command -v mkdir) <$(mkdir --version 2>&1 | head -1)> · fs: $(df -PT "$T" 2>/dev/null | tail -1) · $(. /etc/os-release 2>/dev/null; echo "$PRETTY_NAME")"
fi

# 5. CARRERA: dos gates de la misma tríada a la vez
rm -rf "$T/rec" "$LOCK"; : > "$STUB_VENTANAS"; : > "$SSH_LOG"
gate "$T/o5a" UC_SESION=backend UC_TEST_STAGE="$STAGE" STUB_SYNC_SEG=3 UC_GATE_LOCK_POLL=1 & p1=$!
gate "$T/o5b" UC_SESION=backend UC_TEST_STAGE="$STAGE" STUB_SYNC_SEG=3 UC_GATE_LOCK_POLL=1 & p2=$!
wait "$p1"; r1=$?; wait "$p2"; r2=$?
solapan="$(sort -n "$STUB_VENTANAS" | awk 'NR==1{f=$2} NR==2{print ($1 < f) ? "SI" : "NO"}')"
if [ "$r1" -eq 0 ] && [ "$r2" -eq 0 ] && [ "$(wc -l < "$STUB_VENTANAS")" -eq 2 ] && [ "$solapan" = "NO" ] && [ ! -d "$LOCK" ]; then
  ok "5 CARRERA · dos gates simultáneos: ambos ok, en serie (ventanas sin solape), candado suelto"
else fail "5 CARRERA · r1=$r1 r2=$r2 ventanas=<$(tr '
' ' ' < "$STUB_VENTANAS")> solapan=$solapan lock=$([ -d "$LOCK" ] && echo QUEDO || echo suelto)"
  # Diagnostico del flake (medido en CI 2 veces, no reproducible en 88 corridas locales): que gate dijo TOMADO/VENCIDO/espero,
  # para distinguir "dos tomaron el candado" de "uno lo tomo y el otro nunca lo pidio".
  echo "     --- bitácora de llamadas remotas (inicio fin pid lock_antes rc salida):"; sed 's/^/     /' "$SSH_LOG"
  for x in "$T/o5a" "$T/o5b"; do echo "     --- $(basename "$x"): $(grep -E 'candado|ocupado' "$x" | tr '
' '|')"; done; fi

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-gate-triada-y-candado: todo verde"; exit 0; }
echo "❌ test-gate-triada-y-candado: $fallos fallo(s)"; exit 1
