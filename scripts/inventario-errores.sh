#!/usr/bin/env bash
# Inventario cuantificado del manejo de errores de TODA la app.
# Fuente de verdad: `origin/main` (NO el working tree — checkout compartido sirve versiones viejas).
# Idempotente, read-only. Salida: markdown a stdout.
set -uo pipefail

REPO="${REPO:-c:/Proyectos/Claude/Claude code/copiloto-emprendedor}"
REF="${REF:-origin/main}"
cd "$REPO" || exit 1

SHA="$(git rev-parse --short "$REF")"

# --- capas: nombre|pathspec glob ---
CAPAS_PY=(
  "backend-app|:(glob)apps/copiloto/**/*.py|:(glob,exclude)apps/copiloto/tests/**"
  "backend-tests|:(glob)apps/copiloto/tests/**/*.py"
  "motor|:(glob)motor/**/*.py"
  "deploy|:(glob)deploy/**/*.py"
)
CAPAS_TS=(
  "core|:(glob)packages/core/src/**/*.ts|:(glob,exclude)packages/core/src/**/*.test.ts"
  "core-tests|:(glob)packages/core/src/**/*.test.ts"
  "mobile|:(glob)apps/mobile/**/*.ts|:(glob)apps/mobile/**/*.tsx|:(glob,exclude)apps/mobile/**/*.test.ts|:(glob,exclude)apps/mobile/**/*.test.tsx"
  "mobile-tests|:(glob)apps/mobile/**/*.test.ts|:(glob)apps/mobile/**/*.test.tsx"
  "web-pwa|:(glob)apps/copiloto-web/src/**/*.ts|:(glob)apps/copiloto-web/src/**/*.tsx"
)

# cuenta ocurrencias de un patrón ERE en una capa
cnt() { # $1=pattern  $2..=pathspecs
  local pat="$1"; shift
  git grep -h -I -E -c "$pat" "$REF" -- "$@" 2>/dev/null | awk '{s+=$1} END{print s+0}'
}
# archivos distintos con match
files() {
  local pat="$1"; shift
  git grep -l -I -E "$pat" "$REF" -- "$@" 2>/dev/null | wc -l | tr -d ' '
}
# lista sitios archivo:linea
sites() {
  local pat="$1"; shift
  git grep -n -I -E "$pat" "$REF" -- "$@" 2>/dev/null
}

hdr() { printf '\n## %s\n\n' "$1"; }

echo "# Inventario de manejo de errores — \`$REF\` @ $SHA"
echo
echo "> Generado por \`inventario-errores.sh\` (read-only, contra el ref, no el working tree)."

# =====================================================================
hdr "1. Python — densidad por capa"
printf '| capa | try | except-genérico | bare-except | raise | HTTPException | logging/logger | print | traceback/exc_info |\n'
printf '|---|---|---|---|---|---|---|---|---|\n'
for row in "${CAPAS_PY[@]}"; do
  IFS='|' read -r nombre p1 p2 p3 <<<"$row"
  ps=(); for p in "$p1" "$p2" "$p3"; do [ -n "${p:-}" ] && ps+=("$p"); done
  printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' "$nombre" \
    "$(cnt '^[[:space:]]*try:' "${ps[@]}")" \
    "$(cnt '^[[:space:]]*except (Exception|BaseException)' "${ps[@]}")" \
    "$(cnt '^[[:space:]]*except:' "${ps[@]}")" \
    "$(cnt '^[[:space:]]*raise ' "${ps[@]}")" \
    "$(cnt 'HTTPException' "${ps[@]}")" \
    "$(cnt '(logging\.|logger\.|log\.(info|warn|error|debug|exception))' "${ps[@]}")" \
    "$(cnt '^[[:space:]]*print\(' "${ps[@]}")" \
    "$(cnt '(traceback|exc_info)' "${ps[@]}")"
done

hdr "2. Python — silencios (candidatos a error tragado)"
echo '### `except ...: pass` / `return None` / `continue` en la MISMA línea o la siguiente'
echo '```'
sites '^[[:space:]]*except[^:]*:[[:space:]]*(pass|return|continue)' ':(glob)apps/copiloto/**/*.py' ':(glob)motor/**/*.py' ':(glob,exclude)apps/copiloto/tests/**'
echo '---- except seguido de pass/return en la línea siguiente ----'
git grep -n -I -A1 -E '^[[:space:]]*except' "$REF" -- ':(glob)apps/copiloto/**/*.py' ':(glob)motor/**/*.py' ':(glob,exclude)apps/copiloto/tests/**' 2>/dev/null \
  | grep -E '[-:][[:space:]]*(pass|return None|return \{\}|return \[\]|continue)[[:space:]]*$' || true
echo '```'

hdr "3. Temporal — política de fallo durable"
for pat in 'RetryPolicy' 'maximum_attempts' 'non_retryable' 'NonRetryableError' 'ApplicationError' 'start_to_close_timeout' 'schedule_to_close_timeout' 'heartbeat' 'ActivityError' 'ChildWorkflow' 'continue_as_new' 'WorkflowFailureError' 'CancelledError' 'TimeoutError'; do
  printf '%-28s app=%-4s motor=%-4s\n' "$pat" \
    "$(cnt "$pat" ':(glob)apps/copiloto/**/*.py' ':(glob,exclude)apps/copiloto/tests/**')" \
    "$(cnt "$pat" ':(glob)motor/**/*.py')"
done
echo
echo '### Sitios de RetryPolicy / timeouts (todos)'
echo '```'
sites '(RetryPolicy|maximum_attempts|non_retryable_error_types|start_to_close_timeout|schedule_to_close_timeout|heartbeat_timeout)' ':(glob)apps/copiloto/**/*.py' ':(glob)motor/**/*.py' ':(glob,exclude)apps/copiloto/tests/**'
echo '```'

hdr "4. Contrato de error HTTP (backend → app)"
echo '### status codes emitidos'
echo '```'
sites 'status_code[[:space:]]*=[[:space:]]*[0-9]{3}' ':(glob)apps/copiloto/**/*.py' ':(glob,exclude)apps/copiloto/tests/**' | sed -E 's/.*status_code[[:space:]]*=[[:space:]]*([0-9]{3}).*/\1/' | sort | uniq -c | sort -rn
echo '--- HTTPException(...) con literal ---'
sites 'HTTPException\([0-9]{3}' ':(glob)apps/copiloto/**/*.py' ':(glob,exclude)apps/copiloto/tests/**' | sed -E 's/.*HTTPException\(([0-9]{3}).*/\1/' | sort | uniq -c | sort -rn
echo '```'
echo '### módulo de errores canónico (si existe) y su uso'
echo '```'
git ls-tree -r --name-only "$REF" | grep -iE 'error' || echo '(sin archivos con "error" en el nombre)'
echo '--- imports de errores_web / codigo= ---'
sites '(errores_web|from .*errores|detail[[:space:]]*=[[:space:]]*\{|"codigo")' ':(glob)apps/copiloto/**/*.py' ':(glob,exclude)apps/copiloto/tests/**' | head -60
echo '```'

# =====================================================================
hdr "5. TypeScript — densidad por capa"
printf '| capa | try{ | catch | throw | .catch( | console.error/warn | finally | ErrorBoundary | Alert.alert | setError/estado error |\n'
printf '|---|---|---|---|---|---|---|---|---|---|\n'
for row in "${CAPAS_TS[@]}"; do
  IFS='|' read -r nombre p1 p2 p3 p4 <<<"$row"
  ps=(); for p in "$p1" "$p2" "$p3" "$p4"; do [ -n "${p:-}" ] && ps+=("$p"); done
  printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' "$nombre" \
    "$(cnt 'try[[:space:]]*\{' "${ps[@]}")" \
    "$(cnt 'catch[[:space:]]*[({]' "${ps[@]}")" \
    "$(cnt 'throw ' "${ps[@]}")" \
    "$(cnt '\.catch\(' "${ps[@]}")" \
    "$(cnt 'console\.(error|warn)' "${ps[@]}")" \
    "$(cnt 'finally[[:space:]]*\{' "${ps[@]}")" \
    "$(cnt '(ErrorBoundary|componentDidCatch|ErrorUtils|setJSExceptionHandler)' "${ps[@]}")" \
    "$(cnt 'Alert\.alert' "${ps[@]}")" \
    "$(cnt '(setError|setErrorMsg|errorMsg|\berror:|hasError|esError|mensajeError)' "${ps[@]}")"
done

hdr "6. TS — silencios y degradación muda"
echo '### catch vacío / que traga'
echo '```'
git grep -n -I -A2 -E 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{' "$REF" -- ':(glob)packages/core/src/**/*.ts' ':(glob)apps/mobile/**/*.ts' ':(glob)apps/mobile/**/*.tsx' ':(glob,exclude)**/*.test.ts' ':(glob,exclude)**/*.test.tsx' 2>/dev/null \
  | grep -E '[-:][[:space:]]*(\}|return( (null|undefined|\{\}|\[\]|false|0))?;?)[[:space:]]*$' | head -80 || true
echo '```'
echo '### validación de respuesta del endpoint (patrón esRespuestaDelEndpoint / res.ok / status)'
echo '```'
for pat in 'esRespuestaDelEndpoint' 'res\.ok' '\.status[[:space:]]*(===|!==|>=|<)' 'response\.ok' 'AbortController' 'signal:' 'timeout'; do
  printf '%-32s core=%-4s mobile=%-4s pwa=%-4s\n' "$pat" \
    "$(cnt "$pat" ':(glob)packages/core/src/**/*.ts' ':(glob,exclude)**/*.test.ts')" \
    "$(cnt "$pat" ':(glob)apps/mobile/**/*.ts' ':(glob)apps/mobile/**/*.tsx' ':(glob,exclude)**/*.test.ts' ':(glob,exclude)**/*.test.tsx')" \
    "$(cnt "$pat" ':(glob)apps/copiloto-web/src/**/*.ts' ':(glob)apps/copiloto-web/src/**/*.tsx')"
done
echo '```'

hdr "7. Cobertura adversarial de error (tests que ejercitan el fallo)"
echo '```'
for pat in 'raises' 'pytest\.raises' '(fall|error|falla|revienta|no_explota|timeout|429|500|409|401|403)' ; do
  printf 'PY  %-40s tests=%s\n' "$pat" "$(cnt "$pat" ':(glob)apps/copiloto/tests/**/*.py')"
done
for pat in 'rejects' 'toThrow' '(error|falla|fail|timeout|409|500|401)'; do
  printf 'TS  %-40s core=%-4s mobile=%s\n' "$pat" \
    "$(cnt "$pat" ':(glob)packages/core/src/**/*.test.ts')" \
    "$(cnt "$pat" ':(glob)apps/mobile/**/*.test.ts' ':(glob)apps/mobile/**/*.test.tsx')"
done
echo '--- nombres de test que hablan de fallo ---'
sites '^[[:space:]]*(def test_[a-z_]*(fall|error|revient|no_explota|timeout|rechaz|invalid|vacio|colgad|duplicad)[a-z_]*|it\(.(fall|error|no |rechaz))' ':(glob)apps/copiloto/tests/**/*.py' ':(glob)packages/core/src/**/*.test.ts' ':(glob)apps/mobile/**/*.test.ts' ':(glob)apps/mobile/**/*.test.tsx' | wc -l
echo '```'

hdr "8. Observabilidad (D-E del mapa 2026-07-23 — recontrol)"
echo '```'
for pat in 'fingerprint' 'structlog' 'dlq|DLQ' 'trauma' 'json\.dumps.*(level|event)' 'request_id|correlation|trace_id' 'sentry|Sentry' 'logging\.basicConfig' 'getLogger'; do
  printf '%-30s app=%-4s motor=%-4s core=%-4s mobile=%-4s\n' "$pat" \
    "$(cnt "$pat" ':(glob)apps/copiloto/**/*.py' ':(glob,exclude)apps/copiloto/tests/**')" \
    "$(cnt "$pat" ':(glob)motor/**/*.py')" \
    "$(cnt "$pat" ':(glob)packages/core/src/**/*.ts')" \
    "$(cnt "$pat" ':(glob)apps/mobile/**/*.ts' ':(glob)apps/mobile/**/*.tsx')"
done
echo '```'

hdr "9. Top archivos por densidad de except/catch (dónde vive el manejo de errores)"
echo '### Python (app + motor, sin tests)'
echo '```'
git grep -c -I -E '^[[:space:]]*except' "$REF" -- ':(glob)apps/copiloto/**/*.py' ':(glob)motor/**/*.py' ':(glob,exclude)apps/copiloto/tests/**' 2>/dev/null | sed "s|^$REF:||" | sort -t: -k2 -rn | head -25
echo '```'
echo '### TS/TSX (core + mobile + pwa, sin tests)'
echo '```'
git grep -c -I -E 'catch[[:space:]]*[({]' "$REF" -- ':(glob)packages/core/src/**/*.ts' ':(glob)apps/mobile/**/*.ts' ':(glob)apps/mobile/**/*.tsx' ':(glob)apps/copiloto-web/src/**/*.ts' ':(glob)apps/copiloto-web/src/**/*.tsx' ':(glob,exclude)**/*.test.ts' ':(glob,exclude)**/*.test.tsx' 2>/dev/null | sed "s|^$REF:||" | sort -t: -k2 -rn | head -25
echo '```'

hdr "10. Control positivo del instrumento"
echo 'Un patrón que DEBE dar >0 y uno que DEBE dar 0:'
printf 'control+ (def en backend)      = %s  (esperado >0)\n' "$(cnt '^def |^async def ' ':(glob)apps/copiloto/**/*.py')"
printf 'control- (patrón inexistente)  = %s  (esperado 0)\n' "$(cnt 'zzz_patron_que_no_existe_zzz' ':(glob)apps/copiloto/**/*.py')"
echo
echo "_fin — ref \`$REF\` @ ${SHA}_"
