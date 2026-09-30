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
# El buzon NO esta versionado (`coordinacion/` esta gitignoreada), asi que esta ruta no
# existe en CI ni en un clon limpio. Parametrizable para que el test pueda apuntarla a un
# fixture y ejercitar la CEGUERA a proposito: sin eso, el unico control de ceguera posible
# es no tener corpus, que es justo el caso que no se puede provocar en la maquina que lo tiene.
COORD = Path(os.environ.get("COPILOTO_COORD",
                            "C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion"))
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
    # ── 2026-09-29: los 3 que este PR hizo VISIBLES ─────────────────────────────────────
    # No son documentos nuevos: ya producian veredictos antes. Eran invisibles porque el
    # parser no leia sus formas (tabla de 2 columnas, celdas sin backtick), asi que no
    # llegaban ni a candidatos y el guard de `sin clasificar` tampoco los veia.
    #
    # Barrido de las 35 pantallas. MIDE, y mide con todo: prod real con el bundle fijado
    # (`assets/index-w80j8z6l.js`, confirmado al cierre), `main` en `ed4e31c0`, prototipo al
    # mismo viewport, usuario canonico, capturas por id. 22 filas COHERENTE.
    # ⚠️ Auditoria lo da por RETIRADO (C3-25). Buscado en TODO el buzon: el retiro existe
    # UNICAMENTE en su `cierre_` del 29/09 — el documento no lo dice, ningun contrato lo dice,
    # y `RETIRADOS_DECLARADOS` es de ids de pantalla, no de documentos. Asi que se clasifica
    # por lo que el documento AFIRMA DE SI MISMO, que es una medicion. Si esta superado, el
    # retiro tiene que estar escrito donde el instrumento pueda leerlo: eso es la fila E del
    # eje (`SUPERSEDE:`/`RETIRADO_POR:`), dueño planificacion, y hasta entonces excluirlo
    # seria aplicar un retiro que solo vive en la memoria de una sesion.
    "2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md",
    # Filas 3-6 de la matriz web. MIDE: 7 veredictos (`card`, `card-cobro`, `card-presu`,
    # `card-cliente`, `pres-hitl`, `pres-ciclo`, `preg`) sobre prod real con purga de SW.
    # Es la mitad de `matriz-web-re-medida-v2` que vivia en una tabla de DOS columnas, y por
    # eso daba 0 ids mientras su gemela de 3 columnas daba 9. Mismos ids, mismos veredictos,
    # distinto ancho de tabla: el fixture diferencial de la fila B, ya en el corpus.
    "2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2-filas-3-a-6.md",
    "2026-09-28_cierre_auditoria-a-planificacion_lado-proto-de-factura-y-comousar-medido.md",
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
    "2026-09-29_cierre_auditoria-a-planificacion_poblacion-A-medida-y-el-criterio-3-NO-TIENE-referencia-de-escritorio.md",
    # `(home)`: la ULTIMA fila del criterio 3, medida por FE2 el 2026-09-30. Nadie la habia medido
    # nunca, y no por olvido: el id era ILEGIBLE para este parser (ver SUJ_CELDA_RARA), asi que su
    # veredicto quedaba huerfano y la cifra no podia pasar de 53 de 54 por mucho que se midiera.
    # Este documento estaba en el buzon ANTES de que el fix existiera; lo que lo hizo aparecer no
    # fue trabajo nuevo, fue el instrumento dejando de ser ciego.
    "2026-09-30_cierre_frontend2-a-planificacion_C3-home-medida-DESVIO-mi-dia-vs-tablero.md",
}

# Candidatos que el parser encuentra y que NO son mediciones. El motivo es obligatorio: sin el, la
# lista es indistinguible de una exclusion por conveniencia — y la exclusion sin motivo es como se
# hace desaparecer un dato incomodo sin que nadie lo note.
NO_SON_MEDICION = {
    # 2026-09-29 — visible por primera vez con el fix de formas de este PR.
    # DICTAMINA sobre mediciones ajenas: responde el `dato_` de frontend1 sobre los 34 png,
    # le da la razon en 6 de 7 y declara `bi` falso positivo del rail. No mide ninguna
    # pantalla propia — cita las de frontend1 para juzgarlas.
    # ⚠️ MOTIVO REDACTADO POR PLANIFICACION, NO POR SU AUTOR (auditoria). La regla es que lo
    # declare quien escribio el documento; se redacta aca porque el guard bloquea el PR que
    # lo hizo visible, y esperar el motivo para desbloquear el gate seria dejar rojo el
    # tronco de las cuatro sesiones. Sujeto a correccion del autor.
    "2026-09-29_cierre_auditoria-a-frontend1_si-a-la-marca-de-ancho-y-bi-es-falso-positivo-del-rail.md":
        "CIERRE de auditoria a frontend1: dictamina sobre la medicion de los 34 png ajena "
        "(6 de 7 se sostienen, `bi` es falso positivo del rail). EXAMINA una captura ajena "
        "para explicar el falso positivo, sin comparar contra el prototipo ni emitir "
        "veredicto de fidelidad propio. [CONFIRMADO por el autor (auditoria) 2026-09-29: "
        "verifico las tres afirmaciones contra el documento -- «6 de 7» literal en :62, "
        "`bi`/Rail en :82-91, y no mide pantallas propias]",
    # Clave SIN el titular editorial: este archivo se renombro TRES veces en un dia
    # (`se-cae-8-de-10` -> `-5-de-10` -> `-2-de-10-y-el-falso-verde-esta-en-el-parser`) y la
    # clasificacion anclada al nombre completo quedo apuntando a un archivo inexistente, con lo
    # que el documento real volvio a abortar el parser con exit 8. El sujeto (fecha + emisor +
    # tema) es estable; el titulo es del autor y cambia cuando cambia la cifra.
    "2026-09-29_cierre_auditoria-a-planificacion_HIPOTESIS-MATRIZ-2209":
        "CIERRE de auditoria: cita los 10 ids de la hipotesis con sus veredictos para dictaminar "
        "SOBRE mediciones ajenas. No mide ninguna pantalla. (Motivo redactado por su autor, "
        "auditoria, 2026-09-29: es el unico que puede declararlo.)",
    "2026-09-28_contrato_planificacion-a-todos_BL-Q3-v2-la-unidad-de-medicion-es-id-mas-camino.md":
        "NORMATIVO y es MIO: DEFINE la unidad de medicion y el vocabulario. Su tabla es `| clasificacion | ids |` — taxonomia con conteos, no pantallas medidas. Es el candidato mas peligroso del corpus: un documento que DEFINE el vocabulario contiene todos sus tokens (16 COHERENTE, 7 DESVIO, 11 NO_MEDIBLE), asi que clasificado como medicion inyectaria 28 senales falsas. Lo destapo el gate al arreglarse el parser, no yo.",
    "2026-09-29_cierre_auditoria-a-planificacion_verificabilidad-de-los-38-ninguno-midio-desktop-y-el-contador-es-ciego-a-28.md":
        "Razona SOBRE el instrumento y sobre los documentos, no sobre pantallas: su tabla es `| lote | sha256 | mtime |`. Los veredictos que contiene son citas de los lotes ajenos.",
    "2026-09-23_cierre_auditoria-a-planificacion_BLOQUE-A-6-de-54-y-que-son-realmente-las-29-filas.md":
        "RE-EVALUACION, no medicion: su tabla es `| id | COHERENTE | REQUIERE_TRIAGE -- no se sostiene |`, donde la col2 es el veredicto de FE2 CITADO y la col3 el juicio de auditoria sobre el. Confirmado analitico por auditoria 2026-09-29. Excluido ANTES del fix de `limpiar()` a proposito: con el parser arreglado, esos COHERENTE citados entrarian como mediciones propias suyas.",
    "2026-09-21_hallazgo_auditoria-a-planificacion_delta-516-del-prototipo-51-entradas-3-pantallas-nuevas-medidas-y-una-contradiccion-para-martin.md":
        "Delta de INVENTARIO del prototipo, no de pantallas: su tabla es `| Que | Al 16/09 | Al 21/09 |` y sus «ids» son conteos. Confirmado por contenido (auditoria 2026-09-29). Aporta 0 exclusivos.",
    "2026-09-21_dato_planificacion-a-frontend1_filas-nuevas-volver-e-ingresar-mobile.md":
        "ENCARGO mio a FE1, no medicion: nombra ids para que los midan, con vocabulario propio (AUSENTE/PARCIAL). Verificado que no se pierde nada: `volver`/`ingresar`/`ingresar-error` tienen 3 aportantes cada uno.",
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
    "2026-09-30_contrato_planificacion-a-frontend2_C3-la-ultima-fila-medir-la-home-mi-dia-con-ver-vacio.md":
        "Es MIO y es el `contrato_` que ENCARGA la medicion de `(home)`: cita el sujeto y enumera el "
        "vocabulario cerrado (incluido el retiro de `DIFERENCIA`/`COINCIDE`) para decirle a FE2 con "
        "que palabras escribir. Un contrato que nombra los tokens permitidos los contiene todos: "
        "clasificado como medicion inyectaria las senales que solo estaba citando. La medicion que "
        "encarga es el `cierre_` de FE2, que si esta en MEDICIONES_DECLARADAS -- contar los dos "
        "seria doble conteo del mismo sujeto.",
}

NO_COMPARACION = ("NO_MEDIBLE", "FUERA-DE-REFERENCIA", "NO_REPRODUCIBLE_SIN_EFECTO",
                  "PENDIENTE_DEVICE")
# Vocabulario CERRADO de veredictos (§15.5 del contrato). Un token fuera de esta lista no se cuenta
# como veredicto en silencio: se reporta como VOCABULARIO_DESCONOCIDO. Sin esto,
# `**CORREGIDO — COHERENTE (era DIFERENCIA GRAVE…)**` entraba como si `CORREGIDO` fuera un veredicto
# y ensuciaba `por_clase` — visible y MAL, que es peor que un hueco (auditoría, H-D).
VOCABULARIO = {"COHERENTE", "DESVÍO", "DESVIO", "NO_MEDIBLE", "FUERA-DE-REFERENCIA",
               "NO_REPRODUCIBLE_SIN_EFECTO", "PENDIENTE_DEVICE",
               # 2026-09-29: dos estados que DOS autores usaban en 6 archivos y el vocabulario
               # no cubria, asi que caian en VOCABULARIO_DESCONOCIDO. El costo no era cosmetico:
               # `REQUIERE_TRIAGE` es el estado con el que frontend2 BAJO su propio COHERENTE de
               # `cuenta`/`detalle` el 22/09 -- la correccion existia y el instrumento leia solo
               # el COHERENTE ya superado. Un contador de COHERENTE ciego al token que los
               # corrige fabrica el falso verde que existe para cazar.
               "REQUIERE_TRIAGE", "INCOMPLETO"}
# La grafia se CANONIZA, no se lista dos veces. `DESVÍO`/`DESVIO` estan los dos arriba y por eso
# `INCOMPATIBLES` necesita dos tuplas y un mismo id parece tener dos veredictos distintos: ese
# parche ya se pago. Con el token nuevo la grafia venia partida 3 y 3 entre los dos autores, asi
# que elegir una sola habria perdido las filas del otro.
# ⚠️ DEUDA DECLARADA (planificacion, 2026-09-29): `DESVIO` -> `DESVÍO` NO se canoniza todavia.
# Moverlo cambia `INCOMPATIBLES` y el ratchet de 10 conflictos conocidos, asi que va en un
# cambio propio con su evidencia, no de arrastre en este.
ALIAS_VEREDICTO = {"REQUIRES_TRIAGE": "REQUIERE_TRIAGE"}
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
    # 🔴 Y la DECORACIÓN INICIAL no alfabética — el emoji-semáforo, sobre todo. El brazo `tabla`
    # matchea con `re.match`, que está ANCLADO: `🔴 **DESVÍO**` se limpiaba a `🔴 DESVÍO` y el
    # emoji bloqueaba el ancla, perdiendo la medición sin dar hueco. Medido por auditoría el
    # 2026-09-29: **9 filas** de 199, en documentos de FE1, FE2 y auditoría.
    # Es la MISMA clase que este docstring ya describe («cada patrón fallaba por UN carácter»): el
    # fix de entonces agregó el backtick y el asterisco, y dejó el tercer carácter afuera. Por eso
    # esto no saca "el emoji" sino **todo lo que no sea palabra al inicio**: enumerar decoraciones
    # es lo que garantiza que la cuarta vuelva a pasar.
    s = re.sub(r"^[^\wÁÉÍÓÚÑáéíóúñ]+", "", s)
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
    # VACIO A PROPOSITO, y eso es el resultado, no un pendiente. Las 4 entradas que vivieron aca
    # unas horas eran: 3 documentos analiticos (ya movidos a NO_SON_MEDICION, donde corresponde) y
    # `poblacion-A-medida`, que NO era un rol — mide 3 ids con `DESVIO`, vocabulario cerrado, y su
    # cero venia del bug del emoji en `limpiar()`. Declararla excepcion habria firmado un bug del
    # parser como decision de clasificacion, que es el error que este gate tenia que evitar.
    # Si vuelve a hacer falta una entrada aca, la pregunta primero es si el documento NO MIDE o si
    # NO SE LEE: el exit 10 las separa.
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
    candidatos, descartados, cobertura, cerrados_por_doc, vocab_en_texto = {}, {}, {}, {}, {}
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
                # Tokens del vocabulario presentes en el TEXTO, atribuidos o no: es lo que distingue
                # «no mide» (no hay veredictos) de «no se lee» (hay y el parser no los ve).
                vocab_en_texto[p.name] = sum(
                    len(re.findall(r"(?<![A-ZÁÉÍÓÚÑ_-])"
                                   + re.escape(v)
                                   + r"(?![A-ZÁÉÍÓÚÑ_-])", txt))
                    for v in VOCABULARIO)
                clave = next((k for k in NO_SON_MEDICION
                              if p.name == k or p.name.startswith(k)), None)
                if clave:
                    descartados[p.name] = NO_SON_MEDICION[clave]
                else:
                    candidatos[p.name] = p

    # 🚦 EL ORDEN ES EL ARREGLO. Este control existia y estaba BIEN escrito -- su docstring
    # describe exactamente este fallo -- pero corria al FINAL, despues de los ratchets. Con el
    # corpus ausente (CI, clon limpio, buzon movido) el glob da 0 candidatos, `perdidos` dispara
    # primero y el rojo acusa «EL PISO QUEDO VIEJO -- 14 declarados que el glob ya no encuentra»
    # sobre 14 archivos que existen perfectamente. Medido en CI el 2026-09-29: ese rojo bloqueo un
    # PR y mandaba a buscar renombres inexistentes. Un control de ceguera que corre DESPUES del
    # guard que la ceguera dispara no protege nada: el mensaje elige la causa equivocada.
    # Sale por exit 2, que en todo este script ya significa «no puedo medir», no por exit 8.
    if not (COORD / "abierto").exists() and not (COORD / "cerrado").exists():
        print(f"ABORTA: no veo el buzon en {COORD}. `coordinacion/` no esta versionada, asi que en"
              f" CI o en un clon limpio este corpus no existe -- y un 0 de aca seria del"
              f" instrumento, no del dato. Apuntalo: COPILOTO_COORD=<ruta>.", file=sys.stderr)
        sys.exit(2)
    if not docs_control(candidatos):
        sys.exit(2)

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
    # 🔴 El predicado se PARTE. «0 ids cerrados» era exactamente el sintoma del bug del emoji, asi
    # que el gate acusaba de «no mide» a documentos que median y no se leian — un gate cuyo predicado
    # es el sintoma de un bug abierto convierte el bug en veredicto de rol. Y es la clase que ya
    # esta escrita: dos causas distintas comparten el codigo de salida y el mensaje elige una.
    #   · 0 cerrados Y ningun token del vocabulario en el texto  -> ROL     (exit 9)
    #   · 0 cerrados PERO hay tokens del vocabulario en el texto -> LECTURA (exit 10)
    ilegibles = sorted(n for n in candidatos
                       if cerrados_por_doc.get(n, 0) == 0
                       and vocab_en_texto.get(n, 0) > 0
                       and n not in MEDICION_SIN_VEREDICTO_CERRADO_JUSTIFICADA)
    if ilegibles:
        print(f"DOCUMENTOS: MEDICION QUE NO SE LEE — {len(ilegibles)} documento(s) declarado(s) como "
              f"MEDICION aportan CERO ids cerrados PERO tienen tokens del vocabulario en el texto:",
              file=sys.stderr)
        for n in ilegibles:
            print(f"  · {n}  ({vocab_en_texto[n]} token(s) del vocabulario en el texto, 0 "
                  f"atribuido(s) a un id)", file=sys.stderr)
        print("Esto NO es un rol: es un defecto de LECTURA. El documento escribio veredictos del "
              "vocabulario y el parser no los atribuyo a ningun sujeto. Arreglar el parser, no "
              "reclasificar el documento — reclasificarlo convierte un bug en veredicto de rol.",
              file=sys.stderr)
        sys.exit(10)

    mudos = sorted(n for n in candidatos
                   if cerrados_por_doc.get(n, 0) == 0
                   and vocab_en_texto.get(n, 0) == 0
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


def sello_del_instrumento():
    """El `git hash-object` de ESTE script, para que el JSON diga con que version se midio.

    Lo pidio auditoria (C3-25, fila G) despues de que sus probes corrieran el blob equivocado:
    el mismo path tenia TRES versiones a la vez (su HEAD 493 lineas, su working tree 918, y
    `origin/main` 1239) y `python script.py` corre el archivo del DISCO, que no declara su
    procedencia. Sus hallazgos coincidieron igual, pero por suerte: el diff tocaba el universo,
    no las formas que sus canarios ejercitaban. Un control de denominador no podia cazarlo
    -- el archivo era el correcto, lo que estaba mal era CUAL DE SUS VERSIONES.

    Se computa a mano y no con `git hash-object` a proposito: el script tiene que poder sellarse
    sin git en el PATH y sin estar dentro de un repo.
    """
    b = Path(__file__).read_bytes()
    blob = b"blob " + str(len(b)).encode() + b"\0" + b
    return {
        "path": Path(__file__).name,
        "git_blob": hashlib.sha1(blob).hexdigest(),
        "bytes": len(b),
        "lineas": b.count(b"\n") + 1,
    }


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
    tok = ALIAS_VEREDICTO.get(tok, tok)
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
    if not (linea.strip().startswith("|") and linea.count("|") >= 3):
        return False
    return set(linea.strip().strip("|").replace("|", "").strip()) <= set("-: ")


def fila_de_tabla(linea):
    if not (linea.strip().startswith("|") and linea.count("|") >= 3):
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
    col_veredicto = None        # el índice que la cabecera identifica y que antes se tiraba
    for n, linea in enumerate(lineas, 1):
        if es_separador(linea):
            continue                             # el separador no es fila ni cabecera
        celdas = fila_de_tabla(linea)
        if celdas is None:
            cabecera_mide = True                 # fuera de tabla, el estado no se arrastra
            col_veredicto = None
        elif n < len(lineas) and es_separador(lineas[n]):
            cabecera_mide = "veredicto" in " ".join(celdas).lower()
            # 🔴 La cabecera ya sabía CUÁL es la columna del veredicto y el índice se tiraba, así que
            # el brazo `tabla` tenía que adivinar con `reversed(celdas)` — y cualquier columna a la
            # derecha lo tapaba (6 filas de 199, medidas por auditoría). Guardar el índice es la raíz;
            # invertir el barrido habría sido el parche espejo, y rompe los documentos donde el
            # veredicto SÍ está a la derecha.
            col_veredicto = next((i for i, c in enumerate(celdas)
                                  if "veredicto" in c.lower()), None)
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
        if "tabla" in armas:
            # Orden de preferencia, de la señal más fuerte a la más débil:
            #   1. la celda de la columna que la CABECERA declara como veredicto
            #   2. cualquier celda cuyo token esté en el VOCABULARIO CERRADO
            #   3. la primera celda con forma de veredicto, de derecha a izquierda (el viejo)
            # El paso 2 existe porque un token desconocido (`SIN_REFERENCIA`) no debe ganarle a uno
            # interpretable por estar más a la derecha: eso es lo que rellenaba el hueco con un
            # veredicto falso y enmascaraba al bug del emoji.
            def _tok(cel):
                m2 = re.match(r"\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", limpiar(cel))
                if m2 and m2.group(1) not in ("N/A", "SHA", "ID"):
                    return m2.group(1)
                return None

            elegida = None
            if col_veredicto is not None and col_veredicto < len(celdas):
                t = _tok(celdas[col_veredicto])
                if t:
                    elegida = (t, celdas[col_veredicto])
            if elegida is None:
                for cel in celdas:
                    t = _tok(cel)
                    if t and t in VOCABULARIO:
                        elegida = (t, cel)
                        break
            if elegida is None:
                for cel in reversed(celdas):
                    t = _tok(cel)
                    if t:
                        elegida = (t, cel)
                        break
            if elegida is not None:
                v, corr = normalizar(elegida[0], limpiar(elegida[1]))
                hits.append((n, v, "tabla", corr))
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
# CUALQUIER heading, sea sujeto o no: es lo que CIERRA el alcance de una declaracion `heading`.
# `SUJ_HEADING` no sirve para esto — solo matchea los que declaran un id del padron, y un
# `## Otra cosa` sin id tiene que cerrar igual.
HEADING_CUALQUIERA = re.compile(r"^(#{1,6})\s")
SUJ_BULLET = re.compile(r"^\s*[-*]+\s+\*\*`?([a-z0-9][a-z0-9\-]{1,30})`?\*\*\s*(.*)$")
SUJ_CELDA = re.compile(r"^\*{0,2}`([a-z0-9][a-z0-9\-]{1,40})`")
# El MISMO sujeto sin backticks. Va en una constante aparte y NO relajando `SUJ_CELDA` porque
# las dos formas no valen lo mismo: el backtick es una DECLARACION explicita del autor y se
# acepta sola, mientras que una primera celda en prosa (`| card (gasto) |`, y tambien `| ok |`
# o `| sujeto |`) solo cuenta si el id esta en el PADRON. Sin esa asimetria, relajar el
# backtick convierte cada cabecera y cada celda de texto en una medicion fantasma con nombre
# inventado.
# Medido (auditoria C3-25, 2026-09-29): el barrido de 35 pantallas tiene 22 filas COHERENTE y
# CERO backticks, asi que era INVISIBLE -- ni medicion ni hueco, y por eso el guard de `sin
# clasificar` tampoco lo veia. Y el detalle que lo dejo vivir: ese documento esta RETIRADO, asi
# que su invisibilidad era el resultado correcto. El guard acertaba por accidente, y una
# medicion vigente escrita igual habria desaparecido sin dar sintoma.
SUJ_CELDA_PELADA = re.compile(r"^\*{0,2}([a-z0-9][a-z0-9\-]{1,40})\b")
# Los DOS de arriba exigen `[a-z0-9]` al inicio, y el padron tiene un id que EL PROPIO INSTRUMENTO
# fabrica y que empieza con parentesis: `(home)`, que `criterio3-padron.sh:59` genera normalizando
# la celda `*(vacio)* Mi dia` del SPEC. Medido el 2026-09-30 con control positivo (`factura` se
# lee): `(home)` salia ILEGIBLE en las tres formas y su veredicto quedaba HUERFANO, asi que la
# ultima fila del criterio 3 no podia cerrarse NUNCA -- por bien que alguien midiera la home, la
# cifra se quedaba en 53 de 54. El universo y el lector no compartian el alfabeto, y el universo lo
# escribe este mismo repo.
#
# Este captura el token DECLARADO sin exigirle forma, y queda condicionado a la pertenencia al
# padron en el call-site. Por que es seguro y no una relajacion: es la MISMA asimetria que ya rige
# arriba -- backtick = declaracion explicita del autor, token pelado = solo si esta en el padron --,
# extendida al caso que el padron fabrico. El padron es EXTERNO y cerrado (54 ids parseados del
# SPEC), asi que esto no puede inventar sujetos: solo reconoce los que ya estaban declarados.
#
# El ancla `^` es lo que separa el rol de SUJETO del de REFERENCIA: `| ver `(home)` mas arriba |`
# menciona el id y NO es una medicion. El rol de la cita se escribe, no se infiere (#721).
SUJ_CELDA_RARA = re.compile(r"^\*{0,2}\s*`([^`]{1,60})`")


def camino_de(cola):
    """El sufijo `— camino A (…)` distingue dos mediciones del mismo id. Sin él, `camino: único`."""
    m = re.search(r"—\s*(camino\s+[^(,]{1,40})", cola or "")
    return m.group(1).strip() if m else ""


def mediciones_de(texto, armas=ARMAS, ids=frozenset()):
    """Devuelve las MEDICIONES (`id`+`camino`, §1) con los veredictos que se le pudieron leer a cada
    una. Una medición sin veredicto legible es un HUECO CON NOMBRE: accionable y con dueño, que es
    exactamente lo que el conteo por veredictos no podía producir."""
    hits = veredictos_de(texto, armas)
    por_linea = {}
    for n, v, f, c in hits:
        if f != "hueco":
            por_linea.setdefault(n, []).append((v, f, c))

    meds, actual, nivel_cierre = [], None, 0
    lineas = texto.splitlines()
    # La fila ANTERIOR a un separador es la cabecera (`es_separador` lo documenta). Saltearla es
    # obligatorio desde que existe `SUJ_CELDA_PELADA`: `| sujeto | veredicto |` matchea `sujeto`
    # y la cabecera entraria como medicion. Antes no hacia falta porque el backtick la excluia
    # sin quererlo -- otro guard que acertaba por accidente.
    cabeceras = {n for n in range(1, len(lineas) + 1)
                 if n < len(lineas) and es_separador(lineas[n])}
    for n, linea in enumerate(lineas, 1):
        if n in cabeceras:
            continue
        celdas = fila_de_tabla(linea)
        nueva = None
        if celdas:
            m = SUJ_CELDA.match(celdas[0])
            sujeto = m.group(1) if m else None
            forma = "celda"
            if sujeto is None:
                mp = SUJ_CELDA_PELADA.match(celdas[0])
                if mp and mp.group(1) in ids:
                    sujeto, forma = mp.group(1), "celda-pelada"
            if sujeto is None:
                # TERCER intento: el id del PADRON con la forma que el padron le dio (ver
                # SUJ_CELDA_RARA). Dos variantes, las dos condicionadas a `ids`:
                #   a) declarado entre backticks, con o sin glosa:  | `(home)` (Mi dia) |
                #   b) la celda entera, pelada de adorno markdown:  | **(home)** |
                # La (a) es la forma que los documentos usan DE VERDAD, y casi se me escapa: la
                # primera version solo hacia (b), el caso (b) del test pasaba, y el verde parcial
                # tapaba que la forma real seguia ilegible. Lo caza el caso con glosa.
                mr = SUJ_CELDA_RARA.match(celdas[0])
                if mr and mr.group(1).strip() in ids:
                    sujeto, forma = mr.group(1).strip(), "celda-padron-bt"
                else:
                    crudo = celdas[0].strip().strip("*").strip().strip("`").strip()
                    if crudo in ids:
                        sujeto, forma = crudo, "celda-padron"
            if sujeto is not None:
                nueva = {"id": sujeto, "camino": "", "linea": n,
                         "forma_decl": forma,
                         "veredictos": []}
                # En una tabla el sujeto y el veredicto viven en la MISMA línea: la medición se
                # cierra acá y no arrastra contexto a la fila siguiente.
                nueva["veredictos"] = [v for v, _, _ in por_linea.get(n, [])]
                meds.append(nueva)
                actual, nivel_cierre = None, 0
                continue
        else:
            # CIERRE DEL ALCANCE. Una `tabla` se cierra sola —sujeto y veredicto viven en la MISMA
            # linea— pero un `heading` no tenia delimitador: `actual` acumulaba TODO lo que seguia
            # hasta el proximo sujeto DECLARADO. Un heading que es el ULTIMO sujeto del documento
            # se quedaba entonces con cada veredicto restante, y eso inventa artefactos en las dos
            # direcciones: le roba el veredicto al vecino (CONTRASTE falso) o no encuentra ninguno
            # (HUECO falso). Medido el 2026-09-30 en `..._B1-13-id...`: el mismo documento aportaba
            # COHERENTE y DESVIO para `esc`, `factura`, `ingresar` y `soporte` — una contradiccion
            # INTERNA, que es imposible si el parser lee bien.
            #
            # El limite es el de markdown, NO un umbral de distancia (un umbral seria una foto del
            # corpus del dia): una seccion termina donde empieza otra de nivel igual o mayor. Un
            # `bullet` vive DENTRO de una seccion, asi que lo cierra cualquier heading.
            mh = HEADING_CUALQUIERA.match(linea)
            if mh and actual is not None and len(mh.group(1)) <= nivel_cierre:
                actual, nivel_cierre = None, 0
            m = SUJ_HEADING.match(linea) or SUJ_BULLET.match(linea)
            if m:
                es_heading = linea.startswith("#")
                actual = {"id": m.group(1), "camino": camino_de(m.group(2)), "linea": n,
                          "forma_decl": "heading" if es_heading else "bullet",
                          "veredictos": []}
                nivel_cierre = (len(linea) - len(linea.lstrip("#"))) if es_heading else 6
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


def contraste_de_veredictos(res):
    """({id: {veredicto: [documentos]}} en conflicto, [ids NO declarados]).

    Separada de `main` porque el ABORT tiene que correr antes de la bifurcación de `--json` y la
    TABLA después: mezclarlas es lo que dejó el gate inerte en el único camino que se usa.
    """
    por_id = {}
    for nombre, d in res["lotes"].items():
        for i, vs in d.get("veredictos_por_id", {}).items():
            for v in vs:
                por_id.setdefault(i, {}).setdefault(v, []).append(nombre)
    conflictos = {}
    # Cada documento con su FECHA, para que el lector pueda ver la SUCESION sin recomputarla.
    # El ratchet de abajo declara dos lecturas posibles -- (a) sucesion legitima, (b)
    # contradiccion -- y dice que no las dirime porque requiere re-medir. Sigue sin dirimirlas:
    # esto NO elige el mas nuevo. Decidir por `mtime` le pondria veredicto a algo que necesita
    # una medicion, y dos veredictos distintos pueden ser de dos superficies distintas y los dos
    # vigentes. Lo que se arregla es que la fecha ESTE a la vista: con `REQUIERE_TRIAGE` ya
    # legible (2026-09-29), el par `cuenta`/`detalle` muestra los tres eslabones en orden
    # -- COHERENTE 22/09, REQUIERE_TRIAGE 22/09 posterior, DESVÍO 28/09 -- y la lectura (a) se
    # lee sola. Antes el eslabon del medio era invisible y el conflicto parecia un desacuerdo.
    for i, mapa in por_id.items():
        # `v1, v2` y no `a, b`: en `main`, `a`/`b` son los conteos de los lotes que se imprimen más
        # abajo («lote A={a}, lote B={b}»). Con el bloque al final daba igual; al subirlo, el
        # desempaquetado los pisaba con dos strings y el reporte mentía la cifra de control.
        for v1, v2 in INCOMPATIBLES:
            if v1 in mapa and v2 in mapa:
                conflictos[i] = mapa
    return conflictos, sorted(set(conflictos) - set(CONFLICTOS_CONOCIDOS))


def contradicciones_internas(conflictos):
    """{id: [documentos que aportan LAS DOS puntas del par incompatible]}.

    El reporte decia «veredictos INCOMPATIBLES entre documentos» para todos, y para algunos era
    literalmente falso: las dos puntas del par salian de UN solo documento, asi que no habia
    discrepancia ENTRE mediciones. Medido el 2026-09-30: de 12 ids en contraste, 3 (`esc`,
    `factura`, `soporte`) venian enteros del mismo cierre, que ademas declara la causa en el
    titulo de cada seccion — «PARTIDO». Es el caso que este modulo ya describia sin separarlo:
    «dos veredictos distintos pueden ser de dos superficies distintas y los dos vigentes».

    Un id partido por dimension emite dos veredictos POR DISENO, y meterlo en la misma cifra que
    una contradiccion real hace incitable el numero: el que lo lee no puede saber cuantos de los
    12 son desacuerdos y cuantos son particiones declaradas. Separar no dirime nada —el interno
    sigue reportandose, porque puede ser tambien un defecto del documento— pero deja de afirmar
    un sujeto que no se midio.

    No se separa por el rotulo «PARTIDO» del titulo: eso ataria el instrumento a una palabra que
    un autor puede no escribir. Se separa por la ESTRUCTURA del dato, que siempre esta.
    """
    interno = {}
    for i, mapa in conflictos.items():
        ambas = set()
        for v1, v2 in INCOMPATIBLES:
            if v1 in mapa and v2 in mapa:
                # INTERSECCION, no union: los documentos que aportan LAS DOS puntas del par.
                # La union no separa nada —- medido: da 0 de 12, porque un id en contraste casi
                # siempre tiene varias fuentes-- y el cero parecia «no hay internos» cuando era
                # «mi criterio mide otra cosa».
                ambas |= set(mapa[v1]) & set(mapa[v2])
        if ambas:
            interno[i] = sorted(ambas)
    return interno


def veredictos_por_id(con, ids):
    """{id del padron: [veredictos CERRADOS, ordenados]}. Solo vocabulario cerrado: un token que el
    parser no interpreta no puede sostener ni un acuerdo ni un conflicto."""
    salida = {}
    for clave, vs in con.items():
        i = clave.split("\u00b7")[0]
        if i not in ids:
            continue
        buenos = sorted({v for v in vs if v in VOCABULARIO})
        if buenos:
            salida.setdefault(i, [])
            salida[i] = sorted(set(salida[i]) | set(buenos))
    return salida


# Los pares de veredictos que NO pueden ser ciertos los dos sobre la misma pantalla contra el mismo
# proto. `NO_MEDIBLE` y `FUERA-DE-REFERENCIA` no entran: no afirman coincidencia ni desvio, dicen que
# la comparacion no se puede hacer — chocar con ellos es una discusion de alcance, no de hecho.
INCOMPATIBLES = (("COHERENTE", "DESVIO"), ("COHERENTE", "DESV\u00cdO"))

# Ratchet de conflictos: los de hoy con su LECTURA; uno nuevo aborta. Un reporte que nadie tiene que
# atender no es un control — es una linea que se scrollea.
# Los 10 conflictos que destapo el contraste en su primera corrida NO son 10 causas: son UNA, y
# declararlos con 10 motivos distintos habria escondido justo eso. Todos tienen la misma forma:
#
#     `matriz-web-re-medida` (FE1, 2026-09-22, superficie WEB)   dice COHERENTE
#     las mediciones del 28-29/09 (lote A, poblacion-C, B1)      dicen DESVIO
#
# Mismo id, mismo camino (`unico` en los dos lados), misma superficie web en varios de ellos. No es
# un desacuerdo puntual: es un documento entero cuyos COHERENTE choca sistematicamente con lo que se
# midio una semana despues.
#
# DOS lecturas posibles y NO las dirimo yo (requiere re-medir, y medir no es de esta sesion):
#   (a) SUCESION legitima: las pantallas cambiaron entre el 22 y el 29, y el veredicto viejo esta
#       superado. Entonces el contraste esta viendo historia, no contradiccion — y lo que falta es
#       que el instrumento sepa que un veredicto puede caducar.
#   (b) CONTAMINACION de regimen: la matriz del 22/09 se midio en un ancho donde el prototipo NO
#       refluye (`prototipo/index.html:63` lo dibuja como telefono de 390px), asi que comparo el
#       layout de escritorio de la app contra el proto mobile enmarcado. Es el mismo defecto que ya
#       contamino 11 veredictos (C3-10), apareciendo ahora desde el lado de los COHERENTE.
#
# La (b) es la que importa: un DESVIO falso cuesta una recaptura y se descubre; un COHERENTE falso
# **desactiva trabajo** y no deja rastro. Si la matriz del 22/09 esta contaminada, hay 10 pantallas
# marcadas «no hay nada que hacer» que si lo tienen.
#
# DUENO: auditoria (dirimir) + FE1 (su documento). TEST QUE FALSA LA (b): re-medir uno de los 10 a
# 390px contra `54fac3ea`; si sale DESVIO, la matriz del 22/09 esta contaminada y sus COHERENTE se
# retiran en bloque.
#
# 🔓 La cifra NO depende de como se resuelva: un id EN CONFLICTO tiene, por definicion, veredicto en
# >=2 documentos, asi que ninguno de los 10 se apoya solo en la matriz del 22/09. Los 50 de 54
# aguantan cualquiera de las dos lecturas. Eso es lo que permite declararlos sin congelar el frente.
#
# LIMITACION CONOCIDA del contraste: la clave es `id·camino` y **no lleva la superficie**, asi
# que no puede distinguir por si mismo un conflicto real de una comparacion web-vs-mobile. Para los
# 10 de hoy se verifico a mano que el camino coincide; para los proximos, hay que mirarlo.
HIPOTESIS_MATRIZ_2209 = ("[POR VERIFICAR] Choque sistematico matriz-web-22/09 (COHERENTE) vs "
                         "mediciones 28-29/09 (DESVIO). Una causa, no diez. Dueno: auditoria + FE1. "
                         "Ver el comentario de arriba: lecturas (a) sucesion / (b) contaminacion de "
                         "regimen, y el test que falsa la (b).")

CONFLICTOS_CONOCIDOS = {
    "card": HIPOTESIS_MATRIZ_2209,
    "card-cliente": HIPOTESIS_MATRIZ_2209,
    "card-cobro": HIPOTESIS_MATRIZ_2209,
    "card-presu": HIPOTESIS_MATRIZ_2209,
    "cuenta": HIPOTESIS_MATRIZ_2209,
    "detalle": HIPOTESIS_MATRIZ_2209,
    "esc": HIPOTESIS_MATRIZ_2209,
    "factura": HIPOTESIS_MATRIZ_2209,
    "ingresar": HIPOTESIS_MATRIZ_2209,
    "preg": HIPOTESIS_MATRIZ_2209,
    "bi": "COHERENTE (matriz-web-re-medida, FE1 22/09, «recapturado con espera real a datos») vs "
          "DESVIO (lote A, 28/09). Auditoria ya resolvio que su DESVIO era FALSO POSITIVO del rail, "
          "y lo retiro el 2026-09-29 — el conflicto ya esta dirimido y a favor del COHERENTE. "
          "Se deja declarado porque es el caso que motivo este control.",
    "soporte": "COHERENTE (FE1 web 22/09) vs DESVIO (poblacion-A, auditoria 29/09). Puede ser "
               "conflicto REAL o de PREGUNTA: la columna `Resolucion` de FE1 dice «H-A4-4 confirmado "
               "desplegado» — mide EL HALLAZGO RESUELTO; auditoria mide COINCIDE CON EL PROTO. Dos "
               "preguntas distintas sobre el mismo id. [POR VERIFICAR]",
    "comousar": "Misma forma que `soporte`: COHERENTE (FE1 web 22/09) vs DESVIO (auditoria 29/09), "
                "y la sospecha es la misma — hallazgo-resuelto vs coincide-con-proto. [POR VERIFICAR]",
}


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
    hits, meds, huerfanos = mediciones_de(txt, armas, ids)
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
            # El mapa id -> veredictos CERRADOS. Sin el, `detalle` lista veredictos por linea sin
            # sujeto, asi que no se podia cruzar el mismo id entre documentos — y ese cruce es lo
            # unico que caza un COHERENTE falso.
            "veredictos_por_id": veredictos_por_id(con, ids),
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

    # ── CONTRASTE id -> veredictos: el único control que caza un COHERENTE falso ──────────────
    # 🔴 Esto vivía DESPUÉS del `return` de `--json`, o sea INERTE en el único camino que alguien
    # llama (la suite entera usa `--json`). Lo cazó su propio control positivo saliendo verde. El
    # alcance de un gate no puede depender del FORMATO DE SALIDA: la detección y el abort son del
    # gate, la tabla legible es del reporte. Espejo de `el-test-que-no-usa-el-camino-de-produccion`:
    # acá el test sí usaba el camino real y el GATE era el que estaba en el otro.
    conflictos, nuevos = contraste_de_veredictos(res)
    if nuevos:
        print(f"CONTRASTE: CONFLICTO NUEVO — {len(nuevos)} id(s) con veredictos incompatibles que "
              f"nadie declaro: {nuevos}. Dos documentos afirman cosas opuestas sobre la misma "
              f"pantalla. Dirimilo y declaralo en CONFLICTOS_CONOCIDOS con la lectura: es el unico "
              f"control que caza un COHERENTE falso, y un COHERENTE falso desactiva trabajo sin "
              f"dejar rastro.", file=sys.stderr)
        sys.exit(11)

    if "--json" in sys.argv:
        res["instrumento"] = sello_del_instrumento()
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
    # La TABLA del contraste; la detección y el abort viven arriba, antes de la bifurcación de
    # `--json` (ver `contraste_de_veredictos`). Acá sólo se muestra, así que `conflictos` siempre
    # está calculado y `nuevos` siempre está vacío: si no lo estuviera, no se habría llegado.
    if conflictos:
        interno = contradicciones_internas(conflictos)
        print(f"⚠️  CONTRASTE: {len(conflictos)} id(s) con veredictos INCOMPATIBLES "
              f"— {len(nuevos)} sin declarar")
        if interno:
            print(f"   ⚑ de ellos, {len(interno)} con un documento que se contradice A SÍ MISMO "
                  f"(aporta las DOS puntas del par): {', '.join(sorted(interno))}")
            for i, docs_i in sorted(interno.items()):
                print(f"      {i:<14} <- {', '.join(d[:52] for d in docs_i)}")
            print(f"     Eso NO es desacuerdo entre mediciones: o el id está PARTIDO por dimensión "
                  f"(las dos vigentes) o ese documento tiene un defecto propio. Se le pide al autor "
                  f"que lo separe por dimensión; el instrumento no lo dirime.")
        for i in sorted(conflictos):
            marca = "<<< NUEVO" if i in nuevos else "declarado"
            origen = "SE CONTRADICE" if i in interno else "entre docs"
            print(f"   {i:<14} {marca:<9} [{origen}]")
            for v, docs_v in sorted(conflictos[i].items()):
                print(f"      {v:<22} <- {', '.join(n[:52] for n in sorted(docs_v))}")
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
    # NOMBRA los faltantes, no sólo los cuenta. Pedido de auditoría (2026-09-30) y su motivo es
    # el caso `(home)`: el reporte decía «53 de 54» con el faltante CONTADO y SIN NOMBRAR, así que
    # para saber cuál era hubo que capturar los locales de este `main()` con un tracer. El dato lo
    # tiene sólo este script; hacer que el lector lo vuelva a deducir es pedirle trabajo y no darle
    # lo único que no puede conseguir en otro lado. Es la misma falla que
    # `memoria/instrumento-que-no-mira-nunca-falla.md` un paso más adelante: acá SÍ mira, pero no
    # dice qué vio.
    sin_nada = sorted(i for i in ids if i not in union)
    print(f"   sin nada en rol de veredicto en ningún documento: {len(sin_nada)}"
          + (f" -> {sin_nada}" if sin_nada else " (ninguno)"))
    print(f"TOTAL, unidad «ocurrencias de veredicto»: {ocurrencias}  ·  de las cuales "
          f"no-comparación: {tnc}  ·  (los dos lotes originales aportan {a + b})")
    print("⚠️  Esa cifra es en VEREDICTOS. En «mediciones» (id+camino) es menor: una medición")
    print("   partida por dimensión emite dos veredictos. Nunca citar el número sin la unidad.")
    print("⚠️  Y el numerador que manda es el de SUJETOS: contar veredictos sólo encuentra los que")
    print("   este lector ya sabe parsear (auditoría 2026-09-28, 8 hallazgos).")


if __name__ == "__main__":
    main()
