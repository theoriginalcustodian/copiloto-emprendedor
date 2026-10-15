#!/usr/bin/env bash
# Control de apps/mobile/metro.config.js §4-5: `@copiloto/core` se resuelve al packages/core de ESTE workspace.
#
# EL DEFECTO (2026-10-15): en un git worktree `node_modules` es una junction al checkout compartido; Metro
# resolvía `@copiloto/core` por ahí y bundleaba un core atrasado SIN avisar → una medición «contra sha X»
# medía otro código. Este test falla si el core resuelto cae fuera de packages/core del workspace donde corre.
#
# CONTROL POSITIVO: la config de origin/main (sin el pin) NO fija nada → el test tiene que detectarlo (FALLA 2/2).
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="$RAIZ/apps/mobile"
[ -r "$MOBILE/metro.config.js" ] || { echo "FALLA: no existe apps/mobile/metro.config.js"; exit 1; }
[ -d "$RAIZ/node_modules/expo" ] || { echo "SKIP: sin node_modules/expo (se corre donde hay deps)"; exit 0; }

comprobar() {  # $1 = ruta del metro.config.js a ejercitar
  RAIZ="$RAIZ" CFG="$1" node -e '
    const path = require("node:path");
    const cfg = require(process.env.CFG);
    const core = path.resolve(process.env.RAIZ, "packages/core");
    const r = cfg.resolver.resolveRequest;
    let fallos = 0;
    for (const [mod, esperado] of [["@copiloto/core","src/index.ts"],["@copiloto/core/chat","src/chat/index.ts"],["@copiloto/core/api","src/api/index.ts"]]) {
      let got = null; try { got = r({ resolveRequest: () => ({ type: "sourceFile", filePath: "/AJENO/" + mod }) }, mod, "android").filePath; } catch (e) {}
      const ok = got === path.resolve(core, esperado);
      console.log((ok ? "  ok   " : "  FALLA ") + mod + " -> " + got); if (!ok) fallos++;
    }
    process.exit(fallos ? 1 : 0);'
}

echo "[1] config actual"; comprobar "$MOBILE/metro.config.js" || exit 1
# Control del control: la config SIN el pin (la de origin/main antes de este cambio) tiene que fallar.
TMP="$MOBILE/.metro.config.sinpin.tmp.js"; trap 'rm -f "$TMP"' EXIT
sed -n '1,/^module.exports = config;/p' "$MOBILE/metro.config.js" | sed '/^\/\/ 4\./,$d' > "$TMP"; echo "module.exports = config;" >> "$TMP"
echo "[2] mutante: config sin el pin (tiene que FALLAR)"
if comprobar "$TMP" >/dev/null 2>&1; then echo "FALLA: el test acepta una config sin pin (no discrimina)"; exit 1; else echo "  ok   el mutante es detectado"; fi
