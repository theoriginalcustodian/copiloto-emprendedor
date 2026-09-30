#!/usr/bin/env bash
# Canario de `vigencia-de-mediciones.py`: cada uno de sus controles tiene que PODER ponerse rojo.
#
# Por que existe versionado y no como corrida suelta: un guard que nunca se vio fallar no se sabe
# si funciona (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`). Si el canario vive solo
# en el scratchpad de la sesion que escribio el script, el proximo cambio no lo ejercita y el
# reportador puede quedar verde por ceguera.
#
# Cada caso muta el registro REAL en una copia temporal y exige el exit code que corresponde. El
# registro del repo no se toca.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$RAIZ/scripts/evidencia/vigencia-de-mediciones.py"
REGISTRO="$RAIZ/docs/copiloto-emprendedor/Auditorias/2026-09-30-registro-de-vigencia-la-sucesion-la-declara-el-sucesor.md"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[[ -f "$SCRIPT"   ]] || { echo "SIN MEDIR: no encuentro $SCRIPT"; exit 2; }
[[ -f "$REGISTRO" ]] || { echo "SIN MEDIR: no encuentro $REGISTRO"; exit 2; }

# Los mutantes se generan con python para poder ASEGURAR que cada patron existe y que la copia
# quedo distinta del original. Sin ese control, un patron que dejo de matchear produce un canario
# identico al registro real, sale VERDE, y se lee como «el control funciona».
python - "$REGISTRO" "$TMP" <<'PYEOF'
import sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
S = pathlib.Path(sys.argv[2])
B = "2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md"
M = "2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md"
muts = {
 # el retiro que FE1 declaro el 22/09 desaparece del registro
 "c1-positivo.md": (f"SUPERSEDE: {B}",
                    "SUPERSEDE: 2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2.md"),
 # una relacion apunta a un documento que no existe en el buzon
 "c2-cadena.md": ("SUPERSEDE: 2026-09-22_dato_frontend2-a-planificacion_BL-Q3-web-barrido-pwa-vs-prototipo.md",
                  "SUPERSEDE: 2026-09-22_dato_frontendX-a-planificacion_documento-fantasma.md"),
 # una relacion pierde su ALCANCE, del que depende la exclusion POR FILA del paso 3
 "c3-campos.md": (f"SUPERSEDE: {M}\nALCANCE: parcial\n", f"SUPERSEDE: {M}\n"),
 # entra la relacion inventada que el control negativo busca. El fence es OBLIGATORIO desde el
 # fix del 30/09: sin el, los campos no se leen, el mutante deja de mutar el sentido que probaba
 # y el control MUDO lo delata (paso: este mismo caso salio exit 9 en vez de 4).
 "c4-negativo.md": ("### `2026-09-22_dato_frontend2-a-planificacion_matriz-web-re-medida.md`",
                    "### `2026-09-22_dato_frontend9-a-planificacion_documento-que-no-existe.md`\n"
                    "```\n" f"SUPERSEDE: {M}\nALCANCE: total\nANCLA: pres-ciclo\n```\n\n"
                    "### `2026-09-22_dato_frontend2-a-planificacion_matriz-web-re-medida.md`"),
 # la cita que el registro pone en boca de FE1 deja de estar en el documento de FE1
 "c5-ancla.md": ("ANCLA: invalida como evidencia las 22 filas",
                 "ANCLA: esta-frase-no-esta-en-ningun-documento-del-buzon"),
 # el encabezado cae DENTRO del fence: los campos no se leen y la relacion se pierde MUDA, que es
 # como desaparecio la 5a relacion del reporte sin un solo error.
 "c6-mudo.md": ("-2-pendiente-device.md`\n```",
                "-2-pendiente-device.md`"),
 # una linea `ALCANCE:` FUERA de todo fence, como las que este registro transcribe de su PROPIA
 # salida en §5 y §6. El parser no la debe tomar. Se asierta por CONTENIDO: un valor basura
 # satisface al control CAMPOS igual que uno bueno, y asi el fail-open paso desapercibido.
 "c7-contaminacion.md": ("## 4 · Lo que este documento NO hace",
                         "ALCANCE: VALORCONTAMINADO\n\n## 4 · Lo que este documento NO hace"),
}
for nombre, (viejo, nuevo) in muts.items():
    if viejo not in src:
        print(f"CANARIO INVALIDO: el patron de {nombre} ya no esta en el registro"); sys.exit(7)
    txt = src.replace(viejo, nuevo, 1)
    if txt == src:
        print(f"CANARIO INVALIDO: {nombre} no cambio nada"); sys.exit(7)
    (S / nombre).write_text(txt, encoding='utf-8')
print(f"  {len(muts)} de {len(muts)} mutantes generados y verificados distintos del original")
PYEOF
rc=$?
[[ $rc -eq 0 ]] || { echo "CANARIO INVALIDO (exit $rc): los patrones ya no matchean el registro."; exit 7; }

ok=0; total=0
# caso : exit esperado : nombre del control
for caso in "c1-positivo.md:3:POSITIVO" "c2-cadena.md:5:CADENA" "c3-campos.md:6:CAMPOS" \
            "c4-negativo.md:4:NEGATIVO" "c5-ancla.md:8:ANCLA" "c6-mudo.md:9:MUDO" \
            "c7-contaminacion.md:0:CONTAMINACION(exit)"; do
  f="${caso%%:*}"; resto="${caso#*:}"; esperado="${resto%%:*}"; nombre="${resto##*:}"
  python "$SCRIPT" --registro "$TMP/$f" > "$TMP/$f.out" 2>&1
  got=$?
  total=$((total+1))
  if [[ "$got" == "$esperado" ]]; then
    ok=$((ok+1)); echo "  ROJO-OK  $nombre -> exit=$got"
  else
    echo "  FALLA    $nombre -> exit=$got (esperado $esperado)"; sed 's/^/           /' "$TMP/$f.out" | tail -5
  fi
done

# c7 por CONTENIDO: el exit 0 no alcanza. Un `ALCANCE:` con valor basura satisface al control
# CAMPOS igual que uno bueno, asi que el unico modo de probar que la linea de AFUERA del fence
# fue ignorada es buscar su valor en el reporte.
total=$((total+1))
if grep -q "VALORCONTAMINADO" "$TMP/c7-contaminacion.md.out"; then
  echo "  FALLA    CONTAMINACION(contenido) -> el parser leyo un ALCANCE: de FUERA del fence"
else
  echo "  ok       CONTAMINACION(contenido) -> la linea de fuera del fence fue ignorada"; ok=$((ok+1))
fi

# Y el hermano verde: el registro REAL tiene que salir 0. Sin esto, un script que devolviera
# siempre un rojo pasaria los 4 canarios.
python "$SCRIPT" > "$TMP/real.out" 2>&1
real=$?
if [[ $real -eq 0 ]]; then
  ok=$((ok+1)); echo "  VERDE-OK registro real -> exit=0"
else
  echo "  FALLA    registro real -> exit=$real (esperado 0)"; tail -5 "$TMP/real.out"
fi
total=$((total+1))

echo ""
echo "CANARIO: $ok de $total casos con el veredicto esperado"
[[ $ok -eq $total ]] || exit 1
echo "VERDE: los 7 controles pueden ponerse rojo, la contaminacion fuera del fence se ignora,"
echo "       y el registro real sale limpio."
