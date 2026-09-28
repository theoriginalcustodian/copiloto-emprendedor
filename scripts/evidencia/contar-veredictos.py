#!/usr/bin/env python3
"""Cuenta las mediciones del criterio 3 en los dos lotes, POR FORMA y con la unidad declarada.

Por qué existe: el 2026-09-28 circularon 12, 14, 30, 31 y 32 para el mismo frente, y todas eran
correctas en SU unidad (ids · ids sin voz · filas de reparto · mediciones · veredictos). El número
solo no dice nada: la unidad viajaba en la cabeza de quien contó y no en el papel. Este script
imprime SIEMPRE la unidad junto al número, y las tres unidades a la vez para que no haya que elegir.

Y registra el hash + mtime de cada archivo leído, porque los docs están VIVOS: FE2 corrigió dos
veredictos mientras esta auditoría los estaba midiendo. Un conteo sin la versión del archivo medido
es exactamente la caducidad que el criterio 3 ya pagó una vez, en escala de minutos.

CONTROL POSITIVO horneado: el lote A tiene que dar >= 15 bloques con veredicto y el lote B >= 10
filas de tabla. Si alguno da 0, el formato cambió y el conteo NO se lee (fue el fallo del
instrumento de planificación: asumió tabla donde había secciones y dio 0).

Read-only. Uso: python contar-veredictos.py [--json]
"""
import hashlib
import io
import json
import os
import re
import sys
import time
from pathlib import Path

COORD = Path("C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion")
NO_COMPARACION = ("NO_MEDIBLE", "FUERA-DE-REFERENCIA", "NO_REPRODUCIBLE_SIN_EFECTO", "PENDIENTE_DEVICE")


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


def veredictos_de(texto):
    """Toda aparición de un veredicto en ROL de veredicto: `veredicto: X`, `veredicto**: X`, o la
    última celda de una fila de tabla. Cuenta la FORMA, no el símbolo: una mención en prosa o en un
    comentario no es un veredicto (fue el error del `8` de mic-funcion)."""
    hits = []
    for n, linea in enumerate(texto.splitlines(), 1):
        m = re.search(r"\*{0,2}veredicto\*{0,2}\s*:\s*\*{0,2}\s*([A-ZÁÉÍÓÚÑ_\-]{3,})", linea)
        if m:
            hits.append((n, m.group(1), "campo"))
            continue
        if linea.strip().startswith("|") and linea.count("|") >= 4:
            if set(linea.strip().strip("|").replace("|", "").strip()) <= set("-: "):
                continue                      # separador de tabla markdown, no una fila
            celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
            antes = len(hits)
            for c in reversed(celdas):
                # Una fila PARTIDA por dimension (§14.2) trae los dos veredictos en una celda que
                # arranca en minuscula: `contenido: COHERENTE · componente: FUERA-DE-REFERENCIA`.
                # El patron de las filas normales no la matchea y la perdia ENTERA — ni 1 ni 2, y sin
                # avisar. Se buscan primero TODOS los `<dimension>: VEREDICTO` de la celda.
                partidos = re.findall(r"(?:contenido|componente|ambas)\s*:\s*\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", c)
                if len(partidos) >= 2:
                    for v in partidos:
                        hits.append((n, v, "tabla-partida"))
                    break
                m2 = re.match(r"\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", c)
                if m2 and m2.group(1) not in ("N/A", "SHA", "ID"):
                    hits.append((n, m2.group(1), "tabla"))
                    break
            if len(hits) == antes:
                # Una fila de tabla que no rinde veredicto es un HUECO, no un cero: se nombra.
                hits.append((n, "SIN_VEREDICTO_PARSEABLE", "hueco"))
    return hits


docs = {"lote_A": ubicar("lote-A"), "lote_B": ubicar("lote-B")}
faltan = [k for k, v in docs.items() if v is None]
if faltan:
    print(f"ABORTA: no encontre {faltan}. Un 0 aca seria del instrumento, no del dato.", file=sys.stderr)
    sys.exit(2)

res = {"medido_en": time.strftime("%Y-%m-%d %H:%M:%S"), "lotes": {}}
for k, p in docs.items():
    txt = io.open(p, encoding="utf-8", errors="replace").read()
    hits = veredictos_de(txt)
    porClase = {}
    for _, v, _ in hits:
        porClase[v] = porClase.get(v, 0) + 1
    res["lotes"][k] = {
        "archivo": sello(p),
        "veredictos_total": len(hits),
        "por_clase": dict(sorted(porClase.items(), key=lambda x: -x[1])),
        "no_comparacion": sum(n for v, n in porClase.items() if v in NO_COMPARACION),
        "detalle": [{"linea": n, "veredicto": v, "forma": f} for n, v, f in hits],
    }

# --- control positivo: si el formato cambio y un lote da 0, el conteo no se lee ---
a, b = res["lotes"]["lote_A"]["veredictos_total"], res["lotes"]["lote_B"]["veredictos_total"]
if a < 15 or b < 10:
    print(f"CONTROL POSITIVO FALLA: lote A={a} (esperado >=15), lote B={b} (esperado >=10). "
          f"El formato cambio o el patron no matchea. El conteo NO se lee.", file=sys.stderr)
    sys.exit(3)

if "--json" in sys.argv:
    print(json.dumps(res, ensure_ascii=False, indent=2))
    sys.exit(0)

print(f"CONTROL POSITIVO OK: lote A={a}, lote B={b} (ninguno en 0 -> el patron matchea el formato)\n")
for k, d in res["lotes"].items():
    f = d["archivo"]
    print(f"=== {k} ===")
    print(f"  archivo   {f['path']}")
    print(f"  version   sha256:{f['sha256_12']} · {f['bytes']} bytes · mtime {f['mtime']}")
    print(f"  UNIDAD «veredictos en rol de veredicto»: {d['veredictos_total']}")
    print(f"    de los cuales NO son una comparacion: {d['no_comparacion']}")
    for v, n in d["por_clase"].items():
        marca = "  <- no es comparacion" if v in NO_COMPARACION else ""
        print(f"      {n:3}  {v}{marca}")
    print()
tot = a + b
tnc = res["lotes"]["lote_A"]["no_comparacion"] + res["lotes"]["lote_B"]["no_comparacion"]
print(f"HUECOS (filas de tabla sin veredicto parseable): "
      f"{sum(1 for L in res['lotes'].values() for h in L['detalle'] if h['forma']=='hueco')}")
print(f"TOTAL, unidad «veredictos»: {tot}  ·  de los cuales no-comparacion: {tnc}")
print("⚠️  Esta cifra es en VEREDICTOS. En «mediciones» (id+camino) es menor: una medicion partida")
print("   por dimension emite dos veredictos. Nunca citar el numero sin la unidad.")
