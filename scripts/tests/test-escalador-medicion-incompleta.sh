#!/usr/bin/env bash
# test-escalador-medicion-incompleta.sh — un escalador que no pudo medir NO puede quedarse callado.
#
# CASO REAL (2026-09-21). Con 16 worktrees y 5 sesiones vivas sobre el mismo Git for Windows, los
# forks empezaron a fallar de a rachas:
#     dofork: child -1 - forked process ... died unexpectedly, errno 11
#     escaladores-buzon.sh: fork: retry: Resource temporarily unavailable
#
# Lo grave no era que fallara, sino CÓMO. `edad="$(edad_min "$f")"` con el fork caído devuelve la
# cadena VACÍA; el `[ "$edad" -ge "$UMBRAL" ] || continue` de cada regla trata el error de bash
# («integer expression expected») igual que «todavía es joven» y SALTEA el archivo. Si la racha
# alcanzaba a todos, el script terminaba con `alarma=0`, imprimía «nada que escalar» y salía 0 —
# y `vigilancia-check.sh` reportaba calma. **Un contrato abandonado y un escalador que no pudo
# mirarlo producían exactamente el mismo silencio.**
#
# Es la misma familia que el repo ya pagó con el watchdog que sólo veía al que llegaba tarde y con
# la allowlist que no sabía lo que le faltaba: el instrumento no falla, se calla.
#
# CÓMO SE SIMULA, sin código de test dentro del script de producción: un `stat` de mentira, primero
# en el PATH, que sale 0 e imprime NADA. Eso reproduce la forma exacta del fallo —una sustitución
# que vuelve sin número— y además esquiva el `|| echo "$now"`, que sólo cubre que `stat` falle, no
# que el fork no vuelva.
#
#   1. CONTROL POSITIVO — sin shim, contrato viejo         → CONTRATO SIN TOMAR, sin falsa alarma
#   2. CONTROL NEGATIVO — sin shim, buzón limpio           → «nada que escalar», exit 0
#   3. EL CASO — con shim, contrato viejo                  → MEDICIÓN INCOMPLETA + exit 1
#   4. CONTROL DE LA REGRESIÓN — con shim                  → NUNCA dice «nada que escalar»
#   5. El centinela está en los dos caminos (alarma y silencio)
#   6. El gate exige el centinela: escalador que muere a mitad → alarma
#   7. CONTROL DE LA CONTROL — con centinela presente, el gate NO acusa
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESC="$REPO_ROOT/scripts/escaladores-buzon.sh"
VIG="$REPO_ROOT/scripts/vigilancia-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# ── Buzón con un contrato viejo, sin tomar ────────────────────────────────────
nuevo_buzon() {  # nuevo_buzon <dir> [con-contrato-viejo]
  local b="$1"
  mkdir -p "$b/abierto" "$b/en-curso" "$b/cerrado"
  if [ "${2:-}" = "con-contrato" ]; then
    local f="$b/abierto/2026-09-21_contrato_planificacion-a-backend_K-99-prueba.md"
    printf '# contrato de prueba\n\nDisparador: arrancable ya.\n' > "$f"
    touch -d "-200 minutes" "$f"
  fi
}

# ── Un `stat` que sale 0 y no imprime nada: la forma exacta del fork caído ────
mkdir -p "$TMP/bin-roto"
cat > "$TMP/bin-roto/stat" <<'SHIM'
#!/usr/bin/env bash
exit 0
SHIM
chmod +x "$TMP/bin-roto/stat"

B_LLENO="$TMP/buzon-lleno"; nuevo_buzon "$B_LLENO" con-contrato
B_VACIO="$TMP/buzon-vacio"; nuevo_buzon "$B_VACIO"

echo "── 1. CONTROL POSITIVO: sin shim, el escalador ve el contrato viejo ──"
# Sin este caso, un escalador que gritara SIEMPRE «medición incompleta» pasaría el caso 3 en verde.
sal1="$(bash "$ESC" --dry-run "$B_LLENO" 2>&1)"; rc1=$?
if [ "$rc1" -eq 1 ] && grep -q "CONTRATO SIN TOMAR" <<< "$sal1"; then
  ok "escala el contrato de 200min (exit 1)"
else
  fail "no escaló el contrato viejo (rc=$rc1)"
fi
if grep -q "MEDICION INCOMPLETA" <<< "$sal1"; then
  fail "acusa medición incompleta cuando midió bien: la alarma sonaría siempre"
else
  ok 'no inventa fallos de medición cuando stat anda'
fi

echo "── 2. CONTROL NEGATIVO: buzón limpio, silencio legítimo ──"
sal2="$(bash "$ESC" --dry-run "$B_VACIO" 2>&1)"; rc2=$?
if [ "$rc2" -eq 0 ] && grep -q "nada que escalar" <<< "$sal2"; then
  ok "buzón sin obligaciones viejas: exit 0"
else
  fail "alarmó sobre un buzón limpio (rc=$rc2)"
fi

echo "── 3. EL CASO: la medición no vuelve con un número ──"
sal3="$(PATH="$TMP/bin-roto:$PATH" bash "$ESC" --dry-run "$B_LLENO" 2>&1)"; rc3=$?
if [ "$rc3" -eq 1 ]; then
  ok "exit 1: una medición que no se pudo hacer es alarma, no cero"
else
  fail "exit $rc3: se quedó callado sin haber podido medir"
fi
if grep -q "MEDICION INCOMPLETA" <<< "$sal3"; then
  ok "lo dice con nombre propio"
else
  fail "no reportó MEDICION INCOMPLETA"
fi
if grep -q "K-99-prueba" <<< "$sal3"; then
  ok "nombra el archivo que quedó sin mirar"
else
  fail "no dice CUÁL archivo no pudo medir: el aviso no es accionable"
fi
# El contrato NO puede aparecer como "sin tomar": el escalador no pudo saber su edad. Si apareciera,
# el caso 3 estaría pasando por el motivo equivocado — alarma correcta, razón inventada.
if grep -q "CONTRATO SIN TOMAR" <<< "$sal3"; then
  fail "escaló un contrato cuya edad no pudo medir: la alarma es real pero el dato es inventado"
else
  ok "no escala lo que no pudo medir: lo reporta como no medido"
fi

echo "── 3.bis: el otro modo de no saber — mentir hacia ARRIBA ──"
# Antes del fix, `stat` mudo no daba error: en aritmética bash una variable vacía vale 0, así que
# `(now - 0) / 60` devolvía 29.833.587 minutos. El escalador no se callaba: INUNDABA, porque todo
# cruzaba cualquier umbral a la vez. Callarse e inundar son los dos síntomas del mismo no-saber.
if grep -qE '\([0-9]{7,}min' <<< "$sal3"; then
  fail "REGRESIÓN: reportó una edad absurda (>10⁶ min) en vez de admitir que no pudo medir"
else
  ok "no reporta edades imposibles: una variable vacía no es un cero"
fi

echo "── 4. CONTROL DE LA REGRESIÓN: no puede decir que no hay nada ──"
# Éste es el caso exacto del 2026-09-21. La versión anterior imprimía «nada que escalar» y salía 0.
if grep -q "nada que escalar" <<< "$sal3"; then
  fail "REGRESIÓN: declaró el buzón limpio sin haber podido mirarlo"
else
  ok "nunca afirma «nada que escalar» sobre lo que no midió"
fi

echo "── 5. El centinela cierra los dos caminos ──"
for par in "alarma:$sal1" "silencio:$sal2" "medicion-fallida:$sal3"; do
  if grep -q "ESCALADORES: FIN-OK" <<< "${par#*:}"; then
    ok "centinela presente en el camino «${par%%:*}»"
  else
    fail "falta el centinela en el camino «${par%%:*}»: el gate lo leería como muerte a mitad"
  fi
done

echo "── 6. El gate exige el centinela ──"
cat > "$TMP/escalador-que-muere.sh" <<'MUERE'
#!/usr/bin/env bash
# Imprime como si todo estuviera bien y se muere antes del final, sin centinela.
echo "ESCALADORES: nada que escalar."
exit 0
MUERE
sal6="$(ESCALADOR_SH="$TMP/escalador-que-muere.sh" BUZON_DIR="$B_VACIO" \
        TRANSCRIPTS_DIR="$TMP/sin-transcripts" RAMAS_GIT_DIR="$TMP/repo-vacio" \
        bash "$VIG" --dry-run 2>&1)"; rc6=$?
if [ "$rc6" -eq 1 ] && grep -q "ESCALADORES NO TERMINARON" <<< "$sal6"; then
  ok "un escalador sin centinela levanta alarma aunque haya salido 0 y dicho que no hay nada"
else
  fail "el gate creyó el silencio de un escalador que nunca llegó al final (rc=$rc6)"
fi

echo "── 7. CONTROL DE LA CONTROL: con centinela, el gate no acusa ──"
# Sin este caso, un gate que gritara SIEMPRE «NO TERMINARON» pasaría el caso 6 en verde.
cat > "$TMP/escalador-que-termina.sh" <<'TERMINA'
#!/usr/bin/env bash
echo "ESCALADORES: nada que escalar."
echo "ESCALADORES: FIN-OK"
exit 0
TERMINA
sal7="$(ESCALADOR_SH="$TMP/escalador-que-termina.sh" BUZON_DIR="$B_VACIO" \
        TRANSCRIPTS_DIR="$TMP/sin-transcripts" RAMAS_GIT_DIR="$TMP/repo-vacio" \
        bash "$VIG" --dry-run 2>&1)"
if grep -q "ESCALADORES NO TERMINARON" <<< "$sal7"; then
  fail "acusa muerte a mitad con el centinela presente: la alarma sonaría siempre"
else
  ok "con el centinela presente no acusa nada"
fi
if grep -q "FIN-OK" <<< "$sal7"; then
  fail "el centinela se filtra al reporte: es plomería del gate, no una novedad para el humano"
else
  ok "el centinela no ensucia el reporte"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-escalador-medicion-incompleta: 14/14"
  exit 0
fi
echo "❌ test-escalador-medicion-incompleta: $fallos fallo(s)"
exit 1
