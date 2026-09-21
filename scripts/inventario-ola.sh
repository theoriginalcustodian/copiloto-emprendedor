#!/usr/bin/env bash
# Inventario de una OLA del plan autónomo beta·Odobi, para el pedido a AUDITORÍA (plan §8.4).
#
# Por qué existe: el contrato con auditoría dice que ella NO explora — recibe el inventario hecho
# (memoria `sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho`). Armarlo a mano cuatro veces
# (A1..A4) es donde se cuela la fila olvidada: el "esperado" sale del plan y el "entregado" sale de
# los PR mergeados, y sólo el cruce de los dos muestra el hueco.
#
# Idempotente, read-only, sin escribir nada: markdown a stdout. Redirigilo al doc.
#   bash scripts/inventario-ola.sh --ola 1 > docs/copiloto-emprendedor/Auditorias/2026-09-21-inventario-ola-1.md
#
# Fuente de verdad: `origin/main` remoto vía `gh` (el checkout compartido sirve refs viejas — medido
# el 21/09: `origin/main` local en 5ec87b8e mientras el remoto estaba 11 merges adelante).
set -uo pipefail

# REPO por defecto = el worktree donde vive ESTE script, no el checkout compartido: ése queda decenas
# de commits atrás (medido el 21/09) y el plan que lee sería el viejo.
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PLAN="${PLAN:-docs/copiloto-emprendedor/2026-09-21-plan-implementacion-beta-odobi-autonomo.md}"
OLA=""
DESDE="${DESDE:-2026-09-21}"   # los PR de la beta arrancan el 21/09 (#520 en adelante)

while [ $# -gt 0 ]; do
  case "$1" in
    --ola)   OLA="$2"; shift 2 ;;
    --desde) DESDE="$2"; shift 2 ;;
    *) echo "uso: $0 --ola N [--desde YYYY-MM-DD]" >&2; exit 2 ;;
  esac
done
[ -n "$OLA" ] || { echo "falta --ola N" >&2; exit 2; }
cd "$REPO" || exit 1

# Seams para el test (scripts/tests/test-inventario-ola.sh): PRS_JSON_FILE reemplaza a `gh pr list`
# y SHA_MAIN al `gh api`. En uso normal no se tocan.
if [ -z "${PRS_JSON_FILE:-}" ] || [ -z "${SHA_MAIN:-}" ]; then
  command -v gh >/dev/null || { echo "gh no está en el PATH" >&2; exit 1; }
fi
SHA_MAIN="${SHA_MAIN:-$(gh api "repos/{owner}/{repo}/commits/main" --jq '.sha[0:8]')}"
HOY="$(date +%Y-%m-%d)"

# ── 1. ESPERADO: las filas que el plan asigna a esta ola, por cola ──────────────────────────────
# Formato de las tablas §8.1/8.2/8.3:  | Ola | # | **BL-XX** texto | plataformas | depende | nota |
esperado() { # $1 = sección (8.1|8.2|8.3) · $2 = ola (default --ola; «*» = todas, como «ola<TAB>código»)
  awk -v sec="### $1 " -v ola="${2:-$OLA}" '
    index($0, sec) == 1 { on = 1; next }
    on && /^### / { on = 0 }
    on && $0 ~ /^\| *[0-9]+ *\|/ {
      split($0, c, "|")
      gsub(/ /, "", c[2])
      if (ola == "*" || c[2] == ola) {
        item = c[4]
        # los códigos de fila son BL-xx o K-xx en negrita
        while (match(item, /\*\*(BL-[A-Za-z0-9]+|K-[0-9]+)[^*]*\*\*/)) {
          f = substr(item, RSTART + 2, RLENGTH - 4)
          # sólo el CÓDIGO, no el texto del ítem: con el texto completo, un código nombrado de paso
          # en la fila de otra cola hacía que la columna «Cola» atribuyera el ítem a la sesión
          # equivocada (BL-C6 salía BACKEND siendo de FRONTEND-2; medido el 21/09).
          # «**BL-J2 + BL-J3** texto»: cada código unido por « + » es fila propia (J3 salía «fuera
          # del plan»). El avance del ítem se guarda ANTES: los match() internos pisan RSTART.
          sig = RSTART + RLENGTH
          while (match(f, /^(BL-[A-Za-z0-9]+|K-[0-9]+)/)) {
            if (ola == "*") printf "%s\t%s\n", c[2], substr(f, RSTART, RLENGTH)
            else printf "%s\n", substr(f, RSTART, RLENGTH)
            f = substr(f, RLENGTH + 1)
            if (substr(f, 1, 3) != " + ") break
            f = substr(f, 4)
          }
          item = substr(item, sig)
        }
      }
    }' "$PLAN"
}

# códigos sueltos (BL-D3, K-01…) de una lista de filas
codigos() { grep -oE '\b(BL-[A-Za-z0-9]+|K-[0-9]+)\b' | sort -u; }

BE_ESP="$(esperado 8.1)";  FE1_ESP="$(esperado 8.2)";  FE2_ESP="$(esperado 8.3)"
TODOS_ESP="$(printf '%s\n%s\n%s\n' "$BE_ESP" "$FE1_ESP" "$FE2_ESP" | codigos)"

# ── 2. ENTREGADO: PR mergeados desde --desde, con su SHA y los códigos que citan ────────────────
# El filtro por fecha se hace en python, NO en `--jq`: anidar comillas dentro del --jq devolvía una
# cadena vacía en silencio y el inventario salía sin una sola fila (medido el 21/09). Un filtro que
# falla callado en un instrumento de auditoría es peor que no tenerlo.
if [ -n "${PRS_JSON_FILE:-}" ]; then PRS_JSON="$(cat "$PRS_JSON_FILE")"
else
  # La ventana se pide por FECHA, no por cantidad. Con `--limit 60`, al pasar los 60 merges los
  # PR más viejos de la ventana (#520–#530) se caían en silencio y sus filas salían «mitad sin
  # diff» (BL-X12w, 21/09). Si igual se llega al tope, el inventario muere: truncar es mentir.
  LIMITE_PRS="${LIMITE_PRS:-1000}"
  PRS_JSON="$(gh pr list --state merged --search "merged:>=$DESDE" --limit "$LIMITE_PRS" \
                --json number,title,mergeCommit,mergedAt,files)"
fi
n_prs="$(PYTHONIOENCODING=utf-8 python -c 'import json,sys; print(len(json.load(sys.stdin)))' <<< "$PRS_JSON" | tr -d '\r')"
if [ -z "${PRS_JSON_FILE:-}" ] && [ "$n_prs" -ge "${LIMITE_PRS:-1000}" ]; then
  echo "❌ inventario-ola: $n_prs PR = el tope --limit; la ventana puede estar TRUNCADA. Subí LIMITE_PRS o acotá --desde." >&2
  exit 3
fi
export DESDE
# Sin esto, python en Windows escribe cp1252 a stdout y las rayas y comillas del markdown salen
# como «?» en el doc que recibe auditoría.
export PYTHONIOENCODING=utf-8
# Y python en Windows escribe CRLF: el `\r` quedaba pegado al ÚLTIMO campo de cada línea TSV
# (la lista de PR) y en el markdown. Todas sus salidas pasan por `tr -d '\r'`.

# Los helpers de python viven en archivos temporales, no en `python -c "…"`: el literal multilínea
# entre comillas dobles dentro de `$( )` deja el parser de bash contando comillas y aborta el script
# entero con «unexpected EOF» (medido el 21/09, dos veces).
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT
TMP_CITADOS="$TMPD/citados.py"
TMP_TABLA="$TMPD/tabla.py"
# El expansor de códigos vive en UN módulo que los dos scripts importan: dos copias divergen.
cat > "$TMPD/codigos.py" <<'PY'
import re

RX = r'(?:BL-[A-Za-z0-9]+|K-[0-9]+)'

def codigos(titulo):
    """Códigos de fila que cita un título de PR.

    Expande la notación abreviada que usan las sesiones: `BL-C1/W2/C4/X5` son CUATRO filas, no una.
    Sin esto, `BL-W2`, `BL-C4` y `BL-X5` salían NO CITADOS estando entregados en #521, y el
    inventario habría mandado a auditoría a buscar trabajo que ya estaba hecho (medido el 21/09).
    """
    out = set(re.findall(RX, titulo))
    for grupo in re.findall(r'BL-[A-Za-z]?[0-9]+(?:/[A-Za-z]?[0-9]+)+', titulo):
        partes = grupo.split('/')
        out.add(partes[0])
        for seg in partes[1:]:
            out.add(seg if seg.startswith('BL-') else 'BL-' + seg)
    return out

PY
cat > "$TMP_TABLA" <<'PY'
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from codigos import codigos
d = os.environ.get('DESDE', '')
prs = sorted((p for p in json.load(sys.stdin) if p['mergedAt'] > d), key=lambda x: x['number'])
for p in prs:
    sha = ((p.get('mergeCommit') or {}).get('oid') or '')[:8] or '-'
    filas = sorted(codigos(p['title']))
    n = len(p.get('files') or [])
    q = chr(96)
    print('| #%d | %s%s%s | %s | %s | %d |' % (
        p['number'], q, sha, q, p['title'].replace('|', '/'),
        ', '.join(q + f + q for f in filas) or '-', n))
PY
TMP_TESTS="$TMPD/tests.py"
cat > "$TMP_TESTS" <<'PY'
import json, sys, os
d = os.environ.get('DESDE', '')
q = chr(96)
tocados = {}
for p in json.load(sys.stdin):
    if p['mergedAt'] <= d:
        continue
    for f in (p.get('files') or []):
        path = f['path']
        if 'test' in path.lower() and (path.endswith('.py') or '.test.' in path):
            tocados.setdefault(path, []).append(p['number'])
if tocados:
    for path in sorted(tocados):
        prs = ', '.join('#%d' % n for n in sorted(set(tocados[path])))
        print('- %s%s%s — %s' % (q, path, q, prs))
else:
    print('- **Ningún test tocado en la ventana.** Eso no es «no hacía falta»: es el primer '
          'hallazgo del inventario. Verificar antes de mandarlo.')
PY
cat > "$TMP_CITADOS" <<'PY'
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from codigos import codigos

# Capa = por dónde pasó el diff, no lo que dice el título. Una fila con mitad BACKEND y mitad FE que
# cita un solo PR de web salía «✅ sí» (BL-X5, A1 §9.2): contar citas no ve la mitad que falta.
BACK = ('apps/copiloto/', 'motor/', 'deploy/', 'docs/copiloto-emprendedor/kb-usuario/')
FRONT = ('apps/mobile/', 'apps/copiloto-web/', 'packages/')

d = os.environ.get('DESDE', '')
capas, prs = {}, {}
for p in json.load(sys.stdin):
    if p['mergedAt'] <= d:
        continue
    paths = [f['path'] for f in (p.get('files') or [])]
    tocadas = set()
    if any(x.startswith(BACK) for x in paths):
        tocadas.add('B')
    if any(x.startswith(FRONT) for x in paths):
        tocadas.add('F')
    for c in codigos(p['title']):
        capas.setdefault(c, set()).update(tocadas)
        prs.setdefault(c, []).append('#%d' % p['number'])
for c in sorted(capas):
    print('%s\t%s\t%s' % (c, ''.join(sorted(capas[c])) or '-', ','.join(prs[c])))
PY

# ── 3. Salida ───────────────────────────────────────────────────────────────────────────────────
cat <<EOF
# Inventario de la Ola $OLA — entrada para AUDITORÍA (A$OLA)

> Generado por \`scripts/inventario-ola.sh --ola $OLA\` el $HOY.
> **SHA de \`main\` al momento de generarlo: \`$SHA_MAIN\`.** Cada fila re-medida por auditoría
> lleva el SHA que midió; si \`main\` avanzó, el veredicto es sobre ESTE SHA, no sobre «lo último».
> Auditoría **no explora fuera de estas rutas**: si algo falta acá, falta en el inventario, no en la app.

## 1. PR mergeados en la ventana (desde $DESDE)

| PR | SHA de merge | Título | Filas que cita | Archivos |
|---|---|---|---|---|
EOF

echo "$PRS_JSON" | python "$TMP_TABLA" | tr -d '\r'

cat <<EOF

## 2. Esperado vs entregado, fila por fila

Sale del plan (\`$PLAN\`, §8.1–8.3, columna **Ola = $OLA**) cruzado con los títulos de los PR de
arriba. Un **NO CITADO** no prueba que falte: prueba que el PR no la nombró, y eso es lo primero que
auditoría tiene que preguntar.

| Fila | Cola | ¿La cita algún PR? |
|---|---|---|
EOF

CITADOS="$(echo "$PRS_JSON" | python "$TMP_CITADOS" | tr -d '\r')"

fila_cola() {
  local f="$1"
  # -x: línea completa. Un `grep -w` sobre el texto del ítem daba falsos positivos.
  local out=""
  echo "$BE_ESP"  | grep -qxF "$f" && out="BACKEND"
  echo "$FE1_ESP" | grep -qxF "$f" && out="${out:+$out + }FRONTEND-1"
  echo "$FE2_ESP" | grep -qxF "$f" && out="${out:+$out + }FRONTEND-2"
  # Acumula en vez de devolver la primera: las filas de junta (K-xx) las tienen DOS colas y mostrar
  # sólo una hacía que auditoría le reclamara la mitad faltante a la sesión equivocada.
  echo "${out:-?}"
}

# Contratos K-xx que el plan cuelga de una fila BL (columna «Contrato» de §8.1–8.3). La mitad BACKEND
# de una fila de junta se entrega bajo su contrato, no bajo el BL: #546 dice «K-05», no «BL-J10».
# Sin este cruce, las 6 juntas de la Ola 2 salían «mitad BACKEND sin diff» con el diff en main (21/09).
contratos_de() {
  awk -v f="$1" '
    /^### 8\.[123] / { on = 1; next }
    on && /^### / { on = 0 }
    on {
      # la fila cuelga de f si f está en su segmento en negrita (puede ser «**BL-J2 + BL-J3**»)
      l = $0; hit = 0
      while (match(l, /\*\*[^*]+\*\*/)) {
        if (substr(l, RSTART, RLENGTH) ~ ("[* ]" f "[* ]")) hit = 1
        l = substr(l, RSTART + RLENGTH)
      }
      if (hit) { l = $0; while (match(l, /K-[0-9]+/)) { print substr(l, RSTART, RLENGTH); l = substr(l, RSTART + RLENGTH) } }
    }
  ' "$PLAN" | sort -u
}

FALTAN=0
for f in $TODOS_ESP; do
  cola="$(fila_cola "$f")"
  linea="$(awk -F'\t' -v c="$f" '$1 == c' <<< "$CITADOS")"
  if [ -z "$linea" ]; then
    est="❌ **NO CITADO**"; FALTAN=$((FALTAN+1))
  else
    capas="$(cut -f2 <<< "$linea")"; prs="$(cut -f3 <<< "$linea")"
    # Sólo la capa BACKEND se hereda del contrato: la mitad FE tiene que citar su BL. Heredar las dos
    # daba ✅ a una fila FE con sólo el PR de otra fila que nombró el mismo K (#550 cita K-09).
    for k in $(contratos_de "$f"); do
      lk="$(awk -F'	' -v c="$k" '$1 == c' <<< "$CITADOS")"
      [ -n "$lk" ] || continue
      if [[ "$(cut -f2 <<< "$lk")" == *B* && "$capas" != *B* ]]; then
        capas="${capas}B"; prs="$prs; $(cut -f3 <<< "$lk") vía $k"
      fi
    done
    falta=""
    [[ "$cola" == *BACKEND* && "$capas" != *B* ]] && falta="BACKEND"
    [[ "$cola" == *FRONTEND* && "$capas" != *F* ]] && falta="${falta:+$falta + }FRONTEND"
    if [ -n "$falta" ]; then
      est="⚠️ **citada, pero la mitad $falta no tiene diff** ($prs)"; FALTAN=$((FALTAN+1))
    else
      est="✅ sí ($prs)"
    fi
  fi
  echo "| \`$f\` | $cola | $est |"
done

cat <<EOF

**Filas de la Ola $OLA sin PR que las cite, o con una mitad sin diff: $FALTAN.** Si es > 0, el pedido
a auditoría no sale hasta explicarlas una por una (entregada dentro de otro PR / diferida con dueño /
realmente abierta). «Mitad sin diff» se mide por las rutas que tocaron los PR, no por el título.

## 2.bis Entregadas en esta ventana pero asignadas a OTRA ola (adelantadas)

El plan las pone en otra ola, pero un PR de esta ventana ya las cita. **Entran en esta auditoría**:
si no se miden acá, nadie las mide (A1 §9.1: las J de la Ola 2 llegaron con los K de la Ola 0 y el
inventario no las listaba).

| Fila | Ola del plan | PR que la cita |
|---|---|---|
EOF

TODAS_OLAS="$(for s in 8.1 8.2 8.3; do esperado "$s" "*"; done | sort -u)"
ADELANTADAS=0
while IFS=$'\t' read -r cod _capas prs; do
  [ -n "$cod" ] || continue
  grep -qxF "$cod" <<< "$TODOS_ESP" && continue
  olas="$(awk -F'\t' -v c="$cod" '$2 == c {print $1}' <<< "$TODAS_OLAS" | sort -u | paste -sd, -)"
  echo "| \`$cod\` | ${olas:-fuera del plan §8} | $prs |"
  ADELANTADAS=$((ADELANTADAS+1))
done <<< "$CITADOS"
[ "$ADELANTADAS" -gt 0 ] || echo "| — | — | ninguna |"

cat <<EOF

## 3. Controles de aislamiento nuevos — el test adversarial se CORRE, no se lee

Regla dura del repo (\`CLAUDE.md\` §Seguridad): un control de autorización sin test adversarial
ejecutado queda \`[UNVERIFIED]\` y bloquea el cierre.

⚠️ **Esta lista NO es la de adversariales** (A1 §9.4): son los tests que tocaron los PR de la ventana;
el resto del repo no entra. Cuáles ejercitan el caso hostil lo decide auditoría leyendo el test — un
filtro por nombre acá sería una allowlist que no sabe lo que le falta.

EOF
# Sólo los tests que ESTA ola tocó, no todo el repo: el grep amplio devolvía 61 archivos (casi cada
# test nombra «ajeno» o «tenant» en algún assert) y una lista de 61 no es un inventario, es ruido
# que empuja a auditoría a leer en vez de correr.
echo "$PRS_JSON" | python "$TMP_TESTS" | tr -d '\r'

cat <<'EOF'

**Comando exacto para correrlos** (el job backend corre en el VPS; en segundo plano, salida completa
a archivo, sin sub-agentes vivos en la PC — bajo carga el gate falla por `fork`, A1 §4.3):

```bash
# El job va SOLO, sin guiones: `gate.sh --solo backend` no matchea ningún job, corre 0 y sale verde
# (A1 §4.1). La triada (DB/puerto/stage) sale de UC_SESION; si tu sesión no está en
# scripts/ci/sesion-env.sh, exportá UC_TESTDB_NAME/UC_TESTDB_PORT/UC_TEST_STAGE propios.
UC_SESION=<tu-sesión> bash scripts/gate.sh backend > "gate-backend-$(date +%s).log" 2>&1
grep -c PASSED gate-backend-*.log   # 0 PASSED o un recibo con "jobs":{} es falso verde, no verde
```

## 4. Evidencia de device

`[PENDIENTE_DEVICE]` no es un estado de excepción: es el estado por defecto de toda fila táctil
hasta que el móvil esté libre. Auditoría marca como **no cerrable** cualquier fila que dependa de
device y no traiga su evidencia, sin importar que el PR esté mergeado.

## 5. Qué NO entra en esta auditoría

Lo que el plan asigna a olas posteriores, y todo lo que no aparezca en §1. Cada hallazgo se devuelve
como **fila para que planificación la asigne** — auditoría no abre trabajo propio (plan §9).
EOF
