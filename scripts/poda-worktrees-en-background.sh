#!/usr/bin/env bash
# poda-worktrees-en-background.sh — corre el podador y deja constancia. Lo lanza el hook
# SessionStart (`scripts/hooks/podar_worktrees_al_arrancar.mjs`) desacoplado, para que una corrida de
# ~42 s no demore el arranque de la sesión.
#
# Vive en su propio archivo a propósito: embutido como string dentro del .mjs, los escapes anidados
# (JS → bash → printf) ya produjeron dos errores de sintaxis seguidos, y un guión que no se puede
# leer tampoco se puede verificar. Acá se corre a mano igual que lo corre el hook.
#
# Uso:  scripts/poda-worktrees-en-background.sh <repo> <log> <marca>
# Exit: siempre 0. Esto es higiene: no gatea nada y no puede romperle el arranque a nadie.
set -uo pipefail

REPO="${1:?falta el repo}"
LOG="${2:?falta el log}"
MARCA="${3:?falta la marca}"

cd "$REPO" || exit 0

# `--podar` es el punto: en dry-run el script informa y no borra, que es exactamente el estado del
# que venimos (un informe que nadie leía). Las bases NO se pasan: desde el 2026-10-19 el default las
# DERIVA de los worktrees que git registra, y pasar `--base` acá reintroduciría el path fijo que ya
# dejó ciego al script una vez (29/09: 23 de 34 worktrees fuera del análisis).
salida="$(timeout 300 bash scripts/podar-worktrees.sh --podar --quiet 2>&1)" || true

{ printf '=== %s ===\n' "$(date -Iseconds)"; printf '%s\n' "$salida"; } >> "$LOG"

# El script imprime «N podado(s)»; de ahí sale la cifra que el hook muestra en el próximo arranque.
n="$(printf '%s' "$salida" | grep -oE '[0-9]+ podado' | grep -oE '[0-9]+' | head -1)"

# Escritura con temporal + mv: `>` trunca al abrir, y una marca a medio escribir se lee como corrida
# sin podados. → memoria/open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo.md
tmp="$MARCA.tmp.$$"
printf '{"cuando":"%s","podados":%s}\n' "$(date -Iseconds)" "${n:-0}" > "$tmp" \
  && mv -f "$tmp" "$MARCA"
rm -f "$tmp" 2>/dev/null
exit 0
