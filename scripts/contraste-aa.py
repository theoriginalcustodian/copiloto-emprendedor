#!/usr/bin/env python3
"""Contraste WCAG AA de los pares fg/bg de `themes.css` — instrumento VERSIONADO.

Por qué existe: la cabecera de `apps/copiloto-web/src/design-system/themes.css` cita sus números
como medidos con «`/tmp/wcag2.py` de la sesión» — un script efímero que ya no existe. Eso dejó el
número de pares bajo AA (23) **no reproducible por nadie**: ni para verificar un fix, ni para saber
si subió. Un número de deuda que no se puede re-medir no es una medición, es una anécdota.

CONTROL POSITIVO HORNEADO (`--control`): re-mide los 3 valores que la cabecera declara y falla
ruidoso si alguno no reproduce. Sin eso, un cambio en la función de luminancia daría números nuevos
con la misma cara de siempre. El control ya pagó: al escribirlo, `#DE7250` daba 2,55 donde la
cabecera dice 2,86 — no era un bug, era que «crema» en ese párrafo es OTRA superficie (`#FAF3E4`,
no `--bg` `#EFE6D2`). Sin el control eso queda como sospecha sobre el instrumento; con el control se
cierra como hecho y se documenta cuál superficie es cuál.

Uso:
  python scripts/contraste-aa.py --control      # sólo el control positivo (rápido, para CI)
  python scripts/contraste-aa.py --par FG BG    # un par puntual
  python scripts/contraste-aa.py --objetivo FG BG [--min 4.5]   # el valor más cercano que despeja
"""
import argparse
import sys

# Windows abre stdout en cp1252 y CUALQUIER `✅`/`→` lo hace explotar con UnicodeEncodeError
# a mitad de la corrida: el instrumento moría DESPUÉS de medir bien, así que el número
# correcto se perdía y parecía que fallaba la medición. Se fuerza UTF-8 acá, no en el
# invocador, porque un instrumento que exige un entorno especial no lo corre nadie más.
for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):  # ya redirigido o sin soporte: no es fatal
        pass

AA_TEXTO_NORMAL = 4.5


def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgb(h):
    h = h.lstrip('#')
    if len(h) != 6:
        raise ValueError(f"hex inesperado: {h!r} (se esperan 6 dígitos)")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminancia(h):
    r, g, b = _rgb(h)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def ratio(fg, bg):
    la, lb = luminancia(fg), luminancia(bg)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def componer(fg, alfa, bg):
    """Un token `rgba(...)` NO se mide contra sí mismo: se compone sobre la superficie de abajo.
    Medirlo sin componer es el error que infla el contraste de cualquier chip translúcido."""
    fr, fg_, fb = _rgb(fg)
    br, bg_, bb = _rgb(bg)
    return '#%02X%02X%02X' % tuple(
        round(f * alfa + b * (1 - alfa)) for f, b in ((fr, br), (fg_, bg_), (fb, bb))
    )


# Los 3 valores que la cabecera de themes.css declara medidos, con la superficie EXPLÍCITA —
# el bug que el control cazó fue justamente que el párrafo decía «crema» sin decir cuál.
CONTROL = [
    ('#B04A2E', '#EFE6D2', 4.38, '--core claro sobre --bg'),
    ('#C2452E', '#EFE6D2', 4.04, 'acento viejo sobre --bg (no es regresión)'),
    ('#DE7250', '#FAF3E4', 2.86, '--core oscuro sobre crema (NO es --bg: ahí da 2,55)'),
]


def control():
    fallos = 0
    for fg, bg, esperado, nota in CONTROL:
        obtenido = ratio(fg, bg)
        ok = abs(obtenido - esperado) <= 0.02
        print(f"  {'✅' if ok else '❌'} {fg} / {bg} = {obtenido:.2f}:1 "
              f"(cabecera: {esperado}) — {nota}")
        if not ok:
            fallos += 1
    if fallos:
        print(f"\n❌ CONTROL POSITIVO ROTO: {fallos}/{len(CONTROL)} no reproducen. "
              f"El instrumento cambió de respuesta sin que nadie lo declarara — "
              f"NO usar sus números hasta resolverlo.", file=sys.stderr)
        return 1
    print(f"\n✅ control positivo {len(CONTROL)}/{len(CONTROL)}: el instrumento reproduce la cabecera.")
    return 0


def objetivo(fg, bg, minimo):
    """El valor más cercano al original (oscureciendo proporcional) que despeja el mínimo."""
    base = _rgb(fg)
    print(f"  original {fg} / {bg} = {ratio(fg, bg):.2f}:1 (mínimo pedido {minimo})")
    for k in range(100, 0, -1):
        f = k / 100.0
        hx = '#%02X%02X%02X' % tuple(max(0, min(255, round(c * f))) for c in base)
        rt = ratio(hx, bg)
        if rt >= minimo:
            print(f"  → {hx} = {rt:.2f}:1 (factor {f:.2f} — el más cercano que despeja)")
            return 0
    print(f"  ⚠️ NINGÚN oscurecimiento proporcional de {fg} llega a {minimo} sobre {bg}: "
          f"el arreglo no es el fg, es la superficie.", file=sys.stderr)
    return 2


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--control', action='store_true')
    p.add_argument('--par', nargs=2, metavar=('FG', 'BG'))
    p.add_argument('--objetivo', nargs=2, metavar=('FG', 'BG'))
    p.add_argument('--componer', nargs=3, metavar=('FG', 'ALFA', 'BG'))
    p.add_argument('--min', type=float, default=AA_TEXTO_NORMAL)
    a = p.parse_args()
    if not any([a.control, a.par, a.objetivo, a.componer]):
        p.print_help()
        return 2
    rc = 0
    if a.control:
        rc |= control()
    if a.componer:
        fg, alfa, bg = a.componer
        print(f"  {fg} @ {alfa} sobre {bg} = {componer(fg, float(alfa), bg)}")
    if a.par:
        fg, bg = a.par
        r = ratio(fg, bg)
        print(f"  {fg} / {bg} = {r:.2f}:1 — {'AA ✅' if r >= a.min else f'FALLA (< {a.min})'}")
        if r < a.min:
            rc |= 1
    if a.objetivo:
        rc |= objetivo(a.objetivo[0], a.objetivo[1], a.min)
    return rc


if __name__ == '__main__':
    sys.exit(main())
