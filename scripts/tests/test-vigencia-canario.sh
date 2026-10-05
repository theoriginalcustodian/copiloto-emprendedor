#!/usr/bin/env bash
# Canario de `scripts/evidencia/vigencia-de-mediciones.py`: cada uno de sus controles tiene que
# PODER ponerse rojo.
#
# Por que existe versionado y no como corrida suelta: un guard que nunca se vio fallar no se sabe
# si funciona (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`). Si el canario vive solo
# en el scratchpad de la sesion que escribio el script, el proximo cambio no lo ejercita y el
# reportador puede quedar verde por ceguera.
#
# Cada caso muta el registro REAL en una copia temporal y exige el exit code que corresponde. El
# registro del repo no se toca.
#
# VIVE EN `scripts/tests/` A PROPOSITO: es el unico directorio que `scripts/ci/lint.sh` recorre
# (`for t in "$ROOT"/scripts/tests/test-*.sh`). Mientras estuvo en `scripts/evidencia/` el nombre
# matcheaba ese patron pero el glob no llegaba, asi que corria solo en la maquina de su autor --
# exactamente lo que `lint.sh` dice de si mismo: «un test que nadie ejecuta no es un control, es
# un archivo».
#
# -- Por que hay un BUZON FIXTURE y no se mide solo el corpus real ------------------------------
# `coordinacion/` NO esta versionado (0 archivos en `origin/main`). En un clon limpio el reportador
# sale 2 SIN MEDIR **antes de llegar a un solo control**: medido, mover este archivo al glob del CI
# sin el fixture habria puesto 9 fallos en el gate de las cuatro sesiones. El registro si esta
# versionado (vive en `docs/`), asi que los mutantes salen del registro real y el corpus se fabrica.
#
# Lo que el fixture verifica es el INSTRUMENTO: que cada control puede ponerse rojo, y que el
# veredicto de ANCLA depende del CONTENIDO del buzon (par vestido/desnudo, abajo).
# Lo que el fixture NO verifica -- y su verde no hay que leerlo como si lo hiciera -- es que las
# anclas del corpus REAL sean ciertas: eso lo prueba el ultimo caso, que corre donde el buzon
# existe y se reporta SALTADO donde no.
#
# El fixture se construye con el parser DEL PROPIO REPORTADOR (import por spec_from_file_location),
# nunca con una copia de sus regex: una segunda definicion del formato divergiria en silencio
# (`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$RAIZ/scripts/evidencia/vigencia-de-mediciones.py"
REGISTRO="$RAIZ/docs/copiloto-emprendedor/Auditorias/2026-09-30-registro-de-vigencia-la-sucesion-la-declara-el-sucesor.md"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# El interprete se resuelve, no se asume: `scripts/ci/lint.sh` invoca `python3` pero el job
# `lint` de `tests.yml` NO tiene `setup-python` (solo node), y en Git Bash `python3` puede ser
# un stub. Es el mismo resolvedor de `scripts/tests/test-contar-veredictos-padron.sh:38`:
# el patron ya existe en el repo, asi que se reutiliza en vez de inventar una segunda forma.
PY="$(command -v python || command -v python3)"
[[ -n "$PY" ]] || { echo "SIN MEDIR: no encuentro python ni python3"; exit 2; }

[[ -f "$SCRIPT"   ]] || { echo "SIN MEDIR: no encuentro $SCRIPT"; exit 2; }
[[ -f "$REGISTRO" ]] || { echo "SIN MEDIR: no encuentro $REGISTRO"; exit 2; }

# Los mutantes se generan con python para poder ASEGURAR que cada patron existe y que la copia
# quedo distinta del original. Sin ese control, un patron que dejo de matchear produce un canario
# identico al registro real, sale VERDE, y se lee como «el control funciona».
"$PY" - "$REGISTRO" "$TMP" <<'PYEOF'
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

# Dos buzones fixture del MISMO registro:
#   `buzon/`         -- cada documento citado existe y el del sucesor CONTIENE su ancla  => verde
#   `buzon-desnudo/` -- los mismos archivos, sin ningun ancla                            => rojo 8
# El par es el discriminante: prueba que el veredicto sale del CONTENIDO del buzon y no de que el
# registro se declare correcto a si mismo. Sin el desnudo, el verde del fixture seria
# indistinguible de un control que no mira (`memoria/instrumento-que-no-mira-nunca-falla.md`).
"$PY" - "$SCRIPT" "$REGISTRO" "$TMP" <<'PYEOF'
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location("vg", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)            # no corre main(): esta bajo `if __name__ == "__main__"`
mod.REGISTRO = pathlib.Path(sys.argv[2])
entradas, mudos = mod.leer_registro()
if not entradas:
    print("CANARIO INVALIDO: el parser del reportador no devolvio ninguna relacion"); sys.exit(7)
if mudos:
    print(f"CANARIO INVALIDO: el registro real tiene {len(mudos)} encabezados mudos"); sys.exit(7)
S = pathlib.Path(sys.argv[3])
vestido, desnudo = S / "buzon", S / "buzon-desnudo"
vestido.mkdir(); desnudo.mkdir()
nombres = set()
for e in entradas:
    nombres.add(e["otro"]); nombres.add(e["sucesor"])
for n in nombres:
    (vestido / n).write_text("fixture\n", encoding="utf-8")
    (desnudo / n).write_text("fixture\n", encoding="utf-8")
anclas = 0
for e in entradas:
    a = e.get("ancla")
    if not a:
        print(f"CANARIO INVALIDO: {e['sucesor'][:40]} no declara ANCLA en el registro real"); sys.exit(7)
    f = vestido / e["sucesor"]
    f.write_text(f.read_text(encoding="utf-8") + a + "\n", encoding="utf-8")
    anclas += 1
# Control del propio generador: el vestido tiene que contener CADA ancla y el desnudo NINGUNA. Sin
# esto, un fixture mal armado pone verde al caso desnudo y el par deja de discriminar -- el mismo
# filo que el assert de los mutantes.
for e in entradas:
    if e["ancla"] not in (vestido / e["sucesor"]).read_text(encoding="utf-8"):
        print(f"CANARIO INVALIDO: el vestido no contiene el ancla de {e['sucesor'][:40]}"); sys.exit(7)
    if e["ancla"] in (desnudo / e["sucesor"]).read_text(encoding="utf-8"):
        print(f"CANARIO INVALIDO: el desnudo SI contiene el ancla de {e['sucesor'][:40]}"); sys.exit(7)
print(f"  fixture: {len(nombres)} documentos por buzon, {anclas} de {len(entradas)} anclas "
      f"inyectadas en el vestido y 0 en el desnudo (verificado archivo por archivo)")
PYEOF
rc=$?
[[ $rc -eq 0 ]] || { echo "CANARIO INVALIDO (exit $rc): no se pudo fabricar el buzon fixture."; exit 7; }

FIX="$TMP/buzon"
ok=0; total=0
# caso : exit esperado : nombre del control
for caso in "c1-positivo.md:3:POSITIVO" "c2-cadena.md:5:CADENA" "c3-campos.md:6:CAMPOS" \
            "c4-negativo.md:4:NEGATIVO" "c5-ancla.md:8:ANCLA" "c6-mudo.md:9:MUDO" \
            "c7-contaminacion.md:0:CONTAMINACION(exit)"; do
  f="${caso%%:*}"; resto="${caso#*:}"; esperado="${resto%%:*}"; nombre="${resto##*:}"
  "$PY" "$SCRIPT" --registro "$TMP/$f" --buzon "$FIX" > "$TMP/$f.out" 2>&1
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

# El hermano verde: registro REAL + fixture completo tiene que salir 0. Sin esto, un script que
# devolviera siempre un rojo pasaria todos los mutantes.
total=$((total+1))
"$PY" "$SCRIPT" --buzon "$FIX" > "$TMP/verde.out" 2>&1
got=$?
if [[ $got -eq 0 ]]; then
  ok=$((ok+1)); echo "  VERDE-OK registro real + fixture -> exit=0"
else
  echo "  FALLA    registro real + fixture -> exit=$got (esperado 0)"; tail -6 "$TMP/verde.out"
fi

# Su par: MISMO registro, buzon sin las anclas => 8. Este caso es el que vuelve informativo al
# anterior: prueba que el verde depende del contenido del buzon y no del registro.
total=$((total+1))
"$PY" "$SCRIPT" --buzon "$TMP/buzon-desnudo" > "$TMP/desnudo.out" 2>&1
got=$?
if [[ $got -eq 8 ]]; then
  ok=$((ok+1)); echo "  ROJO-OK  ANCLA(par desnudo) -> exit=8: el veredicto sale del buzon, no del registro"
else
  echo "  FALLA    ANCLA(par desnudo) -> exit=$got (esperado 8)"; tail -6 "$TMP/desnudo.out"
fi

# Y el corpus REAL, sin `--buzon`: el unico caso que prueba que las anclas del registro estan de
# verdad en los documentos de sus autores. Donde `coordinacion/` no existe (CI, clon limpio) el
# reportador sale 2 y eso NO es una falla: se cuenta SALTADO y se dice que quedo sin verificar.
# El 2 se distingue por el MENSAJE, no solo por el codigo -- exit 2 tambien significa «universo
# vacio» (`memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md`).
#
# `CANARIO_BUZON_REAL`: vacia por defecto -- el reportador resuelve el buzon el mismo, que es como
# corre en el CI. Seteandola a un path inexistente se ejercita la rama SALTADO desde una maquina
# que SI tiene el buzon. Sin eso esa rama se estrena en el CI, y un error ahi rompe el gate de las
# cuatro sesiones: una rama hacia el «no medi» que nadie vio andar no se sabe si anda.
saltados=0
if [[ -n "${CANARIO_BUZON_REAL:-}" ]]; then
  "$PY" "$SCRIPT" --buzon "$CANARIO_BUZON_REAL" > "$TMP/corpus.out" 2>&1
else
  "$PY" "$SCRIPT" > "$TMP/corpus.out" 2>&1
fi
got=$?
if [[ $got -eq 0 ]]; then
  total=$((total+1)); ok=$((ok+1))
  echo "  VERDE-OK corpus REAL -> exit=0: las anclas estan en los documentos de sus autores"
elif [[ $got -eq 2 ]] && grep -q "el buzon no existe en este checkout" "$TMP/corpus.out"; then
  saltados=1
  echo "  SALTADO  corpus REAL -> exit=2: coordinacion/ no esta en este checkout (no esta versionado)."
  echo "           Las anclas del corpus quedan SIN verificar aca; correrlo donde el buzon exista."
else
  total=$((total+1))
  echo "  FALLA    corpus REAL -> exit=$got (esperado 0, o 2 con el mensaje del buzon ausente)"
  tail -6 "$TMP/corpus.out"
fi

echo ""
echo "CANARIO: $ok de $total casos con el veredicto esperado · $saltados saltado(s)"
[[ $ok -eq $total ]] || exit 1
echo "VERDE: los 7 controles pueden ponerse rojo, la contaminacion fuera del fence se ignora,"
echo "       y el veredicto de ANCLA depende del contenido del buzon (par vestido/desnudo)."
