#!/usr/bin/env bash
# test-archivar-buzon-campo-cierre.sh — test HOSTIL del campo `CIERRE:` auto-declarado del janitor.
#
# POR QUÉ ES HOSTIL Y NO HAPPY-PATH: el hallazgo del 2026-10-16 («19 broadcasts nunca se cierran»)
# propuso este campo y deliberadamente NO lo implementó, porque tocar el janitor para que archive
# OBLIGACIONES exige probar lo contrario de lo que uno quiere: que una obligación VIVA sobrevive.
# Un test que sólo verifique «el que declara su cierre se archiva» sale verde aunque el patrón
# archive todo, y ese fallo borra normas vigentes del circuito sin dar un solo síntoma — el janitor
# no falla cuando archiva de más, archiva.
#
# Los tres casos hostiles no son hipotéticos: son los tres falsos positivos MEDIDOS en §3 de ese
# hallazgo, cada uno de un criterio distinto que se descartó por esto.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JANITOR="$AQUI/../archivar-buzon.sh"
[ -x "$JANITOR" ] || [ -f "$JANITOR" ] || { echo "❌ no encuentro $JANITOR"; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/abierto" "$TMP/en-curso" "$TMP/cerrado"

fallos=0
ok()   { echo "  ✅ $1"; }
mal()  { echo "  ❌ $1"; fallos=$((fallos+1)); }

# Un archivo del buzón, envejecido 200 min (bien por encima del TTL de 90).
msg() {  # msg <nombre> <cuerpo>
  printf '%s\n' "$2" > "$TMP/abierto/$1"
  touch -d "$(date -d '-200 minutes' '+%Y-%m-%d %H:%M:%S')" "$TMP/abierto/$1"
}

correr() { BUZON_DIR="$TMP" TTL_MIN=90 bash "$JANITOR" >/dev/null 2>&1; }
sigue()  { [ -f "$TMP/abierto/$1" ]; }

echo "── 1. CONTROL POSITIVO: la obligación que declara su propio cierre SÍ se archiva ──"
msg "2026-10-01_urgente_planificacion-a-todos_norma-cumplida.md" \
'# Norma vieja

CIERRE: CUMPLIDO — su regla ya vive en CLAUDE.md §3.bis y el sprint cerró.'
correr
if sigue "2026-10-01_urgente_planificacion-a-todos_norma-cumplida.md"; then
  mal "NO archivó la obligación con CIERRE: válido — el mecanismo no dispara (todo lo de abajo seria vacuo)"
else
  ok "archivó la obligación que declara su propio cierre"
fi

echo "── 2. CONTROL HOSTIL (el que el hallazgo exigía): obligación VIVA, sin el campo → SOBREVIVE ──"
msg "2026-10-02_urgente_planificacion-a-todos_norma-vigente.md" \
'# Norma VIGENTE — nadie trabaja sin goal

Esta norma sigue en pie y no tiene cierre declarado.'
correr
if sigue "2026-10-02_urgente_planificacion-a-todos_norma-vigente.md"; then
  ok "la obligación viva sobrevive — el campo no abrió la puerta a todas"
else
  mal "ARCHIVÓ una obligación VIVA: el patrón archiva de más y borra normas vigentes"
fi

echo "── 3. CONTROL HOSTIL: la PLANTILLA del protocolo (con pipes) NO cuenta como cierre ──"
# Este es el caso que el documento que PROPONE el campo contiene literalmente, y el que un
# patrón laxo archivaría primero: el doc que define el mecanismo se autodestruye.
msg "2026-10-03_hallazgo_planificacion-a-todos_propone-el-campo.md" \
'# Propuesta: un campo dedicado

CIERRE: VENCIDO|REFUTADO|CUMPLIDO — <motivo en una línea>

Con eso el janitor archiva sin juicio.'
correr
if sigue "2026-10-03_hallazgo_planificacion-a-todos_propone-el-campo.md"; then
  ok "la plantilla con pipes no matchea — el doc que define el campo no se autodestruye"
else
  mal "archivó el doc que sólo CITA la plantilla: el patrón no exige el motivo tras el guión"
fi

echo "── 4. CONTROL HOSTIL: el banner ⛔ REFUTADO habla de OTRO archivo → SOBREVIVE ──"
# El hallazgo midió que `⛔ REFUTADO` tiene DOS referentes: acá significa que ESTE archivo refuta a
# otro, o sea que es el artefacto VIGENTE. Archivarlo mata la corrección y deja circulando lo falso.
msg "2026-10-04_hallazgo_planificacion-a-todos_REFUTADO-el-hallazgo-de-las-13-ramas.md" \
'⛔ REFUTADO — este archivo refuta al hallazgo de las 13 ramas. NO ACTUAR sobre aquél.

Cita del protocolo, indentada:
> CIERRE: REFUTADO — así se declararía un cierre propio.'
correr
if sigue "2026-10-04_hallazgo_planificacion-a-todos_REFUTADO-el-hallazgo-de-las-13-ramas.md"; then
  ok "el banner y la cita indentada no matchean — la corrección sobrevive"
else
  mal "archivó la CORRECCIÓN vigente: el patrón no está anclado a inicio de línea"
fi

echo "── 5. CONTROL: el campo NO saltea el TTL — una obligación FRESCA con cierre se queda ──"
# El campo decide si la obligación deja de estar exenta; no la exime del TTL. Si lo salteara, un
# cierre escrito hace un minuto haría desaparecer el archivo antes de que nadie lo lea.
printf '%s\n' '# Recién cerrada

CIERRE: VENCIDO — se cerró hace un minuto.' > "$TMP/abierto/2026-11-05_urgente_planificacion-a-todos_recien-cerrada.md"
correr
if sigue "2026-11-05_urgente_planificacion-a-todos_recien-cerrada.md"; then
  ok "la obligación recién cerrada se queda dentro del TTL — hay ventana para leerla"
else
  mal "el campo salteó el TTL: un cierre recién escrito desaparece antes de ser leído"
fi

echo "── 6. NO REGRESIÓN: el tráfico normal viejo sigue archivándose ──"
msg "2026-10-05_dato_planificacion-a-backend_un-dato-viejo.md" '# dato viejo'
correr
if sigue "2026-10-05_dato_planificacion-a-backend_un-dato-viejo.md"; then
  mal "dejó de archivar tráfico normal — regresión del comportamiento base"
else
  ok "el tráfico normal viejo se sigue archivando"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-archivar-buzon-campo-cierre: OK"
else
  echo "❌ test-archivar-buzon-campo-cierre: $fallos fallo(s)"
fi
exit "$fallos"