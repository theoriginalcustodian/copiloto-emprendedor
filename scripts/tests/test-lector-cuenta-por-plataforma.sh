#!/usr/bin/env bash
# Control POSITIVO de PLATCONV: el lector cuenta por PLATAFORMA, y un veredicto de mobile NO puede
# aparecer como cobertura de web.
#
# Por que existe, y por que es OBLIGATORIO antes de publicar cualquier cifra: hasta el 2026-09-30 la
# clave del lector era `id·camino` y **no llevaba la plataforma** -- el propio archivo lo declaraba en
# un comentario («LIMITACION CONOCIDA del contraste»). Con esa clave, un id con veredicto WEB y nada
# en mobile contaba como cubierto, y de ahi salia el «54 de 54»: un solo numero para DOS poblaciones.
#
# El arreglo es indistinguible del bug sin este test, y no por prolijidad: `ids_del_criterio_cerrados`
# COLAPSA la clave al id (`clave.split(SEP)[0]`), asi que con la clave nueva devuelve exactamente el
# mismo total. O sea que se puede "arreglar" el parser entero y seguir publicando la cifra mentirosa,
# con el codigo nuevo corriendo. El caso 2 es el que lo caza.
#
# La UNICA variable entre casos es la columna `plataforma` (presente / ausente / con vocabulario
# inventado). Si el POSITIVO falla, TODA la tanda es invalida.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
PY="${PYTHON:-python}"
CONTADOR="scripts/evidencia/contar-veredictos.py"
[ -f "$CONTADOR" ] || { echo "❌ no existe $CONTADOR"; exit 1; }

corrida="$("$PY" - <<'PYEOF'
# -*- coding: utf-8 -*-
import importlib.util, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8")
SRC = pathlib.Path("scripts/evidencia/contar-veredictos.py").resolve()
spec = importlib.util.spec_from_file_location("cv", str(SRC)); cv = importlib.util.module_from_spec(spec)
sys.argv = ["cv"]
try: spec.loader.exec_module(cv)
except SystemExit: pass

IDS = {"factura", "card", "cuenta", "detalle"}

def plataformas(txt):
    """{plataforma: [ids]} tal como lo publica el reporte."""
    _, con, _, _, _, _, _ = cv.medir(txt, IDS)
    return cv.ids_cerrados_por_plataforma(con, IDS)

def sin_comparacion(txt):
    """{plataforma: [ids cubiertos EN esa plataforma pero sin ninguna comparacion]}."""
    _, con, _, _, _, _, _ = cv.medir(txt, IDS)
    return cv.ids_solo_no_comparacion_por_plataforma(con, IDS)

def sin_leer(txt, ids=None):
    """(filas de TABLA sin columna, {valor crudo: lineas}, fuera de tabla, AJENAS al padron).

    `ids` se puede pasar para ampliar el padron: es lo que ejercita el cuarto cubo (casos 19-20)."""
    _, _, _, _, _, _, ps = cv.medir(txt, IDS if ids is None else ids)
    return ps

# La forma REAL que escribe FE1 (`cierre_…B1-13-ids-superficie-y-dimension.md:38`), recortada a lo
# que este test necesita. `superficie` y `dimension` quedan a proposito: son columnas distintas y el
# lector no las debe confundir con la plataforma.
CAB = "| id (camino) | plataforma | superficie (app/proto) | dimension | veredicto |\n|---|---|---|---|---|\n"
CAB_SIN = "| id (camino) | superficie (app/proto) | dimension | veredicto |\n|---|---|---|---|\n"

casos = []

# ── 1. POSITIVO: la columna dice web y el id cae en web ──────────────────────────────────────
p = plataformas(CAB + "| `factura` (ARCA) | web | app | layout | COHERENTE |\n")
casos.append(("POSITIVO columna web -> cubierto en web",
              "factura" in p["web"] and "factura" not in p["mobile"]
              and "factura" not in p["indeterminada"], p))

# ── 2. EL CONTROL DEL CONTRATO: solo-mobile NO puede aparecer en web ─────────────────────────
# Es el caso que el contrato exige clavar: «un id con veredicto sólo mobile **no** puede aparecer
# como cubierto en web». Antes del fix, `factura` salia cubierto y la cifra de web lo contaba.
p = plataformas(CAB + "| `factura` (ARCA) | mobile | app | layout | COHERENTE |\n")
casos.append(("CONTRATO solo-mobile NO cuenta en web",
              "factura" in p["mobile"] and "factura" not in p["web"], p))

# ── 3. sin columna -> indeterminada, NUNCA web ───────────────────────────────────────────────
# El fail-open de hoy: contar «no se» como «web». La mayoria del corpus no tiene la columna, asi
# que este caso es el que decide si la cifra de web es real o heredada.
p = plataformas(CAB_SIN + "| `card` (gasto) | app | layout | COHERENTE |\n")
casos.append(("sin columna -> indeterminada, no web",
              "card" in p["indeterminada"] and "card" not in p["web"], p))

# ── 4. columna con vocabulario inventado -> indeterminada, y se NOMBRA ───────────────────────
# `pwa` es el caso que el contrato le prohibe a FE2 explicitamente. Que caiga en indeterminada no
# alcanza: hay que poder distinguir «falta la columna» de «la columna dice cualquier cosa», porque
# son dos trabajos distintos.
txt4 = CAB + "| `cuenta` (Mi cuenta) | pwa | app | layout | COHERENTE |\n"
p = plataformas(txt4)
_, invalidos, _, _ = sin_leer(txt4)   # (tabla, vocab invalido, fuera de tabla, ajenas)
casos.append(("vocabulario inventado (`pwa`) -> indeterminada Y nombrado",
              "cuenta" in p["indeterminada"] and "cuenta" not in p["web"]
              and "pwa" in invalidos, (p, sorted(invalidos))))

# ── 5. el MISMO id en las dos plataformas son DOS coberturas ─────────────────────────────────
# Es lo que la clave nueva permite y la vieja no: con `id·camino` la segunda fila se fundia con la
# primera y una de las dos mediciones desaparecia del reparto.
p = plataformas(CAB + "| `detalle` (Mi día) | web | app | layout | COHERENTE |\n"
                    + "| `detalle` (Mi día) | mobile | app | layout | DESVIO |\n")
casos.append(("mismo id en web y mobile -> cuenta en LAS DOS",
              "detalle" in p["web"] and "detalle" in p["mobile"], p))

# ── 6. una celda que dice las dos no es medicion de ninguna ──────────────────────────────────
# Elegir `web` porque aparece primero seria adivinar por orden de lectura con cara de medir.
p = plataformas(CAB + "| `card` (gasto) | web y mobile | app | layout | COHERENTE |\n")
casos.append(("«web y mobile» en una celda -> indeterminada",
              "card" in p["indeterminada"] and "card" not in p["web"]
              and "card" not in p["mobile"], p))

# ── 7. heading/bullet no tienen columna: indeterminada, sin inferir del titulo ───────────────
p = plataformas("# Medición de la app WEB de septiembre\n\n"
                "### `factura` — camino A (ARCA)\n\nVeredicto: COHERENTE\n")
casos.append(("heading -> indeterminada (no se infiere del titulo)",
              "factura" in p["indeterminada"] and "factura" not in p["web"], p))

# ── 8. el alcance de la cabecera MUERE con su tabla ──────────────────────────────────────────
# Si `col_plataforma` sobrevive a la tabla, la segunda hereda una columna que no tiene y el valor
# sale de la posicion equivocada: un dato inventado con apariencia de medido.
p = plataformas(CAB + "| `factura` (ARCA) | web | app | layout | COHERENTE |\n"
                + "\ntexto que cierra la tabla\n\n"
                + CAB_SIN + "| `card` (gasto) | app | layout | COHERENTE |\n")
casos.append(("la columna no se hereda a la tabla siguiente",
              "factura" in p["web"] and "card" in p["indeterminada"]
              and "card" not in p["web"], p))

# ── 9. DIFERENCIAL: «sin columna» (accionable) vs «fuera de tabla» (no lo es) ────────────────
# El caso que ya costó una vuelta REAL. El reporte publicaba las dos poblaciones juntas como «77
# medición(es) sin columna `plataforma`», y 48 de esas 77 eran headings y bullets — formas donde no
# hay columna que agregar. Con esa cifra se le atribuyeron 20 filas al `cierre_` de FE1, que aporta
# 0; FE1 contestó «0 sin columna» y tenía razón. Las dos mediciones eran honestas y contaban
# poblaciones distintas: la costura no era de nadie hasta que alguien la midió.
#
# El test es DIFERENCIAL a propósito: las dos formas en el MISMO fixture, y cada una tiene que caer
# en su cubo. Afirmar sólo una dejaría pasar un reporte que las mete a las dos en el mismo lado.
FIX9 = (CAB_SIN + "| `card` (gasto) | app | layout | COHERENTE |\n"
        + "\n### `factura` — camino A (ARCA)\n\nVeredicto: COHERENTE\n")
tabla, invalidos, fuera, _ = sin_leer(FIX9)
casos.append(("DIFERENCIAL fila de tabla -> accionable, heading -> NO accionable",
              len(tabla) == 1 and len(fuera) == 1 and not invalidos,
              "tabla=%s fuera=%s" % (tabla, fuera)))

# ── 10. POSITIVO INLINE: un heading declara plataforma con el campo `plataforma: web` ────────
# El mecanismo NO lo invento el lector: frontend1 lo escribio 21 veces en su `cierre_` del lote A,
# un documento en prosa por `###` id donde no hay tabla en la que poner una columna. Abri PLATHEAD
# preguntando que mecanismo podian usar los headings, y la respuesta ya estaba en el corpus.
p = plataformas("### `factura` — camino A (ARCA)\n\n"
                "`medido_contra: app=servido@abc · proto=proto@def` · `plataforma: web`\n\n"
                "Veredicto: COHERENTE\n")
casos.append(("INLINE `plataforma: web` en un heading -> web",
              "factura" in p["web"] and "factura" not in p["indeterminada"], p))

# ── 11. el alcance del campo inline MUERE con su bloque ──────────────────────────────────────
# Mismo riesgo que el de la cabecera (caso 8) pero por la otra forma: si la declaracion se pega al
# heading siguiente, el segundo id sale `web` sin que nadie lo haya medido en web. Un dato inventado
# con apariencia de medido es peor que un `indeterminada` honesto.
p = plataformas("### `factura` — camino A (ARCA)\n\n`plataforma: web`\n\nVeredicto: COHERENTE\n\n"
                "### `card` — camino A (gasto)\n\nVeredicto: DESVIO\n")
casos.append(("la declaracion inline no se hereda al heading siguiente",
              "factura" in p["web"] and "card" in p["indeterminada"]
              and "card" not in p["web"], p))

# ── 12. DOS declaraciones distintas en el mismo bloque -> ambiguo, no «gana la ultima» ───────
# Elegir la ultima seria adivinar por orden de lectura con cara de medir: el mismo fail-open del
# caso 6. Y se NOMBRA el conflicto, porque un `indeterminada` mudo no le dice a nadie que arreglar.
txt12 = ("### `cuenta` — camino A (Mi cuenta)\n\n`plataforma: web`\n\n`plataforma: mobile`\n\n"
         "Veredicto: COHERENTE\n")
p = plataformas(txt12)
_, invalidos12, _, _ = sin_leer(txt12)
casos.append(("dos declaraciones inline distintas -> indeterminada Y el conflicto nombrado",
              "cuenta" in p["indeterminada"] and "cuenta" not in p["web"]
              and "cuenta" not in p["mobile"]
              and any(k.startswith("conflicto:") for k in invalidos12),
              (p, sorted(invalidos12))))

# ── 13. CONTROL NEGATIVO del patron: la CABECERA de una tabla no es una declaracion inline ───
# `| id | veredicto | causa | plataforma |` contiene la palabra pero no los dos puntos. Si el patron
# fuera mas laxo, cada tabla con esa columna le declararia plataforma al heading que la precede --
# una plataforma leida del ENCABEZADO y no de la medicion.
p = plataformas("### `detalle` — camino A (Mi día)\n\n"
                "| id | veredicto | causa | plataforma |\n|---|---|---|---|\n\n"
                "Veredicto: COHERENTE\n")
casos.append(("la cabecera `| ... | plataforma |` NO declara nada (control del patron)",
              "detalle" in p["indeterminada"] and "detalle" not in p["web"], p))

# ── 14. EL HEDGE NO ES UNA DECLARACION — la celda REAL que se contaba como mobile limpio ─────
# Copiada textual de `…_cierre_frontend2-…_BL-Q3-v2-lote-B-11-de-11-completo.md:23`. La celda dice
# «ambas» y ADEMAS declara que mobile no fue verificado; el lector la contaba como `mobile` porque
# era el unico token del vocabulario que aparecia. frontend2 reporto 4 filas `ambas` y el instrumento
# reportaba 3: la cuarta no estaba perdida, estaba PROMOVIDA a una plataforma que nadie midio.
# Sin este caso, el arreglo es indistinguible del bug: la cifra de web no cambia.
# ⚠️ El sujeto es `detalle` y no `reveal` a proposito: `reveal` NO esta en `IDS`, y un id que el
# lector no mide no cae en NINGUN cubo — asi que `"reveal" not in p["mobile"]` salia True sin
# haber medido nada. La primera version de este caso salio VERDE mirando cero elementos, que es
# el mismo defecto que el test existe para cazar. La asercion que manda es la POSITIVA
# (`in p["indeterminada"]`), porque esa no se puede satisfacer por vacio.
txt14 = (CAB + "| `detalle` (Mi día) | ambas (mobile `[ASSUMED_PENDING_VERIFY]`, línea no releída) "
                "| app | layout | COHERENTE |\n")
p = plataformas(txt14)
_, invalidos14, _, _ = sin_leer(txt14)
casos.append(("hedge «ambas (mobile …)» -> indeterminada, NO mobile, Y nombrado",
              "detalle" in p["indeterminada"]
              and "detalle" not in p["mobile"] and "detalle" not in p["web"]
              and any("ambas" in k for k in invalidos14),
              (p, sorted(invalidos14))))

# ── 15. CONTROL DE SOBRE-ESTRICTEZ: la DECORACION no rompe una celda legitima ────────────────
# El arreglo del 14 es un match EXACTO, asi que hay que probar el otro lado: una celda que ES el
# token pero viene con backticks o negrita tiene que seguir contando. Un guard que se pasa de
# estricto vuelve `indeterminada` a todo el corpus y eso se lee como «el lector no sabe leer».
p = plataformas(CAB + "| `factura` (ARCA) | **`web`** | app | layout | COHERENTE |\n")
casos.append(("la decoracion (`backticks`/**negrita**) no invalida la celda",
              "factura" in p["web"] and "factura" not in p["indeterminada"], p))

# ── 16. un id CUBIERTO en web cuya unica medicion NO es una comparacion ──────────────────────
# `NO_REPRODUCIBLE_SIN_EFECTO` esta en el vocabulario CERRADO, asi que el id cuenta como cubierto --
# y no hubo comparacion de ninguna clase. Medido en el corpus: de 48 ids «cubiertos» en web, 7 son
# de esta forma, o sea que la cobertura de COMPARACION real es 41 y no 48. Lo destapo una pregunta
# de frontend2: se nego a partir `vacio`/`vacio-visto` en dos filas porque eso afirmaria dos intentos
# de medicion donde hubo cero, y tenia razon.
txt16 = CAB + "| `card` (gasto) | web | app | layout | NO_REPRODUCIBLE_SIN_EFECTO |\n"
p = plataformas(txt16)
nc = sin_comparacion(txt16)
casos.append(("cubierto en web pero SIN comparacion -> contado Y marcado",
              "card" in p["web"] and "card" in nc["web"], (p, nc)))

# ── 17. una comparacion REAL en la misma plataforma desmarca al id ───────────────────────────
# El `all()` es lo que decide: si el id tiene aunque sea UNA comparacion en esa plataforma, no es
# «sin comparacion». Sin este caso, el 16 pasaria igual con un `any()` y la advertencia marcaria a
# medio corpus -- un falso positivo que ensena a ignorarla.
txt17 = (CAB + "| `card` (gasto) | web | app | layout | NO_REPRODUCIBLE_SIN_EFECTO |\n"
             + "| `card` (gasto) | web | app | copy | COHERENTE |\n")
p = plataformas(txt17)
nc = sin_comparacion(txt17)
casos.append(("una comparacion real en la misma plataforma lo DESMARCA",
              "card" in p["web"] and "card" not in nc["web"], (p, nc)))

# ── 18. EL CRUCE ENTRE DOCUMENTOS — el control de `cruzar_no_comparacion` ────────────────────
# Un id puede ser `NO_MEDIBLE` en un documento y `COHERENTE` en otro. Unir los parciales de cada doc
# lo dejaria marcado como no comparado aunque SI se comparo en otro lugar, y ahi la advertencia seria
# tan mentirosa como la cifra que existe para corregir. Se ejercita la funcion del cruce con dos
# lotes armados a mano, porque el agregado vive en el reporte y no en `medir`.
doc_a = {"ids_cerrados_por_plataforma": {"web": ["factura", "card"]},
         "ids_solo_no_comparacion_por_plataforma": {"web": ["factura", "card"]}}
doc_b = {"ids_cerrados_por_plataforma": {"web": ["factura"]},
         "ids_solo_no_comparacion_por_plataforma": {"web": []}}
cruz = cv.cruzar_no_comparacion([doc_a, doc_b])
casos.append(("el cruce entre docs: comparado en OTRO doc -> no se marca",
              "factura" not in cruz["web"] and "card" in cruz["web"], cruz))

# ── 19. ACCFALSO — el cubo accionable exige SUJETO DEL PADRON (diferencial puro) ─────────────
# El falso positivo REAL que esto cierra: el reporte publicaba «ACCIONABLE (agregar la columna): 3
# filas» sobre una tabla de CAMPOS DOM del `cierre_` de frontend2 (`gasto-monto`, `ingreso-monto`,
# `presupuesto-item-0-precio`, con colores RGB). Tiene forma de tabla y no tiene la columna, pero no
# mide ninguna pantalla del padron: agregarle `plataforma` no significaria nada. Un instrumento que
# manda a hacer trabajo inutil INFLA su propio denominador de lo pendiente, y el que lee el numero
# no puede separar las filas reales de las que no lo son. Lo midio frontend2 cuando le atribui ese
# trabajo: «ninguna fila ahi declara un id del padron».
#
# DIFERENCIAL en el MISMO fixture, misma tabla, misma ausencia de columna: la UNICA variable es si
# el sujeto esta en el padron. Afirmar solo el lado ajeno dejaria pasar un filtro que se come las
# dos filas -- que es el error espejo y resta trabajo que SI existe.
FIX19 = (CAB_SIN + "| `card` (gasto) | app | layout | COHERENTE |\n"
         + "| `gasto-monto` (form de gasto) | app | layout | COHERENTE |\n")
tabla19, _, fuera19, ajenas19 = sin_leer(FIX19)
casos.append(("ACCFALSO: fila del padron -> accionable, fila con sujeto AJENO -> no accionable",
              len(tabla19) == 1 and len(ajenas19) == 1 and not fuera19,
              "tabla=%s ajenas=%s fuera=%s" % (tabla19, ajenas19, fuera19)))

# ── 20. CONTROL DE NO-DESCARTE: declarar el id ajeno lo DEVUELVE al cubo accionable ──────────
# Lo que separa «reclasificar» de «descartar en silencio», que es la implementacion mas barata de
# escribir y la que no da sintoma: con un `continue` los dos casos de arriba salen igual de verdes
# (`ajenas` seria 0 y nadie lo nota) y el instrumento perderia mediciones reales. Si el filtro se
# apoya de verdad en el padron, agregar `gasto-monto` tiene que mover la fila de cubo, no crearla.
tabla20, _, _, ajenas20 = sin_leer(FIX19, IDS | {"gasto-monto"})
casos.append(("declarar el id ajeno en el padron lo devuelve a accionable (no se descarto)",
              len(tabla20) == 2 and not ajenas20,
              "tabla=%s ajenas=%s" % (tabla20, ajenas20)))

# ── 21-22. CANARIO DEL TECHO: un set declarado NO puede descontar del denominador ────────────
# Por que existe (refutacion de auditoria, 2026-10-05): el set `SIN_REFERENCIA_EN_CAPA_ESCRITORIO`
# se llamaba `FUERA_DE_ALCANCE_WEB` y RESTABA del techo, asi que un 50 de 54 se publicaba como
# «TECHO ALCANZABLE 50 ✅ COMPLETO» y `web_faltan_accionables` quedaba vacio **por construccion** —
# la lista de pendientes no podia tener elementos. Lo probo corriendo el lector dos veces sobre el
# mismo tree cambiando solo el set: la cifra medida era identica y lo unico que cambiaba era el ✅.
#
# Ninguno de los 20 casos anteriores miraba el techo, asi que la correccion no tenia quien la
# sostenga: reintroducir el descuento habria vuelto a salir 20/20 verde. Esto es el canario, y mide
# la PROPIEDAD —el set informa, no descuenta— no la cifra del dia.
LOTE21 = [{"ids_cerrados_por_plataforma": {"web": ["factura", "card"]}}]
P21 = {"factura", "card", "cuenta", "detalle"}
cv.SIN_REFERENCIA_EN_CAPA_ESCRITORIO = {"cuenta", "detalle"}   # los 2 que faltan, los 2 en el set
a21 = cv.agregado_por_plataforma(LOTE21, P21)
casos.append(("CANARIO DEL TECHO: el set declarado NO descuenta del denominador",
              a21["web_techo_alcanzable"] == len(P21),
              "techo=%s esperado=%s" % (a21["web_techo_alcanzable"], len(P21))))
# La segunda mitad del mismo defecto: con TODOS los faltantes en el set, `accionables` se vaciaba —
# y es la lista que el lector publica como «lo que queda por hacer». Si se vacia aca, se vacia
# justo en el caso en que importa.
casos.append(("CANARIO DEL TECHO: `accionables` no se vacia por estar los faltantes en el set",
              sorted(a21["web_faltan_accionables"]) == sorted(a21["web_faltan"]) and bool(a21["web_faltan"]),
              "faltan=%s accionables=%s" % (a21["web_faltan"], a21["web_faltan_accionables"])))

for rot, ok, detalle in casos:
    print("%s\t%s\t%s" % ("OK" if ok else "FAIL", rot, detalle))
PYEOF
)"
rc=$?
echo "$corrida"
[ "$rc" = 0 ] || { echo "❌ el python del test no completó (rc=$rc)"; exit 1; }

total="$(printf '%s\n' "$corrida" | grep -c $'^\(OK\|FAIL\)\t')"
malos="$(printf '%s\n' "$corrida" | grep -c '^FAIL')"
# El POSITIVO se afirma aparte: si el fixture esta roto, los otros casos salen "bien" por la razon
# equivocada y la tanda entera no vale nada.
# `$'...'` y no `'...'`: en una ERE/BRE de grep, `\t` es una `t` literal, asi que el patron sin
# comillas-dolar NO matchea nunca y este guard condena una tanda 8/8 -- justo el guard que grita en
# el caso normal. Le paso lo mismo al contador de arriba y ahi si estaba bien escrito.
printf '%s\n' "$corrida" | grep -q $'^OK\tPOSITIVO' \
  || { echo "❌ el POSITIVO falló: el fixture no sirve y el resto de la tanda NO se puede leer"; exit 1; }
[ "$total" -ge 22 ] || { echo "❌ esperaba >=22 casos, corrieron $total"; exit 1; }
[ "$malos" = 0 ] || { echo "❌ $malos de $total caso(s) fallaron"; exit 1; }
echo "OK — $total/$total: la cifra se parte por plataforma, el campo inline se lee, un veredicto de mobile no cuenta como web, y el cubo accionable exige sujeto del padrón"
