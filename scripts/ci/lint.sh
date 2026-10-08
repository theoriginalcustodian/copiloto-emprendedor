#!/usr/bin/env bash
# Job "lint" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
# Sólo los ERRORES rompen (mismo criterio que tests.yml): los avisos no bloquean.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund
npx eslint packages/core/src apps/mobile/src apps/copiloto-web/src

# BL-B3: repo PÚBLICO — cero secretos y cero fuentes de marca con licencia (.otf) trackeadas (R-8).
# Fail-closed: si el escáner no puede correr, el job falla.
#
# ⚠️ ALCANCE REAL, y hasta el 2026-10-06 esta línea decía otra cosa: escanea **el ÁRBOL** (`--arbol`),
# NO la historia. Decía «cero secretos en TODA la historia», y el `Fail-closed:` reforzaba que la
# garantía estaba mecanizada ⇒ quien viniera a buscar si existe el gate de la historia lo encontraba
# acá y DEJABA DE BUSCAR. No existe: `--historia` no tiene NINGÚN llamador en `scripts/`, `.githooks/`
# ni `.github/` (medido el 2026-10-06 por dos sesiones con dos instrumentos). Hallazgo de auditoría,
# fila `LINTHISTORIA` — tercera aparición en el día de un productor que declara una protección que
# nadie provee, y la única de las tres que ningún consumidor tapaba.
#
# Lo que SÍ cubre la historia es incremental y vive en otro lado: el `pre-push` escanea el RANGO de
# commits que se pushea (modo `git`, `--refs-stdin`), así que cada commit se midió al entrar — con las
# reglas de ESE día. Quedan afuera: lo pusheado antes del hook, lo pusheado con `--no-verify`, y las
# reglas AGREGADAS después. Por eso correr `--historia` A MANO al agregar una regla no es ritual: es
# el único momento en que la historia se mide con la regla nueva (2026-10-06, al agregar las 5 formas
# reales: 2142 commits, 1 hallazgo, un fixture sintético en `b97ed322` no alcanzable desde `main`).
#
# 🔴 Y NO se arregla poniendo `--historia` acá: un hallazgo histórico no se corrige sin reescribir la
# historia, así que un `--historia` en el camino del PR deja rojo PERMANENTE sin acción posible, se
# desarma en dos días y se lleva puesto el `--arbol`, que sí sirve. Si se mecaniza, va fuera del
# camino del PR y con la pregunta contestada antes: ante un hallazgo histórico, ¿rewrite o
# rotar-y-declarar? Sin esa respuesta escrita es un rojo sin salida.
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

# CONTROLES DE DEPLOY (2026-10-07, fila `CONTROLESDEPLOYSINGATE`, hallazgo de auditoría). Los 6
# controles locales de `deploy/copiloto/` —el import del smoke (`SMOKESTDIN`), el guard de /healthz
# post-restart (`CANARIOPOSTRESTART`), el build que no borra el dist vivo (`REDEPLOYMISMOSHA`), la
# rama de falla del gate de durabilidad (`DURABGATE`), el lector del set declarado
# (`MECLAVESRUNTIME`) y la convergencia de Caddy (`DEPLOYNOCONVERGE`)— tenían CERO invocadores en
# todo el árbol: seis cierres de este sprint apoyados en controles que ningún gate disparaba. Van
# acá y no en `backend` porque son bash+python puros (0 hits de ssh/scp: medido), corren en segundos
# y no necesitan DB ni venv del VPS. `fetch-depth: 0` del job ya está (lo exige
# `test_redeploy_mismo_sha.sh`, que compara contra `bf406abe` con `git show`).
#   ⚠️ Los dos controles `.py` NO entran acá y el motivo lo midió CI: `test_meclaves_check.py` es
#   estilo pytest y `test_caddy_converge.py` es `unittest` — los dos necesitan un runner que este job
#   no tiene (ni debe: `lint` es bash + python STDLIB). Van en la suite de `scripts/ci/backend.sh`,
#   donde pytest los ejecuta de verdad. Correr el primero como `python archivo.py` daba VERDE sin
#   ejecutar una sola aserción, que es peor que no correrlo.
bash "$ROOT/scripts/ci/tests-coordinacion.sh" "$ROOT/deploy/copiloto" 'test_*.sh' 'de deploy'

# DURABGATE (2026-10-08): `scripts/test-durabilidad-gate.sh` prueba las funciones bash de
# `deploy/copiloto/durabilidad-gate.sh` (activación, opt-out, resolución de `.env.e2e`) y tenía
# CERO invocadores -- vive SUELTO en `scripts/`, no en `scripts/tests/` (línea 70) ni en
# `deploy/copiloto/` (línea 86), así que ninguno de los dos bucles de arriba lo alcanza. Es el
# control que el DoD de `DURABGATE` pedía wireado al gate (sin esto, el fail-open del armado de
# durabilidad podía volver sin que ningún CI lo viera). Bash puro, sin red/ssh, corre en segundos.
bash "$ROOT/scripts/test-durabilidad-gate.sh"
