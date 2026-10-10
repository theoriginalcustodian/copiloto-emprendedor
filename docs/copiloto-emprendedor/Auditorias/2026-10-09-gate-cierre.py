#!/usr/bin/env python3
"""GATE BINARIO del relevamiento. Exit 0 = cerrado. Exit 1 = NO cerrado, y dice por que.

Existe porque "terminado" dicho por el agente no es evidencia. Cada criterio se MIDE sobre el
documento; ninguno se declara.

Uso:  python -I gate-cierre-relevamiento.py [ruta-al-documento] [--autotest]

PORTABLE a proposito: corre igual desde el scratchpad (al lado de CIERRE-RELEVAMIENTO.md) que
desde docs/.../Auditorias/ de un clon (al lado del documento publicado). Una copia que solo
funciona en la maquina donde se escribio no es un mecanismo, es un recuerdo.

Trae su propio control positivo (--autotest): muta el documento en memoria de cinco formas que
el gate DEBE poner en rojo. Un gate sin control hacia el "no" no da sintoma cuando se rompe:
sale verde igual.
"""
import io
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLICADO = '2026-10-09-relevamiento-codigo-cierre.md'
MAESTRO = 'CIERRE-RELEVAMIENTO.md'
LOTES = ['L%02d' % i for i in range(1, 12)]          # L01..L11

# Se cuenta por EMOJI, no por la prosa: la etiqueta tiene 19 grafias distintas para 6 clases
# ("codigo roto" / "codigo roto en prod" / "codigo roto en produccion"...). Un gate que contara
# el texto lee 27 de 60 filas y acusa al documento de un defecto que es del instrumento. Fue el
# primer rojo que dio este gate, y era mio.
CLASES = [('🔥', 'código roto en producción'), ('🚫', 'protección o camino ausente'),
          ('🕳️', 'capacidad completa que nadie alcanza'), ('🔬', 'instrumento ciego'),
          ('📐', 'evidencia que no toca producción'), ('♊', 'duplicación divergente')]


def resolver_documento():
    """El sujeto de la medicion. Explicito > publicado al lado > maestro al lado."""
    for arg in sys.argv[1:]:
        if not arg.startswith('--'):
            return os.path.abspath(arg), 'explícito'
    for nombre, modo in ((PUBLICADO, 'publicado'), (MAESTRO, 'maestro')):
        p = os.path.join(AQUI, nombre)
        if os.path.exists(p):
            return p, modo
    raise SystemExit('no encuentro el documento: ni %s ni %s al lado de %s'
                     % (PUBLICADO, MAESTRO, AQUI))


def instrumento(nombres):
    """Primer script existente de la lista, al lado de este archivo. None si ninguno."""
    for n in nombres:
        p = os.path.join(AQUI, n)
        if os.path.exists(p):
            return p
    return None


def criterios(doc):
    """[(nombre, ok, detalle)] -- cada uno medido sobre el texto, ninguno declarado."""
    out = []

    # 1 · los 11 lotes cerrados en §5
    falta = [l for l in LOTES if not re.search(r'^### §5\.\d+ · ' + l + ' —', doc, re.M)]
    out.append(('11 lotes en §5', not falta, 'faltan: %s' % falta if falta else '11/11'))

    # 2 · las 11 refutaciones en §N.2. El formato de la casa es `#### L0N — ...`; medirlo con
    #     otra forma (p.ej. `### N.2/L01`) hace que el gate cuente 1 de 11 y culpe al documento.
    ancla = '### N.2 · Resultado por lote'
    tras = doc[doc.index(ancla):] if ancla in doc else doc
    refut = sorted(set(re.findall(r'^#### (L\d\d) —', tras, re.M)))
    out.append(('11 refutaciones en §N.2', len(refut) == 11,
                '%d/11 -> %s' % (len(refut), ','.join(refut))))

    # 3 · el indice: filas numeradas consecutivas desde 1, sin huecos ni repetidas
    nums = [int(n) for n in re.findall(r'^\| (\d+) \| ', doc, re.M)]
    esperado = list(range(1, len(nums) + 1))
    out.append(('índice consecutivo', nums == esperado,
                '%d filas' % len(nums) if nums == esperado
                else 'huecos/repetidas: %s' % [n for n in esperado if n not in nums][:6]))

    # 4 · conteos de clase declarados == clases contadas en la tabla
    declarado, contado = {}, {}
    filas = re.findall(r'^\| \d+ \| .*$', doc, re.M)
    for emoji, prosa in CLASES:
        m = re.search(r'\*\*(\d+)\*\* ' + re.escape(prosa), doc)
        declarado[emoji] = int(m.group(1)) if m else None
        contado[emoji] = sum(1 for f in filas if ('| ' + emoji + ' **') in f)
    difs = [(e, declarado[e], contado[e]) for e, _ in CLASES if declarado[e] != contado[e]]
    out.append(('conteos de clase == tabla', not difs,
                'suma %d' % sum(contado.values()) if not difs else 'difieren: %s' % difs))

    # 5 · la suma de clases == cantidad de filas (ninguna sin clase, ninguna con dos)
    out.append(('toda fila tiene una clase', sum(contado.values()) == len(nums),
                '%d clases / %d filas' % (sum(contado.values()), len(nums))))

    # 6 · ningun lote con refutacion "pedida": una espera no es un estado terminal
    pedidas = re.findall(r'refutación \*\*pedida\*\*', doc)
    out.append(('ninguna refutación pendiente', not pedidas, '%d pendientes' % len(pedidas)))

    return out


def criterios_de_citas(doc_path):
    """Los dos instrumentos de citas, como criterio. FAIL-CLOSED: si no corren, es FALLA.
    Degradar a 'no aplica' ante la duda es como un gate se vuelve decorativo."""
    cit = instrumento(['2026-10-09-citas-rotas.py', 'verificar-citas-del-cierre.py'])
    amb = instrumento(['2026-10-09-ambiguedad-citas.py', 'medir-ambiguedad-citas.py'])
    if not cit or not amb:
        return [('instrumentos de citas presentes', False,
                 'faltan al lado del gate: %s' % ', '.join(
                     n for n, p in (('citas-rotas', cit), ('ambiguedad-citas', amb)) if not p))]

    def correr(script):
        try:
            r = subprocess.run([sys.executable, '-I', script, '--doc=' + doc_path],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace', cwd=AQUI, timeout=900)
            return r.stdout + r.stderr
        except Exception as exc:                                  # noqa: BLE001
            return 'EXCEPCION: %s' % exc

    sv, sa = correr(cit), correr(amb)

    def leer(patron, texto):
        m = re.search(patron, texto)
        return int(m.group(1)) if m else None

    tot = leer(r'citas en el documento:\s+(\d+)', sv)
    duros = leer(r'defectos duros:\s+(\d+)', sv)
    por_num = leer(r'resolubles por el numero:\s+(\d+)', sa)
    real = leer(r'ambiguedad REAL \(2\+\):\s+(\d+)', sa)
    tapadas = leer(r'ROTAS, tapadas por AMBIGUO:\s+(\d+)', sa)

    if None in (tot, duros, por_num, real, tapadas):
        return [('instrumentos de citas legibles', False,
                 'salida ilegible (tot=%s duros=%s por_num=%s real=%s tapadas=%s)'
                 % (tot, duros, por_num, real, tapadas))]
    return [
        ('citas verificadas contra el SHA', tot > 700, '%d citas' % tot),
        ('0 citas ROTAS', tapadas == 0, '%d tapadas por AMBIGUO' % tapadas),
        ('0 ambigüedades REALES', real == 0,
         '%d reales (%d resolubles por el número)' % (real, por_num)),
        # Coherencia entre los dos instrumentos: el coarse cuenta como "duro" todo AMBIGUO; el
        # refinado los parte. Si no cuadran, uno cambio de criterio y la tabla mentiria sin avisar.
        ('los dos instrumentos cuadran', duros == por_num + real + tapadas,
         'duros=%d vs %d+%d+%d' % (duros, por_num, real, tapadas)),
    ]


def autotest(doc):
    """Cada mutante debe poner ROJO al gate. Si alguno sale verde, el gate es ciego ahi."""
    mutantes = [
        ('borrar una refutación',
         lambda d: d.replace('#### L01 — facturación', '#### XX — facturación', 1)),
        ('borrar un lote de §5',
         lambda d: d.replace('### §5.1 · L01 —', '### §5.1 · XX —', 1)),
        ('borrar una fila del índice',
         lambda d: re.sub(r'\n\| 60 \| [^\n]*', '', d, count=1)),
        ('inflar un conteo de clase',
         lambda d: d.replace('**18** código roto en producción',
                             '**19** código roto en producción', 1)),
        ('cambiar la clase de una fila',
         lambda d: d.replace('| 🔥 **código roto en producción** | §N.2/L01 |',
                             '| 🔬 **instrumento ciego** | §N.2/L01 |', 1)),
    ]
    print('\n--- control positivo del gate (cada mutante debe dar ROJO) ---')
    ciegos = []
    for nombre, mutar in mutantes:
        mutado = mutar(doc)
        if mutado == doc:
            ciegos.append('%s [el mutante no se aplicó]' % nombre)
            print('  ????   %-34s el mutante no cambió nada' % nombre)
            continue
        rojo = any(not ok for _, ok, _ in criterios(mutado))
        print('  %s  %-34s' % ('OK   ' if rojo else 'CIEGO', nombre))
        if not rojo:
            ciegos.append(nombre)
    return ciegos


def main():
    doc_path, modo = resolver_documento()
    doc = io.open(doc_path, encoding='utf-8').read()

    print('=' * 78)
    print('GATE DE CIERRE — relevamiento de código (sujeto: wt-relev @ 6278836a)')
    print('documento: %s  [%s]' % (os.path.basename(doc_path), modo))
    print('=' * 78)

    todos = criterios(doc) + criterios_de_citas(doc_path)
    for nombre, ok, detalle in todos:
        print('  %s  %-34s %s' % ('[OK]   ' if ok else '[FALLA]', nombre, detalle))

    ciegos = autotest(doc) if '--autotest' in sys.argv else None
    if ciegos:
        print('\n  GATE CIEGO en: %s' % ', '.join(ciegos))

    fallas = [n for n, ok, _ in todos if not ok]
    print()
    if fallas or ciegos:
        print('RESULTADO: NO CERRADO — %s' % ', '.join(fallas + (ciegos or [])))
        return 1
    print('RESULTADO: CERRADO — %d criterios medidos, %d en verde. '
          'El documento tiene %d líneas.' % (len(todos), len(todos), doc.count('\n') + 1))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
