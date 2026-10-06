#!/usr/bin/env bash
# Job "lint" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
# Sólo los ERRORES rompen (mismo criterio que tests.yml): los avisos no bloquean.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund
npx eslint packages/core/src apps/mobile/src apps/copiloto-web/src

# BL-B3: repo PÚBLICO — cero secretos en TODA la historia (gitleaks fijado) y cero fuentes de marca
# con licencia (.otf) trackeadas (R-8). Fail-closed: si el escáner no puede correr, el job falla.
bash "$ROOT/scripts/secretos-check.sh" --arbol
if [ -n "$(git ls-files '*.otf')" ]; then
  echo "❌ hay .otf trackeados (fuentes con licencia en repo público):"; git ls-files '*.otf'; exit 1
fi

# BL-Q1: paridad testID (mobile) <-> data-testid (web). El escaneo es del script; sólo la
# excepción unilateral se declara a mano, con motivo y fecha (scripts/ci/testid-paridad-excepciones.json).
python3 "$ROOT/scripts/ci/testid_paridad.py" --root "$ROOT" --check

# PARID + LEGAL: paridad mobile<->web de "idemKey deriva de mensajeId" (IDEM-gasto-duplica-plata) +
# paridad de LEGAL_VERSION entre packages/core/src/legal.ts <-> apps/copiloto/tenant_legal_store.py
# <-> scripts/e2e_bl_o6_legal_aceptacion.py (BL-O6: un bump a medias deja a todo tester en 409
# permanente). El escaneo es del script; sólo una asimetría de PARID aceptada POR DISEÑO se declara
# a mano (scripts/ci/idemkey-paridad-excepciones.json) -- LEGAL no tiene excepciones, es igualdad
# estricta.
python3 "$ROOT/scripts/ci/idemkey_paridad.py" --root "$ROOT" --check

# ÍNDICE DE MEMORIA: una entrada sin línea en MEMORY.md/HISTORIA.md es INVISIBLE para toda sesión, y
# un índice pasado del techo se trunca sin dar síntoma. El único llamador era `seed-memory.sh:148`,
# que **avisa sin abortar** — o sea nada frenaba un merge con huérfanas. Costo medido el 2026-09-29:
# dos re-derivaciones de lecciones ya escritas en un solo turno, y lo que las cazó fue la salida del
# medidor, no el índice. Acá SÍ aborta: es el único momento en que frenar sirve.
#   ⚠️ El hermano `contar-veredictos.py` NO puede entrar así: su corpus vive en `coordinacion/`, que
#   está gitignoreado, así que en CI sólo se lo puede ejercitar contra fixtures — y eso ya ocurre,
#   `test-contar-veredictos-padron.sh` entra por el bucle de abajo. Su rojo en CI sería un
#   «no puedo ver mi sujeto», no un hallazgo.
python3 "$ROOT/scripts/medir-indice-memoria.py"

# Tests de los scripts de coordinación. Van en "lint" y no en "core" porque son bash puro: no
# necesitan DB, node ni el venv del VPS, y corren en segundos. Sin este bucle, `scripts/tests/`
# es letra muerta — un test que nadie ejecuta no es un control, es un archivo.
# El bucle y su DENOMINADOR viven en `scripts/ci/tests-coordinacion.sh`, y no acá, por un motivo
# que es el hallazgo mismo: para ejercitar el caso interesante del guard —el glob no matchea nada,
# que es como lint salía VERDE con cero controles corridos— hay que poder CORRERLO, y acá arriba
# están eslint, las dos paridades y el medidor del índice, que exigen npm y python. Un guard que
# sólo se alcanza atravesando cuatro pasos de entorno es un guard sin control positivo posible.
bash "$ROOT/scripts/ci/tests-coordinacion.sh"
