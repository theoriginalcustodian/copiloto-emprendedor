#!/usr/bin/env python3
# ESCRITO POR AUDITORIA el 2026-09-30 y traido al gate por planificacion el mismo dia, con su
# docstring y sus dos controles intactos. Vive en `scripts/tests/` y no en
# `docs/.../Auditorias/` —donde nacio y donde va TODO lo de auditorias— porque no es el
# registro de una auditoria: es un instrumento PERMANENTE que el gate tiene que correr en cada
# vuelta. Un canario que viva en un doc se corre cuando alguien se acuerda, y este existe
# justamente porque nadie se acordaba de cruzar el padron contra su lector.
"""CANARIO DEL ALFABETO: cruza el PADRON del criterio 3 contra el LECTOR que lo parsea.

Por que existe (auditoria, 2026-09-30, sobre el caso real de `(home)`):

  El universo del criterio 3 son 54 ids que este mismo repo FABRICA: `criterio3-padron.sh:59`
  los normaliza desde el SPEC de BL-P5 — y ahi nacio `(home)`, del texto `*(vacio)* Mi dia`.
  El lector de esos ids son las formas de celda de `contar-veredictos.py`, que exigian
  `[a-z0-9]` al inicio. **El universo y su lector no compartian el alfabeto**, y nadie cruzaba
  los dos: `(home)` fue ilegible 8 dias.

  Y la falla NO daba sintoma, por una razon que importa mas que el id: un documento cuyo UNICO
  sujeto es ilegible **no llega a ser candidato**, asi que no aparece ni entre los medidos ni
  entre los descartados, y el ratchet `exit 8` —que si caza al candidato sin clasificar— nunca
  se entera. El `cierre_` de FE2 con la medicion de `(home)` estuvo en el buzon desde las 00:17
  y el reporte siguio diciendo `53 de 54`, con la cifra faltante contada pero SIN NOMBRAR.

  #742 arreglo el alfabeto de hoy. Esto es el control que faltaba: el padron es GENERADO, asi
  que la proxima spec puede fabricar otro id raro y volver a vivir ilegible. El canario falla
  **al construir**, no ocho dias despues.

Contrato:
  exit 0 = los N ids del padron son legibles por el lector
  exit 1 = al menos uno es ILEGIBLE -> el criterio no puede cerrarse, y se dice CUAL
  exit 2 = no se pudo establecer la precondicion (padron o parser ausente), que NO es lo mismo
           que "todos legibles". Vacio no es hallazgo.

Uso:  python docs/copiloto-emprendedor/Auditorias/2026-09-30-canario-del-alfabeto-del-padron.py
      [--parser <ruta>]   (default: scripts/evidencia/contar-veredictos.py)

Controles horneados, porque un canario sin control positivo es un instrumento que no mira:
  POSITIVO: con `--control-negativo` se le pasa una fila con un id que el lector NO puede leer
            y el canario TIENE que cazarlo. Si no lo caza, su 0 no vale.
  NEGATIVO: un token con forma de id que NO esta en el padron debe seguir siendo ilegible; si
            pasara, el lector estaria inventando sujetos en vez de reconocer los declarados.
"""
import argparse, importlib.util, os, sys

CAB = "| id | veredicto | nota |\n|---|---|---|\n"
# La forma que los documentos usan DE VERDAD: id entre backticks + glosa. La version pelada sola
# daba verde parcial y tapaba que la forma real seguia ilegible (lo pago #742 en su primer intento).
FILA = "| `%s` (glosa) | COHERENTE | x |\n"


def cargar(ruta):
    if not os.path.exists(ruta):
        print("ABORTA: no existe el parser %s" % ruta)
        sys.exit(2)
    spec = importlib.util.spec_from_file_location("cv_canario", ruta)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["cv_canario"] = mod
    sys.argv = ["cv"]                      # el parser corre su main() si lo invocan como script
    try:
        spec.loader.exec_module(mod)
    except SystemExit:
        pass                               # importarlo no es correrlo: su exit no es el nuestro
    for f in ("universo_de_sujetos", "mediciones_de"):
        if not hasattr(mod, f):
            print("ABORTA: el parser no expone %s() — contrato cambiado" % f)
            sys.exit(2)
    return mod


def legible(mod, ident, ids):
    _, meds, _ = mod.mediciones_de(CAB + FILA % ident, ids=frozenset(ids))
    return any(m["id"] == ident for m in meds)


def main():
    ap = argparse.ArgumentParser()
    # La ruta sale de `__file__`, NO del cwd. Con el default relativo, correrlo desde cualquier
    # directorio que no fuera la raiz daba `exit 2` «no existe el parser» — un falso «no pude medir»
    # exactamente en el caso que el canario viene a cubrir, y el gate corre los tests sin garantia
    # de cwd. Es `memoria/un-procedimiento-nuevo-mueve-el-instrumento-a-un-contexto-que-nadie-probo`.
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--parser", default=os.path.join(raiz, "scripts", "evidencia", "contar-veredictos.py"))
    a = ap.parse_args()
    mod = cargar(a.parser)
    ids = sorted(mod.universo_de_sujetos())
    if not ids:
        print("ABORTA: el padron devolvio 0 ids. Vacio no es hallazgo: el universo es la precondicion.")
        sys.exit(2)

    ileg = [i for i in ids if not legible(mod, i, ids)]
    leg = [i for i in ids if i not in ileg]
    print("parser medido: %s" % a.parser)
    print("EXAMINADOS: %d de %d ids del padron, uno por uno, con la forma real de los documentos"
          % (len(ids), len(ids)))
    print("  LEGIBLES : %d de %d" % (len(leg), len(ids)))
    print("  ILEGIBLES: %d de %d%s" % (len(ileg), len(ids), (" -> %s" % ileg) if ileg else " (ninguno)"))

    # CONTROL POSITIVO — y la primera version estaba MAL, con el error justo en el medio del punto
    # que este canario hace. Probaba con un cebo `((cebo-del-canario))` metido DENTRO de `ids`, y el
    # parser de #742 lo daba por legible: con razon, porque el lector reconoce lo que el padron
    # DECLARA, y al meter el cebo en el padron yo lo habia declarado. El cebo no era imposible: lo
    # autorice. Un guard condicionado a una lista blanca no se puede probar metiendo el cebo en la
    # lista blanca — entra por la misma puerta que el guard abre a proposito. Resultado: `exit 2`
    # sobre el unico parser que estaba BIEN, o sea un falso rojo de mi propio instrumento.
    #
    # El control correcto no prueba que un token sea raro: prueba que el canario detecta un LECTOR
    # CIEGO. Se le inyecta un lector que no lee nada y los 54 tienen que salir ilegibles. Asi el
    # control es del canario, no del parser, y vale con cualquier parser.
    real = mod.mediciones_de
    try:
        mod.mediciones_de = lambda *a, **k: ([], [], 0)
        ciegos = [i for i in ids if not legible(mod, i, ids)]
    finally:
        mod.mediciones_de = real
    if len(ciegos) != len(ids):
        print("CONTROL POSITIVO FALLO: con un lector CIEGO el canario vio %d de %d legibles -> su 0 NO vale"
              % (len(ids) - len(ciegos), len(ids)))
        sys.exit(2)
    print("control POSITIVO: con un lector ciego inyectado, %d de %d salen ilegibles -> el canario si mide"
          % (len(ciegos), len(ids)))

    # CONTROL NEGATIVO: forma rara FUERA del padron sigue ilegible (el fix reconoce lo declarado,
    # no relaja el lector).
    _, m2, _ = mod.mediciones_de(CAB + "| `(fuera-del-padron)` | COHERENTE | x |\n", ids=frozenset(ids))
    if [x for x in m2 if "fuera-del-padron" in x["id"]]:
        print("CONTROL NEGATIVO FALLO: el lector acepta un token que el padron no declara")
        sys.exit(2)
    print("control NEGATIVO: token fuera del padron sigue ilegible -> no inventa sujetos")

    if ileg:
        print("\n>>> El criterio 3 NO puede cerrarse: %d id(s) del padron son ILEGIBLES para su lector."
              % len(ileg))
        print("    No es que falte medirlos: por bien que alguien los mida, su veredicto queda")
        print("    huerfano y el documento entero puede no llegar a ser candidato.")
        sys.exit(1)
    print("\n>>> alfabeto compartido: los %d ids del padron son legibles por su lector" % len(ids))
    sys.exit(0)


if __name__ == "__main__":
    main()
