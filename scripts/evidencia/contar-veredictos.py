#!/usr/bin/env python3
"""Cuenta las mediciones del criterio 3 en los dos lotes, POR SUJETO y con la unidad declarada.

Por qué existe: el 2026-09-28 circularon 12, 14, 30, 31 y 32 para el mismo frente, y todas eran
correctas en SU unidad (ids · ids sin voz · filas de reparto · mediciones · veredictos). El número
solo no dice nada: la unidad viajaba en la cabeza de quien contó y no en el papel. Este script
imprime SIEMPRE la unidad junto al número, y las unidades a la vez para que no haya que elegir.

Y registra el hash + mtime de cada archivo leído, porque los docs están VIVOS: FE2 corrigió dos
veredictos mientras esta auditoría los estaba midiendo. Un conteo sin la versión del archivo medido
es exactamente la caducidad que el criterio 3 ya pagó una vez, en escala de minutos.

────────────────────────────────────────────────────────────────────────────────────────────────
LA UNIDAD PRIMARIA ES EL SUJETO, NO EL VEREDICTO. Por qué se dio vuelta (auditoría, 2026-09-28):

  Contar VEREDICTOS sólo encuentra los que el lector ya sabe parsear. Cada forma nueva de registrar
  una medición era invisible, y encima la pérdida no daba síntoma: el fallback `hueco` iba a la
  MISMA lista cuyo largo era la métrica, así que cada medición perdida se sustituía 1-a-1 y el
  total no se movía. Medido por auditoría rompiendo cada brazo por separado: romper `tabla` dejaba
  los totales IDÉNTICOS byte a byte (A=20, B=32). Ningún control lo veía.

  El universo de SUJETOS sale de una fuente EXTERNA a este parser (`criterio3-matriz.mjs`), por eso
  una forma de registro nueva no puede esconder un sujeto: el id sigue en la lista, y si no se le
  pudo leer veredicto aparece como HUECO CON NOMBRE — accionable y con dueño. Las formas siguen
  existiendo como diagnóstico (`por_forma`), pero ya no son el numerador.

CONTROLES HORNEADOS (tres, y el tercero es el que faltaba):
  1. POSITIVO por lote: A >= 15 y B >= 10 mediciones. Un 0 es del instrumento, no del dato.
  2. COBERTURA de sujetos: si ningún id canónico aparece en un lote, el doc cambió de vocabulario.
  3. CANARIO POR BRAZO (`--canario`): rompe cada brazo de a uno y exige que la métrica de sujetos
     BAJE. Un brazo cuya rotura no mueve nada es un brazo que nadie controla — es el defecto que
     dejó `tabla` sin control durante toda su vida. El control se corre, no se promete.

Read-only. Uso: python contar-veredictos.py [--json] [--canario]
"""
import hashlib
import io
import json
import os
import re
import sys
import time
from pathlib import Path

# Consola cp1252 en Windows: un `UnicodeEncodeError` al IMPRIMIR salía exit 1 DESPUÉS de que los
# controles pasaron, o sea un rojo que no es del dato ni del código medido (auditoría, H-G).
for _f in (sys.stdout, sys.stderr):
    if hasattr(_f, "reconfigure"):
        _f.reconfigure(encoding="utf-8", errors="replace")

RAIZ = Path(__file__).resolve().parents[2]
COORD = Path("C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion")
MATRIZ = RAIZ / "scripts" / "evidencia" / "criterio3-matriz.mjs"
# La SPEC es la fuente de verdad del criterio: el backlog §13 punto 3 dice, con esas palabras, que
# se mide «contra la sección spec de este documento». Hasta el 2026-09-29 el universo salía de
# MATRIZ — o sea del INSTRUMENTO — y eso es C3-13: la matriz conoce 27 ids de los 54, así que los
# otros 28 no podían aparecer ni como «hueco con nombre». No eran los marginales: `cobro-voz`, las
# cinco `card-*`, `fact-voz`/`fact-hitl`/`pres-voz`/`pres-hitl`, `vacio`/`vacio-visto`, la home.
SPEC = (RAIZ / "docs" / "copiloto-emprendedor" /
        "2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md")

# Ratchet de cobertura del instrumento. NO es una lista de exclusiones: es el PISO medido, y el gate
# falla en las DOS direcciones — si aparece un ciego nuevo (regresión) y si uno declarado dejó de
# serlo sin bajar de esta lista (piso viejo). Un ratchet que sólo aprieta hacia arriba se afloja solo:
# la lista queda vieja y el gate pasa a certificar un estado que ya no existe.
CIEGOS_DECLARADOS = {
    "bi-refresh", "bi-vacio", "bloqueado", "caida", "card", "card-cliente", "card-cobro",
    "card-factura", "card-presu", "chat", "cobro-voz", "fact-cae", "fact-hitl", "fact-voz",
    "feedback", "grabando", "ingresar-error", "onb-cumplida", "onb-promesa", "preg", "pres-ciclo",
    "pres-hitl", "pres-voz", "recibo", "vacio", "vacio-visto", "volver", "(home)",
}
# `plan` está en la matriz y NO en la spec: salió por DEC-8 (visión, `BL-V2`). Es C3-14, y la
# ironía se mide sola — la spec existe porque «48/48 coherentes» se medía contra pantallas que nadie
# va a construir, y `plan` figuraba como una. La spec lo corrigió en su primera página; el
# instrumento lo heredó. Un diff de universo es BIDIRECCIONAL: faltantes Y retirados.
RETIRADOS_DECLARADOS = {"plan"}

NO_COMPARACION = ("NO_MEDIBLE", "FUERA-DE-REFERENCIA", "NO_REPRODUCIBLE_SIN_EFECTO",
                  "PENDIENTE_DEVICE")
# Vocabulario CERRADO de veredictos (§15.5 del contrato). Un token fuera de esta lista no se cuenta
# como veredicto en silencio: se reporta como VOCABULARIO_DESCONOCIDO. Sin esto,
# `**CORREGIDO — COHERENTE (era DIFERENCIA GRAVE…)**` entraba como si `CORREGIDO` fuera un veredicto
# y ensuciaba `por_clase` — visible y MAL, que es peor que un hueco (auditoría, H-D).
VOCABULARIO = {"COHERENTE", "DESVÍO", "DESVIO", "NO_MEDIBLE", "FUERA-DE-REFERENCIA",
               "NO_REPRODUCIBLE_SIN_EFECTO", "PENDIENTE_DEVICE"}
# Anotaciones de ESTADO que preceden al veredicto real y no son veredictos: `CORREGIDO — COHERENTE`
# vale COHERENTE, con la marca de que se corrigió.
ANOTACIONES = {"CORREGIDO", "RECLASIFICADO", "REVISADO"}

# Un bullet de IDENTIDAD: `- **`gastos`**` / `- **gastos**`. Es una de las formas en que este frente
# registra mediciones, y la que el conteo viejo no veía (de ahí 11 vs 12 en la MISMA unidad).
BULLET_ID = re.compile(r"^\s*[-*]+\s+\*\*`?[a-z0-9][a-z0-9\-]{1,30}`?\*\*")
# `veredicto: X`, `Veredicto**: X`, `veredicto = X`. El `(?i)` cierra el caso de `Veredicto:` con
# mayúscula, que el patrón case-sensitive perdía sin dar hueco (auditoría, H-E).
CAMPO = re.compile(r"(?i)\*{0,2}veredicto\*{0,2}\s*[:=]\s*\*{0,2}\s*([A-ZÁÉÍÓÚÑ_\-]{3,})")
# Una RECLASIFICACIÓN registra el par `VIEJO → NUEVO`: vale el NUEVO. Es una de las dos operaciones
# que introdujo Q3RECL y que el parser viejo no modelaba (auditoría, H-E).
RECLASIF = re.compile(r"([A-ZÁÉÍÓÚÑ_\-]{3,})\s*(?:→|->|=>)\s*([A-ZÁÉÍÓÚÑ_\-]{3,})")


def limpiar(s):
    """Saca la DECORACIÓN antes de buscar el veredicto: backticks, asteriscos y el sufijo
    `/documentado`.

    Es la raíz de la clase entera, no un caso: los cinco patrones asumían el token pelado y este
    frente escribe `` `NO_MEDIBLE` → `FUERA-DE-REFERENCIA` `` y `contenido=NO_MEDIBLE/documentado`.
    El backtick no es `\\s`, así que cada patrón fallaba por UN carácter y perdía la medición sin
    dar hueco. Auditoría lo encontró en `tabla-partida` (H-A); al arreglar sólo ese caso, el mismo
    defecto seguía vivo en `reclasif` — y lo cazó el canario, no yo. Se normaliza en UN lugar para
    que la próxima forma decorada no necesite un patrón nuevo.
    NO se usa para detectar el SUJETO: ahí los backticks son justamente la señal."""
    s = s.replace("`", "").replace("*", "")
    return re.sub(r"(?<=[A-ZÁÉÍÓÚÑ_\-])/[a-záéíóúñ\-]+", "", s)
# Una fila PARTIDA por dimensión (§14.2). La etiqueta viene en BACKTICKS en el doc real
# (`` `contenido`: COHERENTE · `componente`: FUERA-DE-REFERENCIA ``) y el `\s*` no matchea un
# backtick: el brazo fallaba por UN carácter y nunca disparó en ninguno de los dos lotes, mientras
# su caso de activación volvía como `hueco` (auditoría, H-A).
# Una medición PARTIDA por dimensión (§14.2 / §15.5). La etiqueta no es sólo `contenido`/`componente`:
# A·215 parte por CAMINO (`PARTIDO: camino-directo=COHERENTE · camino-buzón-…=COHERENTE-…`), así que
# se acepta cualquier etiqueta en minúscula seguida de `=`/`:` y un veredicto. Y vive tanto en una
# celda como en PROSA en negrita (A·46, A·72-73), por eso este brazo no se limita a filas de tabla.
# La etiqueta se acota a las dimensiones DECLARADAS (§14.2) más las particiones por camino. Una rama
# genérica `[a-z]{4,30}=MAYÚSCULAS` pegaba de casualidad en prosa (L35 del lote B): un brazo que
# acierta por coincidencia es indistinguible de uno que mide.
PARTIDA = re.compile(r"(?:^|[\s·(])(contenido|componente|ambas|camino[a-záéíóúñ\-]*)"
                     r"\s*[:=]\s*([A-ZÁÉÍÓÚÑ_\-]{3,})")
DIM_EXPLICITA = ("contenido", "componente", "ambas")
ARMAS = ("campo", "bullet", "reclasif", "tabla-partida", "tabla")


def claves_nivel1(texto, nombre):
    """Claves de PROFUNDIDAD 1 del objeto `nombre` — las anidadas son atributos, no ids."""
    m = re.search(nombre + r"\s*=\s*\{", texto)
    if not m:
        return []
    i, prof, fin = m.end() - 1, 0, None
    for j in range(i, len(texto)):
        if texto[j] == "{":
            prof += 1
        elif texto[j] == "}":
            prof -= 1
            if prof == 0:
                fin = j
                break
    if fin is None:
        return []
    claves, prof = [], 0
    for linea in texto[i:fin].splitlines():
        if prof == 1:
            k = re.match(r"\s*([a-z][a-z0-9\-]{1,30})\s*:", linea)
            if k:
                claves.append(k.group(1))
        prof += linea.count("{") - linea.count("}")
    return claves


def ids_de_la_matriz():
    """Lo que el INSTRUMENTO sabe capturar. Ya no es el universo: es una de las dos patas del diff."""
    if not MATRIZ.exists():
        print(f"ABORTA: no encontré {MATRIZ}. Sin la matriz no se puede medir la cobertura.",
              file=sys.stderr)
        sys.exit(2)
    s = io.open(MATRIZ, encoding="utf-8").read()
    ids = claves_nivel1(s, "PROTO_VISTA") + claves_nivel1(s, "MEDIBILIDAD")
    ids = sorted(set(i for i in ids if i not in ("captura", "porque")))
    if len(ids) < 15:
        print(f"CONTROL DEL UNIVERSO FALLA: {len(ids)} ids extraídos de criterio3-matriz.mjs "
              f"(esperado >=15). Cambió la forma de las tablas: el conteo NO se lee.",
              file=sys.stderr)
        sys.exit(2)
    return ids


def universo_de_sujetos():
    """Los 54 ids del criterio, parseados de la sección «spec» de la SPEC.

    El universo sigue siendo EXTERNO a este parser (si saliera de los docs medidos, una forma nueva
    escondería el sujeto), pero ahora la fuente externa es la que el criterio nombra, no el
    instrumento que lo mide. Ver C3-13 arriba.

    El control es ARITMÉTICO y la spec se lo da servido: su §3 cierra «51 − 2 + 4 + 1 = 54,
    recontado sobre la tabla de §2: 54 ids, ninguno repetido». Así que 54 exactos, sin duplicados,
    o el parser NO entendió la tabla y aborta. Un conteo aproximado acá no es un conteo: 53 podría
    ser una fila mal leída y se vería igual de plausible.
    """
    if not SPEC.exists():
        print(f"ABORTA: no encontré {SPEC}. El universo NO se deduce de la matriz (C3-13).",
              file=sys.stderr)
        sys.exit(2)
    txt = io.open(SPEC, encoding="utf-8").read()
    m = re.search(r"^### spec[^\n]*\n(.*?)(?=^### )", txt, re.S | re.M)
    if not m:
        print("ABORTA: no encontré la sección «### spec» en la spec. Cambió su estructura.",
              file=sys.stderr)
        sys.exit(2)
    ids, home = [], 0
    for linea in m.group(1).splitlines():
        if not linea.lstrip().startswith("|"):
            continue
        if "?ver=" in linea or set(linea.replace("|", "").strip()) <= set("-: "):
            continue                      # cabecera y separador
        celdas = linea.split("|")
        for pos in (1, 4):                # las dos mitades de la tabla partida; la 3 es el hueco
            if pos >= len(celdas):
                continue
            c = celdas[pos].strip()
            if not c:
                continue
            b = re.findall(r"`([a-z][a-z0-9-]*)`", c)
            if b:
                ids.extend(b)
            elif "vac" in c and "Mi d" in c:
                home += 1                 # la home no tiene `?ver=`: es el 54º y entra como (home)
    dups = sorted(i for i in set(ids) if ids.count(i) > 1)
    if dups:
        print(f"CONTROL DE LA SPEC FALLA: ids repetidos en §2 {dups}. La spec declara «ninguno "
              f"repetido» (§3): o la spec cambió o el parser lee mal.", file=sys.stderr)
        sys.exit(2)
    univ = sorted(set(ids)) + (["(home)"] if home else [])
    if len(univ) != 54:
        print(f"CONTROL DE LA SPEC FALLA: parseé {len(univ)} ids de la sección «spec» "
              f"({len(ids)} literales + {home} home) y la spec declara 54 en §3. El parser no "
              f"entendió la tabla: el conteo NO se lee.", file=sys.stderr)
        sys.exit(2)
    return univ


def control_de_cobertura(ids):
    """DIFF BIDIRECCIONAL entre el universo del criterio y lo que la matriz sabe capturar.

    Es el control que faltaba, y su ausencia es la forma de la que ya hay varias en este repo: los
    dos controles horneados (`len(ids) >= 15` y el canario de 5 brazos) miran hacia ADENTRO del
    parser. Prueban que los brazos funcionan; ninguno pregunta si el universo está completo. Con 28
    de 54 ids invisibles, el conteo salía verde y sonaba a cobertura.

    Devuelve (ciegos, retirados) y aborta si el ratchet no cuadra en cualquiera de las dos
    direcciones.
    """
    mids = set(ids_de_la_matriz())
    ciegos = {i for i in ids if i not in mids}
    retirados = {i for i in mids if i not in set(ids)}

    nuevos_ciegos = sorted(ciegos - CIEGOS_DECLARADOS)
    ya_cubiertos = sorted(CIEGOS_DECLARADOS - ciegos)
    nuevos_retirados = sorted(retirados - RETIRADOS_DECLARADOS)
    ya_no_retirados = sorted(RETIRADOS_DECLARADOS - retirados)

    if nuevos_ciegos:
        print(f"COBERTURA: REGRESIÓN — {len(nuevos_ciegos)} id(s) de la spec que la matriz dejó de "
              f"cubrir: {nuevos_ciegos}. Si es deliberado, bajalos a CIEGOS_DECLARADOS con el por "
              f"qué; si no, la matriz perdió una captura.", file=sys.stderr)
        sys.exit(6)
    if ya_cubiertos:
        print(f"COBERTURA: EL PISO QUEDÓ VIEJO — la matriz ya cubre {ya_cubiertos}, que siguen "
              f"declarados como ciegos. Sacalos de CIEGOS_DECLARADOS: un ratchet que no se aprieta "
              f"certifica un estado que ya no existe.", file=sys.stderr)
        sys.exit(6)
    if nuevos_retirados or ya_no_retirados:
        print(f"COBERTURA: el diff de retirados no cuadra — nuevos {nuevos_retirados}, "
              f"ya-no {ya_no_retirados}. RETIRADOS_DECLARADOS tiene que reflejar la spec vigente.",
              file=sys.stderr)
        sys.exit(6)
    return sorted(ciegos), sorted(retirados)


def ubicar(patron):
    for base in ("abierto", "en-curso", "cerrado"):
        for p in (COORD / base).rglob("*.md"):
            if patron in p.name:
                return p
    return None


def sello(p):
    b = p.read_bytes()
    return {
        "path": p.relative_to(COORD).as_posix(),
        "sha256_12": hashlib.sha256(b).hexdigest()[:12],
        "bytes": len(b),
        "mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(p))),
    }


def normalizar(tok, crudo):
    """Devuelve (veredicto, corregido) validando contra el vocabulario CERRADO."""
    if tok in ANOTACIONES:
        m = re.search(r"(?:—|-|:)\s*\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", crudo)
        if m and m.group(1) in VOCABULARIO:
            return m.group(1), True
        return "VOCABULARIO_DESCONOCIDO", True
    if tok not in VOCABULARIO:
        return "VOCABULARIO_DESCONOCIDO", False
    return tok, False


def es_separador(linea):
    """La fila `|---|---|` de markdown. Es LA señal de cabecera: en markdown el separador va
    obligatoriamente justo debajo de la cabecera, así que la fila anterior ES la cabecera. Adivinar
    la cabecera por su contenido («¿son palabras en minúscula?») falla con
    `| id (· camino) | tipo | medido_contra |` — y falló: dejó las 16 filas del backfill volviendo
    como huecos (auditoría, H-C)."""
    if not (linea.strip().startswith("|") and linea.count("|") >= 4):
        return False
    return set(linea.strip().strip("|").replace("|", "").strip()) <= set("-: ")


def fila_de_tabla(linea):
    if not (linea.strip().startswith("|") and linea.count("|") >= 4):
        return None
    if es_separador(linea):
        return None                              # separador de tabla markdown, no una fila
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def veredictos_de(texto, armas=ARMAS):
    """Toda aparición de un veredicto en ROL de veredicto. Cuenta la FORMA, no el símbolo: una
    mención en prosa o en un comentario no es un veredicto (fue el error del `8` de mic-funcion).

    `armas` existe para el CANARIO: romper un brazo de a uno y exigir que la métrica baje."""
    hits = []
    lineas = texto.splitlines()
    # ¿la tabla en curso declara columna de veredicto? Se resuelve con la regla de markdown: una fila
    # es la CABECERA si la línea siguiente es el separador `|---|`. Sin tabla en curso queda True,
    # porque suprimir por defecto convertiría este gate en «un instrumento que no mira nunca falla».
    cabecera_mide = True
    for n, linea in enumerate(lineas, 1):
        if es_separador(linea):
            continue                             # el separador no es fila ni cabecera
        celdas = fila_de_tabla(linea)
        if celdas is None:
            cabecera_mide = True                 # fuera de tabla, el estado no se arrastra
        elif n < len(lineas) and es_separador(lineas[n]):
            cabecera_mide = "veredicto" in " ".join(celdas).lower()
            continue                             # una cabecera no es una medición

        # Todos los brazos buscan sobre la línea SIN decoración: ahí murieron `tabla-partida` (H-A)
        # y `reclasif`, cada uno por un backtick. El sujeto se detecta sobre la línea original.
        plana = limpiar(linea)

        if "tabla-partida" in armas:
            # Una PARTIDA vive tanto en una celda como en prosa en negrita, así que este brazo es de
            # LÍNEA. Se exige o dos pares o el marcador `PARTIDO`, para no cazar `veredicto: X` (que
            # es del brazo `campo`) ni cualquier `etiqueta: MAYÚSCULAS` de prosa.
            pares = [(et, tok) for et, tok in PARTIDA.findall(plana) if et != "veredicto"]
            if pares and (len(pares) >= 2 or "PARTIDO" in plana
                          or pares[0][0] in DIM_EXPLICITA):
                for et, tok in pares:
                    v, corr = normalizar(tok, plana)
                    hits.append((n, v, "tabla-partida", corr))
                continue
        if "campo" in armas:
            m = CAMPO.search(plana)
            if m:
                v, corr = normalizar(m.group(1), plana)
                hits.append((n, v, "campo", corr))
                continue
        if "bullet" in armas and BULLET_ID.match(linea):
            # La medición registrada en un BULLET de identidad: `- **`gastos`** … «Veredicto sin
            # cambios (solo vocabulario): **DESVÍO**`». Hay texto entre `Veredicto` y los dos
            # puntos, así que no matchea CAMPO, y no empieza con `|`, así que tampoco daba hueco:
            # desaparecía. Se acota a líneas que YA se identifican como medición (un id en bullet)
            # para no cazar prosa que menciona un veredicto de pasada.
            m3 = re.search(r"(?i)veredicto[^:=]{0,60}[:=]\s*([A-ZÁÉÍÓÚÑ_\-]{3,})", plana)
            if m3:
                v, corr = normalizar(m3.group(1), plana)
                hits.append((n, v, "bullet", corr))
                continue
        if "reclasif" in armas:
            m4 = RECLASIF.search(plana)
            if (m4 and m4.group(2) in VOCABULARIO
                    and m4.group(1) in (VOCABULARIO | ANOTACIONES | {"DIFERENCIA"})):
                hits.append((n, m4.group(2), "reclasif", True))
                continue
        if celdas is None:
            continue
        antes = len(hits)
        for c in (limpiar(x) for x in reversed(celdas)):
            if "tabla" in armas:
                m2 = re.match(r"\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", c)
                if m2 and m2.group(1) not in ("N/A", "SHA", "ID"):
                    v, corr = normalizar(m2.group(1), c)
                    hits.append((n, v, "tabla", corr))
                    break
        if len(hits) == antes and cabecera_mide:
            # Un HUECO sólo tiene sentido en una tabla que DECLARA columna de veredicto. Sin este
            # gate, las 16 filas de la tabla `medido_contra` y los encabezados volvían como huecos:
            # 19 de 20 eran inventados por el parser, y leídos como hallazgos son 19 acusaciones
            # falsas contra quien escribió el doc (auditoría, H-C).
            hits.append((n, "SIN_VEREDICTO_PARSEABLE", "hueco", False))
    return hits


# ── DECLARACIÓN DE SUJETO ────────────────────────────────────────────────────────────────────────
# El sujeto se declara en un canal DISTINTO del veredicto, y ése es el que le da poder a la
# inversión. Medido en los dos lotes: el id siempre viene entre backticks, en una de tres formas
#   · encabezado   `### \`agenda\` — camino A (Mi día, panel resumen embebido)`
#   · bullet        `- **\`gastos\`** — CAMINO-ÚNICO confirmado…`
#   · primera celda `| \`onb-promesa\` | … | DESVÍO |`
# mientras el VEREDICTO aparece en cinco formas distintas y contando. Un canal uniforme no puede
# esconder un sujeto cuando aparece una forma de registro nueva; contar veredictos sí.
#
# La clave del sujeto es `id` + `camino`, que es la unidad que declara el §1 del contrato. Por eso
# `agenda — camino A` y `agenda — camino B` son DOS mediciones y no una fila ambigua.
SUJ_HEADING = re.compile(r"^#{2,4}\s+\*{0,2}`([a-z0-9][a-z0-9\-]{1,30})`\*{0,2}\s*(.*)$")
SUJ_BULLET = re.compile(r"^\s*[-*]+\s+\*\*`?([a-z0-9][a-z0-9\-]{1,30})`?\*\*\s*(.*)$")
SUJ_CELDA = re.compile(r"^\*{0,2}`([a-z0-9][a-z0-9\-]{1,40})`")


def camino_de(cola):
    """El sufijo `— camino A (…)` distingue dos mediciones del mismo id. Sin él, `camino: único`."""
    m = re.search(r"—\s*(camino\s+[^(,]{1,40})", cola or "")
    return m.group(1).strip() if m else ""


def mediciones_de(texto, armas=ARMAS):
    """Devuelve las MEDICIONES (`id`+`camino`, §1) con los veredictos que se le pudieron leer a cada
    una. Una medición sin veredicto legible es un HUECO CON NOMBRE: accionable y con dueño, que es
    exactamente lo que el conteo por veredictos no podía producir."""
    hits = veredictos_de(texto, armas)
    por_linea = {}
    for n, v, f, c in hits:
        if f != "hueco":
            por_linea.setdefault(n, []).append((v, f, c))

    meds, actual = [], None
    for n, linea in enumerate(texto.splitlines(), 1):
        celdas = fila_de_tabla(linea)
        nueva = None
        if celdas:
            m = SUJ_CELDA.match(celdas[0])
            if m:
                nueva = {"id": m.group(1), "camino": "", "linea": n, "forma_decl": "celda",
                         "veredictos": []}
                # En una tabla el sujeto y el veredicto viven en la MISMA línea: la medición se
                # cierra acá y no arrastra contexto a la fila siguiente.
                nueva["veredictos"] = [v for v, _, _ in por_linea.get(n, [])]
                meds.append(nueva)
                actual = None
                continue
        else:
            m = SUJ_HEADING.match(linea) or SUJ_BULLET.match(linea)
            if m:
                actual = {"id": m.group(1), "camino": camino_de(m.group(2)), "linea": n,
                          "forma_decl": "heading" if linea.startswith("#") else "bullet",
                          "veredictos": []}
                meds.append(actual)
        if actual is not None and n in por_linea:
            actual["veredictos"] += [v for v, _, _ in por_linea[n]]

    # Los veredictos que NO cayeron bajo ningún sujeto declarado son el otro lado del hueco: están
    # leídos pero huérfanos, y sumarlos al total los haría parecer atribuidos.
    atribuidos = sum(len(m["veredictos"]) for m in meds)
    huerfanos = sum(len(v) for v in por_linea.values()) - atribuidos
    return hits, meds, huerfanos


def ids_del_criterio(con, ids):
    """Los ids DEL CRITERIO que tienen veredicto: el cruce entre lo medido y el padron.

    Vive en una funcion y no inline porque el canario del padron (control 4) tiene que ejercitar
    ESTE camino, no recomputar el cruce por su cuenta. La primera version del canario lo recomputaba
    y por eso no cazaba nada: con el cruce neutralizado en el reporte, el canario seguia cruzando en
    su propia linea y veia bajar la cifra igual. Un control que recalcula la metrica en vez de
    llamar al codigo que la produce mide su propia aritmetica
    (`memoria/el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md`).

    Se cuenta por ID, no por `id·camino`: un mismo id medido en dos caminos es UN id cubierto.
    """
    return sorted({c.split("·")[0] for c in con} & set(ids))


def medir(txt, ids, armas=ARMAS):
    """`con` = mediciones con veredicto legible · `sin` = HUECOS CON NOMBRE (`id·camino`).

    ⚠️ 2026-09-29 — EL PADRON ERA INERTE. Esta funcion recibia `ids` y NO lo usaba en ninguna
    linea de su cuerpo: todo salia de `mediciones_de(txt, armas)`. Medido con el control que
    faltaba, y que es de una linea: con el padron VACIO el resultado era identico byte a byte
    (lote A 21 sujetos / 26 hits con 54 ids, con 27 ids y con 0 ids).

    Lo que eso implica es mas grande que el universo chico de C3-13: ningun `id` se validaba contra
    nada, asi que un typo del documento (`facutra`) entraba como sujeto legitimo, y la cifra que
    este script existe para dar —«N de 54»— NO se computaba en ninguna parte. El acta del 22/09
    afirmo «29 de 54» sin registro de donde contarlo; el instrumento hecho para arreglar eso
    tampoco lo tenia.

    Y el detalle que lo dejo vivir: `universo_de_sujetos()` tenia su propio control
    (`CONTROL DEL UNIVERSO FALLA` si extraia <15 ids) protegiendo un valor que nadie consumia. Un
    control sobre un dato inerte da verde con toda razon y no significa nada. El canario de 5 brazos
    probaba las FORMAS del parser; el padron era un sexto brazo sin canario. Por eso ahora hay uno
    (control 4, en main): sacarle al padron UN id que el doc mide tiene que bajar la cifra en
    exactamente 1. Formularlo como «con padron vacio tiene que dar 0» no sirve — eso se computa
    como una interseccion con el conjunto vacio y da 0 por definicion, no por el comportamiento
    del codigo: habria salido verde sobre el padron inerte. Un control que no puede fallar no es
    un control.

    Se agrega POR SUJETO, no por sitio de declaración: un `id·camino` que rinde veredicto en algún
    lugar del doc está medido, aunque además aparezca en una tabla que no lleva columna de veredicto
    (el backfill de `medido_contra` declara 16 ids sin veredicto y todos están medidos arriba). Sin
    esta agregación, esas 16 filas vuelven como huecos — el mismo falso positivo que el gate de
    cabecera cerró a nivel fila, reapareciendo a nivel sujeto (auditoría, H-C)."""
    hits, meds, huerfanos = mediciones_de(txt, armas)
    padron = set(ids)
    con, sitios, fuera = {}, {}, {}
    for m in meds:
        clave = f"{m['id']}·{m['camino'] or 'único'}"
        if padron and m["id"] not in padron:
            # NO se descarta: se cuenta aparte. Descartarlo en silencio seria el error espejo del
            # que este bloque arregla — un id fuera del padron puede ser un typo del doc (`facutra`),
            # un id nuevo que la spec todavia no tiene, o una pantalla retirada. Las tres cosas hay
            # que verlas; ninguna se puede resolver borrandola.
            fuera.setdefault(m["id"], []).append(m["linea"])
        sitios.setdefault(clave, []).append(m["linea"])
        if m["veredictos"]:
            con.setdefault(clave, []).extend(m["veredictos"])
    sin = [f"{c} (declarado en L{','.join(str(x) for x in ls)})"
           for c, ls in sitios.items() if c not in con]
    return hits, con, sin, sitios, huerfanos, fuera


def main():
    ids = universo_de_sujetos()
    ciegos, retirados = control_de_cobertura(ids)
    docs = {"lote_A": ubicar("lote-A"), "lote_B": ubicar("lote-B")}
    faltan = [k for k, v in docs.items() if v is None]
    if faltan:
        print(f"ABORTA: no encontré {faltan}. Un 0 acá sería del instrumento, no del dato.",
              file=sys.stderr)
        sys.exit(2)

    res = {"medido_en": time.strftime("%Y-%m-%d %H:%M:%S"), "universo_de_sujetos": ids,
           "cobertura_del_instrumento": {
               "fuente_del_universo": str(SPEC.name),
               "ids_del_criterio": len(ids),
               "ids_que_la_matriz_captura": len(ids) - len(ciegos),
               "ciegos": ciegos,
               "retirados_de_la_spec_que_la_matriz_conserva": retirados,
           },
           "lotes": {}}
    textos = {}
    for k, p in docs.items():
        txt = textos[k] = io.open(p, encoding="utf-8", errors="replace").read()
        hits, con, sin, sitios, huerfanos, fuera = medir(txt, ids)
        # La cifra que pide el criterio, por fin computada: de los 54 ids de la spec, cuantos tienen
        # veredicto en este doc.
        ids_con_veredicto = ids_del_criterio(con, ids)
        porClase, porForma = {}, {}
        for _, v, f, _ in hits:
            porClase[v] = porClase.get(v, 0) + 1
            porForma[f] = porForma.get(f, 0) + 1
        res["lotes"][k] = {
            "archivo": sello(p),
            "mediciones_declaradas": len(sitios),
            "veredictos_huerfanos": huerfanos,
            "sujetos_con_veredicto": len(con),
            "ids_del_criterio_con_veredicto": len(ids_con_veredicto),
            "ids_del_criterio_con_veredicto_lista": ids_con_veredicto,
            "ids_medidos_fuera_del_padron": {k: v for k, v in sorted(fuera.items())},
            "sujetos_nombrados_sin_veredicto": sin,
            "veredictos_total": len([h for h in hits if h[2] != "hueco"]),
            "por_clase": dict(sorted(porClase.items(), key=lambda x: -x[1])),
            "por_forma": dict(sorted(porForma.items(), key=lambda x: -x[1])),
            "corregidos": sum(1 for h in hits if h[3]),
            "no_comparacion": sum(n for v, n in porClase.items() if v in NO_COMPARACION),
            "detalle": [{"linea": n, "veredicto": v, "forma": f, "corregido": c}
                        for n, v, f, c in hits],
        }

    # --- control 1: POSITIVO por lote -----------------------------------------------------------
    a = res["lotes"]["lote_A"]["veredictos_total"]
    b = res["lotes"]["lote_B"]["veredictos_total"]
    if a < 15 or b < 10:
        print(f"CONTROL POSITIVO FALLA: lote A={a} (esperado >=15), lote B={b} (esperado >=10). "
              f"El formato cambió o el patrón no matchea. El conteo NO se lee.", file=sys.stderr)
        sys.exit(3)

    # --- control 2: el CANAL DEL SUJETO sigue vivo ----------------------------------------------
    # Es el control que le falta a cualquier conteo por veredictos: si el canal por el que se
    # declara el sujeto se rompe, TODO el resto sigue dando números plausibles. Se exige que cada
    # lote declare mediciones y que la mayoría tenga veredicto legible.
    for k in docs:
        d = res["lotes"][k]
        if d["mediciones_declaradas"] < 5:
            print(f"CONTROL DEL CANAL DE SUJETO FALLA en {k}: {d['mediciones_declaradas']} "
                  f"mediciones declaradas (esperado >=5). El doc cambió la forma de declarar el "
                  f"`id`, o SUJ_HEADING/SUJ_BULLET/SUJ_CELDA se rompieron. El conteo NO se lee.",
                  file=sys.stderr)
            sys.exit(4)
        if d["sujetos_con_veredicto"] == 0:
            print(f"CONTROL DEL CANAL DE SUJETO FALLA en {k}: {d['mediciones_declaradas']} "
                  f"mediciones y NINGUNA con veredicto atribuido. La atribución se rompió.",
                  file=sys.stderr)
            sys.exit(4)

    # --- control 3: CANARIO POR BRAZO -----------------------------------------------------------
    # El agregado no alcanza: romper `tabla` dejaba los totales idénticos byte a byte porque el
    # fallback `hueco` sustituía 1-a-1 lo perdido. Se rompe cada brazo de a uno y se exige que la
    # métrica de SUJETOS baje. Un brazo cuya rotura no mueve nada es un brazo sin control.
    if "--canario" in sys.argv:
        print("CANARIO POR BRAZO (se rompe uno y la métrica de sujetos tiene que BAJAR)\n")
        malos = []
        for arma in ARMAS:
            resto = tuple(x for x in ARMAS if x != arma)
            movio, bajo = [], False
            for k in docs:
                base = res["lotes"][k]["sujetos_con_veredicto"]
                con2 = medir(textos[k], ids, resto)[1]
                movio.append((k, base, len(con2)))
                if len(con2) < base:
                    bajo = True
            marca = "OK   " if bajo else "CIEGO"
            det = " · ".join(f"{kk} {bb}->{dd}" for kk, bb, dd in movio)
            print(f"  {marca} sin `{arma}`: {det}")
            if not bajo:
                malos.append(arma)
        if malos:
            print(f"\nCANARIO FALLA: romper {malos} no mueve la métrica en ningún lote. Ese brazo "
                  f"NO tiene control: su rotura es indistinguible de su funcionamiento.",
                  file=sys.stderr)
            sys.exit(5)
        print(f"\nCANARIO OK: los {len(ARMAS)} brazos tienen control — romper cualquiera se ve.")
        return

    # --- control 4: CANARIO DEL PADRON -----------------------------------------------------------
    # El sexto brazo, el que no tenia canario. Mismo criterio que el canario por brazos —«un brazo
    # cuya rotura no mueve nada es un brazo sin control»— aplicado al padron, que es justo donde no
    # se habia aplicado.
    #
    # Y OJO CON LA FORMA DE ESTE CONTROL, porque la primera version que escribi era tautologica:
    # «con padron vacio la cifra tiene que dar 0» se computa como `set(medidos) & set([])`, que es 0
    # por definicion de interseccion, no por el comportamiento del codigo. Habria salido verde sobre
    # el padron inerte que este commit arregla. Un control que no puede fallar no es un control, y el
    # unico modo de saberlo es preguntarle «¿que tendria que pasar para que esto diera rojo?».
    #
    # El control que SI discrimina rompe el padron de a un id: se le saca uno que este doc mide, y la
    # cifra tiene que bajar EXACTAMENTE 1. Si no se mueve, `ids` volvio a ser decorado.
    for k in docs:
        base = res["lotes"][k]["ids_del_criterio_con_veredicto"]
        if base == 0:
            print(f"CANARIO DEL PADRON FALLA en {k}: 0 ids del criterio con veredicto. O el doc no "
                  f"mide nada del criterio, o el cruce con el padron se rompio. Sin un >0 aca, "
                  f"romper el padron no puede mover nada y el canario no probaria nada.",
                  file=sys.stderr)
            sys.exit(7)
        victima = res["lotes"][k]["ids_del_criterio_con_veredicto_lista"][0]
        recortado = [i for i in ids if i != victima]
        con2 = medir(textos[k], recortado)[1]
        baja = len(ids_del_criterio(con2, recortado))
        if baja != base - 1:
            print(f"CANARIO DEL PADRON FALLA en {k}: saque `{victima}` del padron y la cifra fue "
                  f"{base} -> {baja} (esperaba {base - 1}). El padron no participa de la cuenta: es "
                  f"el defecto inerte de vuelta.", file=sys.stderr)
            sys.exit(7)

    if "--json" in sys.argv:
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    print(f"CONTROL POSITIVO OK: lote A={a}, lote B={b} (ninguno en 0 -> el patrón matchea)\n")
    for k, d in res["lotes"].items():
        f = d["archivo"]
        print(f"=== {k} ===")
        print(f"  archivo   {f['path']}")
        print(f"  versión   sha256:{f['sha256_12']} · {f['bytes']} bytes · mtime {f['mtime']}")
        print(f"  UNIDAD PRIMARIA «mediciones (id+camino, §1) con veredicto legible»: "
              f"{d['sujetos_con_veredicto']} de {d['mediciones_declaradas']} declaradas")
        if d["sujetos_nombrados_sin_veredicto"]:
            print(f"    ⚠️  HUECOS CON NOMBRE ({len(d['sujetos_nombrados_sin_veredicto'])} "
                  f"mediciones declaradas sin veredicto legible):")
            for s in d["sujetos_nombrados_sin_veredicto"]:
                print(f"         {s}")
        if d["veredictos_huerfanos"]:
            print(f"    ⚠️  {d['veredictos_huerfanos']} veredicto(s) HUÉRFANO(S): leídos pero sin "
                  f"sujeto declarado arriba — no se atribuyen a ninguna medición")
        print(f"  unidad «veredictos en rol de veredicto»: {d['veredictos_total']}"
              f"  (corregidos/reclasificados: {d['corregidos']})")
        print(f"    de los cuales NO son una comparación: {d['no_comparacion']}")
        for v, n in d["por_clase"].items():
            marca = "  <- no es comparación" if v in NO_COMPARACION else ""
            if v == "VOCABULARIO_DESCONOCIDO":
                marca = "  <- FUERA del vocabulario cerrado: revisar a mano"
            print(f"      {n:3}  {v}{marca}")
        print(f"    por forma: {d['por_forma']}")
        print()
    tnc = res["lotes"]["lote_A"]["no_comparacion"] + res["lotes"]["lote_B"]["no_comparacion"]
    print(f"HUECOS de fila (sólo en tablas que DECLARAN columna de veredicto): "
          f"{sum(1 for L in res['lotes'].values() for h in L['detalle'] if h['forma'] == 'hueco')}")
    print(f"TOTAL, unidad «veredictos»: {a + b}  ·  de los cuales no-comparación: {tnc}")
    print("⚠️  Esa cifra es en VEREDICTOS. En «mediciones» (id+camino) es menor: una medición")
    print("   partida por dimensión emite dos veredictos. Nunca citar el número sin la unidad.")
    print("⚠️  Y el numerador que manda es el de SUJETOS: contar veredictos sólo encuentra los que")
    print("   este lector ya sabe parsear (auditoría 2026-09-28, 8 hallazgos).")


if __name__ == "__main__":
    main()
