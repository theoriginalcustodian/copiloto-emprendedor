#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verifica el MAPEO prototipo -> app nativa contra los controles que lo hacen creible.

QUE ES EL MAPEO: una fila por cada uno de los 54 ids del padron del criterio 3, diciendo
que pantalla del prototipo (`Prototipo frontend/odobi-ui/prototipo/index.html`) corresponde
a que archivo de `apps/mobile/src`, y cual es la divergencia. Es el denominador unico de
«dejar la app tal cual define index»: sin el, cada medicion inventa su propio universo.

POR QUE HAY UN VERIFICADOR Y NO ALCANZA EL DOC: el doc lo escriben agentes. Un mapeo con
filas plausibles pero fabricadas se lee igual que uno medido. Estos controles son lo unico
que separa las dos cosas.

EL UNIVERSO NO SE DEDUCE ACA (y es a proposito): se consume del JSON de
`contar-veredictos.py --json`, campo `universo_de_sujetos`. Reimplementar el parser del
padron seria una segunda fuente de verdad para la misma cifra, que es como se termina con
tres numeros distintos para la misma pregunta. Si falta el JSON, aborta y dice como generarlo.

LOS CUATRO CONTROLES:
  1 UNIVERSO, diff BIDIRECCIONAL: faltantes Y sobrantes. Un mapeo de 53 filas con una
    inventada da 54 y pasaria un control de conteo.
  2 CELDAS: cero vacias, cero placeholders. Una fila con `?` no es una fila medida.
  3 CONTROL POSITIVO: reproduce las 5 filas resueltas A MANO antes de construir nada. Si
    no las reproduce, la corrida no se acepta — mide otra cosa.
  4 CONTROL NEGATIVO: los 8 ids que el grep por nombre declaraba ausentes NO pueden salir
    como `NO EXISTE`. Su pantalla existe con otro nombre; si reaparecen, el mapeo volvio a
    medir el nombre en vez de la pantalla.

`--canario` rompe cada control de a uno y exige que CADA uno falle. Un gate que nunca se
probo hacia el «no» es indistinguible de uno ausente: el verde no prueba que mire.

Read-only. Uso: python verificar-mapeo.py [--json] [--canario]
Exit: 0 OK · 1 un control fallo · 2 no puedo medir (falta un archivo / forma inesperada)
"""
import io
import json
import os
import re
import sys
from pathlib import Path

RAIZ = Path(os.environ.get("COPILOTO_RAIZ", Path(__file__).resolve().parents[2]))
MAPEO = Path(os.environ.get(
    "COPILOTO_MAPEO",
    RAIZ / "docs" / "copiloto-emprendedor" / "2026-10-12-mapeo-prototipo-vs-nativo.md"))
# OJO con el caso vacio: `Path("")` NO es falsy, es `Path(".")` — el directorio actual. La
# v1 hacia `Path(os.environ.get(..., ""))` y sin la env var intentaba abrir `.` como JSON,
# muriendo con PermissionError en vez de caer al fixture. El default se decide ANTES de
# construir el Path, no despues.
_env_padron = os.environ.get("COPILOTO_PADRON_JSON", "").strip()
PADRON_JSON = Path(_env_padron) if _env_padron else None
CONTROL = Path(os.environ.get(
    "COPILOTO_CONTROL_POSITIVO",
    RAIZ / "scripts" / "evidencia" / "fixtures" / "mapeo-control-positivo.tsv"))

# Los 8 falsos negativos MEDIDOS del grep por nombre (2026-10-12): su id no aparece como
# literal en `apps/mobile/src`, y la pantalla EXISTE con otro nombre. Son el control
# negativo porque ya se sabe la respuesta: ninguno puede figurar como ausente.
FALSOS_NEGATIVOS = [
    "card-cliente", "card-cobro", "card-presu", "fact-voz",
    "onb-cumplida", "onb-promesa", "pres-voz", "vozchat",
]

PLACEHOLDERS = ("?", "-", "--", "tbd", "todo", "n/a", "na", "pendiente", "xxx", "...")


def morir(msg, codigo=2):
    print("ABORTA: %s" % msg, file=sys.stderr)
    sys.exit(codigo)


def padron():
    """Los 54 ids. Fuente UNICA: la salida --json del instrumento del criterio 3."""
    cand = [PADRON_JSON] if PADRON_JSON else []
    cand += [RAIZ / "scripts" / "evidencia" / "fixtures" / "criterio3.json"]
    for p in cand:
        if p and p.is_file():
            try:
                d = json.load(io.open(str(p), encoding="utf-8"))
            except ValueError as e:
                morir("%s no es JSON valido (%s)" % (p, e))
            u = d.get("universo_de_sujetos")
            if not isinstance(u, list) or len(u) < 15:
                morir("%s no trae `universo_de_sujetos` usable (vi %r)" % (p, type(u)))
            return sorted(set(u)), p
    morir("no encontre el padron. Generalo con:\n"
          "  python scripts/evidencia/contar-veredictos.py --json > "
          "scripts/evidencia/fixtures/criterio3.json\n"
          "o apunta COPILOTO_PADRON_JSON a ese archivo.")


def filas_del_mapeo(texto):
    """Parsea la tabla markdown. Devuelve {id: (proto, nativo, divergencia)}.

    Toma SOLO las filas cuya primera celda es un id entre backticks: asi un renglon de
    prosa con pipes no entra como fila y no infla el conteo.
    """
    out = {}
    for ln in texto.split("\n"):
        if not ln.strip().startswith("|"):
            continue
        cel = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cel) < 4:
            continue
        m = re.match(r"^`([^`]+)`$", cel[0])
        if not m:
            continue
        out[m.group(1)] = (cel[1], cel[2], cel[3])
    return out


def vacia(celda):
    c = celda.strip().strip("`*_ ").lower()
    return (not c) or c in PLACEHOLDERS


def control_positivo():
    """Las 5 filas resueltas a mano. Devuelve {id: nativo_esperado}."""
    if not CONTROL.exists():
        morir("falta el control positivo %s. Sin el no hay con que validar la corrida."
              % CONTROL)
    out = {}
    for ln in io.open(str(CONTROL), encoding="utf-8").read().split("\n"):
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        p = ln.split("\t")
        if len(p) < 3 or p[0].strip() == "id":
            continue
        out[p[0].strip()] = p[2].strip()
    if len(out) < 5:
        morir("el control positivo tiene %d filas y se esperan 5. Un control recortado "
              "absuelve igual que uno ausente." % len(out))
    return out


def archivos_citados(celda):
    """Los paths que una celda cita, sin la parte de :linea."""
    return set(re.findall(r"[\w./-]+\.(?:tsx|ts|html|md)", celda))


def _segmentos(p):
    return tuple(x for x in p.replace("\\", "/").split("/") if x)


def mismo_archivo(a, b):
    """True si dos paths citados nombran el MISMO archivo, aunque uno este abreviado.

    POR QUE NO SE COMPARAN LAS CADENAS: el mapeo cita el mismo archivo de hasta TRES formas
    distintas en la misma tabla -- medido el 2026-10-12: 23 basenames con mas de una forma
    (`PantallaMiDia.tsx`, `midia/PantallaMiDia.tsx`,
    `apps/mobile/src/modules/midia/PantallaMiDia.tsx`). Comparar literales daba FALSO ROJO
    contra cualquier resolvedor que escriba el path completo que ve en el filesystem, que es
    justo lo que hace un resolvedor ciego. El control positivo original pasaba porque sus 5
    filas cayeron en celdas que abrevian igual que el fixture: suerte de muestra, no robustez.

    POR QUE SUFIJO Y NO BASENAME: basename colapsaria `chat/Burbuja.tsx` con cualquier otro
    `Burbuja.tsx` de otra carpeta, y eso debilita el control en vez de arreglarlo. El sufijo
    de segmentos acepta la abreviacion y sigue distinguiendo carpetas.
    """
    sa, sb = _segmentos(a), _segmentos(b)
    n = min(len(sa), len(sb))
    return n > 0 and sa[-n:] == sb[-n:]


def algun_archivo_comun(esp, got):
    """Si alguno de los paths esperados nombra el mismo archivo que alguno de los del mapeo."""
    return any(mismo_archivo(a, b) for a in esp for b in got)


# Las filas son (proto, nativo, divergencia). Estos dos indices existen con nombre porque
# la v1 comparaba el control positivo contra DIVERGENCIA en vez de NATIVO y daba falso
# rojo en las 5 filas correctas: un control que grita en el caso normal se desarma solo.
I_PROTO, I_NATIVO, I_DIVERG = 0, 1, 2


def pantalla_ausente(fila):
    """No hay NINGUNA contraparte nativa: la columna NATIVO declara la ausencia.

    Esto es lo que significa «hay que implementar la pantalla». La v1 buscaba «no existe»
    en NATIVO **o** en DIVERGENCIA y contaba 9, pero 8 de esas filas SI tienen archivo
    nativo y lo que falta es un elemento adentro («la validacion inline no existe», «NO
    EXISTE el estado veterano»). Mezclar las dos cosas da una cifra que se deja citar para
    dos preguntas distintas, y la que viaja es siempre la mas alta.
    """
    return bool(re.search(r"no existe", fila[I_NATIVO], re.I))


def elemento_ausente(fila):
    """Hay pantalla nativa, pero le falta algo que el prototipo si define. Es trabajo
    DENTRO de una pantalla existente, no una pantalla nueva: otro costo y otro dueno."""
    return bool(not pantalla_ausente(fila)
                and re.search(r"no existe", fila[I_DIVERG], re.I))


# Filas que una decision AJENA bloquea, con quien la desbloquea. La cabecera del mapeo
# declaraba «las filas van marcadas [ASSUMED_PENDING_VERIFY]» y NINGUNA lo estaba: un
# comentario que declara una proteccion apaga la busqueda del proximo que lea. Este control
# mide la marca en los DOS sentidos, porque cada direccion falla distinto: una fila bloqueada
# SIN marca se implementa a ciegas; una marca sin entrada aca es huerfana y nadie sabe que
# respuesta la libera, asi que nunca se levanta.
BLOQUEADAS = {
    # VACIA desde 2026-10-12: el operador respondio las 3 decisiones del `pedido_` y eligio
    # **A — reset a Mi Dia** para el reposo de las 3 capas, que era el unico bloqueo real.
    # Se deja la tabla (no se borra el mecanismo) porque es la fuente unica del control 5 y
    # del aviso de la cabecera de los contratos: un mecanismo retirado no frena a la proxima
    # fila bloqueada. El control 5 es simetrico, asi que vaciarla EXIGE que ninguna fila del
    # mapeo lleve la marca — y al reves.
}
MARCA = "[ASSUMED_PENDING_VERIFY]"


def corrida(filas, univ, ctl):
    """Devuelve (lista de fallos, dict de metricas). No imprime: asi `--canario` la
    reusa sin ensuciar la salida."""
    fallos = []
    ids = set(filas)
    faltan = sorted(set(univ) - ids)
    sobran = sorted(ids - set(univ))

    if faltan:
        fallos.append("CONTROL 1 (universo): faltan %d id(s) del padron: %s"
                      % (len(faltan), ", ".join(faltan[:12])))
    if sobran:
        fallos.append("CONTROL 1 (universo): %d id(s) que NO estan en el padron de 54: %s"
                      % (len(sobran), ", ".join(sobran[:12])))

    incompletas = [i for i, c in filas.items() if any(vacia(x) for x in c)]
    if incompletas:
        fallos.append("CONTROL 2 (celdas): %d fila(s) con celda vacia o placeholder: %s"
                      % (len(incompletas), ", ".join(sorted(incompletas)[:12])))

    no_repro = []
    for i, esperado in ctl.items():
        if i not in filas:
            no_repro.append("%s (ausente del mapeo)" % i)
            continue
        esp = archivos_citados(esperado)
        got = archivos_citados(filas[i][I_NATIVO])
        if esp and not algun_archivo_comun(esp, got):
            no_repro.append("%s (esperaba alguno de %s, el mapeo dice %s)"
                            % (i, sorted(esp), sorted(got) or ["nada"]))
    if no_repro:
        fallos.append("CONTROL 3 (positivo): el mapeo NO reproduce %d de las %d filas "
                      "resueltas a mano: %s" % (len(no_repro), len(ctl),
                                                " · ".join(no_repro)))

    reaparecen = [i for i in FALSOS_NEGATIVOS
                  if i in filas and pantalla_ausente(filas[i])]
    if reaparecen:
        fallos.append("CONTROL 4 (negativo): %d falso(s) negativo(s) conocido(s) vuelven a "
                      "figurar como NO EXISTE: %s. Su pantalla existe con otro nombre — el "
                      "mapeo volvio a medir el nombre." % (len(reaparecen),
                                                           ", ".join(reaparecen)))

    sin_marca = [i for i in BLOQUEADAS if i in filas and MARCA not in filas[i][I_DIVERG]]
    if sin_marca:
        fallos.append("CONTROL 5 (marca): %d fila(s) que una decision ajena bloquea NO llevan "
                      "%s en su divergencia: %s. Se implementan a ciegas."
                      % (len(sin_marca), MARCA, ", ".join(sorted(sin_marca))))
    marca_huerfana = sorted(i for i, c in filas.items()
                            if MARCA in c[I_DIVERG] and i not in BLOQUEADAS)
    if marca_huerfana:
        fallos.append("CONTROL 5 (marca): %d fila(s) marcada(s) %s sin entrada en BLOQUEADAS: "
                      "%s. Nadie sabe que respuesta las libera, asi que no se levantan nunca."
                      % (len(marca_huerfana), MARCA, ", ".join(marca_huerfana)))

    met = {
        "filas": len(filas),
        "padron": len(univ),
        "faltan": faltan,
        "sobran": sobran,
        "incompletas": sorted(incompletas),
        "control_positivo_filas": len(ctl),
        "control_positivo_no_reproducidas": no_repro,
        "falsos_negativos_reaparecidos": reaparecen,
        "bloqueadas_sin_marca": sorted(sin_marca),
        "marca_huerfana": marca_huerfana,
        "bloqueadas_declaradas": sorted(BLOQUEADAS),
        "pantalla_ausente": sorted(i for i, c in filas.items()
                                   if pantalla_ausente(c)),
        "elemento_ausente": sorted(i for i, c in filas.items()
                                   if elemento_ausente(c)),
        "indeterminados": sorted(
            i for i, c in filas.items()
            if re.search(r"indeterminado", c[I_NATIVO] + " " + c[I_DIVERG], re.I)),
    }
    return fallos, met


def main():
    if not MAPEO.exists():
        morir("no encontre el mapeo %s" % MAPEO)
    univ, fuente_padron = padron()
    texto = io.open(str(MAPEO), encoding="utf-8").read()
    filas = filas_del_mapeo(texto)
    ctl = control_positivo()
    fallos, met = corrida(filas, univ, ctl)

    if "--canario" in sys.argv:
        # Cada control se rompe de a uno y DEBE fallar. Sin esto, un control que no mira
        # nada sale verde para siempre.
        pruebas = []
        f2 = dict(filas)
        f2.pop(sorted(filas)[0], None)
        pruebas.append(("1 universo (saco una fila)", f2, univ, ctl, True))
        f3 = dict(filas)
        k = sorted(filas)[0]
        f3[k] = (filas[k][0], filas[k][1], "?")
        pruebas.append(("2 celdas (pongo un placeholder)", f3, univ, ctl, True))
        # El sabotaje va en la columna que el control MIRA. La v1 escribia en DIVERG y el
        # control 3 lee NATIVO, asi que el canario no inyectaba nada y acusaba de ciego a
        # un control sano.
        f4 = dict(filas)
        ki = next((k for k in sorted(ctl) if k in f4), None)
        if ki:
            f4[ki] = (f4[ki][I_PROTO], "apps/mobile/src/ZZZinexistente.tsx",
                      f4[ki][I_DIVERG])
        pruebas.append(("3 positivo (desvio una fila del control)", f4, univ, ctl, ki))
        # Y el id a sabotear tiene que EXISTIR en el mapeo: con `FALSOS_NEGATIVOS[0]` fijo,
        # un mapeo que no lo contenga dejaba la mutacion sin aplicar y el canario lo leia
        # como ceguera. No es lo mismo «el control no mira» que «no pude ejercitarlo».
        f5 = dict(filas)
        kf = next((k for k in FALSOS_NEGATIVOS if k in f5), None)
        if kf:
            f5[kf] = (f5[kf][I_PROTO], "NO EXISTE: busque en todos lados",
                      f5[kf][I_DIVERG])
        pruebas.append(("4 negativo (declaro ausente un falso negativo)", f5, univ, ctl, kf))
        # Dos sabotajes, uno por direccion: el control 5 tiene dos ramas y un solo canario
        # acreditaria la mitad.
        f6 = dict(filas)
        kb = next((k for k in sorted(BLOQUEADAS) if k in f6), None)
        if kb:
            f6[kb] = (f6[kb][I_PROTO], f6[kb][I_NATIVO],
                      f6[kb][I_DIVERG].replace(MARCA, ""))
        pruebas.append(("5a marca (le saco la marca a una bloqueada)", f6, univ, ctl, kb))
        f7 = dict(filas)
        kh = next((k for k in sorted(f7) if k not in BLOQUEADAS), None)
        if kh:
            f7[kh] = (f7[kh][I_PROTO], f7[kh][I_NATIVO], MARCA + " " + f7[kh][I_DIVERG])
        pruebas.append(("5b marca (marco una fila que nadie bloquea)", f7, univ, ctl, kh))

        print("=== CANARIO: cada control roto de a uno debe FALLAR ===")
        malos = inyectables = 0
        for nombre, ff, uu, cc, pudo in pruebas:
            if not pudo:
                # El corpus no tiene el sujeto que este sabotaje necesita. Eso NO acusa al
                # control: lo deja sin ejercitar, y decirlo asi es la diferencia entre un
                # canario honesto y uno que culpa al inocente.
                print("  control %-46s SIN EJERCITAR (el mapeo no tiene el sujeto a "
                      "sabotear)" % nombre)
                continue
            inyectables += 1
            fl, _ = corrida(ff, uu, cc)
            disparo = len(fl) > len(fallos)
            print("  control %-46s %s" % (nombre, "FALLA (bien)" if disparo
                                          else "NO DISPARO  <-- el control esta ciego"))
            if not disparo:
                malos += 1
        print("CANARIO: %d de %d sabotajes ejercitados · %s"
              % (inyectables, len(pruebas),
                 "OK, todos los ejercitados disparan" if not malos
                 else "%d control(es) CIEGO(s)" % malos))
        if inyectables < len(pruebas):
            print("  AVISO: un canario con sabotajes SIN EJERCITAR no acredita esos controles: "
                  "correlo sobre el mapeo COMPLETO antes de creerle.")
        return 1 if malos else 0

    if "--json" in sys.argv:
        met["ok"] = not fallos
        met["fallos"] = fallos
        met["mapeo"] = str(MAPEO)
        met["padron_desde"] = str(fuente_padron)
        print(json.dumps(met, ensure_ascii=False, indent=2))
        return 0 if not fallos else 1

    print("MAPEO: %s" % MAPEO)
    print("PADRON: %d ids (desde %s)" % (len(univ), fuente_padron.name))
    print("FILAS PARSEADAS: %d" % met["filas"])
    print("  faltan del padron: %d · sobran (no estan en el padron): %d"
          % (len(met["faltan"]), len(met["sobran"])))
    print("  filas con celda vacia o placeholder: %d" % len(met["incompletas"]))
    print("CONTROL POSITIVO: %d filas a mano · no reproducidas: %d"
          % (met["control_positivo_filas"], len(met["control_positivo_no_reproducidas"])))
    print("CONTROL NEGATIVO: falsos negativos que reaparecen como NO EXISTE: %d de %d"
          % (len(met["falsos_negativos_reaparecidos"]), len(FALSOS_NEGATIVOS)))
    print("CONTROL MARCA: %d fila(s) bloqueada(s) declarada(s) · sin marca: %d · "
          "marca huerfana: %d"
          % (len(met["bloqueadas_declaradas"]), len(met["bloqueadas_sin_marca"]),
             len(met["marca_huerfana"])))
    print("--- del mapeo, para leer (NO son fallos) ---")
    print("  PANTALLA ausente, sin contraparte nativa (pantalla nueva): %d  %s"
          % (len(met["pantalla_ausente"]), ", ".join(met["pantalla_ausente"])))
    print("  ELEMENTO ausente dentro de una pantalla que SI existe: %d  %s"
          % (len(met["elemento_ausente"]), ", ".join(met["elemento_ausente"])))
    print("  filas INDETERMINADO (no se pudo resolver): %d  %s"
          % (len(met["indeterminados"]), ", ".join(met["indeterminados"][:14])))
    print()
    if fallos:
        for f in fallos:
            print("ROJO: %s" % f)
        print("VEREDICTO: el mapeo NO se acepta (%d control(es) fallando)." % len(fallos))
        return 1
    print("VEREDICTO: los 5 controles pasan. El mapeo se acepta.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
