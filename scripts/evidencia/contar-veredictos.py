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

────────────────────────────────────────────────────────────────────────────────────────────────
CÓDIGOS DE SALIDA — cada uno nombra la ACCIÓN que destraba, porque dos de ellos piden lo
CONTRARIO y hasta el 2026-09-30 compartían el 6:

   0   medido y todos los controles pasaron.
   2   NO PUEDO MEDIR (falta un archivo, cambió la forma de una tabla, el universo no se lee).
       Nunca es un hallazgo sobre el dato: es ceguera del instrumento.
   3-5, 7-11   controles de contenido; cada rama imprime su propia acción.
   6   COBERTURA: REGRESIÓN — la matriz DEJÓ de cubrir un id de la spec.
       Acción: arreglar la matriz (o bajar el id al piso, deliberadamente y con el por qué).
   12  EL PISO QUEDÓ VIEJO — la matriz YA cubre un id que sigue en CIEGOS_DECLARADOS.
       Acción: sacarlo del piso. Es la INVERSA del 6.
   13  el diff de RETIRADOS_DECLARADOS no cuadra con la spec vigente.

Por qué se partieron (caso real, 2026-09-30): el 6 decía «el piso quedó viejo, sacá `preg`» en un
árbol y «la matriz dejó de cubrir `preg`, no lo saques» en otro — dos diagnósticos OPUESTOS bajo
el mismo código. Auditoría midió este script copiándolo a SU directorio, así que
`RAIZ = parents[2]` resolvió a SU matriz (la única que cubre `preg`); leí «le falta el ratchet»,
traje su commit, y el contador pasó de 0 a 6 por la causa contraria. Un código compartido no
sólo pierde información: cuando las acciones son inversas, ELIGE MAL por vos.
────────────────────────────────────────────────────────────────────────────────────────────────
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
# ⚠️ MATRIZ y SPEC son parametrizables por la MISMA razón que COORD, más una propia y peor: con
# `RAIZ = parents[2]`, el sujeto medido lo decide DÓNDE ESTÁ ESTE ARCHIVO. Copiar el script a otro
# checkout lo repunta en silencio a la matriz de ESE árbol — el caso real del 2026-09-30 narrado en
# el docstring, donde el mismo código dio dos diagnósticos opuestos sin que nada fallara. Poder
# apuntarlos explícitamente hace dos cosas que el default no puede: (1) el sabotaje de los exit
# 6/12/13 se monta sobre fixtures en vez de copiar el script — o sea el test ya NO necesita la misma
# trampa que causó el incidente; (2) quien mide puede DECLARAR su sujeto en vez de heredarlo del
# lugar donde quedó el archivo. El default no cambia: sin env, mide este árbol.
MATRIZ = Path(os.environ.get("COPILOTO_MATRIZ",
                             RAIZ / "scripts" / "evidencia" / "criterio3-matriz.mjs"))
# La SPEC es la fuente de verdad del criterio: el backlog §13 punto 3 dice, con esas palabras, que
# se mide «contra la sección spec de este documento». Hasta el 2026-09-29 el universo salía de
# MATRIZ — o sea del INSTRUMENTO — y eso es C3-13: la matriz conoce 27 ids de los 54, así que los
# otros 28 no podían aparecer ni como «hueco con nombre». No eran los marginales: `cobro-voz`, las
# cinco `card-*`, `fact-voz`/`fact-hitl`/`pres-voz`/`pres-hitl`, `vacio`/`vacio-visto`, la home.
SPEC = Path(os.environ.get("COPILOTO_SPEC",
                           RAIZ / "docs" / "copiloto-emprendedor" /
                           "2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md"))
# El piso también se puede apuntar a un fixture, y SÓLO para eso: es lo que permite sabotear en las
# dos direcciones (quitar del piso un id que la matriz no cubre ⇒ 6; dejar uno que sí cubre ⇒ 12)
# sin editar la constante de este archivo. En uso normal queda en None y manda CIEGOS_DECLARADOS.
PISO_OVERRIDE = os.environ.get("COPILOTO_PISO")

# Ratchet de cobertura del instrumento. NO es una lista de exclusiones: es el PISO medido, y el gate
# falla en las DOS direcciones — si aparece un ciego nuevo (regresión) y si uno declarado dejó de
# serlo sin bajar de esta lista (piso viejo). Un ratchet que sólo aprieta hacia arriba se afloja solo:
# la lista queda vieja y el gate pasa a certificar un estado que ya no existe.
CIEGOS_DECLARADOS = {
    "bi-refresh", "bi-vacio", "bloqueado", "caida", "card", "card-cliente", "card-cobro",
    "card-factura", "card-presu", "chat", "cobro-voz", "fact-cae", "fact-hitl", "fact-voz",
    "feedback", "grabando", "ingresar-error", "onb-cumplida", "onb-promesa", "pres-ciclo",
    "pres-hitl", "pres-voz", "recibo", "vacio", "vacio-visto", "volver", "(home)",
}
# `plan` está en la matriz y NO en la spec: salió por DEC-8 (visión, `BL-V2`). Es C3-14, y la
# ironía se mide sola — la spec existe porque «48/48 coherentes» se medía contra pantallas que nadie
# va a construir, y `plan` figuraba como una. La spec lo corrigió en su primera página; el
# instrumento lo heredó. Un diff de universo es BIDIRECCIONAL: faltantes Y retirados.
RETIRADOS_DECLARADOS = {"plan"}

# Techo ALCANZABLE del criterio en web. NO es una exclusion de cortesia: estos cuatro son dictado
# (`BL-P5`) y el criterio 3 compara contra una referencia de ESCRITORIO que para ellos no existe —
# auditoria lo midio el 2026-09-29: «el criterio 3 NO TIENE referencia de escritorio» para voz. Se
# miden en mobile, con device, el sprint que viene.
#
# 🔴 POR QUE ESTA DECLARADO Y SE PUBLICA, en vez de quedar como nota en un plan: el 2026-10-05 el
# DoD que escribi decia «web 54 de 54» y era INALCANZABLE, pero el reporte publicaba «49 de 54» sin
# nombrar a nadie — asi que nadie podia ni cerrarlos ni DESCUBRIR que cuatro no se podian cerrar. Un
# numerador que no puede llegar a su denominador manda a trabajar al vacio y encima inventa deuda:
# cada vuelta alguien vuelve a preguntar por los mismos cuatro ids. El instrumento publica su techo.
# 🔴 REFUTADA PARCIALMENTE POR AUDITORIA (2026-10-05) Y CORREGIDA ACA. Este set se llamaba
# `FUERA_DE_ALCANCE_WEB` y DESCONTABA del techo, convirtiendo un 92% en «✅ COMPLETO». Dos defectos,
# y el segundo es el grave:
#
#  1. EL EQUIVOCO DE PALABRA. «Escritorio» nombra DOS cosas sin relacion en este repo: la CAPA 0
#     launcher del prototipo (`#escritorio`, index.html:1613) y el VIEWPORT de pantalla grande
#     (index.html:63). La medicion de frontend1 prueba —con precision, lo dice en su :68— que estos
#     4 ids no tocan la CAPA. Yo concluia que estan fuera del alcance WEB, que es el viewport. Se
#     probo A y se concluyo B: entre uno y otro no hay inferencia. Peor: el predicado no es de web
#     en absoluto — los mismos 4 salen «sin comparacion» en mobile, por la misma causa.
#  2. EL TECHO ES LO QUE RESTA TRABAJO, no una cifra decorativa. Auditoria corrio este lector dos
#     veces sobre el MISMO tree cambiando solo el set: la cifra medida es identica (50 de 54) y lo
#     unico que cambia es si se imprime «✅ COMPLETO». Y `web_faltan_accionables` quedaba vacio **por
#     construccion**: la lista de pendientes no podia tener elementos. Una exencion que vacia su
#     propia lista de trabajo se auto-confirma, y un ✅ saca a todos el motivo de volver a mirar.
#
# Que queda: el HECHO medido (no hay referencia en la capa escritorio del prototipo) se conserva,
# porque esta medido y es util. Lo que se retira es la CONCLUSION de alcance y el descuento del
# techo. El camino para cerrarlos existe y es el vocabulario que este mismo lector ya habla:
# `FUERA-DE-REFERENCIA` (ver NO_COMPARACION), usado en 8 lotes — pero lo declara el DOCUMENTO que
# mide, no este set: un lector que asigna veredictos que no midio es peor que un techo mal puesto.
SIN_REFERENCIA_EN_CAPA_ESCRITORIO = {"cobro-voz", "fact-voz", "pres-voz", "vozchat"}

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
    # ── 2026-10-06: el que CAMBIÓ DE LADO, y el motivo es que el documento cambió ────
    # Estaba en `NO_SON_MEDICION` y estaba BIEN clasificado: medía los 4 ids de voz con dos
    # instrumentos por id, pero emitía su veredicto con un token FUERA del vocabulario cerrado
    # (`SIN-REFERENCIA-DE-ESCRITORIO`), así que no producía ningún veredicto contable. El
    # 2026-10-06 frontend1 agregó, a pedido de planificación, un bloque `> Corrección de
    # vocabulario` con los 4 ids declarados `FUERA-DE-REFERENCIA` y `plataforma` en cabecera. La
    # medición es la MISMA —nadie re-midió nada—; lo que cambió es que ahora está dicha en el
    # idioma que este lector cuenta. Autoridad del canónico: cierre de auditoría del 2026-10-05
    # §3 (los 4 entran al denominador declarados, no exentos).
    #
    # 🔴 LA CLASE, más grande que el caso: **una entrada de estas listas afirma el PRESENTE de
    # un documento que puede cambiar después.** Clasificar es un acto fechado y nada avisa cuando
    # el documento se corrige: el `rc` sigue en 0, la cifra no se mueve, y un descarte que fue
    # correcto el día que se escribió pasa a ESCONDER una medición válida sin dar síntoma. Acá se
    # vio sólo porque auditoría había pronosticado el efecto (54 de 54) y el efecto no llegó: sin
    # ese pronóstico, el 50 se habría citado como completo. Un descarte motivado en «no usa el
    # vocabulario» caduca el día que su documento cambia de tamaño.
    #
    # 📜 Lo que deciamos cuando estaba del otro lado, y que NO se pierde: el descarte original
    # argumentaba que el documento mide el ALCANCE (¿existe esta fila en escritorio?) y no el
    # criterio (app vs prototipo), y de ahi salio la observacion de que este dict tiene DOS cubos
    # «mide / cita» mientras la realidad tiene TRES —mide-el-criterio, mide-OTRA-cosa, cita— porque
    # el parser clasifica por FORMA y la forma no codifica el ROL. Ese hueco sigue abierto y vive en
    # la fila VOCABAJENO de `coordinacion/PLAN.md`; lo que cambio hoy no es el argumento, es que el
    # documento ahora declara tambien el veredicto del vocabulario cerrado, asi que ya no hace falta
    # elegir entre contarlo en otro idioma o no contarlo.
    "2026-10-05_cierre_frontend1-a-planificacion_los-4-ids-de-voz-SIN-REFERENCIA-DE-ESCRITORIO-confirmado-empirico.md",
    # 2026-09-30 — la re-emision limpia del §9 del `hallazgo_` de los 12 conflictos, pedida por
    # planificacion justamente porque el documento mixto no se podia clasificar: su tabla de CITAS le
    # daba al lector 8 COHERENTE superados. Clasificado MIDIENDO, no por el titulo: aporta 4 DESVIO
    # (`cuenta`, `soporte`, `esc`, `comousar`), **0 veredictos huerfanos y 0 ids fuera del padron** —
    # o sea cero contaminacion. Es el contraejemplo util del caso de al lado: la misma medicion, sin
    # la tabla de citas, entra a la cifra sin traer nada mas.
    # ⚠️ Sus 6 filas NO declaran `plataforma`, asi que los 4 DESVIO caen en `indeterminada` y no
    # suman a web todavia (pedido a auditoria en el `dato_` de la cifra).
    # ⚠️ NOMBRE COMPLETO, con `.md`. Las dos constantes hermanas NO se matchean igual:
    # `NO_SON_MEDICION` se consulta con `p.name == k or p.name.startswith(k)` (`:621`, admite
    # prefijo) y esta con `n not in MEDICIONES_DECLARADAS` (`:643`, igualdad exacta). Escribi
    # el prefijo por analogia con la de al lado y el documento siguio saliendo sin clasificar
    # — el gate hizo bien su trabajo, pero la asimetria entre dos constantes que se usan para
    # lo mismo es una trampa. Queda anotada acá hasta que alguien unifique el matcheo.
    "2026-09-30_cierre_auditoria-a-planificacion_mis-6-mediciones-del-criterio-3-tabla-limpia-sin-la-tabla-de-citas.md",
    # ── 2026-09-30: el que el fix de COLUMNA DE SUJETO hizo visible ─────────────────────
    # MIDE, y con vocabulario cerrado: 2 ids del padron (`factura`, `card-presu`), los dos
    # `FUERA-DE-REFERENCIA`, 0 huerfanos. Era invisible porque pone el ENUMERADOR en la primera
    # celda (`A-1`) y el id en la segunda, bajo `| # | camino | veredicto | … |`: el lector miraba
    # solo la celda 1, no leia ningun sujeto, y al ser los unicos del documento este no llegaba
    # siquiera a candidato — ni medido ni descartado, invisible a los cuatro ratchets.
    # Mide 2 caminos contra el prototipo —`factura` con borrador desde presupuesto y `card-presu`
    # vacio—, los dos FUERA-DE-REFERENCIA porque el proto no los modela: veredicto propio, no
    # citado.
    # ⚠️ ACA VA EL NOMBRE COMPLETO. Las dos constantes NO matchean igual y la asimetria no se ve:
    # `NO_SON_MEDICION` se consulta con `p.name == k or p.name.startswith(k)`, asi que admite la
    # clave corta que sobrevive a un renombre del titular; esta es un SET y se consulta por
    # pertenencia exacta en los dos sentidos (`n not in …` y `… - set(candidatos)`), asi que una
    # clave truncada aca no clasifica nada Y ademas dispara `perdidos` — rojo por los dos lados.
    "2026-09-30_cierre_frontend2-a-planificacion_C3-2-mediciones-mas-A2b-y-el-banner-de-alerta-doble-emision.md",
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
    # 2026-09-30 — DICTAMEN SOBRE EL INSTRUMENTO, no sobre pantallas. Re-mide el radio de un defecto
    # del brazo `tabla` sobre 2103 documentos (confirma el radio 0) y CITA las filas que encuentra,
    # incluida la de un contrato mio. Lo que produce veredictos del criterio son esas citas.
    #
    # Su §3 es el hallazgo que importa, y es de los buenos: mi `contrato_..._C3-la-ultima-fila-medir-
    # la-home...` ENSEÑA el formato de una fila de medicion, y para enseñarlo escribe una — con
    # `(home)` y `COHERENTE`. La medicion real de `(home)` el MISMO dia es `DESVIO`. O sea que el
    # ejemplo del formato contradice la medicion que el formato venia a recoger, y para un lector de
    # FORMAS los dos son la misma cosa. Un COHERENTE fabricado asi es indistinguible de uno medido, y
    # nadie lo audita porque coincide con lo que se espera leer.
    #
    # 🔴 La clase, que es mas grande que el caso: **un documento que explica un mecanismo no puede
    # usar el mecanismo con valores reales.** Ya la pagamos por sintaxis (el ejemplo interno lleva un
    # delimitador ficticio, nunca el real); esta es la version semantica. El fix vive en el contrato,
    # no aca: el ejemplo usa un id FUERA del padron.
    "2026-09-30_hallazgo_auditoria-a-planificacion_radio-0-confirmado":
        "DICTAMEN sobre el parser: re-mide el radio del defecto del brazo `tabla` (4 filas en 3 docs, "
        "las 3 descartadas) y CITA las filas halladas, no mide pantallas. Su §3 encuentra que un "
        "contrato que ENSEÑA el formato emite `COHERENTE` sobre `(home)`, que la medicion real del "
        "mismo dia da `DESVIO`.",
    # 2026-09-30 — EL GATE CAZO A SU PROPIA AUTORA. Es la respuesta de planificacion al hallazgo de
    # los 12 conflictos, y para explicar el defecto CITA el fixture minimo (una fila con COHERENTE /
    # REQUIERE_TRIAGE / DESVIO). Esa cita tiene forma de fila de medicion, asi que el documento que
    # describe el problema lo reproduce. No se arregla clasificando y nada mas: ver la fila TABLACITA
    # del PLAN — el brazo `tabla` lee filas de tablas que NO declaran columna de veredicto, y ni el
    # gate de cabecera ni un code fence lo detienen.
    "2026-09-30_dato_planificacion-a-auditoria_hallazgo-12-conflictos":
        "RESPUESTA de planificacion al hallazgo de los 12 conflictos: dictamina, decide la forma de "
        "la sucesion y declara el costo de la clasificacion. Los veredictos que se le leen son la "
        "CITA del fixture que demuestra el defecto del brazo `tabla`; no mide ninguna pantalla.",
    # 2026-09-30 — DICTAMEN, y la clasificacion se decidio MIDIENDO, no leyendo el titulo. El
    # documento es MIXTO: su §9 trae 4 mediciones propias (app@390 vs proto@390, con capturas) y su
    # §2 trae una tabla de CITAS de la sucesion `barrido -> correccion -> medicion posterior`.
    # Importado como medicion, el lector saca 12 veredictos y 8 son `COHERENTE` de la tabla de citas
    # (L39-46), medido:
    #
    #     L39  card         COHERENTE   | `card` | COHERENTE | **REQUIERE_TRIAGE** | DESVÍO (29/09) |
    #     L201 cuenta       DESVÍO      | `cuenta` | **DESVÍO** | título «Cuenta» vs «Mi cuenta» …
    #
    # 🔴 O sea que el instrumento leeria, como mediciones frescas, EXACTAMENTE los `COHERENTE`
    # superados que este documento existe para retirar — y en la misma fila ignora el `DESVÍO` que
    # los supera, porque el brazo `tabla` toma el PRIMER token del vocabulario y en una tabla de
    # sucesion el primero es siempre el mas viejo. Clasificarlo MEDICION resucita el falso verde
    # citando al documento que lo desmiente.
    #
    # ⚠️ EL COSTO, declarado: se pierden las 4 mediciones reales de su §9 (`cuenta`, `soporte`,
    # `esc`, `comousar`, las cuatro DESVÍO). No hay clasificacion binaria que salve las dos cosas:
    # pedido a auditoria (`dato_…`) que re-emita su §9 como documento propio, con SOLO su tabla.
    # Mientras eso no exista, esos 4 DESVÍO NO estan en la cifra — y es mejor que la alternativa,
    # que es contarlos junto a 8 COHERENTE falsos.
    "2026-09-30_hallazgo_auditoria-a-planificacion_los-12-conflictos":
        "DICTAMEN de auditoria sobre la atribucion de los 12 conflictos: mide que el `COHERENTE` "
        "sale del barrido BL-Q3 del 22/09 02:11 y no de `matriz-web-re-medida` (0 de 12), y "
        "dirime la HIPOTESIS_MATRIZ_2209 a favor de la sucesion (la pantalla no cambio: 0 commits "
        "en `account/` con control positivo de 111). Su §2 CITA la cadena barrido->correccion-> "
        "medicion posterior, y esas citas tienen forma de fila de medicion. Sus 4 mediciones "
        "propias (§9) esperan documento propio para entrar a la cifra.",
    # 2026-09-30 — visible por primera vez con el fix de COLUMNA DE SUJETO de este PR.
    # Es un TABLERO DE TRABAJO, no una medicion: su cabecera es
    # `| # | id · camino | cat | que hay que hacer | costo | dueño | estado |`, o sea tareas,
    # costo, dueño y estado. Cita 12 ids del padron en rol de FILA DE TRABAJO y no emite un solo
    # veredicto del vocabulario: los 12 salen con lista vacia. El unico token que el lector saca
    # es `VOCABULARIO_DESCONOCIDO` sobre `bi`, y viene de `🔴 FALSO POSITIVO` en la columna `cat`
    # — que clasifica la FILA, no mide la pantalla. Declararlo medicion lo mandaria derecho al
    # exit 9 («declarado para medir y no mide nada legible»), que es el sintoma correcto de la
    # clasificacion equivocada.
    # ⚠️ MOTIVO REDACTADO POR PLANIFICACION, NO POR SU AUTOR (auditoria), por la misma razon que
    # la entrada de abajo: el guard bloquea el PR que lo hizo visible y dejar rojo el tronco de
    # las cuatro sesiones es peor. Sujeto a correccion del autor.
    "2026-09-29_dato_auditoria-a-planificacion_los-11-desvios":
        "DATO de auditoria: reorganiza los desvios abiertos como filas de un tablero de producto "
        "(categoria, trabajo, costo, dueño, estado) y retira `bi` por falso positivo del Rail. "
        "CITA los ids para asignarles trabajo; no compara ninguna pantalla contra el prototipo "
        "ni emite veredicto de fidelidad. [REDACTADO POR PLANIFICACION 2026-09-30, sujeto a "
        "correccion de auditoria]",
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
    # 2026-10-05 — DICTAMEN SOBRE ESTE INSTRUMENTO, y es el que lo corrigio. Refuta parcialmente mi
    # exencion: corrio este lector dos veces sobre el mismo tree cambiando solo el set y mostro que
    # la cifra medida es identica — lo unico que cambiaba era el «✅ COMPLETO». CITA ids del padron
    # (card-ingreso/card-cobro, los 4 de voz) para fundamentar, asi que produce veredictos con forma
    # de medicion sin medir ninguna pantalla.
    #
    # El hallazgo que vale mas que la correccion: «escritorio» nombra DOS cosas en este repo —la
    # CAPA 0 del prototipo y el VIEWPORT grande— y mi exencion probaba la primera para concluir la
    # segunda. Tambien declara un error PROPIO corregido en 20 minutos (su §2.1 leyo las subvistas
    # `#s-*` como prueba de escritorio-desktop, por el mismo equivoco) — un dictamen que se audita
    # a si mismo adentro del mismo documento.
    "2026-10-05_cierre_auditoria-a-planificacion_EXENCION-PARCIAL":
        "DICTAMEN sobre este contador: refuta el DESCUENTO DEL TECHO de la exencion (la cifra medida "
        "no cambia, solo el ✅) y nombra el equivoco de `escritorio` (capa vs viewport). Cita ids del "
        "padron para fundamentar; no mide pantallas.",
    # 2026-10-05 — TERCERA instancia de VOCABAJENO en el mismo dia, y la que mide su propia clase:
    # barrio `escritorio|desktop` sobre 2168 .md y reparte 655 apariciones en 222 archivos (~311
    # CAPA, ~297 VIEWPORT, 12 AMBIGUO, 4 SALTO, 6 META, 7 MIXTO, 18 OTRO). CITA `| esc | COHERENTE |`
    # de `BL-Q3-web-barrido-35-pantallas` para fundamentar que ese conflicto no tiene via de cierre.
    #
    # 🔴 Y ES LA EVIDENCIA QUE CIERRA LINTALCANCE: este documento lo emitio OTRA sesion y puso el
    # `lint` de las CUATRO ramas en rojo (exit 8) a los minutos de publicarse, por tercera vez hoy.
    # El gate de merge evaluaba un ratchet de ESTADO DEL CORPUS —un corpus vivo, compartido y no
    # versionado— sobre commits que no lo controlan. El aislamiento (COPILOTO_COORD + fixture) es el
    # arreglo; esta linea es el parche que desbloquea mientras entra.
    "2026-10-05_hallazgo_auditoria-a-planificacion_radio-del-equivoco-escritorio-medido":
        "MIDE EL RADIO de un equivoco de VOCABULARIO (`escritorio` = capa del prototipo vs viewport) "
        "sobre el corpus de .md, no pantallas contra el prototipo. Cita ids del padron (`esc`) para "
        "fundamentar que un conflicto declarado no tiene mecanismo de cierre.",
    # 2026-10-05 — EL GATE CAZO EL *REPORTE DE ESTE CONTADOR*, y es la TERCERA forma de la misma
    # clase en este registro. Las dos anteriores fueron un contrato que ENSEÑA el formato (y para
    # enseñarlo emite `(home)`+`COHERENTE`) y una respuesta que CITA el fixture del defecto. Esta es
    # la que faltaba: **el documento que PUBLICA lo que el instrumento midio vuelve a entrar al
    # universo del instrumento.** Los dos de abajo son mi reporte del frente SUPERADO y traen, pegadas
    # por script desde el JSON, las tablas «quien aporta el lado COHERENTE» y «cuantos veredictos
    # distintos tiene cada id» — o sea el inventario completo de veredictos del criterio, por
    # construccion.
    #
    # 🔴 Lo que esto dice del circuito, y no es una anecdota: en este corpus **medir obliga a
    # reportar, y reportar contamina el corpus que se mide.** No hay forma de informar un cruce de
    # veredictos sin nombrar los veredictos cruzados. Asi que la clasificacion a mano no es una deuda
    # que se termine de pagar: es una tasa por cada reporte, y crece con la cantidad de mediciones.
    # El arreglo estructural es la fila TABLACITA (el brazo `tabla` exige CABECERA con columna de
    # veredicto declarada; hoy lee cualquier tabla y ni el code fence lo detiene), no seguir
    # appendeando entradas aca.
    #
    # ⚠️ Y lo que NO se hace, a proposito: una exencion por patron del tipo «lo que emite
    # planificacion no es medicion». Seria fail-open sobre el rol que mas documentos escribe, y es
    # exactamente la forma de `exencion-sin-autoridad` — una regla amplia que nadie vuelve a medir.
    # Prefiero la tasa visible: el gate grita, yo clasifico, y el costo queda contado.
    "2026-10-05_dato_planificacion-a-frontend1_SUPERADO-medido-12-sigue-en-12":
        "REPORTE de este contador a frontend1: le devuelve la cifra medida (12 → 12 con su marca "
        "puesta) y corrige dos pedidos mios equivocados. Sus tablas son el inventario de veredictos "
        "que el contador publico, insertadas desde el JSON; no mide ninguna pantalla.",
    "2026-10-05_hallazgo_planificacion-a-auditoria_UNDOCUMENTO-refutado-midiendo":
        "REPORTE de este contador a auditoria: refuta por medicion la premisa de UNDOCUMENTO (la "
        "superacion cierra 4 de 12, no 10) y nombra que 9 de los 10 dirimidos cuelgan de UNA "
        "hipotesis compartida. Cita las mismas tablas del JSON; no mide pantallas.",
    # 2026-10-05 — CITA PARA MOSTRAR ESTRUCTURA, y este dict descarta justo al documento que le
    # senala el eje que le falta. Sus 3 filas de tabla traen la COLUMNA DE PROCEDENCIA
    # (`2026-09-29_cierre_frontend1...B1-13-ids-superficie-y-dimension.md`) y su :23 lo declara
    # textual: «su propio veredicto, ninguna COHERENTE en este documento». Las otras 2 apariciones de
    # la palabra son prosa explicativa, no veredictos. Verificado leyendo el documento, no por reporte.
    #
    # 🔴 EL DOBLE CONTEO QUE EVITA, medido: `esc` y `factura` son 2 de los 5 ids del conflicto
    # vigente y sus veredictos YA se cuentan por el original del 29/09. Clasificarlo como medicion
    # contaria los mismos dos veces —una por el original, otra por la cita— precisamente sobre ids en
    # disputa, que es donde el doble conteo se lee como confirmacion independiente.
    #
    # 🔴 LO QUE ESTA CLASIFICACION TIRA, que es el hallazgo: el documento SI aporta algo nuevo —que
    # `esc`/`factura`/`soporte` son EJE PARTIDO (contenido vs componente) y que `card` tiene un
    # TERCER eje, `camino` (mic de la funcion / boton +Nuevo / card del chat central), que este
    # contador no habla. Como el dict solo ofrece «mide» o «cita», el unico cajon correcto para la
    # CIFRA descarta el aporte. Otra instancia de VOCABAJENO —y la primera en la que el hueco lo
    # nombra el DOCUMENTO DESCARTADO y no el lector: lo dice en :25, «el contador no tiene ese tercer
    # eje en su vocabulario». Un instrumento que descarta al unico documento que le describe su hueco
    # se queda sin la via por la que se corregiria.
    "2026-10-05_cierre_frontend1-a-planificacion_SUPERADO-los-4-de-contradiccion-interna":
        "ANALISIS que CITA: trae 3 filas del `cierre_` del 29/09 —con su columna de procedencia— para "
        "mostrar que `esc`/`factura`/`soporte` no son «fila a elegir» sino EJE PARTIDO (contenido vs "
        "componente), y su :23 declara «ninguna COHERENTE en este documento». Clasificado como "
        "medicion duplicaria los veredictos de `esc` y `factura`, 2 de los 5 ids en disputa. Su "
        "aporte propio —el tercer eje `camino` para `card`— no tiene cajon en este dict: VOCABAJENO "
        "en PLAN.md.",
    # 2026-10-07 — TERCERA instancia de VOCABAJENO, y la que mejor muestra por que la clase importa:
    # el documento MIDE de verdad (Playwright, viewport 390x844, `unregister` del service worker antes
    # de medir, SHA del bundle servido declarado —`9e344bdf`, no el `main` del dia— y una captura por
    # fila). Lo que no mide es ESTE criterio: su eje es BL-Q3 «las 9 diferencias del 22/09 vs el PWA
    # servido», y su vocabulario propio es COHERENTE / DIFERENCIA / NO_REPRODUCIBLE, con su propio
    # conteo (4 / 4 / 1).
    #
    # 🔬 MEDIDO POR AUDITORIA Y RE-MEDIDO POR MI: el discriminante NO es «usa vocabulario propio»,
    # es **«no cubre ningun sujeto del universo»** — 0 de los 14 canonicos de `criterio3-matriz.mjs`,
    # con control positivo que discrimina (el `dato_` del 22/09 trae 4 de 14 en la misma corrida).
    # El vocabulario falla en las DOS direcciones y este repo ya pago una: el `cierre_` de los 4 ids
    # de voz medía sujetos canonicos con dos instrumentos por id y lo excluia el TOKEN — vocabulario
    # ajeno con sujetos propios. Al revés, un documento puede escribir `COHERENTE` midiendo cualquier
    # otra cosa y entraria. La cobertura de sujetos es un numero: auditable con un grep por cualquiera,
    # no opinable. El motivo de abajo cita ese numero; lo del vocabulario queda como señal secundaria,
    # que es lo unico que es.
    # 🔴 De esos tres tokens, SOLO `COHERENTE` pertenece al vocabulario del criterio 3. Por eso este
    # lector lo ve: engancha la palabra compartida y no las otras dos. Sumarlo como medicion metria 4
    # COHERENTE de OTRO eje en el total del criterio —inflarlo con trabajo real pero ajeno, que es la
    # forma mas dificil de auditar: no hay nada falso que encontrar, el error esta en el denominador.
    # Y descartarlo sin motivo escrito perderia que el documento se corrige a si mismo dos veces (su
    # cifra del 22/09 —«dije 8 DIFERENCIA, son 9»— y el SHA que describe).
    #
    # La asimetria con el caso de arriba es la leccion: ese se descarta porque CITA veredictos ajenos
    # (sumarlo DUPLICA); este se descarta porque mide veredictos PROPIOS de otro eje (sumarlo INFLA).
    # Dos motivos opuestos, el mismo cajon — y por eso el motivo no puede quedar implicito.
    "2026-10-07_cierre_frontend2-a-planificacion_BL-Q3-PWA-reverificadas-9-diferencias":
        "MIDE, pero OTRO EJE, y el discriminante es un NUMERO: cubre **0 de los 14 sujetos "
        "canonicos** de `criterio3-matriz.mjs` (`bi-refresh`, los cuatro `tile-*`, los siete "
        "`*-cargando`, `inteligencia-actualizar`, `midia-ver-agenda`). Control positivo del grep en la "
        "misma corrida: `2026-09-22_dato_frontend2-..._matriz-web-re-medida.md` trae 4 de 14, asi que "
        "no es ciego. Re-verifica en el PWA servido las 9 diferencias del `dato_` del 22/09 (su propio "
        "conteo: COHERENTE 4 · DIFERENCIA 4 · NO_REPRODUCIBLE 1); sumarlo metia 4 COHERENTE de otro "
        "eje en el total. VOCABAJENO en PLAN.md.",
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

    # El piso efectivo: la constante, salvo que un fixture declare otro. Es lo único que permite
    # sabotear las dos direcciones del ratchet sin copiar este archivo a otro árbol.
    piso = CIEGOS_DECLARADOS
    if PISO_OVERRIDE is not None:
        piso = {t for t in re.split(r"[,\s]+", PISO_OVERRIDE) if t}

    nuevos_ciegos = sorted(ciegos - piso)
    ya_cubiertos = sorted(piso - ciegos)
    nuevos_retirados = sorted(retirados - RETIRADOS_DECLARADOS)
    ya_no_retirados = sorted(RETIRADOS_DECLARADOS - retirados)

    if nuevos_ciegos:
        print(f"COBERTURA: REGRESIÓN (exit 6) — {len(nuevos_ciegos)} id(s) de la spec que la matriz "
              f"dejó de cubrir: {nuevos_ciegos}. La matriz perdió una captura: arreglala, o bajalos a "
              f"CIEGOS_DECLARADOS con el por qué si es deliberado. ⚠️ NO es el exit 12: acá el piso "
              f"está BIEN y lo que falta es la captura. Sacar el id del piso empeora el fallo.",
              file=sys.stderr)
        sys.exit(6)
    if ya_cubiertos:
        print(f"COBERTURA: EL PISO QUEDÓ VIEJO (exit 12) — la matriz ya cubre {ya_cubiertos}, que "
              f"siguen declarados como ciegos. Sacalos de CIEGOS_DECLARADOS: un ratchet que no se "
              f"aprieta certifica un estado que ya no existe. ⚠️ Esto SÓLO vale si la matriz de ESTE "
              f"árbol los cubre: un id que sólo está en la matriz de otra rama da exit 6 acá.",
              file=sys.stderr)
        sys.exit(12)
    if nuevos_retirados or ya_no_retirados:
        print(f"COBERTURA: el diff de retirados no cuadra — nuevos {nuevos_retirados}, "
              f"ya-no {ya_no_retirados}. RETIRADOS_DECLARADOS tiene que reflejar la spec vigente.",
              file=sys.stderr)
        sys.exit(13)
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
FILAS_CIEGAS_JUSTIFICADAS = {
    # VACIO A PROPOSITO, y medido: sobre los 1979 documentos del buzon el discriminante marca 1
    # documento antes del fix de columna de sujeto y 0 despues (2026-09-30). Si algun dia hay que
    # poner algo aca, la pregunta es la misma que arriba: el documento NO MIDE, o NO SE LEE. Una
    # entrada aca firma «esta fila tiene forma de medicion y NO lo es» — si en realidad el lector no
    # la sabe leer, esto convierte un bug del parser en una excepcion declarada, que es el error que
    # `MEDICION_SIN_VEREDICTO_CERRADO_JUSTIFICADA` ya documenta de su lado.
}

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
    ciegos = {}
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
            if not ids_del_criterio(con, ids):
                # EL DOCUMENTO QUE NO LLEGA A CANDIDATO. Los cuatro ratchets de abajo operan todos
                # sobre `candidatos`, asi que un documento cuyos UNICOS sujetos son ilegibles no
                # aparece ni entre los medidos ni entre los descartados: es el unico agujero que
                # ninguno de ellos cubre, y el que dejo dos dias invisible al `cierre_` de
                # frontend2. Esta rama es la que lo mira.
                fc = filas_ciegas_de(txt, ids)
                if fc and p.name not in FILAS_CIEGAS_JUSTIFICADAS:
                    ciegos[p.name] = fc
            else:
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

    # 🔴 EL CONTROL POSITIVO DEL INSTRUMENTO VIVIA DETRAS DE ESTE GUARD. Medido por auditoria el
    # 2026-10-05 a las dos puntas: con UN documento sin clasificar, `--canario` salia `rc=8`; con el
    # documento clasificado, `rc=0` y «CANARIO OK: los 5 brazos tienen control». El canario corre en
    # `main` (~:2212) y este guard vive en `descubrir_documentos`, que corre ANTES — asi que un solo
    # archivo sin clasificar no bloqueaba solo la cifra: bloqueaba LA PRUEBA DE QUE EL LECTOR
    # FUNCIONA. Y ese falso rojo es PEOR que el de la cifra: quien lo ve concluye «el instrumento
    # esta roto», no «falta clasificar un doc» — y un instrumento declarado roto desactiva todo el
    # trabajo que acredita, sin dejar rastro.
    #
    # EL FIX NO DEBILITA EL GUARD, lo acota al modo que publica cifra. Con `--canario` no se imprime
    # ninguna cifra (el bloque termina en `return` antes del reporte): se rompe cada brazo y se exige
    # que la metrica BAJE. Un documento extra sin clasificar no invalida eso — le da mas corpus.
    # El aviso es RUIDOSO y solo aparece cuando hay sin clasificar, que no es el caso normal: un
    # guard que grita en el caso normal se desarma solo, y este no grita ahi.
    # [[un-control-de-ceguera-ubicado-despues-del-guard-que-dispara]] · [[el-canario-el-control-positivo-de-lo-que-falla-callado]]
    modo_canario = "--canario" in sys.argv

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
        if not modo_canario:
            sys.exit(8)
        print(f"  ⚠️  `--canario` DEGRADA este guard a aviso y sigue: en modo canario no se publica "
              f"ninguna cifra, se acredita el LECTOR. Los {len(sin_clasificar)} sin clasificar "
              f"quedan en el corpus (mas corpus, no menos control).", file=sys.stderr)

    perdidos = sorted(MEDICIONES_DECLARADAS - set(candidatos))
    if perdidos:
        print(f"DOCUMENTOS: EL PISO QUEDO VIEJO — {len(perdidos)} declarado(s) como medicion que el "
              f"glob ya no encuentra con veredictos: {perdidos}. Se renombro, se borro, o el parser "
              f"dejo de verlo. Un ratchet que solo aprieta hacia arriba certifica un corpus que ya "
              f"no existe.", file=sys.stderr)
        if not modo_canario:
            sys.exit(8)
        print(f"  ⚠️  `--canario` lo degrada a aviso por el mismo motivo: el canario mide sobre los "
              f"documentos DESCUBIERTOS, no sobre la lista declarada.", file=sys.stderr)

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

    # 🔴 EL TERCER MIEMBRO DE LA FAMILIA, y el unico que mira AFUERA de `candidatos`. `ilegibles`
    # (10) y `mudos` (9) parten a un documento YA clasificado; esto caza al que ni siquiera llego a
    # clasificarse porque sus sujetos son ilegibles. Corre ULTIMO a proposito: los otros dos operan
    # sobre un conjunto que este no toca, asi que no puede taparles el mensaje — el orden importa en
    # este archivo desde que un guard que corria antes que su control de ceguera acuso 14 archivos
    # que existian.
    if ciegos:
        total = sum(len(v) for v in ciegos.values())
        print(f"DOCUMENTOS: MEDICION QUE NO SE VE — {len(ciegos)} documento(s) NO llegan a "
              f"candidato (0 ids del criterio atribuidos) PERO tienen {total} fila(s) con forma de "
              f"medicion: un id del padron declarado fuera de la primera celda, con veredicto del "
              f"vocabulario cerrado en la misma fila.", file=sys.stderr)
        for n, fs in sorted(ciegos.items(), key=lambda kv: -len(kv[1])):
            print(f"  · {n}", file=sys.stderr)
            for ln, col, sid in fs:
                print(f"      L{ln} columna {col} -> `{sid}`", file=sys.stderr)
        print("Es un defecto de LECTURA, no de rol: el id es del padron CERRADO, asi que el "
              "documento esta midiendo el criterio 3 y el veredicto esta en su misma fila. "
              "Ensanchar el lector (ver `CABECERA_SUJETO`), no declarar la excepcion — declararla "
              "convierte un bug del parser en una decision de clasificacion.", file=sys.stderr)
        sys.exit(11)

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
    disco = Path(__file__).read_bytes()
    # 🔴 SE HASHEA NORMALIZADO A LF, NO LOS BYTES DEL DISCO. Medido por auditoria el 2026-10-05: el
    # mecanismo de arriba es correcto —arma el objeto git y lo sha1— y el sello resolvia exacto; lo
    # rompen los FINALES DE LINEA. En Windows el archivo esta en disco con CRLF (173 664 B) y git
    # almacena el blob normalizado a LF (173 560 B), asi que hashear el disco produce un sello con
    # forma VALIDA que `git rev-parse <sha>:<path>` no resuelve. Es la forma mas cara del bug de
    # finales de linea: no falla, no avisa, y publica una referencia inverificable que nadie
    # distingue de una buena. [[el-open-w-trunca-antes-de-que-el-write-falle]] lleva la clase.
    #
    # Se publican LAS DOS cifras de tamaño a proposito: que `bytes` (lo hasheado) difiera de
    # `bytes_en_disco` es CORRECTO en Windows, y declararlo evita que alguien «arregle» la
    # diferencia el dia que la note. [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]]
    b = disco.replace(b"\r\n", b"\n")
    blob = b"blob " + str(len(b)).encode() + b"\0" + b
    return {
        "path": Path(__file__).name,
        "git_blob": hashlib.sha1(blob).hexdigest(),
        "git_blob_unidad": "sha1 del objeto blob de git sobre el contenido NORMALIZADO A LF; "
                           "resoluble con `git rev-parse <sha>:scripts/evidencia/contar-veredictos.py`",
        "bytes": len(b),
        "bytes_en_disco": len(disco),
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

# Nombres con los que una cabecera DECLARA en qué columna vive el sujeto. Es el MISMO mecanismo que
# `col_veredicto` en `veredictos_de` —el separador markdown identifica la cabecera y el índice se
# GUARDA en vez de tirarse— aplicado al otro canal. Medido el 2026-09-30: el `cierre_` de frontend2
# que aporta 2 mediciones del criterio 3 pone el ENUMERADOR en la primera celda (`A-1`) y el id en la
# segunda, bajo `| # | camino | veredicto | … |`. El lector asumía el sujeto en la celda 1, así que
# las dos mediciones quedaban ILEGIBLES — y por ser los únicos sujetos del documento, el documento no
# llegaba a candidato: ni medido ni descartado, invisible a los cuatro ratchets.
#
# Esa ceguera estaba ESCRITA ocho días antes, en el comentario final de
# `test-parser-veredictos-formas-de-tabla.sh`: «un documento cuyo UNICO sujeto es ilegible no llega a
# ser candidato … y el ratchet exit 8 nunca se entera». Describía el agujero sin mecanismo que lo
# cazara, que es la forma en que un defecto se vuelve invisible POR ESCRITO en vez de visible.
#
# Es un FALLBACK, nunca un override: la celda 1 se intenta siempre primero. La razón es `camino`, que
# nombra DOS cosas en este corpus — la columna donde vive el id (este caso) y la dimensión `camino A`
# / `camino B` de un id que vive en la celda 1 (el caso mayoritario). Leer la cabecera como autoridad
# rompería el segundo; leerla como red sólo agrega documentos que hoy se pierden enteros.
CABECERA_SUJETO = ("camino", "id", "sujeto", "pantalla")
PALABRAS_CABECERA = re.compile(r"[a-záéíóúñ]+")


# PLATCONV (2026-09-30) - el vocabulario de `plataforma` es CERRADO y de dos valores. No admite
# sinonimos a proposito: `pwa`, `desktop` y `app` NO son plataformas (`desktop` es un CAMINO dentro
# de web, y `app`/`proto` son la columna `superficie`, que es otra cosa). Si cada documento elige su
# palabra, el lector vuelve a tener una poblacion que no puede separar - que es el defecto que este
# bloque cierra.
# El separador de la clave, en UN solo lugar: se escribia literal en 4 sitios y la clave ahora
# tiene 3 componentes, asi que un quinto literal desalineado seria un bug mudo.
SEP_CLAVE = "\u00b7"
CABECERA_PLATAFORMA = ("plataforma",)
VOCABULARIO_PLATAFORMA = {"web": "web", "mobile": "mobile"}
# El tercer cubo NO es un valor que alguien pueda escribir: es lo que el lector NO pudo leer. Existe
# porque el fail-open de hoy es contar eso como web.
SIN_PLATAFORMA = "indeterminada"

# El campo INLINE `plataforma: <valor>`, que es como declara plataforma una medicion que NO vive en
# una tabla. NO lo invente yo: frontend1 ya lo escribio 21 veces en
# `2026-09-28_cierre_..._BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md` (un documento en prosa
# por `###` id), junto a cada `medido_contra:`. Abri PLATHEAD preguntando QUE mecanismo podian usar
# los headings para declarar plataforma, y el mecanismo ya existia en el corpus: el que no lo miraba
# era este lector. Es el reverso de la costura que ya tenemos documentada -- ahi el instrumento leia
# un campo que nadie escribia; aca el campo se escribe y nadie lo lee.
#
# Exige los dos puntos, y por eso no matchea la CABECERA de una tabla (`| ... | plataforma |`) ni una
# mencion en prosa («la columna `plataforma` no existe»). El valor se corta en el backtick o el fin
# de linea, que es como esta escrito en el corpus.
DECL_PLATAFORMA_INLINE = re.compile(r"`?\s*plataforma\s*:\s*([A-Za-z][\w/ -]*)", re.I)


def columna_de_plataforma(celdas):
    """El indice que la CABECERA declara como columna de plataforma, o None.

    Mismo mecanismo que `columna_de_sujeto` y por la misma razon: la cabecera ya sabe donde vive el
    dato, y adivinarlo por contenido confundiria `web` (plataforma) con una celda que menciona la
    web en prosa."""
    for i, c in enumerate(celdas or ()):
        if set(PALABRAS_CABECERA.findall(limpiar(c).lower())) & set(CABECERA_PLATAFORMA):
            return i
    return None


def plataforma_de_celda(cel):
    """La plataforma que declara UNA celda, o None si no declara EXACTAMENTE una del vocabulario.

    La celda tiene que SER el token y nada mas. Antes bastaba con que contuviera **un solo** token del
    vocabulario, y eso era un fail-open medido:

        `reveal` -> plataforma = 'ambas (mobile `[ASSUMED_PENDING_VERIFY]`, linea no releida)'

    Esa celda dice «ambas» y encima declara que mobile NO fue verificado — y el lector la contaba como
    una medicion LIMPIA de `mobile`, porque `mobile` era el unico token del vocabulario que aparecia.
    O sea que la unica palabra que el lector miraba era la del hedge. frontend2 reporto 4 filas
    `ambas` en ese documento y mi instrumento reportaba 3: la cuarta no estaba perdida, estaba
    PROMOVIDA a un veredicto de plataforma que nadie habia medido.

    Un hedge no es una declaracion. Si la celda necesita explicar, lo que declara es la duda, y la
    duda se cuenta en `indeterminada` con su valor crudo a la vista — que es accionable— en vez de
    desaparecer dentro de una cifra de cobertura.

    Sigue valiendo el motivo original de `== 1`: «web y mobile» no es una medicion de ninguna de las
    dos, es una fila que hay que partir. Devolver `web` porque aparece primero seria elegir por orden
    de lectura, que es adivinar con cara de medir."""
    pelada = limpiar(cel or "").strip().lower()
    return VOCABULARIO_PLATAFORMA.get(pelada)


def sujeto_de_celda(cel, ids):
    """Los tres intentos de leerle un sujeto a UNA celda, de señal más fuerte a más débil.

    Vive en una función porque hay DOS call-sites: la primera celda (siempre) y la columna que la
    cabecera nombra (sólo si la primera no dio nada). Duplicar los tres intentos sería el defecto que
    este repo ya pagó —un fix que llega a una sola de dos copias—, y acá el costo sería peor que de
    costumbre: la asimetría backtick-vs-padrón es justamente la pieza que impide inventar sujetos
    leyendo prosa, así que una copia desincronizada la aflojaría sin dar síntoma.
    """
    m = SUJ_CELDA.match(cel)
    if m:
        return m.group(1), "celda"
    mp = SUJ_CELDA_PELADA.match(cel)
    if mp and mp.group(1) in ids:
        return mp.group(1), "celda-pelada"
    # TERCER intento: el id del PADRON con la forma que el padron le dio (ver SUJ_CELDA_RARA). Dos
    # variantes, las dos condicionadas a `ids`:
    #   a) declarado entre backticks, con o sin glosa:  | `(home)` (Mi dia) |
    #   b) la celda entera, pelada de adorno markdown:  | **(home)** |
    # La (a) es la forma que los documentos usan DE VERDAD, y casi se me escapa: la primera version
    # solo hacia (b), el caso (b) del test pasaba, y el verde parcial tapaba que la forma real seguia
    # ilegible. Lo caza el caso con glosa.
    mr = SUJ_CELDA_RARA.match(cel)
    if mr and mr.group(1).strip() in ids:
        return mr.group(1).strip(), "celda-padron-bt"
    crudo = cel.strip().strip("*").strip().strip("`").strip()
    if crudo in ids:
        return crudo, "celda-padron"
    return None, None


def columna_de_sujeto(celdas):
    """El índice que la CABECERA declara como columna de sujeto, o None si no declara ninguna.

    Se compara por PALABRA y no por substring: `referencia_prototipo` no declara nada, `id del
    hallazgo` sí. Un None acá no es un fallo — la enorme mayoría de las tablas pone el sujeto en la
    primera celda y no necesita esto.
    """
    for i, c in enumerate(celdas or ()):
        if set(PALABRAS_CABECERA.findall(limpiar(c).lower())) & set(CABECERA_SUJETO):
            return i
    return None


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
    col_sujeto = None
    col_plataforma = None
    for n, linea in enumerate(lineas, 1):
        if es_separador(linea):
            # El separador NO es fila ni cabecera: no abre ni cierra alcance. Saltearlo no es un
            # detalle — `fila_de_tabla` le devuelve None, y el separador vive SIEMPRE entre la
            # cabecera y sus filas, así que sin esta línea el reset de abajo borra `col_sujeto`
            # exactamente una línea después de calcularlo y el fallback no corre NUNCA. Medido con
            # fixture mínimo: `columna_de_sujeto` devolvía 1 en la cabecera y las dos filas salían
            # con sujeto None igual. `veredictos_de` ya tenía esta guarda como primera línea de su
            # loop; reimplementé el mecanismo de cabecera sin traerla.
            continue
        celdas = fila_de_tabla(linea)
        if celdas is None:
            # el alcance de una cabecera muere con su tabla - LAS DOS columnas, o la plataforma de
            # una tabla se le pegaria a la siguiente, y eso es peor que no leerla: seria un valor
            # inventado con apariencia de medido.
            col_sujeto = None
            col_plataforma = None
        if n in cabeceras:
            col_sujeto = columna_de_sujeto(celdas)
            col_plataforma = columna_de_plataforma(celdas)
            continue
        nueva = None
        if celdas:
            sujeto, forma = sujeto_de_celda(celdas[0], ids)
            if sujeto is None and col_sujeto is not None and 0 < col_sujeto < len(celdas):
                # SEGUNDA mirada, sólo si la primera celda no declaró nada: la columna que la
                # cabecera nombra. `0 <` porque si la cabecera nombra la columna 0 ya se intentó.
                sujeto, forma = sujeto_de_celda(celdas[col_sujeto], ids)
                if sujeto is not None:
                    forma += "-col"
            if sujeto is not None:
                # La plataforma sale de la COLUMNA o no sale. Sin columna -> `indeterminada`, que se
                # cuenta aparte y NUNCA dentro de web: contar «no se» como «web» es exactamente el
                # fail-open que producia el `54 de 54`.
                plat, cruda = SIN_PLATAFORMA, ""
                if col_plataforma is not None and col_plataforma < len(celdas):
                    leida = plataforma_de_celda(celdas[col_plataforma])
                    if leida:
                        plat = leida
                    else:
                        # La columna ESTA y su valor no es del vocabulario. Se guarda crudo para
                        # poder nombrarlo: «falta la columna» y «la columna dice `pwa`» son dos
                        # trabajos distintos, y un solo cubo los hace indistinguibles.
                        cruda = celdas[col_plataforma].strip()
                nueva = {"id": sujeto, "camino": "", "linea": n,
                         "forma_decl": forma, "plataforma": plat, "plat_cruda": cruda,
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
                # Un heading o un bullet no tienen columna, asi que la plataforma es
                # `indeterminada` y NO se infiere del titulo del documento ni del nombre del
                # archivo: el NOMBRE es una hipotesis sobre el contenido, no una medicion de el.
                actual = {"id": m.group(1), "camino": camino_de(m.group(2)), "linea": n,
                          "forma_decl": "heading" if es_heading else "bullet",
                          "plataforma": SIN_PLATAFORMA, "plat_cruda": "",
                          "veredictos": []}
                nivel_cierre = (len(linea) - len(linea.lstrip("#"))) if es_heading else 6
                meds.append(actual)
        if actual is not None:
            # La plataforma declarada INLINE en el bloque del heading. `actual` sólo se setea para
            # heading/bullet (una fila de tabla cierra y hace `continue` más arriba), así que acá no
            # hay riesgo de pisar lo que leyó la columna.
            mp = DECL_PLATAFORMA_INLINE.search(linea)
            if mp:
                leida = plataforma_de_celda(mp.group(1))
                previa = actual["plataforma"]
                if leida is None:
                    # Declarada y FUERA del vocabulario: se guarda cruda para poder nombrarla. Es la
                    # misma distinción que en la columna — «no declaró» y «declaró `pwa`» son dos
                    # trabajos distintos y un solo cubo los vuelve indistinguibles.
                    if not actual["plat_cruda"]:
                        actual["plat_cruda"] = mp.group(1).strip()
                elif previa == SIN_PLATAFORMA:
                    actual["plataforma"] = leida
                elif previa != leida:
                    # DOS declaraciones DISTINTAS en el mismo bloque. NO gana la última: eso sería
                    # elegir por orden de lectura con cara de medir, el mismo fail-open que el caso
                    # «web y mobile» en una celda. Ambiguo ⇒ indeterminada, y se dice por qué.
                    actual["plataforma"] = SIN_PLATAFORMA
                    actual["plat_cruda"] = "conflicto:%s+%s" % (previa, leida)
        if actual is not None and n in por_linea:
            actual["veredictos"] += [v for v, _, _ in por_linea[n]]

    # Los veredictos que NO cayeron bajo ningún sujeto declarado son el otro lado del hueco: están
    # leídos pero huérfanos, y sumarlos al total los haría parecer atribuidos.
    atribuidos = sum(len(m["veredictos"]) for m in meds)
    huerfanos = sum(len(v) for v in por_linea.values()) - atribuidos
    return hits, meds, huerfanos


def filas_ciegas_de(texto, ids, armas=ARMAS):
    """Filas con FORMA de medición del criterio que el lector no pudo atribuir a ningún sujeto.

    Este detector es A PROPÓSITO más ancho que el lector: acepta el id del padrón en CUALQUIER
    celda, mientras que `mediciones_de` sólo mira la primera y la que la cabecera nombra. Ese margen
    ES el mecanismo — un detector tan ancho como su lector no puede avisar de la ceguera de su
    lector, que es exactamente cómo el `cierre_` de frontend2 pasó dos días invisible.

    Las tres condiciones de una fila ciega, y cada una está para descartar un falso positivo medido
    sobre los 1979 documentos del buzón (2026-09-30):

      · la fila tiene un veredicto del VOCABULARIO CERRADO leído en posición de medición. Sin esto,
        se marcaba `A2.md` — 12 veredictos sobre filas del BACKLOG (`BL-F1`, `BL-J2`), que no mide
        el criterio 3 y nunca debió entrar.
      · alguna celda DESPUÉS de la primera declara un id DEL PADRÓN. El padrón es cerrado y externo,
        así que esto no puede inventar sujetos; y la celda 1 se excluye porque si el id está ahí el
        lector ya lo ve, y si no lo vio es el otro defecto (el del alfabeto, con su propio canario).
      · el lector NO registró ninguna medición en esa línea.

    Medición del discriminante, que es lo que decide que esto se pueda usar como gate: 1 documento
    de 1979 antes del fix de columna, 0 después. La variante que además marcaba filas sueltas de
    documentos que SÍ miden daba 3 falsos positivos de 5 — una tabla de taxonomía cuyos ids están en
    rol de EJEMPLO (`| el hecho es… | cajón correcto | ejemplo medido |`). Por eso el call-site sólo
    lo aplica a documentos que atribuyen CERO ids: se acepta el falso negativo de la tabla mixta
    antes que un guard que grita en el caso normal y enseña a saltearlo.
    """
    hits, meds, _ = mediciones_de(texto, armas, ids)
    cerrado_en = {n for n, v, f, _ in hits if f != "hueco" and v in VOCABULARIO}
    leidas = {m["linea"] for m in meds if m["veredictos"]}
    lineas = texto.splitlines()
    cabeceras = {n for n in range(1, len(lineas) + 1)
                 if n < len(lineas) and es_separador(lineas[n])}
    ciegas = []
    for n, linea in enumerate(lineas, 1):
        if n in cabeceras or n not in cerrado_en or n in leidas:
            continue
        celdas = fila_de_tabla(linea)
        if not celdas:
            continue
        for i, cel in enumerate(celdas[1:], 1):
            sid, _forma = sujeto_de_celda(cel, ids)
            if sid in ids:                 # el `in ids` NO es redundante: `sujeto_de_celda` acepta
                ciegas.append((n, i, sid))  # cualquier token entre backticks (la asimetría), y acá
                break                       # eso marcaría cualquier celda con una palabra citada.
    return ciegas


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


def ids_cerrados_por_plataforma(con, ids):
    """{plataforma: [ids del padron con veredicto CERRADO *en esa plataforma*]}.

    ES la cifra de PLATCONV, y reemplaza al numero unico. `ids_del_criterio_cerrados` colapsa la
    clave al id, asi que devuelve el MISMO total con clave nueva - si la cifra publicada siguiera
    saliendo de ahi, el arreglo seria invisible y el `54 de 54` volveria por la puerta de al lado.

    Un id puede estar en DOS cubos (medido en web y en mobile) y eso es correcto: son dos coberturas.
    Lo que no puede es estar en `web` por un veredicto que se midio en mobile - ese es el control
    positivo que el contrato exige y el que el test clava.
    """
    salida = {p: set() for p in (*VOCABULARIO_PLATAFORMA.values(), SIN_PLATAFORMA)}
    for clave, vs in con.items():
        i = clave.split(SEP_CLAVE)[0]
        plat = clave.rsplit(SEP_CLAVE, 1)[1] if SEP_CLAVE in clave else SIN_PLATAFORMA
        if i not in ids or not any(v in VOCABULARIO for v in vs):
            continue
        salida.setdefault(plat, set()).add(i)
    return {p: sorted(s) for p, s in salida.items()}


def ids_solo_no_comparacion_por_plataforma(con, ids):
    """{plataforma: [ids cuya cobertura EN ESA PLATAFORMA es SOLO no-comparacion]}.

    🔴 Lo destapo una pregunta de frontend2, y sin esto la cifra por plataforma miente hacia arriba.
    `NO_REPRODUCIBLE_SIN_EFECTO`, `NO_MEDIBLE`, `FUERA-DE-REFERENCIA` y `PENDIENTE_DEVICE` estan en el
    VOCABULARIO CERRADO, asi que un id con uno de esos cuenta como «cubierto» — pero ninguno es una
    COMPARACION: son las cuatro formas de decir que la comparacion NO se hizo.

    El caso concreto: `vacio` y `vacio-visto` son `NO_REPRODUCIBLE_SIN_EFECTO` (no hubo comparacion en
    NINGUNA plataforma). Si se les agrega `plataforma: web` para bajar `indeterminada`, suben la cifra
    de cobertura de web sin que nadie haya comparado nada — o sea que el trabajo de «completar la
    columna» INFLA el numerador. frontend2 se nego a partirlas en dos por exactamente ese motivo, y
    tenia razon: partirlas afirmaria dos intentos de medicion donde hubo cero.

    El total por plataforma no se cambia (un `PENDIENTE_DEVICE` declarado ES informacion sobre esa
    plataforma); lo que se hace es DECIRLO al lado, la misma regla que ya aplica el total de veredictos
    con su «de las cuales no-comparacion».

    Agrega por (id, plataforma) ANTES de decidir: un id con una fila de comparacion y otra de
    no-comparacion en la MISMA plataforma no es «solo no-comparacion». Sin ese paso, la clave por
    documento lo contaria dos veces y en cubos distintos.
    """
    porIdPlat = {}
    for clave, vs in con.items():
        i = clave.split(SEP_CLAVE)[0]
        plat = clave.rsplit(SEP_CLAVE, 1)[1] if SEP_CLAVE in clave else SIN_PLATAFORMA
        if i not in ids:
            continue
        delVocab = [v for v in vs if v in VOCABULARIO]
        if not delVocab:
            continue
        porIdPlat.setdefault((i, plat), []).extend(delVocab)
    salida = {p: set() for p in (*VOCABULARIO_PLATAFORMA.values(), SIN_PLATAFORMA)}
    for (i, plat), vs in porIdPlat.items():
        if all(v in NO_COMPARACION for v in vs):
            salida.setdefault(plat, set()).add(i)
    return {p: sorted(s) for p, s in salida.items()}


def huella_del_instrumento():
    """Identidad del ARCHIVO que produjo la cifra: `sha12 · N lineas · <ruta>`.

    🔴 Auditoria midio el 2026-09-30 que hay **cinco definiciones divergentes** de este mismo script
    vivas al mismo tiempo, una por worktree (1361, 1407, 1480, 1663 y 1764 lineas). La cifra oficial
    salio de UNA de las cinco y el numero no decia de cual. El padron de ciegos era identico en las
    cinco, asi que la divergencia esta en el PARSER — justo lo que cambia el resultado.

    El hash del contenido, y no `git rev-parse`: dos worktrees con el mismo contenido tienen que dar
    la misma huella, y `git -C` en un worktree roto CONTESTA por el checkout principal sin fallar
    (documentado en memoria). El hash no depende de git ni de que el arbol este limpio. La rama va al
    lado como comodidad, pero la identidad es el sha.

    Mientras el grafo bloquee los merges esto crece: es un COSTO del bloqueo, no una causa aparte.
    """
    try:
        ruta = Path(__file__).resolve()
        crudo = ruta.read_bytes()
        return "%s · %d líneas · %s" % (
            hashlib.sha256(crudo).hexdigest()[:12],
            len(crudo.splitlines()),
            ruta)
    except OSError as e:
        # Un fallo de lectura no puede tumbar la medicion, pero TAMPOCO puede pasar callado: sin
        # huella, la cifra vuelve a ser anonima y eso es justo lo que este control corrige.
        return "⚠️ HUELLA NO DISPONIBLE (%s) — la cifra de abajo no se puede atribuir a un archivo" % e


def cruzar_no_comparacion(lotes):
    """{plataforma: [ids que en esa plataforma NO tuvieron comparacion en NINGUN documento]}.

    El cruce es por DOCUMENTO y no una union directa de los «solo no-comparacion» de cada uno. Un id
    puede ser `NO_MEDIBLE` en un doc y `COHERENTE` en otro: unir los parciales lo dejaria marcado como
    no comparado cuando SI se comparo en otro lugar, y entonces la advertencia seria tan mentirosa
    como la cifra que existe para corregir.

    Por eso primero se calcula quien tiene AL MENOS UNA comparacion en algun doc —`cerrados menos
    solo-no-comparacion`, por doc— y ese conjunto RESTA.
    """
    comparados, parciales = {}, {}
    for d in lotes:
        cerr = d.get("ids_cerrados_por_plataforma", {}) or {}
        nc = d.get("ids_solo_no_comparacion_por_plataforma", {}) or {}
        for p, lista in cerr.items():
            comparados.setdefault(p, set()).update(set(lista) - set(nc.get(p, ())))
        for p, lista in nc.items():
            parciales.setdefault(p, set()).update(lista)
    return {p: sorted(s - comparados.get(p, set())) for p, s in parciales.items()}


# Las formas que VIVEN EN UNA TABLA, o sea las unicas donde «agregar la columna `plataforma`» es una
# accion posible. `sujeto_de_celda` devuelve `celda*` (y `*-col` cuando el sujeto salio de la columna
# que la cabecera nombra), asi que el prefijo alcanza y no hay que enumerar sus variantes.
FORMAS_DE_TABLA = ("celda",)


def plataformas_sin_leer(meds, padron=()):
    """(filas de TABLA sin columna, {valor crudo invalido: lineas}, fuera de tabla, AJENAS al padron).

    🔴 Las tres cosas estan separadas porque mezclarlas ya mando trabajo al lugar equivocado. La
    version anterior devolvia un solo `sin_col` con las 77 mediciones sin plataforma, y el reporte lo
    publicaba como «77 medicion(es) sin columna `plataforma`» con los documentos que mas aportaban.
    Medido despues: 44 de esas 77 son HEADINGS y 4 son BULLETS -- formas que no tienen columna y no
    pueden tenerla-- y solo 29 son filas de tabla. Con esa cifra le atribui 20 filas al `cierre_` de
    FE1, que aporta **0**; FE1 contesto «0 sin columna» y tenia razon. Las dos mediciones eran
    honestas y contaban poblaciones distintas.

    ✅ RESUELTO el 2026-09-30, y no por diseño nuevo: un heading no puede declarar plataforma en una
    columna que no existe, asi que abri PLATHEAD preguntando QUE mecanismo usar. El mecanismo ya
    estaba en el corpus — frontend1 escribio `plataforma: web` inline 21 veces en su `cierre_` del
    lote A, junto a cada `medido_contra:`. Lo unico que faltaba era que este lector lo mirara
    (`DECL_PLATAFORMA_INLINE`). Medido: `indeterminada` 31 -> 15, web 45 -> 48 de 54.

    Por eso el tercer cubo sigue siendo ACCIONABLE: son las mediciones fuera de tabla que tampoco
    usaron el campo inline. Lo que cambia es la accion (agregar el campo, no la columna), no la
    accionabilidad.

    🔴 ACCFALSO (2026-10-05) — EL CUARTO CUBO. La forma de tabla NO alcanza para pedir la columna:
    hace falta que la fila hable de un SUJETO DEL PADRON. Sin ese filtro este lector reportaba
    «ACCIONABLE (agregar la columna): 3 filas» sobre una tabla de CAMPOS DOM del `cierre_` de
    frontend2 (`presupuesto-item-0-precio`, `gasto-monto`, `ingreso-monto`, con colores RGB): tiene
    forma de tabla y no tiene la columna, pero no es una medicion del criterio 3 y agregarle
    `plataforma` no significaria nada. Lo midio frontend2 cuando le atribui ese trabajo: «ninguna
    fila ahi declara un id del padron». Un instrumento que manda a hacer trabajo inutil INFLA su
    propio denominador de lo pendiente, y el que lo lee no puede distinguir las filas reales.

    El filtro va ANTES del test de forma a proposito: un heading que mide `facutra` tampoco tiene
    que declarar `plataforma: web` inline. El criterio de accionabilidad es el SUJETO, no la forma —
    por eso el cubo se llama «ajenas al padron» y no «filas de tabla ajenas», y por eso al aplicarlo
    bajaron los DOS cubos (3 filas de tabla y 1 heading, medido el 2026-10-05).

    El dato ya existia y no se usaba: `medir()` separa `ids_medidos_fuera_del_padron` desde el
    2026-09-29 y publicaba esos mismos 3 ids. Por eso el cuarto cubo se REPORTA y no se descarta —
    un id ajeno al padron puede ser un typo (`facutra`), una pantalla retirada o un campo DOM, y las
    tres se ven en ese cubo. Lo que cambia es que ya no se cobra como trabajo pendiente.
    """
    padron = set(padron)
    sin_col, vocab, fuera_de_tabla, ajenas = [], {}, [], []
    for m in meds:
        if m.get("plataforma", SIN_PLATAFORMA) != SIN_PLATAFORMA:
            continue
        if m.get("plat_cruda"):
            vocab.setdefault(m["plat_cruda"], []).append(m["linea"])
        elif padron and m.get("id") not in padron:
            # Sin padron (llamada sin el argumento) NO se filtra: un filtro que se activa con un
            # default vacio borraria TODO el cubo accionable en silencio, que es peor que el falso
            # positivo que arregla.
            ajenas.append(m["linea"])
        elif m.get("forma_decl", "").startswith(FORMAS_DE_TABLA):
            sin_col.append(m["linea"])
        else:
            fuera_de_tabla.append(m["linea"])
    return sin_col, vocab, fuera_de_tabla, ajenas


def agregado_por_plataforma(lotes, ids):
    """Union de los `ids_cerrados_por_plataforma` de todos los lotes + QUIENES faltan en web.

    🔴 POR QUE ES UNA FUNCION Y NO SIGUE INLINE EN EL REPORTE: este agregado se computaba dentro del
    bloque de impresion, o sea DESPUES del `return` de `--json` — exactamente el defecto que ya se
    pago en este archivo con el gate de CONTRASTE (ver su comentario en `main`). La cifra del
    criterio («web N de 54») existia SOLO en el texto para humanos, y el unico consumidor que la
    suite llama de verdad es `--json`, que publicaba los lotes crudos y ningun agregado: para saber
    la cifra habia que re-implementar esta union. Dos implementaciones de la misma cifra divergen, y
    la que divergio ya mando a medir ids que estaban medidos.

    FALTANTES NOMBRADOS, no contados: `web_faltan` existe porque «49 de 54» no nombraba a nadie, asi
    que los 5 que faltaban no se podian cerrar NI se podia descubrir que 4 de ellos eran incerrables
    (ver `SIN_REFERENCIA_EN_CAPA_ESCRITORIO`). El techo se publica al lado de la cifra."""
    plat = {}
    for d in lotes:
        for p, lista in (d.get("ids_cerrados_por_plataforma") or {}).items():
            plat.setdefault(p, set()).update(lista)
    padron = set(ids)
    web = plat.get("web", set())
    faltan = sorted(padron - web)
    sin_ref = [i for i in faltan if i in SIN_REFERENCIA_EN_CAPA_ESCRITORIO]
    salida = {p: sorted(v) for p, v in sorted(plat.items())}

    # 🔴 LA CIFRA QUE EL ACTA EXIGE NO LA PUBLICABA NADIE. El acta pide el veredicto cerrado en WEB
    # **Y** MOBILE para los 54 ids; esta funcion publicaba las dos listas por separado y nunca su
    # conjuncion, asi que para responder la pregunta del acta habia que intersecar a mano — y quien
    # no lo hacia citaba la cifra alta (`web 50 de 54`) como si respondiera. Publicar dos listas no
    # es publicar su interseccion, y el lector asume que la cifra que encuentra es la respuesta a su
    # pregunta: tres cifras del mismo criterio circularon el 2026-10-05 y gano la mas alta, que era
    # la unica sin calificador. Computado primero por auditoria (9 de 54) y adoptado aca para que
    # salga del instrumento y no de una re-implementacion: dos implementaciones de la misma cifra
    # divergen, que es el defecto que el docstring de esta funcion ya documenta.
    # [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]] · [[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]]
    mobile = plat.get("mobile", set())
    ambas = sorted(web & mobile)
    salida.update({
        "ids_en_web_Y_mobile": ambas,
        "ids_en_web_Y_mobile_n": len(ambas),
        "ids_con_web_sin_mobile": sorted(web - mobile),
        "ids_con_mobile_sin_web": sorted(mobile - web),
        # La unidad va PEGADA a la cifra, no en el README: una cifra sin unidad se deja citar para
        # cualquier pregunta, y es exactamente lo que paso con «54 de 54».
        "unidad": (f"ids del padron de {len(padron)} con veredicto del vocabulario cerrado, POR "
                   f"PLATAFORMA. `ids_en_web_Y_mobile_n` es la UNICA que responde el criterio del "
                   f"acta (web Y mobile); las listas `web`/`mobile` por separado NO lo responden."),
    })
    salida.update({
        "web_faltan": faltan,
        # El set ya NO descuenta: informa. `accionables` vuelve a ser TODOS los que faltan, porque
        # para los 4 sin referencia tambien hay una accion nombrable (que su documento declare
        # `FUERA-DE-REFERENCIA`). Mientras `accionables` se vaciaba por construccion, la lista de
        # pendientes no podia tener elementos y nadie podia descubrir que faltaba hacer algo.
        "web_faltan_sin_referencia_en_capa_escritorio": sin_ref,
        "web_faltan_accionables": faltan,
        "web_techo_alcanzable": len(padron),
    })
    return salida


# ── SUPERACION DE VEREDICTOS: el mecanismo que faltaba en CONFLICTOSINDUENO ────────────────────
#
# EL PROBLEMA, medido el 2026-10-05. Auditoria barrio los 12 conflictos de veredicto y encontro que
# 10 traen su COHERENTE del MISMO documento (un barrido de cascara del 22/09, superado despues por
# mediciones mas finas DEL MISMO ROL). Frontend1 cerro su mitad ese mismo dia: agrego al final de su
# documento una nota en prosa marcando las 10 filas como superadas, verificada linea por linea
# contra los 5 documentos que las reemplazan. Trabajo correcto y completo.
#
# **Y la cifra siguio diciendo 12.** La nota estaba escrita en un idioma que el instrumento no lee,
# asi que el trabajo del rol dueno no llego al reporte. Es la misma clase que
# `memoria/el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno.md`, un nivel mas arriba: no
# fallo un parser, fallo el circuito entre quien tiene la autoridad y quien publica la cifra.
#
# POR QUE NO SE PARSEA LA PROSA, aunque se podria. Dentro de esa nota los ids aparecen en backticks
# — pero tambien aparecen los nombres de los 5 documentos, que contienen `card-cobro`, `card-presu`
# y `factura` adentro. Un extractor de backticks filtrado por padron funcionaria HOY y retiraria un
# veredicto de mas el dia que una explicacion mencione un id al pasar. Y el costo de un falso
# positivo acá es el peor que tiene este instrumento: retirar un veredicto OCULTA un conflicto, o
# sea fabrica el COHERENTE falso que todo este contraste existe para cazar. Un mecanismo cuyo modo
# de falla es «desactiva trabajo sin dejar rastro» no se construye sobre una heuristica.
#
# LA FORMA CANONICA, en comentario HTML para que no altere el render del documento:
#
#   <!-- SUPERADO 2026-10-05 por frontend1: 10 ids -->
#   <!-- SUPERADO-IDS: esc, factura, comousar, soporte, bi, card, card-cobro, card-presu, card-cliente, preg -->
#
# El CONTEO declarado es el control, y es lo que separa esto de una heuristica: si el parser lee una
# cantidad distinta de la declarada, rompe. Sin el, un id mal tipeado o una coma de mas se tragan
# en silencio — y «silencio» acá significa un veredicto que se retiro o que no se retiro sin que
# nadie se enterara.
#
# La marca la escribe EL ROL DUENO en SU PROPIO documento, que es la unica forma de respetar las dos
# reglas a la vez: la propiedad del veredicto es del rol (no de la sesion) y nadie edita la carpeta
# de otra sesion. No hay lista central en este archivo a proposito: una lista central obligaria al
# dueno del veredicto a pedirme que yo lo escriba, que es exactamente el cuello de botella que
# CONFLICTOSINDUENO describe.
SUPERADO_RX = re.compile(
    r"<!--\s*SUPERADO\s+(\d{4}-\d{2}-\d{2})\s+por\s+([A-Za-z0-9_-]+)\s*:\s*(\d+)\s+ids?\s*-->")
SUPERADO_IDS_RX = re.compile(r"<!--\s*SUPERADO-IDS\s*:\s*([^>]+?)\s*-->")
# La forma EN PROSA que ya se uso (frontend1, 22/09 + nota del 05/10). No se parsea para retirar: se
# detecta para REPORTAR que hay un trabajo hecho que el instrumento no esta contando. Es el canario
# del circuito, no el circuito.
SUPERADO_PROSA_RX = re.compile(r"\*\*Superad[oa]\s*\(", re.IGNORECASE)


def superados_del_documento(txt, ids, doc):
    """(set de ids superados, nota) leidos de la marca canonica. Rompe si el conteo no cierra.

    Devuelve set() cuando no hay marca. `nota` describe lo que se encontro, para el reporte.
    """
    m = SUPERADO_RX.search(txt)
    if not m:
        if SUPERADO_PROSA_RX.search(txt):
            return set(), {"en_prosa_no_leida": True}
        return set(), {}
    fecha, rol, cuantos = m.group(1), m.group(2), int(m.group(3))
    mi = SUPERADO_IDS_RX.search(txt)
    if not mi:
        sys.exit(f"SUPERADO SIN LISTA — {doc} declara «SUPERADO {fecha} por {rol}: {cuantos} ids» y "
                 f"no trae la linea `<!-- SUPERADO-IDS: a, b, c -->`. Declarar la cantidad sin la "
                 f"lista no retira nada y se lee como si hubiera retirado {cuantos}.")
    leidos = [x.strip().strip("`") for x in mi.group(1).split(",") if x.strip()]
    if len(leidos) != cuantos:
        sys.exit(f"SUPERADO: EL CONTEO NO CIERRA — {doc} declara {cuantos} ids y la lista trae "
                 f"{len(leidos)}: {leidos}. Este control es el que separa esto de una heuristica: "
                 f"sin el, una coma de mas o un id mal tipeado retira (o deja de retirar) un "
                 f"veredicto en silencio, y retirar de mas OCULTA un conflicto — el COHERENTE falso "
                 f"que este contraste existe para cazar.")
    fuera = [i for i in leidos if i not in ids]
    if fuera:
        sys.exit(f"SUPERADO: IDS FUERA DEL PADRON — {doc} marca {fuera} como superados y no estan "
                 f"en el padron de la spec. O el id esta mal escrito, o se esta retirando algo que "
                 f"el criterio no mide; las dos cosas se arreglan mirando, no ignorando.")
    return set(leidos), {"fecha": fecha, "rol": rol, "ids": sorted(leidos)}


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
# ✅ CERRADO (PLATCONV, 2026-09-30). Esta linea decia: «LIMITACION CONOCIDA del contraste: la clave
# es `id·camino` y **no lleva la superficie**, asi que no puede distinguir por si mismo un conflicto
# real de una comparacion web-vs-mobile». Era el defecto completo escrito por el propio instrumento,
# y de ahi salia el `54 de 54`: la clave colapsaba dos poblaciones.
#
# Hoy la clave es `id·camino·plataforma` y la cifra se publica partida en web / mobile /
# indeterminada. Lo que NO cambia y hay que seguir mirando: el contraste sigue cruzando por ID, asi
# que dos veredictos distintos del MISMO id en plataformas distintas siguen entrando como conflicto
# aunque no lo sean. La diferencia es que ahora la plataforma esta en la clave y se puede ver; antes
# habia que verificarla a mano y nadie tenia como saber cuando hacia falta.
# ✅ DIRIMIDO el 2026-09-30 por auditoria, con medicion propia. El texto anterior decia
# «[POR VERIFICAR] Choque sistematico matriz-web-22/09 (COHERENTE) vs mediciones 28-29/09 (DESVIO)»
# y ACUSABA AL DOCUMENTO EQUIVOCADO: medido desde la salida de este mismo script, `matriz-web-re-
# medida` aporta 0 de 12 COHERENTE — los 12 salen del barrido `BL-Q3-web` del 22/09 02:11, y la
# matriz del MISMO autor y el MISMO dia los baja a REQUIERE_TRIAGE en 6 de 12. Quien fue a dirimirlo
# abrio el documento que no era y perdio una vuelta; el nombre de la constante fue parte del engaño.
#
# Gano la lectura (a) SUCESION, y no como estaba escrita: no es que la pantalla cambio entre el 22 y
# el 29 —midieron 0 commits en `apps/copiloto-web/src/modules/account/` en esa ventana, con control
# positivo de 111 commits en `origin/main`— es que la MEDICION fue corregida por su propio autor a
# horas de distancia. La (b) (contaminacion de regimen) NO fue necesaria; queda como no descartable
# porque las 21 capturas del proto del 22/09 no declaran viewport, y eso ya se arreglo hacia adelante
# con `PROTO_SOLO_390`.
#
# Re-medidos hoy app@390 vs proto@390: `cuenta`, `soporte`, `esc` DESVIO · `comousar` DESVIO menor ·
# `factura` y `preg` NO MEDIBLES. **Ninguno sobrevive como COHERENTE.** El barrido no acerto en
# ninguno de los que se pudieron medir.
#
# ⚠️ Lo que este dictamen NO cierra, y es el mecanismo raiz: un veredicto de barrido y uno de
# re-medicion tienen el MISMO formato y el MISMO peso, asi que el contraste no puede saber que uno
# supera al otro y los cuenta a los dos vigentes. Ya estaba escrito en
# `memoria/el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario.md` como uno de
# DOS defectos; el otro (el vocabulario no admitia `REQUIERE_TRIAGE`) ya se cerro. Falta este.
HIPOTESIS_MATRIZ_2209 = ("[DIRIMIDO 2026-09-30] El COHERENTE sale del BARRIDO `BL-Q3-web` 22/09 "
                         "02:11, NO de `matriz-web-re-medida` (0 de 12). Es una medicion y su "
                         "propia correccion, del mismo autor y el mismo dia, contadas las dos como "
                         "vigentes. Vigente: DESVIO — re-medido app@390 vs proto@390 en cuenta, "
                         "soporte, esc y comousar. El COHERENTE del barrido queda RETIRADO.")

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
    "bi": "[DIRIMIDO 2026-09-29] COHERENTE (matriz-web-re-medida, FE1 22/09, «recapturado con espera real a datos») vs "
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
        # PLATCONV: la clave lleva la PLATAFORMA. Los consumidores que sacan el id siguen
        # andando sin cambio porque todos usan `split(PUNTO)[0]` (verificado: `:1145`, `:1165`,
        # `:1239`) y el id no puede contener el separador; la plataforma se saca con `rsplit`,
        # no con un indice fijo, porque un `camino` si puede traerlo.
        clave = f"{m['id']}·{m['camino'] or 'único'}·{m.get('plataforma', SIN_PLATAFORMA)}"
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
    # `plataformas_sin_leer` se computa ACA y no en `main` porque necesita `meds`, que es
    # interno de esta funcion. Devolver `meds` entero expondria la estructura del parser a
    # quien solo quiere saber donde falta la columna.
    return hits, con, sin, sitios, huerfanos, fuera, plataformas_sin_leer(meds, padron)


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
               "mediciones_declaradas": "claves `id·camino·plataforma` nombradas en el doc "
                                        "(con veredicto o sin)",
               "ids_cerrados_por_plataforma": "ids UNICOS del padron con veredicto CERRADO *en esa "
                                              "plataforma* - un id medido en web y en mobile cuenta "
                                              "en LAS DOS, y uno sin columna NO cuenta en ninguna",
               "ids_solo_no_comparacion_por_plataforma":
                   "de los de arriba, los que en esa plataforma SOLO tienen no-comparacion "
                   "(NO_MEDIBLE / FUERA-DE-REFERENCIA / NO_REPRODUCIBLE_SIN_EFECTO / "
                   "PENDIENTE_DEVICE): cuentan como cubiertos pero NO hubo comparacion",
               "indeterminada": "NO es una plataforma: es lo que el lector no pudo leer (sin columna "
                                "`plataforma`, o con un valor fuera de {web, mobile})",
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
        hits, con, sin, sitios, huerfanos, fuera, plat_sin_leer = medir(txt, ids)
        superados, nota_sup = superados_del_documento(txt, ids, k)
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
            # PLATCONV - la cifra PARTIDA. La de arriba es «en cualquier plataforma» y queda como
            # agregado; la que se cita es esta, porque un veredicto de mobile contado como web es
            # cobertura que no existe.
            "ids_cerrados_por_plataforma": ids_cerrados_por_plataforma(con, ids),
            "ids_solo_no_comparacion_por_plataforma":
                ids_solo_no_comparacion_por_plataforma(con, ids),
            # `_lineas` son SOLO filas de tabla: las unicas donde agregar la columna es posible.
            "plataforma_sin_leer_lineas": plat_sin_leer[0],
            "plataforma_vocabulario_invalido": plat_sin_leer[1],
            "plataforma_fuera_de_tabla_lineas": plat_sin_leer[2],
            "plataforma_sin_leer_ajenas_al_padron": plat_sin_leer[3],
            # El mapa id -> veredictos CERRADOS. Sin el, `detalle` lista veredictos por linea sin
            # sujeto, asi que no se podia cruzar el mismo id entre documentos — y ese cruce es lo
            # unico que caza un COHERENTE falso.
            # Los ids que el ROL DUENO marco como superados en SU documento no entran al cruce:
            # un veredicto retirado por quien lo emitio no puede seguir sosteniendo un conflicto.
            # Se publican aparte para que el retiro sea AUDITABLE — quien, cuando y cuales.
            "veredictos_por_id": {i: v for i, v in veredictos_por_id(con, ids).items()
                                  if i not in superados},
            "superados": sorted(superados),
            "superado_nota": nota_sup,
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

    # --- control 5: CANARIO DE ACCFALSO (el cubo accionable no puede quedar MUERTO) ------------
    # Mismo criterio que los otros cuatro: un filtro cuya rotura no mueve nada es un filtro sin
    # control. El de ACCFALSO es peligroso justamente porque RESTA trabajo pendiente — si quedara
    # demasiado ancho, taparía filas reales a las que SÍ hay que agregarles la columna y el síntoma
    # sería un reporte más limpio, que nadie audita.
    #
    # La forma que discrimina: declarar en el padrón los ids que hoy están afuera y exigir que (a) el
    # cubo «ajenas» se vacíe —prueba que el filtro se apoya en el padrón de verdad y no en otra cosa—
    # y (b) esas mediciones REAPAREZCAN en los cubos accionables, una por una. (b) es lo que separa
    # «reclasificar» de «descartar en silencio», que es el error espejo y el que más barato sale de
    # escribir. Tautológico habría sido medir sólo (a): el cubo se vacía por la condición misma.
    #
    # DEUDA DECLARADA, no fingida: la dirección contraria —que alguien QUITE el filtro— no tiene
    # canario acá, porque su síntoma es `ajenas == 0`, que también es el estado legítimo de un corpus
    # donde todos los sujetos son del padrón. Un abort ahí sería un falso rojo en el caso normal, y
    # un guard que grita en el caso normal se desarma solo. Lo cubre el test de la suite, que fija
    # un corpus con un id ajeno conocido.
    for k in docs:
        d = res["lotes"][k]
        ajenas_n = len(d.get("plataforma_sin_leer_ajenas_al_padron") or ())
        if not ajenas_n:
            continue
        base = len(d["plataforma_sin_leer_lineas"]) + len(d["plataforma_fuera_de_tabla_lineas"])
        amp = medir(textos[k], list(ids) + sorted(d.get("ids_medidos_fuera_del_padron") or {}))[6]
        rec = len(amp[0]) + len(amp[2])
        if amp[3] or rec != base + ajenas_n:
            print(f"CANARIO DE ACCFALSO FALLA en {k}: declare en el padron los {ajenas_n} id(s) "
                  f"ajenos y el cubo «ajenas» quedo en {len(amp[3])} (esperaba 0) con "
                  f"{rec} accionables (esperaba {base + ajenas_n}). O el filtro no se apoya en el "
                  f"padron, o DESCARTA mediciones en vez de reclasificarlas: en el segundo caso el "
                  f"reporte resta trabajo pendiente que si existe.", file=sys.stderr)
            sys.exit(14)

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

    # ARRIBA de la bifurcacion a proposito: la cifra del criterio no puede existir solo en el
    # formato para humanos (ver el docstring de `agregado_por_plataforma`).
    res["agregado_por_plataforma"] = agregado_por_plataforma(res["lotes"].values(), ids)

    # CONTRASTEJSON (medido por auditoria el 2026-10-05): el bloque «CONTRASTE: N id(s) con
    # veredictos INCOMPATIBLES» existia SOLO en el reporte de texto — 0 ocurrencias en `--json`, con
    # control positivo (el JSON pesaba 101.168 B y «web» aparecia 39 veces, o sea se generaba
    # completo). Quien consume el JSON —la suite, y cualquier automatizacion— no veia que 12 ids se
    # contradicen entre documentos. Es el MISMO defecto de forma que el agregado por plataforma, que
    # vivia despues del `return` de `--json`: el alcance de un dato no puede depender del formato de
    # salida, porque el formato que las maquinas leen es el que decide.
    # CONTRASTEDOCS (medido por auditoria el 2026-10-05, sobre este mismo JSON). El bloque de
    # arriba publicaba `{i: sorted(vs)}`, y `vs` es el mapa veredicto -> DOCUMENTOS: quedarse con
    # las claves tiraba justo el dato que vuelve accionable al reporte. El JSON decia
    # `"bi": ["COHERENTE","DESVIO"]` -- se ve QUE choca y no QUIEN lo dijo, asi que auditoria tuvo
    # que reconstruirlo desde `lotes` para poder trabajar. **Sin el documento no hay a quien pedirle
    # la linea de cierre**, o sea faltaba exactamente la pieza que convierte el dato en una accion
    # con dueno. Es el tercer caso de la misma clase en este archivo (el agregado por plataforma que
    # vivia despues del `return` de `--json`, el contraste que solo existia en texto): el alcance de
    # un dato no puede depender del formato que lo lee.
    #
    # Y LA RESOLUCION TAMBIEN SE PUBLICA, con una distincion que el dict escondia: 10 de las 12
    # entradas de `CONFLICTOS_CONOCIDOS` apuntan al MISMO objeto `HIPOTESIS_MATRIZ_2209`. Eso no es
    # «10 conflictos resueltos»: es UNA hipotesis compartida, declarada una vez y reusada. Se marca
    # por IDENTIDAD del objeto (`is`), que es medible, en vez de inferirla del texto.
    #
    # `dirimido` NO lo adivina el parser: exige el prefijo `DIRIMIDO:` que escribe quien dirime. Una
    # heuristica sobre el texto se equivocaria en el caso que importa -- `soporte` tiene texto propio
    # y dice literalmente «Puede ser conflicto REAL o de PREGUNTA», o sea texto propio NO implica
    # dirimido. Un marcador que pone el que decide no tiene falso positivo; una regex sobre prosa si.
    # ⚠️ EL MARCADOR DE DIRIMIDO YA EXISTIA EN DOS IDIOMAS, y la primera version de este lector
    # invento un TERCERO (`DIRIMIDO:` como prefijo). El efecto medido antes de corregirlo:
    # `dirimidos: 1` sobre 12 cuando nueve textos declaraban `[DIRIMIDO 2026-09-30]` adentro. Un
    # lector que habla un idioma propio no reporta «no hay declaracion»: reporta que no la
    # encuentra, y eso se lee igual. Es el mismo caso que el registro en cuatro idiomas con un
    # lector de uno (memoria/el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno.md), ahora
    # pagado por mi propio parche a las dos horas de escribir la memoria.
    #
    # Se reconocen las formas QUE EL REGISTRO YA USA, y la fecha es obligatoria: un «dirimido» sin
    # fecha no se puede contrastar contra la medicion que vino despues, que es justo para lo que se
    # lo consulta. Los dos ejes son ORTOGONALES y se publican por separado -- `dirimido` dice si hay
    # declaracion; `hipotesis_compartida` dice si esa declaracion es suya o una compartida por N ids
    # (10 entradas apuntan al MISMO objeto `HIPOTESIS_MATRIZ_2209`, o sea UNA hipotesis reusada, no
    # diez decisiones). Mezclarlos fue el error de la primera version: excluia del conteo justo a
    # los que SI estaban declarados.
    DIRIMIDO_RX = re.compile(r"\[?DIRIMID[OA](?:\s+el)?\s+(\d{4}-\d{2}-\d{2})")

    def _resolucion(i):
        r = CONFLICTOS_CONOCIDOS.get(i) if isinstance(CONFLICTOS_CONOCIDOS, dict) else None
        m = DIRIMIDO_RX.search(r) if r else None
        return {
            "resolucion": r,
            "hipotesis_compartida": r is HIPOTESIS_MATRIZ_2209,
            "dirimido": bool(m),
            "dirimido_el": m.group(1) if m else None,
        }

    if isinstance(conflictos, dict):
        declarados = {}
        for i, vs in sorted(conflictos.items()):
            fila = {"veredictos": {v: sorted(docs) for v, docs in sorted(vs.items())}}
            fila.update(_resolucion(i))
            declarados[i] = fila
        total = len(declarados)
        dirimidos = sum(1 for f in declarados.values() if f["dirimido"])
        hipotesis = sum(1 for f in declarados.values() if f["hipotesis_compartida"])
        # Los cubos NO son excluyentes (un dirimido puede serlo por una hipotesis compartida), asi
        # que `sin_dirimir` se resta de UNO solo. La primera version restaba los dos y publicaba
        # `sin_resolucion: -7`: una cifra imposible es la unica suerte que hubo aca, porque una
        # resta de cubos solapados que diera positivo se habria publicado como dato.
        #
        # `declaraciones_distintas` es la cifra que mide lo que auditoria encontro: 12 conflictos
        # declarados NO son 12 decisiones. Se cuenta por IDENTIDAD de objeto, no por texto igual:
        # dos declaraciones redactadas parecido son dos decisiones, y una reusada es una.
        resumen = {
            "total": total,
            "dirimidos": dirimidos,
            "sin_dirimir": total - dirimidos,
            "hipotesis_compartida": hipotesis,
            "declaraciones_distintas": len({id(f["resolucion"]) for f in declarados.values()
                                            if f["resolucion"]}),
            "sin_declaracion": sum(1 for f in declarados.values() if not f["resolucion"]),
            # Una entrada de CONFLICTOS_CONOCIDOS que ya NO es conflicto: la declaracion sobrevivio
            # a su causa. No rompe, pero se publica — es deuda de registro y se cuenta.
            "declaradas_sin_conflicto_vigente": sorted(set(CONFLICTOS_CONOCIDOS) - set(declarados))
                                                if isinstance(CONFLICTOS_CONOCIDOS, dict) else [],
        }
    else:
        declarados = sorted(conflictos)
        resumen = {"total": len(declarados), "dirimidos": 0, "hipotesis_compartida": 0,
                   "sin_resolucion": len(declarados)}

    _decl = CONFLICTOS_CONOCIDOS if isinstance(CONFLICTOS_CONOCIDOS, dict) else {}
    mudos = sorted(i for i, r in _decl.items()
                   if r and "DIRIMID" in r.upper() and not DIRIMIDO_RX.search(r))
    if mudos:
        print(f"CONTRASTE: DIRIMIDO EN OTRO IDIOMA — {len(mudos)} resolucion(es) dicen DIRIMID* sin "
              f"una fecha que este lector sepa leer: {mudos}. Formas reconocidas: "
              f"`[DIRIMIDO AAAA-MM-DD]` o `DIRIMIDO el AAAA-MM-DD`. Esto NO es cosmetico: sin "
              f"fecha, la declaracion no se puede contrastar contra la medicion que vino despues, y "
              f"un lector que no la lee reporta «no hay resolucion», que se lee igual que «nadie lo "
              f"dirimio». Ya paso: la primera version de este lector inventaba un tercer idioma y "
              f"contaba 1 de 12.", file=sys.stderr)
        sys.exit(12)

    res["contraste"] = {
        "conflictos_declarados": declarados,
        "conflictos_nuevos": sorted(nuevos),
        "resolucion": resumen,
    }

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
    # PLATCONV (2026-09-30) - EL TITULAR SE PARTE. Hasta hoy esta linea decia «54 de 54» sobre una
    # clave que no distinguia plataforma, asi que un id con veredicto WEB y nada en mobile contaba
    # como cubierto: un solo numero para DOS poblaciones. `cerrada` sigue impresa abajo como
    # agregado -no se descarta informacion- pero la cifra que se cita es la de la plataforma, y el
    # criterio 3 de este sprint esta acotado a WEB por decision del operador.
    agg = res["agregado_por_plataforma"]
    web, mob, indet = (agg.get(k, []) for k in ("web", "mobile", "indeterminada"))
    solo_nc = cruzar_no_comparacion(res["lotes"].values())
    # La huella va ARRIBA de la cifra y no en un pie: el que copia el numero se lleva la linea de
    # al lado, no la del final del reporte.
    print(f"🔬 INSTRUMENTO: {huella_del_instrumento()}")
    print(f"🎯 CIFRA DEL CRITERIO, unidad «ids únicos de los {len(ids)} con veredicto DEL VOCABULARIO "
          f"CERRADO, POR PLATAFORMA»:")
    def _nc(p):
        # La cifra CUENTA a estos ids (un `PENDIENTE_DEVICE` declarado ES informacion sobre esa
        # plataforma), pero se dice al lado: sin esto, «completar la columna» sobre una fila que
        # nunca se comparo INFLA el numerador de cobertura. Lo destapo una pregunta de frontend2.
        n = solo_nc.get(p, ())
        return (f"  ⚠️ de los cuales {len(n)} SIN comparación ({', '.join(n[:5])}"
                f"{'…' if len(n) > 5 else ''})") if n else ""
    techo = agg["web_techo_alcanzable"]
    print(f"      web  {len(web)} de {len(ids)}   ({100 * len(web) // len(ids)}%)  <- la que se cita "
          f"este sprint (criterio 3 acotado a web) · TECHO ALCANZABLE {techo}"
          f"{' ✅ COMPLETO' if len(web) >= techo else ''}{_nc('web')}")
    # Los faltantes van NOMBRADOS y partidos en dos: el que lee tiene que poder cerrar los
    # accionables y NO volver a preguntar por los otros. Un conteo sin sujetos no permite ninguna
    # de las dos cosas — fue lo que dejo «49 de 54» congelado con un DoD inalcanzable.
    if agg["web_faltan"]:
        acc = agg["web_faltan_accionables"]
        sin_ref = agg["web_faltan_sin_referencia_en_capa_escritorio"]
        otros = [i for i in acc if i not in sin_ref]
        if otros:
            print(f"      └─ FALTAN en web ({len(otros)}): {', '.join(otros)}")
        if sin_ref:
            # Se dice el HECHO medido y la ACCION, no un dictamen de alcance. La version anterior
            # decia «fuera de alcance web / NO se pueden cerrar en este sprint / se miden en mobile
            # con device»: tres afirmaciones que la medicion no sostenia — y la tercera es falsa,
            # porque los mismos ids salen sin comparacion en mobile por la misma causa.
            print(f"      └─ FALTAN en web ({len(sin_ref)}), sin referencia en la CAPA `#escritorio` "
                  f"del prototipo (medido por frontend1 el 2026-10-05, dos instrumentos por id): "
                  f"{', '.join(sin_ref)}")
            print(f"         ACCION para cerrarlos: que el documento que los midio declare el "
                  f"veredicto canonico `FUERA-DE-REFERENCIA` (ya en el vocabulario, usado en 8 "
                  f"lotes). NO lo declara este lector: asignar un veredicto que no medi es peor "
                  f"que dejar el pendiente a la vista.")
    print(f"      mobile  {len(mob)} de {len(ids)}   (sprint siguiente, con device/EAS)"
          f"{_nc('mobile')}")
    print(f"      indeterminada  {len(indet)} de {len(ids)}  <- NO es una plataforma: es lo que el "
          f"lector no pudo leer")
    if indet:
        # Sin esto la cifra es honesta y no accionable: el trabajo de FE1/FE2 es agregar la columna
        # en filas concretas, y el numero solo no dice en cuales.
        sin_col = sum(len(d.get("plataforma_sin_leer_lineas", ())) for d in res["lotes"].values())
        fuera_tab = sum(len(d.get("plataforma_fuera_de_tabla_lineas", ())) for d in res["lotes"].values())
        invalidos = {}
        for d in res["lotes"].values():
            for crudo, ls in d.get("plataforma_vocabulario_invalido", {}).items():
                invalidos.setdefault(crudo, 0)
                invalidos[crudo] += len(ls)
        ajenas = sum(len(d.get("plataforma_sin_leer_ajenas_al_padron", ()))
                     for d in res["lotes"].values())
        print(f"      └─ ACCIONABLE (agregar la columna): {sin_col} fila(s) de tabla" +
              (f" · {sum(invalidos.values())} con la columna y valor FUERA del vocabulario: "
               f"{sorted(invalidos)}" if invalidos else ""))
        # Se imprime aparte y se dice que NO es accionable asi, porque publicarlo junto a lo de
        # arriba manda a agregar una columna a un heading -- que es lo que hizo perder una vuelta.
        print(f"      └─ ACCIONABLE con el campo inline: {fuera_tab} medición(es) en heading o "
              f"bullet sin columna posible, que tampoco declararon `plataforma: <valor>` en su "
              f"bloque (el mecanismo existe: frontend1 lo usó 21 veces en el lote A)")
        if ajenas:
            # ACCFALSO: se dice y NO se cobra. Antes caian en los dos cubos de arriba y mandaban a
            # agregar `plataforma` a filas que no hablan de ninguna pantalla del padron.
            #
            # Se NOMBRAN los sujetos, no se cuentan: `card-ingreso` puede ser un typo que alguien
            # arregla en 10 segundos y `gasto-monto` un campo DOM que no va a existir nunca — un
            # numero solo no deja decidir ninguna de las dos. Es la misma leccion que la cifra del
            # criterio: publicar el conteo sin los sujetos congela el frente.
            ajenos_ids = sorted({i for d in res["lotes"].values()
                                 for i in (d.get("ids_medidos_fuera_del_padron") or {})
                                 if d.get("plataforma_sin_leer_ajenas_al_padron")})
            print(f"      └─ NO accionable: {ajenas} medición(es) cuyo sujeto NO está en el padrón "
                  f"— no necesitan `plataforma`: {', '.join(ajenos_ids)}. Si alguno es un typo de un "
                  f"id real, ahí sí hay trabajo (y es del autor del documento)")
        peores = sorted(((len(d.get("plataforma_sin_leer_lineas", ())), n)
                         for n, d in res["lotes"].items()), reverse=True)[:3]
        if peores and peores[0][0]:
            print(f"      └─ donde agregar la columna primero: " +
                  " · ".join(f"{n} ({c})" for c, n in peores if c))
    print(f"   agregado, unidad «ids con veredicto cerrado en CUALQUIER plataforma» (NO es la cifra "
          f"del criterio): {len(cerrada)} de {len(ids)}")
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
