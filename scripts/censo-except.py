"""Censo de bloques `except` del backend + motor: qué hace cada uno con el error.

Idempotente y read-only. Emite TSV para triar. Dos ejes independientes:

  destino    relanza | deposita | solo_log | informa | evapora  (qué pasa con el error)
  intencion  documentado | mudo                        (hay un porqué escrito al lado)

`evapora` es sintáctico, NO es veredicto: una ausencia legítima («nunca hubo alta»)
evapora igual que un fallo tapado. El cruce con `intencion` es lo que permite triar:
`evapora + mudo` es la cola que hay que leer a mano.
"""
import ast
import io
import pathlib
import sys
import tokenize

RAICES = [
    pathlib.Path("apps/copiloto"),
    pathlib.Path("motor/backend/agent"),
    pathlib.Path("motor/clients/agent"),
]
EXCLUIDOS = ("conftest.py",)
DEPOSITA = ("registrar_evento", "store", "_store", "dlq", "trauma", "pendiente", "fallido")
# El handler no persiste el error, pero produce un valor que ALGUIEN lee: un 409, un motivo que
# pinta la pantalla, un ToolResult de error que vuelve al agente. No es evaporación.
INFORMA = ("_conflicto", "conflicto(", "ErrorValidacion", "self._motivo", "_MSG_",
           'status="error"', "'error'", '"error"', "reason", "motivo")


def lineas_con_comentario(fuente: str) -> set[int]:
    try:
        toks = tokenize.generate_tokens(io.StringIO(fuente).readline)
        return {t.start[0] for t in toks if t.type == tokenize.COMMENT}
    except (tokenize.TokenError, IndentationError):
        return set()


def destino(handler: ast.ExceptHandler, fuente: str) -> str:
    cuerpo = ast.get_source_segment(fuente, handler) or ""
    if any(isinstance(n, ast.Raise) for n in ast.walk(handler)):
        return "relanza"
    if any(t in cuerpo for t in DEPOSITA):
        return "deposita"
    if any(
        isinstance(n, ast.Attribute)
        and n.attr in ("debug", "info", "warning", "error", "exception", "critical")
        for n in ast.walk(handler)
    ):
        return "solo_log"
    if any(t in cuerpo for t in INFORMA):
        return "informa"
    return "evapora"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    filas = []
    for raiz in RAICES:
        if not raiz.exists():
            print(f"AVISO: no existe {raiz}", file=sys.stderr)
            continue
        for py in sorted(raiz.rglob("*.py")):
            if py.name.startswith("test_") or py.name in EXCLUIDOS or "/tests/" in py.as_posix():
                continue
            fuente = py.read_text(encoding="utf-8")
            try:
                arbol = ast.parse(fuente)
            except SyntaxError as exc:
                print(f"AVISO: no parsea {py}: {exc}", file=sys.stderr)
                continue
            comentadas = lineas_con_comentario(fuente)
            for nodo in ast.walk(arbol):
                if not isinstance(nodo, ast.ExceptHandler):
                    continue
                fin = getattr(nodo, "end_lineno", nodo.lineno)
                intencion = ("documentado"
                             if comentadas & set(range(nodo.lineno, fin + 1)) else "mudo")
                primera = (ast.get_source_segment(fuente, nodo.body[0]) or "").splitlines()[:1]
                filas.append((destino(nodo, fuente), intencion, py.as_posix(), nodo.lineno,
                              (primera[0].strip() if primera else "")[:80]))

    print("== TOTAL:", len(filas), "handlers (sin tests ni conftest) ==\n")
    print(f"{'destino':10s} {'documentado':>12s} {'mudo':>6s}")
    for d in ("relanza", "deposita", "solo_log", "informa", "evapora"):
        doc = sum(1 for f in filas if f[0] == d and f[1] == "documentado")
        mudo = sum(1 for f in filas if f[0] == d and f[1] == "mudo")
        print(f"{d:10s} {doc:12d} {mudo:6d}")

    print("\n---- COLA A LEER: evapora + mudo ----")
    for d, i, ruta, linea, snippet in filas:
        if d == "evapora" and i == "mudo":
            print(f"{ruta}:{linea}\t{snippet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
