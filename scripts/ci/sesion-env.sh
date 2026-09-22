#!/usr/bin/env bash
# scripts/ci/sesion-env.sh — triada del gate por sesión (BL-B6). Se hace `source` desde gate.sh.
#
# Por qué existe: `test-db.sh` y `sync-test-backend.sh` tenían un contenedor y un stage FIJOS en el
# VPS. Dos sesiones corriendo el gate a la vez se pisaban la base y el código bajo test (rojos y
# verdes falsos). Las tres variables ya eran parametrizables; esto sólo les da un valor por sesión.
#
# Sesión = `UC_SESION` (backend|fe1|fe2|aud) si viene explícita; si no, se infiere del prefijo de la
# rama (backend/…, frontend1/…, frontend2/…, aud/…) o del nombre del worktree (wt-backend, wt-fe1, wt-fe2, wt-audit*).
# Sin sesión reconocible NO se inventa una triada: quedan los defaults históricos, y `UC_TRIADA_PROPIA=0`.
# gate.sh se NIEGA a correr el job backend con `UC_TRIADA_PROPIA=0` (2026-09-22): un worktree detached
# (`_ctl/verify-<sha>`, el lugar natural para gatear el SHA mergeado) no tiene rama ni nombre que
# delaten la sesión, caía callado al stage legacy, y tres gates de tres corridas se pisaron ahí.
# `copiloto-test-db` en el 55432 queda sin consumidores desde gate.sh. Retirar el contenedor: deuda de Cierre B.
# Un valor ya exportado por quien invoca (UC_TESTDB_NAME/PORT, UC_TEST_STAGE) siempre gana.
_ROOT_SESION="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

_inferir_sesion() {
  local rama dir
  rama="$(git -C "$_ROOT_SESION" branch --show-current 2>/dev/null || true)"
  dir="$(basename "$_ROOT_SESION")"
  case "$rama" in
    backend/*)   echo backend; return ;;
    frontend1/*|fe1/*) echo fe1; return ;;
    frontend2/*|fe2/*) echo fe2; return ;;
    aud/*|auditoria/*) echo aud; return ;;
  esac
  case "$dir" in
    wt-backend)  echo backend ;;
    wt-fe1|wt-fe1b) echo fe1 ;;
    wt-fe2|wt-fe2-*) echo fe2 ;;
    wt-aud|wt-aud-*|wt-audit|wt-audit-*) echo aud ;;
  esac
}

UC_SESION="${UC_SESION:-$(_inferir_sesion)}"
case "$UC_SESION" in
  backend) _sfx=be; _port=55435; _gport=9975; _gmport=8975 ;;
  fe1)     _sfx=fe1; _port=55433; _gport=9973; _gmport=8973 ;;
  fe2)     _sfx=fe2; _port=55434; _gport=9974; _gmport=8974 ;;
  aud)     _sfx=aud; _port=55436; _gport=9976; _gmport=8976 ;;   # auditoría (A1 §4.4: usó copiloto-test-db-aud:55436; H-A3-11: gotrue-aud:9976/8976, ya usado por el spike del auditor)
  "")      _sfx="" ;;
  *) echo "sesion-env: UC_SESION='$UC_SESION' desconocida (backend|fe1|fe2|aud)" >&2; return 1 2>/dev/null || exit 1 ;;
esac

if [ -n "$_sfx" ]; then
  export UC_TESTDB_NAME="${UC_TESTDB_NAME:-copiloto-test-db-$_sfx}"
  export UC_TESTDB_PORT="${UC_TESTDB_PORT:-$_port}"
  export UC_TEST_STAGE="${UC_TEST_STAGE:-/opt/uc-copiloto-cliente-stage-$_sfx}"
  # H-A3-11: misma lógica para la GoTrue de test efímera -- sin esto, dos sesiones que la levantan a
  # la vez comparten contenedor/stage/puerto (mismo bug que ya pisó test-db.sh, BL-B6).
  export UC_TESTGOTRUE_NAME="${UC_TESTGOTRUE_NAME:-copiloto-test-gotrue-$_sfx}"
  export UC_TESTGOTRUE_PORT="${UC_TESTGOTRUE_PORT:-$_gport}"
  export UC_TESTGOTRUE_MAIL_PORT="${UC_TESTGOTRUE_MAIL_PORT:-$_gmport}"
  export UC_TESTGOTRUE_STAGE="${UC_TESTGOTRUE_STAGE:-/tmp/copiloto-test-gotrue-$_sfx}"
fi
export UC_SESION
_etiqueta="${UC_SESION:-<sin sesión: defaults históricos>}"
UC_TRIADA_PROPIA=0; [ -n "$_sfx" ] && UC_TRIADA_PROPIA=1
# triada exportada explícita por quien invoca (sin sesión inferida): no es «sin sesión» (A1 §4.4)
[ -z "$UC_SESION" ] && [ -n "${UC_TESTDB_NAME:-}" ] && [ -n "${UC_TESTDB_PORT:-}" ] && [ -n "${UC_TEST_STAGE:-}" ] && { _etiqueta="<triada exportada explícita>"; UC_TRIADA_PROPIA=1; }
export UC_TRIADA_PROPIA
echo "==> sesión del gate: $_etiqueta · db=${UC_TESTDB_NAME:-copiloto-test-db}:${UC_TESTDB_PORT:-55432} · stage=${UC_TEST_STAGE:-/opt/uc-copiloto-cliente-stage}"
