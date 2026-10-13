#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Emite UN renglon de contrato por cada fila del mapeo prototipo -> app nativa.

POR QUE SE GENERA Y NO SE ESCRIBE A MANO: el DoD del relevamiento exige que
`filas-que-exigen-trabajo == renglones-emitidos`. Escrito a mano, esa igualdad se verifica
contando dos listas que un humano (o un agente) ya creia iguales. Generado, cuadra por
construccion: una fila sin renglon es imposible, no improbable. Una capacidad decidida sin
renglon vuelve a contarse como hueco en el proximo relevamiento — lo que no esta en la
tabla no existe.

NO REIMPLEMENTA NADA DEL VERIFICADOR: importa `filas_del_mapeo`, el path del MAPEO y los
predicados `pantalla_ausente` / `elemento_ausente` de `verificar-mapeo.py`. Son la misma
pregunta y tienen que tener una sola definicion: si el verificador y el generador discrepan
sobre que es «ausente», el PR muestra 54 renglones y el gate cuenta otra cosa.

LAS 54 FILAS EXIGEN TRABAJO, de clases distintas. Las que dicen «ninguna medida» exigen
MEDICION, no implementacion: *sin comparacion* no es *coincide*, y por eso tienen renglon
igual. Una fila sin renglon porque «parece que coincide» es exactamente el agujero que este
mapeo vino a cerrar.

Read-only sobre el repo salvo el archivo que escribe. Uso:
  python armar-contratos.py [destino.md]
Exit: 0 el conteo cuadra · 1 no cuadra (filas sin renglon o sin clasificar) · 2 no puedo medir
"""
import io
import importlib.util
import os
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def cargar_verificador():
    """Importa verificar-mapeo.py (el guion en el nombre impide un import normal)."""
    ruta = AQUI / "verificar-mapeo.py"
    if not ruta.is_file():
        sys.stderr.write("ROJO: falta %s. El generador NO define su propia lectura del "
                         "mapeo a proposito.\n" % ruta)
        sys.exit(2)
    spec = importlib.util.spec_from_file_location("verificar_mapeo", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


V = cargar_verificador()
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else (
    V.RAIZ / "docs/copiloto-emprendedor/2026-10-12-contratos-del-mapeo.md")

# Filas que NO se pueden cerrar sin tocar backend o contrato de datos. Cada una con el
# motivo MEDIDO: sin eso, alguien la toma creyendo que es de UI y se traba a mitad.
NECESITA_BACKEND = {
    "preg": "no existe el componente ni la capacidad: la card de datos como respuesta no "
            "tiene parser en `packages/core/src/chat/*.ts`, y la promo masiva a clientes "
            "no existe (cero hits de `promo`)",
    "clientes": "el tipo de cable `Cliente` (`api/clientes.ts:31`) no trae monto vendido "
                "ni cantidad de comprobantes: la columna derecha del proto no se puede "
                "pintar con lo que hoy manda el backend",
    "cobro-voz": "falta saber si los chips WhatsApp/mail llegan por `choices`; y «vence en "
                 "7 dias» el backend no lo manda",
    "caida": "el texto de la tarjeta lo genera `mi_dia_detector.py:253` (regla "
             "`conexion_caida`), no la UI",
    "fact-voz": "el texto de la respuesta lo redacta el backend",
    "onb-cumplida": "el insight sale de `textoDelInsight` (`core api/onboarding.ts:87`), "
                    "no de la pantalla",
    "hitl": "el puente tarjeta->chat necesita que el backend mande la card de accion con "
            "sus kv y el recibo; hoy `gate.markdown` llega como texto plano",
}

# Lo tactil. La pregunta que decide la capa no es «donde vive el codigo» sino «con que se
# acredita»: nada de esto lo acredita un test unitario ni un verde de PWA.
CON_DEVICE = re.compile(
    r"gesto|arrastr|desliz|swipe|candado|UMBRAL_CANCELAR|animaci|rebote|degrad|"
    r"RefreshControl|overscroll|scroll|grip|asidero|pildora sin handler|no pulsable|"
    r"hold-to-record|grabaci|cronometro|onda|pausa|tap-grabar", re.I)


def clasificar(i, fila):
    """-> (capa, dueno, por_que). `a-clasificar` se reporta, no se reparte en silencio."""
    if i in NECESITA_BACKEND:
        return ("backend + nativa", "backend + frontend",
                "contrato primero: " + NECESITA_BACKEND[i])
    if CON_DEVICE.search(fila[V.I_DIVERG]) or CON_DEVICE.search(fila[V.I_NATIVO]):
        return ("nativa-con-device", "frontend (device, dueno unico)",
                "lo tactil no lo acredita un test unitario")
    return ("nativa-sin-device", "frontend", "UI pura, verificable con test")


def dod(i, fila):
    """DoD binario, construido citando lo medido en la propia fila. No se inventa."""
    div = fila[V.I_DIVERG]
    # La marca va en el RENGLON, no solo en la cabecera. Un bloqueo declarado arriba y
    # ausente de la fila que circula no frena a nadie: el que toma trabajo lee su renglon.
    # `V.BLOQUEADAS` es la misma tabla que el control 5 del verificador — una sola
    # definicion, o el doc dice una cosa y el gate mide otra.
    if i in V.BLOQUEADAS:
        return ("**[ASSUMED_PENDING_VERIFY] NO SE IMPLEMENTA.** Bloqueada por: %s. El DoD lo "
                "fija la respuesta; hasta entonces no se toca, ni la opcion recomendada."
                % V.BLOQUEADAS[i])
    if V.pantalla_ausente(fila):
        return ("La pantalla EXISTE y se llega a ella navegando; el id `%s` del prototipo "
                "tiene contraparte con `path:linea`. Escrita-e-inalcanzable NO cuenta." % i)
    if re.search(r"CERO consumidores|NUNCA se dibuja|no se monta", div):
        return ("La capacidad tiene al menos UN consumidor real en `apps/mobile/src` fuera "
                "de su propio archivo y de sus tests, y se VE en la pantalla. Hoy esta "
                "escrita y nadie la usa.")
    if V.elemento_ausente(fila):
        return ("El elemento que la fila declara ausente existe en la pantalla que ya "
                "existe, con `path:linea`, y se ve. No alcanza con que el componente este "
                "definido.")
    if re.search(r"INDETERMINADO", div, re.I):
        return ("Medido: la fila deja de decir INDETERMINADO y dice COINCIDE o nombra la "
                "divergencia. Esta fila es de MEDICION, no de implementacion.")
    if re.search(r"ninguna medida", div, re.I):
        return ("Comparada contra el prototipo: la fila dice COINCIDE o nombra la "
                "divergencia. Hoy no esta medida, y «sin comparacion» no es «coincide».")
    return ("Cada divergencia listada en la fila queda resuelta en el codigo, o declarada "
            "enmienda fundada con su motivo escrito. Ninguna queda sin veredicto.")


def aviso_bloqueo():
    """El aviso de filas bloqueadas, DERIVADO de V.BLOQUEADAS (fuente unica: la misma
    tabla que usa el control 5 del verificador). Antes estaba escrito a mano y nombraba
    `esc`; al responderse la decision habria quedado afirmando un bloqueo inexistente, y al
    aparecer otra fila bloqueada no habria vuelto solo. El caso CERO se IMPRIME en vez de
    callarse: un silencio no se distingue de "no lo mire"."""
    if not V.BLOQUEADAS:
        return (u">\n> \u2705 **Cero filas bloqueadas por decisiones ajenas.** Ninguna fila"
                u" espera una respuesta del operador. Derivado de `V.BLOQUEADAS`, que esta"
                u" vacia: no es una afirmacion escrita a mano.")
    cuerpo = u"\n".join(u"> - `%s` \u2014 bloqueada por: %s" % (k, V.BLOQUEADAS[k])
                       for k in sorted(V.BLOQUEADAS))
    return (u">\n> \u26a0\ufe0f **Lo que NO se implementa todavia** (%d fila(s), marcadas"
            u" `[ASSUMED_PENDING_VERIFY]`): nada de estas filas se toca hasta la respuesta,"
            u" ni la opcion recomendada.\n%s" % (len(V.BLOQUEADAS), cuerpo))


CABECERA = u"""# Contratos del mapeo prototipo -> nativo — un renglon por fila

> **Generado** por `scripts/evidencia/armar-contratos.py` desde
> `2026-10-12-mapeo-prototipo-vs-nativo.md`. No se edita a mano: se regenera. Asi el conteo
> `filas que exigen trabajo == renglones emitidos` cuadra **por construccion**, y una fila
> sin renglon es imposible en vez de improbable.
>
> **Las 54 filas exigen trabajo**, de clases distintas y con dueno distinto. Las que dicen
> «ninguna medida» exigen **medicion**, no implementacion: *sin comparacion* no es
> *coincide*, y por eso tienen renglon igual.
>
> El detalle medido de cada fila (que dice el prototipo, que dice el codigo, con
> `path:linea`) vive en el mapeo y **no se repite aca** — se cita. Dos copias del mismo dato
> divergen, y gana la que circula.
>
{aviso_bloqueo}
"""

PIE = u"""
## Como se usa esto

Cada renglon baja al buzon como su propio `contrato_` cuando se toma, citando **textual** la
fila del mapeo. El DoD de arriba es el binario de cierre.

**Lo que NO cuenta como terminado:** mi autoevaluacion · un verde de PWA para algo del grupo
device (el instrumento del criterio 3 corre `chromium.launch()` en viewport 390x844: mide la
PWA, no el telefono) · una fila que pase de `INDETERMINADO` a `COINCIDE` sin que nadie la
haya medido.

**Regenerar:** `python scripts/evidencia/armar-contratos.py`. Si el conteo no cuadra sale
exit 1 y nombra las filas: no escribe un doc que se lea como completo.
"""


def main():
    texto = V.MAPEO.read_text(encoding="utf-8")
    filas = V.filas_del_mapeo(texto)
    if not filas:
        sys.stderr.write("ROJO: 0 filas parseadas de %s. Vacio = PREGUNTA, no cero.\n"
                         % V.MAPEO)
        return 2

    grupos = {}
    for i in sorted(filas):
        capa, dueno, por_que = clasificar(i, filas[i])
        grupos.setdefault(capa, []).append((i, dueno, por_que, dod(i, filas[i])))

    total = sum(len(v) for v in grupos.values())
    sin_clasificar = grupos.get("a-clasificar", [])
    print("filas en el mapeo:   %d" % len(filas))
    print("renglones emitidos:  %d" % total)
    for c in sorted(grupos):
        print("   %-22s %d" % (c, len(grupos[c])))
    print("sin clasificar:      %d" % len(sin_clasificar))
    cuadra = (total == len(filas)) and not sin_clasificar
    print("CONTEO: %s" % ("CUADRA (filas == renglones, cero sin clasificar)" if cuadra
                          else "NO CUADRA"))
    if not cuadra:
        return 1

    out = [CABECERA.format(aviso_bloqueo=aviso_bloqueo())]
    nota = {
        "backend + nativa": "**Contrato primero**: endpoint, request, response y codigos "
                            "ANTES de que ningun lado implemente. Si para avanzar hay que "
                            "inventar la forma de un endpoint, eso es codificar la "
                            "esperanza.\n",
        "nativa-con-device": "El telefono tiene **un solo dueno**. Nada de este grupo se "
                             "declara listo con un test unitario ni con un verde de PWA. "
                             "Para gestos RNGH: `adb input motionevent` DOWN/MOVE/UP — "
                             "`input tap` no ejercita un Pan.\n",
        "nativa-sin-device": "Acreditables con test en el VPS. No necesitan el telefono, "
                             "asi que **no esperan** al dueno del device.\n",
    }
    for capa in ("backend + nativa", "nativa-con-device", "nativa-sin-device",
                 "a-clasificar"):
        if capa not in grupos:
            continue
        v = grupos[capa]
        out.append("\n## %s — %d renglones\n" % (capa, len(v)))
        if capa in nota:
            out.append(nota[capa])
        out.append("| id | dueno | DoD binario | por que esta capa |")
        out.append("|---|---|---|---|")
        for i, dueno, por_que, d in v:
            out.append("| `%s` | %s | %s | %s |" % (i, dueno, d, por_que))
    out.append(PIE)

    doc = "\n".join(out) + "\n"
    # tmp + replace: `open(..,"w")` TRUNCA al abrir, y una excepcion en el write deja 0 bytes.
    tmp = DEST.with_suffix(DEST.suffix + ".tmp")
    # LF, NO CRLF. Hasta 2026-10-12 esto forzaba CRLF sin motivo, y el gate MAPEOSINGATE de
    # `scripts/ci/lint.sh` salia ROJO en CI acusando "el doc NO esta regenerado": el blob
    # versionado vive con LF (`.gitattributes` no cubre `*.md`, asi que git normaliza al
    # commitear) y el generado nacia con CRLF -> 107 CR de diferencia, 214 lineas "distintas",
    # CERO divergencia de contenido. Un gate que compara DOS CODIFICACIONES del mismo texto
    # acusa al sujeto por un defecto del instrumento.
    with io.open(str(tmp), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(doc)
    os.replace(str(tmp), str(DEST))
    # bytes REALES en disco: `len(doc)` cuenta CARACTERES y los acentos pesan 2 — reportaba
    # 14873 para un archivo de 15012 bytes, y esa cifra se uso para comparar tamanos.
    print("escrito: %s (%d bytes en disco, %d caracteres)"
          % (DEST, os.path.getsize(str(DEST)), len(doc)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
