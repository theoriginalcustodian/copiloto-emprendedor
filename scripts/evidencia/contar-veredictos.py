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

# ── C3-15: QUE DOCUMENTOS SE MIDEN ──────────────────────────────────────────────────────────────
# Hasta el 2026-09-29 esto era `docs = {"lote_A": ubicar("lote-A"), "lote_B": ubicar("lote-B")}`:
# DOS documentos fijos, elegidos a mano. Medido con el glob: hay **22** documentos del buzon que
# producen al menos un id del criterio con veredicto. El contador miraba 2 de 22 y **no lo decia** —
# la cifra «34 de 54» era real para esos dos y se leia como si fuera del corpus.
#
# Lo que el glob NO puede decidir solo es el ROL: si el documento MIDE un sujeto o lo CITA. Medido:
# el `dictamen` del 28/09 produce 12 ids con veredicto y no mide ninguno —dictamina sobre mediciones
# ajenas—, y su estructura (12 ids / 14 sitios) es indistinguible de una medicion real. La relacion
# entre cifras tampoco alcanza. Eso no es falta de ingenio del parser: **el formato no codifica el
# rol**, y ningun parser recupera lo que el documento no escribio.
#
# Asi que el descubrimiento es automatico y la CLASIFICACION es declarada, con ratchet en las dos
# direcciones: un candidato sin clasificar ROMPE el gate (exit 8) en vez de sumarse o descartarse en
# silencio. El instrumento no puede volver a ignorar un documento callado.
#
# 🔴 La clave es el BASENAME, no la ruta. El estado de un mensaje ES su ubicacion (`abierto/` ->
# `en-curso/` -> `cerrado/<fecha>/`), asi que una clave por ruta romperia este gate cada vez que el
# janitor archiva — un falso rojo diario, que es como se desarma un guard.
MEDICIONES_DECLARADAS = {
    # BL-Q3 v2 — los dos lotes que este script ya miraba
    "2026-09-28_cierre_frontend1-a-planificacion_BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md",
    "2026-09-28_cierre_frontend2-a-planificacion_BL-Q3-v2-lote-B-11-de-11-completo.md",
    # BL-Q3 v2 — los que quedaban afuera
    "2026-09-28_cierre_frontend1-a-planificacion_BL-Q3-v2-mis-4-ids-completos-con-superficie-y-dimension.md",
    "2026-09-28_dato_frontend1-a-planificacion_BL-Q3-v2-re-medicion-card-card-cobro-card-presu-factura.md",
    "2026-09-28_dato_frontend1-a-planificacion_BL-Q3-v2-card-presu-cerrado-mas-2-hallazgos.md",
    # B1 / poblacion C — 29/09 (el frente que el `docs` fijo no podia ver)
    "2026-09-29_cierre_frontend1-a-planificacion_B1-13-ids-superficie-y-dimension.md",
    "2026-09-29_cierre_frontend1-a-planificacion_poblacion-C-mobile-5-ids-y-correccion-de-mapeo.md",
    "2026-09-29_cierre_frontend2-a-planificacion_C3-poblacion-C-8-de-9-ids-web-medidos.md",
    # matrices del 22/09 — la mas grande del corpus (22 ids) y nunca se habia contado
    "2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md",
    "2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2.md",
    "2026-09-22_dato_frontend2-a-planificacion_matriz-web-re-medida.md",
    "2026-09-22_dato_frontend2-a-planificacion_BL-Q3-web-barrido-pwa-vs-prototipo.md",
    # auditoria midiendo (no dictaminando)
    "2026-09-23_cierre_auditoria-a-planificacion_BLOQUE-A-6-de-54-y-que-son-realmente-las-29-filas.md",
    "2026-09-29_cierre_auditoria-a-planificacion_poblacion-A-medida-y-el-criterio-3-NO-TIENE-referencia-de-escritorio.md",
    "2026-09-21_hallazgo_auditoria-a-planificacion_delta-516-del-prototipo-51-entradas-3-pantallas-nuevas-medidas-y-una-contradiccion-para-martin.md",
    "2026-09-21_dato_planificacion-a-frontend1_filas-nuevas-volver-e-ingresar-mobile.md",
}

# Candidatos que el parser encuentra y que NO son mediciones. El motivo es obligatorio: sin el, la
# lista es indistinguible de una exclusion por conveniencia — y la exclusion sin motivo es como se
# hace desaparecer un dato incomodo sin que nadie lo note.
NO_SON_MEDICION = {
    "2026-09-29_cierre_auditoria-a-planificacion_remedicion-50-de-54-confirmada-y-tu-control-a-premia-al-vector-de-ataque.md":
        "Razona SOBRE el instrumento: cita veredictos y cifras de otros documentos para arbitrar el contador. No compara ninguna pantalla contra el prototipo y ningun id trae superficie, dimension ni `medido_contra` propio. Motivo escrito por auditoria, que se nego a auto-clasificarse.",
    "2026-09-28_dictamen_auditoria-a-planificacion_el-agregado-NO-alcanza-y-faltan-4-acciones-no-remedir.md":
        "DICTAMEN: cita 12 sujetos con veredicto para dictaminar SOBRE mediciones ajenas. Es el "
        "fixture negativo mas grande del corpus — sumarlo inflaria la cifra en 12 y se veria como "
        "progreso, que es exactamente el riesgo de descubrir documentos por glob.",
    "2026-09-28_dato_frontend1-a-planificacion_cierre-A-paso1-lista-de-filas-invalidadas.md":
        "CRUCE de invalidacion: nombra 15 sujetos y su columna «resultado» dice «fuera del cruce», "
        "no un veredicto. 1 id con veredicto contra 15 sitios.",
    "2026-09-28_cierre_auditoria-a-planificacion_frente1-el-brazo-tabla-es-invisible-y-19-de-20-huecos-son-inventados.md":
        "Documento SOBRE el instrumento: cita ids como ejemplos de un defecto del parser.",
    "2026-09-29_dato_frontend1-a-frontend2_ingresar-volver-ya-medidos-en-B1-no-los-remidas.md":
        "Aviso de NO re-medir: referencia mediciones que viven en el B1. Sumarlo seria DOBLE CONTEO "
        "de los mismos tres sujetos.",
    "2026-09-07_hallazgo_frontend2-a-frontend_paleta-de-torta-sin-token-y-falso-positivo-del-gate-de-hex.md":
        "Otro frente (gate de hex / tokens de color). Los ids que matchean son homonimos, no sujetos "
        "del criterio 3.",
    "2026-09-28_pedido_planificacion-a-frontend1_el-12-era-tuyo-y-3-de-los-interrogantes-ya-tienen-respuesta.md":
        "Es un `pedido_`: asigna trabajo citando un sujeto. Un pedido no mide.",
}

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


# 🔴 DOS discriminantes ESTRUCTURALES de rol fallaron, y el segundo lo medi antes de embarcarlo.
#
# (1) El mio: «un id sostenido por un solo documento es sospechoso». Auditoria lo rompio sin encontrar
#     un id falso — demostro que **premia al vector de ataque**. Un documento que cita mucho corrobora
#     a todos los demas, asi que la propiedad que lo delata es la que lo aprueba. (Y mi cifra estaba
#     mal: reporte 0 ids de un solo documento; son 20 de los 50, con `apar`/`caida`/`soporte` entre
#     los nuevos. Un control que absuelve y que ademas conto mal.)
#
# (2) El de auditoria, en reemplazo: «un documento que cubre >80% del padron es normativo». Medido
#     antes de escribirlo, sobre el corpus real:
#
#         techo de MENCIONES de una medicion  : 29/54 (53%)
#         techo de MENCIONES de un descartado : 29/54 (53%)   <- empate literal
#         techo de VEREDICTOS de una medicion : 22/54
#         techo de VEREDICTOS de un descartado: 12/54          <- las mediciones estan ARRIBA
#
#     No separa en ninguna de las dos unidades. Un gate al 80% **nunca dispararia**: un instrumento
#     que no mira es peor que ninguno, porque entrega la garantia que no tiene. No se embarco.
#
# La conclusion no es «falta el discriminante bueno»: es que **el formato no codifica el rol**, y ya
# fallo desde los dos lados. Lo que protege es (i) la clasificacion DECLARADA con exit 8 y (ii) el
# VOCABULARIO CERRADO, que neutraliza a un analitico aunque este mal clasificado — `BLOQUE-A` esta
# declarado medicion, es analitico, y aporta 0 ids cerrados igual.
#
# Lo que la medicion SI dio es un discriminante que **dispara hoy**, abajo.

# Una medicion declarada que aporta CERO ids con veredicto del vocabulario cerrado esta declarada para
# medir y no mide nada legible. No es un umbral calibrado: es la aritmetica del rol. `sin_clasificar`
# caza al NO clasificado; esto caza al MAL clasificado, que es el unico camino por el que un analitico
# entra al corpus como medicion.
#
# Los 4 de hoy son inocuos para la cifra (el vocabulario cerrado ya los neutraliza), pero su
# clasificacion es FALSA y envenena el corpus del que lo lea manana. Se declaran con motivo, no se
# silencian con un umbral.
MEDICION_SIN_VEREDICTO_CERRADO_JUSTIFICADA = {
    "2026-09-23_cierre_auditoria-a-planificacion_BLOQUE-A-6-de-54-y-que-son-realmente-las-29-filas.md":
        "Analitico, no medicion: auditoria lo declara «misma clase que mi dictamen». Sus 6 veredictos "
        "son vocabulario de triage (CONFIRMADO/REQUIERE_TRIAGE), no del criterio 3. Queda declarado "
        "aca en vez de moverse a NO_SON_MEDICION porque el piso del ratchet lo cuenta como medicion "
        "desde el 23/09 y moverlo sin que auditoria lo confirme romperia `perdidos`. [POR VERIFICAR]",
    "2026-09-29_cierre_auditoria-a-planificacion_poblacion-A-medida-y-el-criterio-3-NO-TIENE-referencia-de-escritorio.md":
        "Mide poblacion A, pero sus veredictos usan vocabulario de triage; 0 cerrados. Los ids que "
        "aporta ya estan medidos en otros documentos, asi que no mueve la cifra. [POR VERIFICAR]",
    "2026-09-21_dato_planificacion-a-frontend1_filas-nuevas-volver-e-ingresar-mobile.md":
        "Es mio y es un ENCARGO, no una medicion: nombra 3 ids para que FE1 los mida. Aporta 0 "
        "cerrados, que es lo correcto. Deberia moverse a NO_SON_MEDICION en el proximo barrido.",
    "2026-09-21_hallazgo_auditoria-a-planificacion_delta-516-del-prototipo-51-entradas-3-pantallas-nuevas-medidas-y-una-contradiccion-para-martin.md":
        "Hallazgo sobre el PADRON (51 vs 54 entradas del prototipo), no sobre pantallas medidas. "
        "Auditoria verifico que aporta 0 cerrados y 0 exclusivos.",
}


def descubrir_documentos(ids):
    """Descubre por glob los documentos con veredictos y exige que cada uno este CLASIFICADO.

    El parser es el filtro de CANDIDATOS (>=1 id del criterio con veredicto); la clasificacion de ROL
    es declarada. Ratchet en las dos direcciones, igual que `control_de_cobertura`:

      · candidato sin clasificar            -> exit 8 (el instrumento no lo ignora en silencio)
      · declarado como medicion que ya no aparece -> exit 8 (el piso quedo viejo: se archivo, se
        renombro, o el parser dejo de verlo — las tres hay que verlas)

    Devuelve (docs, descartados) con docs = {basename: Path} de las mediciones vigentes.
    """
    candidatos, descartados, cobertura, cerrados_por_doc = {}, {}, {}, {}
    for base in ("abierto", "en-curso", "cerrado"):
        raiz = COORD / base
        if not raiz.exists():
            continue
        for p in sorted(raiz.rglob("*.md")):
            if ".escalador-estado" in str(p):
                continue
            try:
                txt = io.open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue          # nombre imposible en Windows (MAX_PATH): no es un dato perdido,
                                  # es un archivo que el filesystem no entrega. Ver el control abajo.
            con = medir(txt, ids)[1]
            if ids_del_criterio(con, ids):
                # Se guarda para TODOS los candidatos, medidos y descartados: la cobertura de los
                # descartados es la evidencia de que el discriminante separa, y sin ella el gate seria
                # un umbral sin control positivo.
                cobertura[p.name] = len(ids_del_criterio(con, ids))
                cerrados_por_doc[p.name] = len(ids_del_criterio_cerrados(con, ids))
                if p.name in NO_SON_MEDICION:
                    descartados[p.name] = NO_SON_MEDICION[p.name]
                else:
                    candidatos[p.name] = p

    sin_clasificar = sorted(n for n in candidatos if n not in MEDICIONES_DECLARADAS)
    if sin_clasificar:
        print(f"DOCUMENTOS: SIN CLASIFICAR — {len(sin_clasificar)} documento(s) producen veredictos "
              f"del criterio y no estan ni en MEDICIONES_DECLARADAS ni en NO_SON_MEDICION:",
              file=sys.stderr)
        for n in sin_clasificar:
            print(f"  · {n}", file=sys.stderr)
        print("Clasificalo: si MIDE, va a MEDICIONES_DECLARADAS; si CITA o dictamina, va a "
              "NO_SON_MEDICION **con el motivo**. Sumarlo sin mirar infla la cifra y se ve como "
              "progreso; descartarlo sin mirar la baja y se ve como rigor.", file=sys.stderr)
        sys.exit(8)

    perdidos = sorted(MEDICIONES_DECLARADAS - set(candidatos))
    if perdidos:
        print(f"DOCUMENTOS: EL PISO QUEDO VIEJO — {len(perdidos)} declarado(s) como medicion que el "
              f"glob ya no encuentra con veredictos: {perdidos}. Se renombro, se borro, o el parser "
              f"dejo de verlo. Un ratchet que solo aprieta hacia arriba certifica un corpus que ya "
              f"no existe.", file=sys.stderr)
        sys.exit(8)

    # 🔴 EL GATE QUE FALTABA: `sin_clasificar` caza al NO clasificado; esto caza al MAL clasificado,
    # que es el unico camino por el que un documento analitico entra al corpus como medicion.
    mudos = sorted(n for n in candidatos
                   if cerrados_por_doc.get(n, 0) == 0
                   and n not in MEDICION_SIN_VEREDICTO_CERRADO_JUSTIFICADA)
    if mudos:
        print(f"DOCUMENTOS: MEDICION QUE NO MIDE — {len(mudos)} documento(s) declarado(s) como "
              f"MEDICION aportan CERO ids con veredicto del vocabulario cerrado:", file=sys.stderr)
        for n in mudos:
            print(f"  · {n}  ({cobertura.get(n, 0)} id(s) con algo en rol de veredicto, 0 "
                  f"interpretable(s))", file=sys.stderr)
        print("Declarado para medir y no mide nada legible: o es analitico mal clasificado (va a "
              "NO_SON_MEDICION con el motivo), o usa vocabulario viejo que hay que mapear, o el "
              "parser dejo de leer su forma. Las tres hay que verlas. Si es legitimo y no aporta, "
              "va a MEDICION_SIN_VEREDICTO_CERRADO_JUSTIFICADA con el motivo.", file=sys.stderr)
        sys.exit(9)

    if not docs_control(candidatos):
        sys.exit(8)
    return candidatos, descartados, cobertura


def docs_control(candidatos):
    """CONTROL POSITIVO del descubrimiento: los dos lotes que el `docs` fijo miraba TIENEN que estar.

    Sin esto, un glob que no matchea nada (ruta mal armada, buzon movido, permisos) devuelve 0
    candidatos, pasa los dos ratchets —0 sin clasificar y 0 perdidos si la lista estuviera vacia— y
    reporta «0 de 54» como si fuera el dato. Es el mismo vacio-que-no-es-hallazgo de siempre: un 0 del
    instrumento leido como un 0 del corpus.
    """
    for patron in ("lote-A", "lote-B"):
        if not any(patron in n for n in candidatos):
            print(f"CONTROL DEL DESCUBRIMIENTO FALLA: ningun candidato contiene «{patron}». El glob "
                  f"no esta encontrando los documentos que el `docs` fijo si encontraba: un 0 aca es "
                  f"del instrumento, no del corpus.", file=sys.stderr)
            return False
    return True


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


def ids_del_criterio_cerrados(con, ids):
    """Los ids del padron con al menos un veredicto DEL VOCABULARIO CERRADO.

    Es la cifra que manda, y la separacion no es cosmetica. `ids_del_criterio` cuenta los ids que
    tienen algo en ROL de veredicto; esta cuenta los que tienen algo INTERPRETABLE. Medido el
    2026-09-29, al descubrir el corpus: 4 documentos aportaban 17 ids con veredicto donde el 100% de
    los veredictos era `VOCABULARIO_DESCONOCIDO` — el parser vio la posicion, no el contenido.

    Por que se reportan las DOS y no se descarta el desconocido: un token fuera del vocabulario puede
    ser un veredicto legitimo con palabra vieja (`DIFERENCIA`, retirada el 28/09), o puede ser una
    palabra en mayuscula que cayo en la posicion. Descartarlo perderia mediciones reales; sumarlo sin
    marcarlo afirma que se entendio algo que no se entendio. Las dos cifras, y la cerrada es la que
    se cita.
    """
    buenos = set()
    for clave, vs in con.items():
        if any(v in VOCABULARIO for v in vs):
            buenos.add(clave.split("·")[0])
    return sorted(buenos & set(ids))


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
    docs, descartados, cobertura = descubrir_documentos(ids)

    res = {"medido_en": time.strftime("%Y-%m-%d %H:%M:%S"), "universo_de_sujetos": ids,
           "cobertura_del_instrumento": {
               "fuente_del_universo": str(SPEC.name),
               "ids_del_criterio": len(ids),
               "ids_que_la_matriz_captura": len(ids) - len(ciegos),
               "ciegos": ciegos,
               "retirados_de_la_spec_que_la_matriz_conserva": retirados,
           },
           # C3-18 — CADA CIFRA DECLARA SU UNIDAD. Auditoria leyo `veredictos_total` (21 en el lote B)
           # como sujetos medidos y lo reporto como conteo inflado. No estaba inflado: contaba
           # OCURRENCIAS, y las tres re-menciones de la seccion «Correccion de vocabulario» son
           # ocurrencias reales —dicen que un veredicto cambio, que es un dato— aunque no sean
           # sujetos nuevos. El defecto no era el numero: era que el NOMBRE no decia la unidad, y
           # deduplicar habria borrado informacion para arreglar una etiqueta. Tercera vez en el dia
           # que la unidad rompe una cifra (veredictos != sujetos · archivos != pares · menciones !=
           # sujetos), asi que la unidad deja de ser prosa y pasa al reporte.
           "unidades": {
               "mediciones_declaradas": "claves `id·camino` nombradas en el doc (con veredicto o sin)",
               "sujetos_con_veredicto": "claves `id·camino` CON veredicto — un id en dos caminos son DOS",
               "ids_del_criterio_con_veredicto": "ids UNICOS del padron con algo en ROL de veredicto",
               "ids_del_criterio_con_veredicto_cerrado": "ids UNICOS con veredicto INTERPRETABLE "
                                                         "(vocabulario cerrado) — ES la cifra «N de 54»",
               "ocurrencias_de_veredicto": "veces que aparece un veredicto, re-menciones INCLUIDAS",
               "re_menciones": "ocurrencias - sujetos: el delta que se lee como inflado y no lo es",
               "corpus": "documentos, no mediciones",
           },
           "corpus": {
               "documentos_medidos": len(docs),
               "documentos_descartados": descartados,
               "como_se_descubren": "glob sobre el buzon + clasificacion declarada (C3-15)",
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
            "ids_del_criterio_con_veredicto_cerrado": len(ids_del_criterio_cerrados(con, ids)),
            "ids_del_criterio_con_veredicto_cerrado_lista": ids_del_criterio_cerrados(con, ids),
            "ids_medidos_fuera_del_padron": {k: v for k, v in sorted(fuera.items())},
            "sujetos_nombrados_sin_veredicto": sin,
            "ocurrencias_de_veredicto": len([h for h in hits if h[2] != "hueco"]),
            "re_menciones": len([h for h in hits if h[2] != "hueco"]) - len(con),
            "por_clase": dict(sorted(porClase.items(), key=lambda x: -x[1])),
            "por_forma": dict(sorted(porForma.items(), key=lambda x: -x[1])),
            "corregidos": sum(1 for h in hits if h[3]),
            "no_comparacion": sum(n for v, n in porClase.items() if v in NO_COMPARACION),
            "detalle": [{"linea": n, "veredicto": v, "forma": f, "corregido": c}
                        for n, v, f, c in hits],
        }

    # --- control 1: POSITIVO, con el piso de los dos lotes que ya se medían ----------------------
    # Antes esto leía `lotes["lote_A"]` y `lotes["lote_B"]` por clave fija. Con el descubrimiento
    # (C3-15) la clave es el basename, así que el piso se busca por patrón — y **se sigue exigiendo**:
    # el corpus creció de 2 a 16 documentos, y un control que sólo mirara el agregado pasaría en verde
    # aunque los dos lotes originales dejaran de leerse, compensados por los 14 nuevos. El agregado
    # esconde justo lo que este control existía para ver.
    def _por_patron(pat):
        return [v for k, v in res["lotes"].items() if pat in k]

    for pat, piso in (("lote-A", 15), ("lote-B", 10)):
        halladas = _por_patron(pat)
        n = sum(d["ocurrencias_de_veredicto"] for d in halladas)
        if not halladas or n < piso:
            print(f"CONTROL POSITIVO FALLA: «{pat}» dio {n} ocurrencias en {len(halladas)} doc(s) "
                  f"(esperado >={piso}). El formato cambió o el patrón no matchea. El conteo NO se lee.",
                  file=sys.stderr)
            sys.exit(3)
    a = sum(d["ocurrencias_de_veredicto"] for d in _por_patron("lote-A"))
    b = sum(d["ocurrencias_de_veredicto"] for d in _por_patron("lote-B"))

    # --- control 2: el CANAL DEL SUJETO sigue vivo ----------------------------------------------
    # Es el control que le falta a cualquier conteo por veredictos: si el canal por el que se
    # declara el sujeto se rompe, TODO el resto sigue dando números plausibles. Se exige que cada
    # lote declare mediciones y que la mayoría tenga veredicto legible.
    # 🔴 El umbral `mediciones_declaradas >= 5` era POR DOCUMENTO y estaba calibrado a los dos lotes
    # grandes, los únicos que existían cuando se escribió. Con el corpus descubierto hay documentos
    # legítimos de 2 y 4 mediciones (un `dato_` que cierra un id suelto), así que ese umbral pasó a
    # ser un falso rojo sobre datos buenos — y un guard que grita en el caso normal se desarma solo:
    # el siguiente que lo vea rojo va a subir el número sin mirar. El piso de tamaño se mueve al
    # CORPUS, donde sí significa algo; la condición POR documento queda la que no depende del tamaño.
    total_med = sum(res["lotes"][k]["mediciones_declaradas"] for k in docs)
    if total_med < 40:
        print(f"CONTROL DEL CANAL DE SUJETO FALLA: {total_med} mediciones declaradas en todo el "
              f"corpus ({len(docs)} docs, esperado >=40). Los documentos cambiaron la forma de "
              f"declarar el `id`, o SUJ_HEADING/SUJ_BULLET/SUJ_CELDA se rompieron.", file=sys.stderr)
        sys.exit(4)
    for k in docs:
        d = res["lotes"][k]
        # Ésta sí es por documento y no tiene umbral arbitrario: declarar mediciones y no atribuir
        # NINGÚN veredicto es atribución rota a cualquier escala, con 2 mediciones o con 200.
        if d["mediciones_declaradas"] and d["sujetos_con_veredicto"] == 0:
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
        print(f"  unidad «OCURRENCIAS de veredicto» (re-menciones incluidas): "
              f"{d['ocurrencias_de_veredicto']}  (corregidos/reclasificados: {d['corregidos']}"
              f" · re-menciones: {d['re_menciones']})")
        print(f"    de los cuales NO son una comparación: {d['no_comparacion']}")
        for v, n in d["por_clase"].items():
            marca = "  <- no es comparación" if v in NO_COMPARACION else ""
            if v == "VOCABULARIO_DESCONOCIDO":
                marca = "  <- FUERA del vocabulario cerrado: revisar a mano"
            print(f"      {n:3}  {v}{marca}")
        print(f"    por forma: {d['por_forma']}")
        print()
    tnc = sum(d["no_comparacion"] for d in res["lotes"].values())
    print(f"HUECOS de fila (sólo en tablas que DECLARAN columna de veredicto): "
          f"{sum(1 for L in res['lotes'].values() for h in L['detalle'] if h['forma'] == 'hueco')}")
    # La cifra del criterio sobre TODO el corpus, que es lo que nadie podía citar: la unión de ids
    # únicos. No la suma de los «N de 54» de cada doc — eso contaría dos veces cualquier id medido en
    # dos documentos, y hay varios (`ingresar`/`volver` viven en el B1 y se re-mencionan en otro).
    union = sorted({i for d in res["lotes"].values()
                    for i in d["ids_del_criterio_con_veredicto_lista"]})
    ocurrencias = sum(d["ocurrencias_de_veredicto"] for d in res["lotes"].values())
    print(f"CORPUS: {len(res['lotes'])} documentos medidos · {len(descartados)} descartados con motivo")
    # La cobertura se REPORTA y no se usa como gate: medida sobre el corpus real, el techo de una
    # medicion y el de un descartado EMPATAN (29/54 los dos), asi que ningun umbral los separa. Queda
    # impresa para que el proximo que proponga ese discriminante vea el empate antes de escribirlo,
    # en vez de re-derivarlo — es la unica forma de que un callejon sin salida no se recorra dos veces.
    _med = sorted(((cobertura[n], n) for n in docs if n in cobertura), reverse=True)
    _des = sorted(((cobertura[n], n) for n in descartados if n in cobertura), reverse=True)
    if _med and _des:
        print(f"   forma del corpus (NO es un gate: no separa): la medicion que mas ids con veredicto "
              f"aporta llega a {_med[0][0]}/{len(ids)}, el descartado que mas cita a "
              f"{_des[0][0]}/{len(ids)} — sin brecha utilizable entre los dos roles")
    cerrada = sorted({i for d in res["lotes"].values()
                      for i in d["ids_del_criterio_con_veredicto_cerrado_lista"]})
    print(f"🎯 CIFRA DEL CRITERIO, unidad «ids únicos de los 54 con veredicto DEL VOCABULARIO "
          f"CERRADO»: {len(cerrada)} de {len(ids)}  ({100 * len(cerrada) // len(ids)}%)  <- la que se cita")
    print(f"   con algo en ROL de veredicto pero fuera del vocabulario: {len(union)} de {len(ids)}")
    if sorted(set(union) - set(cerrada)):
        print(f"   ⚠️  {len(set(union) - set(cerrada))} id(s) cuentan SÓLO por un veredicto no "
              f"interpretable: {sorted(set(union) - set(cerrada))}")
        print(f"       (palabra vieja como `DIFERENCIA`, o una mayúscula que cayó en la posición —")
        print(f"        hasta que alguien las mapee, esos ids NO tienen veredicto legible)")
    print(f"   sin nada en rol de veredicto en ningún documento: "
          f"{len([i for i in ids if i not in union])}")
    print(f"TOTAL, unidad «ocurrencias de veredicto»: {ocurrencias}  ·  de las cuales "
          f"no-comparación: {tnc}  ·  (los dos lotes originales aportan {a + b})")
    print("⚠️  Esa cifra es en VEREDICTOS. En «mediciones» (id+camino) es menor: una medición")
    print("   partida por dimensión emite dos veredictos. Nunca citar el número sin la unidad.")
    print("⚠️  Y el numerador que manda es el de SUJETOS: contar veredictos sólo encuentra los que")
    print("   este lector ya sabe parsear (auditoría 2026-09-28, 8 hallazgos).")


if __name__ == "__main__":
    main()
