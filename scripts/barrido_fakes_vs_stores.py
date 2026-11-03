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
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
T = "apps/copiloto/tests/"
A = "apps/copiloto/"

# (archivo del test, clase fake, archivo del real, clase real)
PARES: list[tuple[str, str, str, str]] = [
    # — plata —
    (T + "test_plata_por_voz.py", "_CobroFake", A + "cobro_store.py", "CobroStore"),
    (T + "test_plata_por_voz.py", "_PresupuestoFake", A + "presupuesto_store.py", "PresupuestoStore"),
    (T + "test_ingresos_web.py", "CobroStoreFake", A + "cobro_store.py", "CobroStore"),
    (T + "test_contabilidad_web.py", "_FakeCobroStore", A + "cobro_store.py", "CobroStore"),
    (T + "test_contabilidad_web.py", "_FakeGastoStore", A + "gasto_store.py", "GastoStore"),
    (T + "test_gastos_web.py", "_FakeGastoStore", A + "gasto_store.py", "GastoStore"),
    (T + "test_presupuestos_web.py", "_FakePresupuestoStore", A + "presupuesto_store.py", "PresupuestoStore"),
    (T + "test_facturar_presupuesto_atomico.py", "StoreFalso", A + "presupuesto_store.py", "PresupuestoStore"),
    (T + "test_mp_web.py", "_FakePayStore", A + "mp_payment_store.py", "MpPaymentStore"),
    (T + "test_mp_web.py", "_FakeCredStore", A + "mp_credential_store.py", "MpCredentialStore"),
    # — comprobantes —
    (T + "test_contabilidad_web.py", "_FakeAfipComprobanteStore", A + "afip_comprobante_store.py", "AfipComprobanteStore"),
    (T + "test_afip_web_facturas.py", "ComprobanteStoreFake", A + "afip_comprobante_store.py", "AfipComprobanteStore"),
    (T + "test_afip_drive_activity.py", "ComprobanteFake", A + "afip_comprobante_store.py", "AfipComprobanteStore"),
    # — tenant / perfil / credenciales / clientes —
    (T + "test_presupuestos_web.py", "_FakePerfilStore", A + "perfil_negocio_store.py", "PerfilNegocioStore"),
    (T + "test_presupuestos_web.py", "_FakeCredStore", A + "afip_credential_store.py", "AfipCredentialStore"),
    (T + "test_facturar_por_voz.py", "_PerfilStoreFake", A + "afip_credential_store.py", "AfipPerfilStore"),
    (T + "test_facturar_por_voz.py", "_CredFake", A + "afip_credential_store.py", "AfipCredentialStore"),
    (T + "test_afip_onboarding.py", "PerfilStoreFake", A + "afip_credential_store.py", "AfipPerfilStore"),
    (T + "test_afip_onboarding.py", "CredStoreFake", A + "afip_credential_store.py", "AfipCredentialStore"),
    (T + "test_afip_ambiente.py", "CredStoreFake", A + "afip_credential_store.py", "AfipCredentialStore"),
    (T + "test_afip_drive_activity.py", "PerfilFake", A + "afip_credential_store.py", "AfipPerfilStore"),
    (T + "test_clientes_web.py", "_FakeClienteStore", A + "cliente_store.py", "ClienteStore"),
    (T + "test_clientes_voz.py", "_FakeStore", A + "cliente_store.py", "ClienteStore"),
    (T + "test_mi_dia_web.py", "_TarjetaStoreFake", A + "mi_dia_tarjeta_store.py", "TarjetaStore"),
]


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


_LEIDAS: dict[str | None, set[str]] = {}


def claves_leidas(ref: str | None) -> set[str]:
    """Claves-string que el código de PRODUCCIÓN lee de un dict: `x["k"]` o `x.get("k")`."""
    if ref in _LEIDAS:
        return _LEIDAS[ref]
    if ref is None:
        archivos = [p.relative_to(RAIZ).as_posix() for p in (RAIZ / A).glob("*.py")]
    else:
        out = subprocess.run(["git", "ls-tree", "--name-only", ref, A], cwd=RAIZ, capture_output=True, text=True,
                             encoding="utf-8", check=True).stdout.split()
        archivos = [f for f in out if f.endswith(".py")]
    leidas: set[str] = set()
    for f in archivos:
        for n in ast.walk(ast.parse(leer(f, ref))):
            if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant) and isinstance(n.slice.value, str):
                leidas.add(n.slice.value)
            elif (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "get"
                  and n.args and isinstance(n.args[0], ast.Constant) and isinstance(n.args[0].value, str)):
                leidas.add(n.args[0].value)
    _LEIDAS[ref] = leidas
    return leidas


def params(f) -> tuple[set[str], bool]:
    a = f.args
    nombres = {x.arg for x in a.args + a.kwonlyargs + a.posonlyargs} - {"self"}
    return nombres, a.kwarg is not None


@dataclass
class Hallazgo:
    tipo: str
    detalle: str


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
    tf, tr = ast.parse(leer(pf, ref)), ast.parse(leer(pr, ref))
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
                hs.append(Hallazgo("PARAM", f"{cf}.{nombre}({p}=) ({pf}:{fm.lineno}) · {cr}.{nombre} no lo acepta ({pr}:{mr[nombre].lineno})"))
        dom = dominios_real(mr_ext, nombre, tr)
        for k, v, ln in _pares_dict(fm):
            if not _es_literal(v):
                continue
            for val in sorted(_valores(v, tf)):
                duenos = sorted(k2 for k2, d in dom.items() if val in d)
                if duenos and k not in duenos:
                    hs.append(Hallazgo("VALOR", f"{cf}.{nombre} responde {k}={val!r} ({pf}:{ln}) · en {cr} `{val}` es valor de "
                                                f"`{'/'.join(duenos)}`, no de `{k}` ({pr}:{mr[nombre].lineno})"))
        kf, kr = claves_dict(fm), claves_real(mr_ext, nombre)
        if not kr:     # el real no arma dicts (devuelve fila/objeto de otro lado): sin base para comparar claves
            continue
        for k in sorted(set(kf) - set(kr)):
            hs.append(Hallazgo("info-INVENTA", f"{cf}.{nombre} responde `{k}` ({pf}:{kf[k]}) · {cr}.{nombre} no lo produce ({pr}:{mr[nombre].lineno})"))
        if kf:
            for k in sorted((set(kr) - set(kf)) & claves_leidas(ref)):
                hs.append(Hallazgo("info-OMITE", f"{cf}.{nombre} no responde `{k}` (que producción lee) ({pf}:{fm.lineno}) · {cr}.{nombre} sí ({pr}:{kr[k]})"))
    return hs


def main() -> int:
    ref = sys.argv[sys.argv.index("--ref") + 1] if "--ref" in sys.argv else None
    sucios = 0
    for pf, cf, pr, cr in PARES:
        try:
            hs = comparar(pf, cf, pr, cr, ref)
        except subprocess.CalledProcessError:
            print(f"?  {cf:28} → {cr:22} (no existe en {ref})")
            continue
        duros = [h for h in hs if not h.tipo.startswith("info")]
        print(f"{'✔ LIMPIO' if not duros else '✖ SUCIO '} {Path(pf).name}::{cf} → {cr}  "
              f"({len(duros)} duros · {len(hs) - len(duros)} info)")
        for h in duros:
            print(f"      {h.tipo:8} {h.detalle}")
        sucios += bool(duros)
    print(f"\npares: {len(PARES)} · sucios: {sucios} · limpios: {len(PARES) - sucios}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
