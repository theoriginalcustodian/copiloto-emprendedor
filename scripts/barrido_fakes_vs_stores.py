#!/usr/bin/env python3
"""Barrido: ¿el fake de un test declara una forma que el store real NO cumple?

Origen: SM-N21 — el fake de `_run_marcar_factura_cobrada` devolvía `estado:"cobrada"` y el store real
responde `estado_cobro`; el test salía verde POR el fake (`2026-11-03`, sonda con LLM real).

Por cada par (clase fake → clase real) mide, SIN ejecutar nada (AST):
  · info-MÉTODO — método del fake que el real no tiene (el fake inventa una API).
  · PARAM    — kwarg del fake que el real no acepta (deriva de firma).
  · info-INVENTA — clave de dict que el fake devuelve y que el real NO produce en ese método (ni en los
               helpers `self._x` que llama): el fake responde un campo que no existe.
  · VALOR    — el fake responde `K=V` y en el real `V` es valor de OTRA clave (K2), no de K: es el caso N21
               (`estado:"cobrada"`; en el real "cobrada" es del `estado_cobro`, y `estado` es el del comprobante).
               Un fake puede acertar todas las CLAVES y mentir en qué campo responde la pregunta.
  · info-OMITE — clave que el real produce, el fake no, y que producción lee. NO entra al veredicto: un fake
               mínimo es legítimo, y medido el set de claves solo no distingue el N21 (ver docstring del control).
Veredicto por par: SUCIO si hay VALOR o PARAM; los `info-*` (INVENTA, MÉTODO, OMITE) se cuentan pero NO
deciden: son ruidosos por construcción (filas armadas dinámicamente, contabilidad propia del fake) y se
auditan a mano sólo en los pares de plata/tenant. Cada hallazgo lleva path:línea de ambos lados.

Uso:  python -I -X utf8 scripts/barrido_fakes_vs_stores.py [--ref <git-ref>]   (sin --ref: working tree)
`--ref` lee los archivos desde `git show <ref>:<path>` (control positivo: contra `3b20a1f1^` el par N21 sale SUCIO).
"""
from __future__ import annotations

import ast
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
T = "apps/copiloto/tests/"
A = "apps/copiloto/"

FAKE_RE = re.compile(r"fake|falso|stub", re.I)
# dobles de CONEXIONES/CLIENTES/transportes, no de stores: se emparejarían por métodos genéricos (`commit`, `get`)
NO_STORE_RE = re.compile(r"conn|cursor|cur\b|http|temporal|gateway|client(?!e)|handle|sdk|reloj|gotrue|crypto|input|request|tools", re.I)
EXENCIONES = RAIZ / "scripts/ci/barrido-fakes-exenciones.json"


def archivos(ref: str | None, carpeta: str) -> list[str]:
    """`.py` directos de la carpeta (sin recursión: `apps/copiloto/*.py` es la capa de producción)."""
    if ref is None:
        return sorted(p.relative_to(RAIZ).as_posix() for p in (RAIZ / carpeta).glob("*.py"))
    out = subprocess.run(["git", "ls-tree", "--name-only", ref, carpeta], cwd=RAIZ, capture_output=True, text=True,
                         encoding="utf-8", check=True).stdout.split()
    return sorted(f for f in out if f.endswith(".py"))


def _publicos(cls: ast.ClassDef) -> set[str]:
    return {n.name for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and not n.name.startswith("_")}


def derivar_pares(ref: str | None) -> tuple[list[tuple[str, str, str, str]], list[str]]:
    """REGLA (no una lista): el corte son los **stores de tenant** — toda clase `*Store` de `apps/copiloto/*.py` cuyo
    `__init__` recibe `cliente_id` (ahí viven plata, comprobantes y aislamiento, y un store nuevo entra solo).
    Cada clase fake/falso/stub de `apps/copiloto/tests/` se empareja con el store tenant cuyos métodos públicos
    contiene (>= 50 % de los suyos y al menos 1 compartido); desempate: el test importa/nombra al real. Un empate
    que sigue vivo NO se adivina: vuelve en `ambiguos` y el gate falla pidiendo un pin en el JSON de exenciones."""
    reales: dict[str, tuple[str, set[str]]] = {}
    for f in archivos(ref, A):
        for c in ast.walk(ast.parse(leer(f, ref))):
            if isinstance(c, ast.ClassDef) and c.name.endswith("Store"):
                ini = next((n for n in c.body if isinstance(n, ast.FunctionDef) and n.name == "__init__"), None)
                if ini and "cliente_id" in params(ini)[0]:
                    reales[c.name] = (f, _publicos(c))
    pins = json.loads(EXENCIONES.read_text(encoding="utf-8")).get("pares_fijos", {}) if EXENCIONES.exists() else {}
    pares, ambiguos = [], []
    for f in archivos(ref, T):
        src = leer(f, ref)
        for c in ast.walk(ast.parse(src)):
            if not (isinstance(c, ast.ClassDef) and FAKE_RE.search(c.name) and not NO_STORE_RE.search(c.name)):
                continue
            pub = _publicos(c)
            if not pub:
                continue
            clave = f"{Path(f).name}::{c.name}"
            if clave in pins:
                pares.append((f, c.name, reales[pins[clave]][0], pins[clave]))
                continue
            # cubre >= 1/3 de los métodos del fake, con >= 2 compartidos (uno solo es un nombre genérico: `get`, `save`)
            cand = [((len(pub & rp) / len(pub), len(pub & rp) / len(pub | rp)), n) for n, (_, rp) in reales.items()
                    if len(pub & rp) >= 2 and len(pub & rp) / len(pub) >= 0.34]
            if not cand:
                continue
            mejor = max(sc for sc, _ in cand)       # (cobertura del fake, Jaccard: castiga al real mucho más grande)
            top = [n for sc, n in cand if sc == mejor]
            if len(top) > 1:
                top = [n for n in top if n in src or Path(reales[n][0]).stem in src] or top
            if len(top) == 1:
                pares.append((f, c.name, reales[top[0]][0], top[0]))
            else:
                ambiguos.append(f"{clave} ~ {'/'.join(sorted(top))}")
    return pares, ambiguos


def leer(path: str, ref: str | None) -> str:
    if ref is None:
        return (RAIZ / path).read_text(encoding="utf-8")
    return subprocess.run(["git", "show", f"{ref}:{path}"], cwd=RAIZ, capture_output=True, text=True,
                          encoding="utf-8", check=True).stdout


def clase(tree: ast.Module, nombre: str) -> ast.ClassDef | None:
    return next((n for n in ast.walk(tree) if isinstance(n, ast.ClassDef) and n.name == nombre), None)


def metodos(cls: ast.ClassDef) -> dict[str, ast.FunctionDef | ast.AsyncFunctionDef]:
    return {n.name: n for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}


def claves_dict(nodo: ast.AST) -> dict[str, int]:
    """Claves-string de los dict literales en el cuerpo → línea de la primera aparición."""
    out: dict[str, int] = {}
    for n in ast.walk(nodo):
        if isinstance(n, ast.Dict):
            for k in n.keys:
                if isinstance(k, ast.Constant) and isinstance(k.value, str):
                    out.setdefault(k.value, k.lineno)
        elif isinstance(n, ast.Assign):                  # x["k"] = ...  también construye la respuesta
            for t in n.targets:
                if (isinstance(t, ast.Subscript) and isinstance(t.slice, ast.Constant)
                        and isinstance(t.slice.value, str)):
                    out.setdefault(t.slice.value, t.lineno)
    return out


def _llamado(n: ast.AST) -> str | None:
    """Nombre del helper que llama el nodo: `self._x(...)` o `_x(...)` (función de módulo)."""
    if isinstance(n, ast.Call):
        if isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id == "self":
            return n.func.attr
        if isinstance(n.func, ast.Name):
            return n.func.id
    return None


def claves_real(ms: dict, nombre: str, visto: frozenset = frozenset(), prof: int = 4) -> dict[str, int]:
    """Claves que produce el método real + las de los helpers `self._x` que llama (profundidad acotada)."""
    if nombre not in ms or nombre in visto or prof == 0:
        return {}
    out = dict(claves_dict(ms[nombre]))
    for n in ast.walk(ms[nombre]):
        sig = _llamado(n)
        if sig:
            for k, v in claves_real(ms, sig, visto | {nombre}, prof - 1).items():
                out.setdefault(k, v)
    return out


_LECT: dict[str | None, dict[str, tuple[set[str], set[str], set[str]]]] = {}


def lecturas(ref: str | None) -> dict[str, tuple[set[str], set[str], set[str]]]:
    """Por archivo de PRODUCCIÓN: (métodos que llama `.m(`, claves que lee con `.get("k")`, claves que lee con `x["k"]`)."""
    if ref in _LECT:
        return _LECT[ref]
    out = {}
    for f in archivos(ref, A):
        llam, gets, subs = set(), set(), set()
        for n in ast.walk(ast.parse(leer(f, ref))):
            if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant) and isinstance(n.slice.value, str):
                subs.add(n.slice.value)
            elif isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
                llam.add(n.func.attr)
                if n.func.attr == "get" and n.args and isinstance(n.args[0], ast.Constant) and isinstance(n.args[0].value, str):
                    gets.add(n.args[0].value)
        out[f] = (llam, gets, subs)
    _LECT[ref] = out
    return out


def params(f) -> tuple[set[str], bool]:
    a = f.args
    nombres = {x.arg for x in a.args + a.kwonlyargs + a.posonlyargs} - {"self"}
    return nombres, a.kwarg is not None


@dataclass
class Hallazgo:
    tipo: str
    detalle: str
    objeto: str = ""      # literal que una exención cita: `Fake.metodo(param)` / `Fake.metodo:clave=valor`


def _pares_dict(nodo: ast.AST):
    for n in ast.walk(nodo):
        if isinstance(n, ast.Dict):
            for k, v in zip(n.keys, n.values):
                if isinstance(k, ast.Constant) and isinstance(k.value, str):
                    yield k.value, v, k.lineno


def _es_literal(e: ast.AST) -> bool:
    if isinstance(e, ast.Constant):
        return isinstance(e.value, str)
    return isinstance(e, ast.IfExp) and _es_literal(e.body) and _es_literal(e.orelse)


def _valores(expr: ast.AST, tree: ast.Module, prof: int = 3) -> set[str]:
    """Strings que `expr` puede valer: literales, constantes de módulo (`COBRADA`) y los `return` de la
    función que llama (`estado_de_cobro(...)`). Lo que no resuelve queda fuera: dominio vacío = desconocido."""
    out: set[str] = set()
    if prof == 0:
        return out
    claves = {id(n.slice) for n in ast.walk(expr) if isinstance(n, ast.Subscript)}   # x["k"]: `k` es la CLAVE, no un valor
    for n in ast.walk(expr):
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in claves:
            out.add(n.value)
        elif isinstance(n, ast.Name):
            for m in tree.body:
                if not isinstance(m, ast.Assign):
                    continue
                for t in m.targets:
                    if isinstance(t, ast.Name) and t.id == n.id and isinstance(m.value, ast.Constant) \
                            and isinstance(m.value.value, str):
                        out.add(m.value.value)
                    elif (isinstance(t, ast.Tuple) and isinstance(m.value, ast.Tuple)      # A, B = "a", "b"
                          and len(t.elts) == len(m.value.elts)):
                        for te, ve in zip(t.elts, m.value.elts):
                            if (isinstance(te, ast.Name) and te.id == n.id and isinstance(ve, ast.Constant)
                                    and isinstance(ve.value, str)):
                                out.add(ve.value)
        elif isinstance(n, ast.Call):
            nom = n.func.id if isinstance(n.func, ast.Name) else (n.func.attr if isinstance(n.func, ast.Attribute) else None)
            for m in ast.walk(tree):
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and m.name == nom:
                    for r in ast.walk(m):
                        if isinstance(r, ast.Return) and r.value is not None:
                            out |= _valores(r.value, tree, prof - 1)
    return out


def dominios_real(ms: dict, nombre: str, tree: ast.Module, visto: frozenset = frozenset(), prof: int = 4) -> dict[str, set[str]]:
    if nombre not in ms or nombre in visto or prof == 0:
        return {}
    out: dict[str, set[str]] = {}
    for k, v, _ in _pares_dict(ms[nombre]):
        out.setdefault(k, set()).update(_valores(v, tree))
    for n in ast.walk(ms[nombre]):
        sig = _llamado(n)
        if sig:
            for k, d in dominios_real(ms, sig, tree, visto | {nombre}, prof - 1).items():
                out.setdefault(k, set()).update(d)
    return out


def comparar(pf: str, cf: str, pr: str, cr: str, ref: str | None) -> list[Hallazgo]:
    tf = ast.parse(leer(pf, ref))
    # Consumidores relevantes = los módulos de producción que ESE test importa (los que el fake puede estar alimentando),
    # sin el propio store real (sus lecturas internas no consumen al fake).
    imps = {n.module.split(".")[0] for n in ast.walk(tf) if isinstance(n, ast.ImportFrom) and n.module} | \
           {a.name.split(".")[0] for n in ast.walk(tf) if isinstance(n, ast.Import) for a in n.names}
    lect = {a: v for a, v in lecturas(ref).items() if Path(a).stem in imps and a != pr}
    return comparar_ast(tf, ast.parse(leer(pr, ref)), pf, cf, pr, cr, lect)


def comparar_ast(tf: ast.Module, tr: ast.Module, pf: str, cf: str, pr: str, cr: str, lect: dict) -> list[Hallazgo]:
    f, r = clase(tf, cf), clase(tr, cr)
    if f is None or r is None:
        raise SystemExit(f"par roto: {cf}@{pf} -> {cr}@{pr} (¿se renombró?)")
    mf, mr = metodos(f), metodos(r)
    mr_ext = {n.name: n for n in tr.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))} | mr
    hs: list[Hallazgo] = []
    for nombre, fm in mf.items():
        if nombre.startswith("__"):
            continue
        if nombre not in mr:
            if not nombre.startswith("_"):   # los helpers propios del fake (contadores, spies) no son API
                hs.append(Hallazgo("info-MÉTODO", f"{cf}.{nombre} ({pf}:{fm.lineno}) no existe en {cr} ({pr})"))
            continue
        pf_, kw_f = params(fm)
        pr_, kw_r = params(mr[nombre])
        if not kw_r:
            for p in sorted(pf_ - pr_):
                hs.append(Hallazgo("PARAM", f"{cf}.{nombre}({p}=) ({pf}:{fm.lineno}) · {cr}.{nombre} no lo acepta ({pr}:{mr[nombre].lineno})",
                                   f"{cf}.{nombre}({p})"))
        dom = dominios_real(mr_ext, nombre, tr)
        for k, v, ln in _pares_dict(fm):
            if not _es_literal(v):
                continue
            for val in sorted(_valores(v, tf)):
                duenos = sorted(k2 for k2, d in dom.items() if val in d)
                if duenos and k not in duenos:
                    hs.append(Hallazgo("VALOR", f"{cf}.{nombre} responde {k}={val!r} ({pf}:{ln}) · en {cr} `{val}` es valor de "
                                                f"`{'/'.join(duenos)}`, no de `{k}` ({pr}:{mr[nombre].lineno})",
                                       f"{cf}.{nombre}:{k}={val}"))
        kf, kr = claves_dict(fm), claves_real(mr_ext, nombre)
        if not kr:     # el real no arma dicts (devuelve fila/objeto de otro lado): sin base para comparar claves
            continue
        for k in sorted(set(kf) - set(kr)):
            hs.append(Hallazgo("info-INVENTA", f"{cf}.{nombre} responde `{k}` ({pf}:{kf[k]}) · {cr}.{nombre} no lo produce ({pr}:{mr[nombre].lineno})"))
        if kf:
            # TRIAGE del OMITE: sólo importa un consumidor REAL de este método (`.nombre(` en producción). Si lo lee
            # con `x["k"]` y el fake no la da, el test revienta con KeyError (RUIDOSO, benigno). Si lo lee con
            # `.get("k")` el default tapa la ausencia y el test sigue verde sobre una forma que no existe (SILENCIOSO).
            for k in sorted(set(kr) - set(kf)):
                cons = [(a, g, sb) for a, (ll, g, sb) in lect.items() if nombre in ll and (k in g or k in sb)]
                silencioso = [a for a, g, sb in cons if k in g and k not in sb]
                if silencioso:
                    hs.append(Hallazgo("info-OMITE-SILENCIOSO", f"{cf}.{nombre} no responde `{k}` ({pf}:{fm.lineno}) · {cr}.{nombre} sí "
                                       f"({pr}:{kr[k]}) · y `{silencioso[0]}` la lee con .get() tras llamar `.{nombre}(`",
                                       f"{cf}.{nombre}~{k}"))
                elif cons:
                    hs.append(Hallazgo("info-OMITE", f"{cf}.{nombre} no responde `{k}` pero el consumidor la lee con [..] (KeyError ruidoso)"))
    return hs


def cargar_json() -> dict:
    return json.loads(EXENCIONES.read_text(encoding="utf-8")) if EXENCIONES.exists() else {}


def aplicar_exenciones(duros: dict[str, list[Hallazgo]], exenciones: list[dict], hoy: str) -> tuple[dict[str, list[Hallazgo]], list[str]]:
    """Quita los hallazgos exentos y devuelve (duros restantes, problemas): exención sin fecha/motivo, VENCIDA, o [STALE]
    (su `objeto` ya no produce hallazgo: el defecto se arregló o el fake desapareció — la exención no puede sobrevivirlo)."""
    problemas: list[str] = []
    vivos = {h.objeto for hs in duros.values() for h in hs}
    for e in exenciones:
        obj = e.get("objeto", "")
        if not (obj and e.get("motivo") and e.get("revisar_hasta")):
            problemas.append(f"exención sin objeto/motivo/revisar_hasta: {e}")
        elif e["revisar_hasta"] < hoy:
            problemas.append(f"exención VENCIDA ({e['revisar_hasta']}): {obj} — arreglarlo o renovar con motivo")
        elif obj not in vivos:
            problemas.append(f"[STALE] exención de `{obj}`: ya no hay hallazgo — borrarla")
    exentos = {e.get("objeto") for e in exenciones}
    return {k: [h for h in hs if h.objeto not in exentos] for k, hs in duros.items()}, problemas


# --- AUTOTEST: el gate se prueba a sí mismo con el N21 en miniatura (un gate que no sabe ponerse rojo no acredita nada)
_REAL = """
IMPAGA, PARCIAL, COBRADA = "impaga", "parcial", "cobrada"
def estado_de_cobro(total, cobrado):
    return COBRADA if cobrado >= total else PARCIAL
class CobroStore:
    def __init__(self, conn_factory, cliente_id): pass
    def registrar(self, comprobante_id, *, monto=None):
        return self._resumen(comprobante_id)
    def _resumen(self, cid):
        return {"estado_cobro": estado_de_cobro(1, 1), "estado": "emitida", "saldo": "0"}
"""
_FAKE_N21 = """
class CobroFake:
    def registrar(self, comprobante_id, *, monto=None):
        return {"estado": "cobrada" if monto else "parcial", "saldo": "0"}
"""
_FAKE_OK = """
class CobroFake:
    def registrar(self, comprobante_id, *, monto=None):
        return {"estado": "emitida", "estado_cobro": "cobrada" if monto else "parcial", "saldo": "0"}
"""
_FAKE_PARAM = _FAKE_OK.replace("monto=None", "importe=None").replace("if monto", "if importe")


def autotest() -> int:
    tr = ast.parse(_REAL)
    casos = [("N21 (estado='cobrada' donde el real dice estado_cobro)", _FAKE_N21, "VALOR"),
             ("fake fiel (estado='emitida' + estado_cobro)", _FAKE_OK, None),
             ("kwarg que el real no acepta", _FAKE_PARAM, "PARAM")]
    mal = 0
    for nombre, src, espera in casos:
        tipos = {h.tipo for h in comparar_ast(ast.parse(src), tr, "fake.py", "CobroFake", "real.py", "CobroStore", {})
                 if not h.tipo.startswith("info")}
        ok = (espera in tipos) if espera else not tipos
        print(f"  {'✔' if ok else '✖'} {nombre}: duros={sorted(tipos) or '-'} (espera {espera or 'limpio'})")
        mal += not ok
    h = Hallazgo("PARAM", "x", "F.m(p)")
    resto, prob = aplicar_exenciones({"par": [h]}, [{"objeto": "F.m(p)", "motivo": "m", "revisar_hasta": "2999-01-01"}], "2026-11-03")
    ok = not resto["par"] and not prob
    print(f"  {'✔' if ok else '✖'} exención con objeto vivo, motivo y fecha: absuelve el hallazgo")
    mal += not ok
    _, prob = aplicar_exenciones({"par": []}, [{"objeto": "F.m(p)", "motivo": "m", "revisar_hasta": "2999-01-01"}], "2026-11-03")
    ok = len(prob) == 1 and "STALE" in prob[0]
    print(f"  {'✔' if ok else '✖'} exención cuyo objeto ya no existe: [STALE]")
    mal += not ok
    _, prob = aplicar_exenciones({"par": [h]}, [{"objeto": "F.m(p)", "motivo": "m", "revisar_hasta": "2020-01-01"}], "2026-11-03")
    ok = len(prob) == 1 and "VENCIDA" in prob[0]
    print(f"  {'✔' if ok else '✖'} exención vencida: roja")
    mal += not ok
    print("autotest:", "OK" if not mal else f"FALLA ({mal})")
    return 1 if mal else 0


def main() -> int:
    if "--autotest" in sys.argv:
        return autotest()
    ref = sys.argv[sys.argv.index("--ref") + 1] if "--ref" in sys.argv else None
    check = "--check" in sys.argv
    pares, ambiguos = derivar_pares(ref)
    cfg = cargar_json()
    problemas: list[str] = [f"AMBIGUO (sin pin en {EXENCIONES.name}): {a}" for a in ambiguos]
    vistos = {f"{Path(f).name}::{c}" for f, c, _, _ in pares}
    problemas += [f"[STALE] pin `{k}`: el fake ya no existe" for k in cfg.get("pares_fijos", {}) if k not in vistos]
    duros: dict[str, list[Hallazgo]] = {}
    silenciosos: list[Hallazgo] = []
    for pf, cf, pr, cr in pares:
        clave = f"{Path(pf).name}::{cf} → {cr}"
        try:
            hs = comparar(pf, cf, pr, cr, ref)
        except subprocess.CalledProcessError:
            print(f"?  {cf:28} → {cr:22} (no existe en {ref})")
            continue
        duros[clave] = [h for h in hs if not h.tipo.startswith("info")]
        silenciosos += [h for h in hs if h.tipo == "info-OMITE-SILENCIOSO"]
        if not check:
            print(f"{'✔ LIMPIO' if not duros[clave] else '✖ SUCIO '} {clave}  ({len(duros[clave])} duros · {len(hs) - len(duros[clave])} info)")
    if silenciosos and not check:
        print(f"\nTRIAGE info-OMITE-SILENCIOSO ({len(silenciosos)}): clave que el real devuelve, el fake omite y un consumidor "
              f"importado por el test lee con .get() (el default tapa la ausencia). NO decide el veredicto: casi todas son "
              f"campos opcionales; se listan para revisión humana.")
        for h in silenciosos:
            print(f"      {h.detalle}")
    duros, prob_ex = aplicar_exenciones(duros, cfg.get("exenciones", []), __import__("datetime").date.today().isoformat())
    problemas += prob_ex
    sucios = {k: v for k, v in duros.items() if v}
    for k, hs in sucios.items():
        print(f"✖ SUCIO {k}")
        for h in hs:
            print(f"      {h.tipo:6} {h.detalle}")
    for pr_ in problemas:
        print(f"✖ {pr_}")
    print(f"\npares: {len(pares)} · sucios: {len(sucios)} · limpios: {len(duros) - len(sucios)} · problemas de config: {len(problemas)}")
    return 1 if (check and (sucios or problemas)) else 0


if __name__ == "__main__":
    sys.exit(main())
