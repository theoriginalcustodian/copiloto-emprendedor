#!/usr/bin/env bash
# test-medidor-ve-los-wikilinks-de-los-topics.sh — el control de links rotos miraba UN subconjunto
# del universo que su nombre promete.
#
# Caso real (2026-09-30). `medir-indice-memoria.py` imprimía «links a archivos inexistentes: 0» y el
# universo que verificaba era `refs = referencias(índice) | referencias(HISTORIA)`. Los topic files
# **se citan entre sí**: 1303 referencias que ningún control miraba. Al medirlas aparecieron **11
# destinos rotos con el medidor en verde**, y 7 de los 11 por la misma causa — el wikilink escrito
# con el ARTÍCULO del gancho del índice (el gancho dice «Un instrumento que NO MIRA nunca falla» y
# el archivo es `instrumento-que-no-mira-nunca-falla`).
#
# Por qué importa más que como higiene: IDXFORMATO va a renombrar ~150 archivos de `memoria/`. Sin
# este control, el rename rompe los wikilinks **en silencio** y el veredicto sale en verde — que es
# exactamente el modo de falla que el medidor existe para cerrar, entrando por la puerta de al lado.
#
#   1. ROTO EN UN TOPIC        — wikilink a un archivo que no existe, en un topic  → MAL, exit 1
#   2. EN BACKTICKS            — el mismo nombre roto, pero como sintaxis citada   → OK,  exit 0
#   3. HUÉRFANA SIGUE HUÉRFANA — topic citado por otro topic y NO por el índice    → MAL (cobertura)
#   4. SANO                    — nada roto                                        → OK,  exit 0
#
# El caso 1 es el control POSITIVO: sin él, un universo mal armado diría «0 rotos» y el verde sería
# el de un instrumento que no mira (`memoria/instrumento-que-no-mira-nunca-falla.md`).
#
# El caso 2 existe porque la memoria **cita su propia sintaxis** para explicarse: `[[wikilink]]` y
# `[[links]]` dentro de backticks eran 2 de los 11 «rotos». Reportarlos sería un guard que grita en
# el caso normal, y ésos se desarman solos.
#
# El caso 3 es el que protege el DISEÑO, y es la razón por la que el control 3 no podía ser un simple
# ensanchamiento de `refs`: esa variable alimenta también el control 2 (cobertura), que mide que **el
# índice** prometa cada entrada. Si se le suman los wikilinks de los topics, una entrada citada por
# otra entrada deja de contar como huérfana aunque el índice no la liste — y una huérfana es
# invisible para toda sesión. Arreglar un control rompiendo el de al lado no es arreglar.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MEDIDOR="${MEDIDOR_BAJO_PRUEBA:-$REPO_ROOT/scripts/medir-indice-memoria.py}"
PY="${PYTHON:-python}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-medidor-ve-los-wikilinks-de-los-topics"

# El medidor deduce su raíz del `__file__` (`parents[1]`), así que se lo copia a un árbol con una
# `memoria/` fabricada. Ese mecanismo hizo abortar a auditoría tres veces al correrlo desde otro
# directorio (`memoria/el-instrumento-respondio-sobre-otro-sujeto.md`); acá se usa a favor.
#
# 12 tópicos: el medidor tiene un control positivo interno que se declara roto con menos de 10
# referencias parseadas, y entonces el caso no mediría nada.
armar() {   # armar  ->  imprime el directorio del árbol fabricado
  local dir="$TMP/caso"; rm -rf "$dir"; mkdir -p "$dir/scripts" "$dir/memoria"
  cp "$MEDIDOR" "$dir/scripts/medir-indice-memoria.py"
  local i idx="# Indice"
  for i in $(seq 1 12); do
    printf -- '---\nname: t%s\ndescription: entrada de prueba numero %s distinta de las demas\nmetadata:\n  type: reference\n---\n\ncuerpo %s\n' "$i" "$i" "$i" > "$dir/memoria/t$i.md"
    idx="$idx
- [T$i](t$i.md) - gancho $i"
  done
  printf '%s\n' "$idx" > "$dir/memoria/MEMORY.md"
  echo "$dir"
}

# Presupuestos holgados a propósito: acá se mide el control de links, no el del techo. Un fixture
# que fallara por bytes daría exit 1 por la causa equivocada y el caso pasaría de casualidad.
correr() { out="$("$PY" "$1/scripts/medir-indice-memoria.py" --presupuesto 99999 --max-lineas 9999 2>&1)"; rc=$?; }

# ── Caso 1: wikilink ROTO dentro de un topic ─────────────────────────────────────────────────
d="$(armar)"
printf '\nver tambien [[destino-que-no-existe-jamas]]\n' >> "$d/memoria/t3.md"
correr "$d"
if [ "$rc" = "1" ] && grep -q "destino-que-no-existe-jamas" <<< "$out"; then
  # Nombrar QUIÉN lo cita no es cosmético: sin eso, un roto en 358 archivos no se puede arreglar.
  if grep -q "t3.md" <<< "$out"; then
    ok "1 roto en un topic: MAL, exit 1, y nombra el archivo que lo cita"
  else
    fail "1 detectó el roto pero no dijo quién lo cita — el hallazgo no es accionable"
  fi
else
  fail "1 NO vio un wikilink roto dentro de un topic (exit $rc) — el universo del control está corto"
  grep -i "inexistentes" <<< "$out" | sed 's/^/      /'
fi

# ── Caso 2: el MISMO nombre roto, pero entre backticks ───────────────────────────────────────
d="$(armar)"
printf '\nla sintaxis es `[[destino-que-no-existe-jamas]]`, asi se escribe\n' >> "$d/memoria/t4.md"
correr "$d"
if [ "$rc" = "0" ] && ! grep -q "destino-que-no-existe-jamas" <<< "$out"; then
  ok "2 en backticks: no lo cuenta (la memoria cita su propia sintaxis para explicarse)"
else
  fail "2 reportó un EJEMPLO citado en backticks (exit $rc) — el guard grita en el caso normal"
  grep -i "inexistentes" <<< "$out" | sed 's/^/      /'
fi

# ── Caso 3: el control de COBERTURA no se contamina ──────────────────────────────────────────
# `t13` existe y lo cita otro TOPIC, pero el índice no lo lista. Tiene que seguir siendo huérfana:
# lo que el control 2 mide es que el ÍNDICE la prometa, porque el índice es lo que cada sesión carga.
d="$(armar)"
printf -- '---\nname: t13\ndescription: entrada que ningun indice lista y otro topic si cita\nmetadata:\n  type: reference\n---\n\ncuerpo 13\n' > "$d/memoria/t13.md"
printf '\nrelacionado: [[t13]]\n' >> "$d/memoria/t5.md"
correr "$d"
if [ "$rc" = "1" ] && grep -q "huérfana" <<< "$out" && grep -q "t13.md" <<< "$out"; then
  ok "3 citada por otro topic pero ausente del índice: sigue siendo HUÉRFANA"
else
  fail "3 una entrada que el índice no lista dejó de contar como huérfana (exit $rc) — el control 3 se comió al 2"
  grep -iE "cobertura|huérfana" <<< "$out" | sed 's/^/      /'
fi

# ── Caso 4: NO-REGRESIÓN — un árbol sano no inventa hallazgos ────────────────────────────────
d="$(armar)"
correr "$d"
if [ "$rc" = "0" ] && grep -q "inexistentes: 0" <<< "$out"; then
  ok "4 árbol sano: 0 rotos, exit 0"
else
  fail "4 falló sobre un árbol SIN nada roto (exit $rc) — falso positivo permanente"
  echo "$out" | head -5 | sed 's/^/      /'
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
