#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
C3-26 - Detector de contradiccion INTRA-CORPUS. Entregable de auditoria, 2026-09-29.

POR QUE ESTE ARCHIVO ES CODIGO Y NO UN PARRAFO EN UN DOC
========================================================
En C3-25-E auditoria recomendo un "gate de contenido": verificar que cada elemento citado por
una fila COHERENTE exista en el prototipo. **Medido antes de construirlo, ese gate da 13 falsos
positivos de 14** (dictamen 2026-09-29-criterio3..., seccion 8). La causa no es un bug
arreglable: el texto entre comillas **no codifica su ROL**, y un gate contra una referencia
externa hereda todos los roles.

Se entrega ejecutable porque **el codigo encarna los cinco descartes por rol que la prosa solo
describe**. Quien lo reimplemente leyendo la seccion 8 va a reproducir los falsos positivos: ya
paso una vez, con el extractor que cruzaba comillas curvas y rectas.

Auditoria NO modifica scripts/ (es de planificacion). Esto es material de auditoria, vive en
Auditorias/, y planificacion decide si lo cablea al ratchet y donde.

QUE HACE
========
1) chrome_por_sujeto()              - extrae chrome de pantalla, con los 5 descartes por rol.
2) contradicciones_intra_corpus()   - dos filas COHERENTE del MISMO sujeto, en documentos
   distintos, citando chrome DISJUNTO => una de las dos describe otra pantalla. No necesita
   referencia externa ni marca de sucesion.
3) listas_complementarias_solapadas() - el caso minimo del mismo mecanismo (C3-28): dos
   conjuntos que un documento presenta como complementarios no deben intersecarse.

MEDICION DE REFERENCIA (corpus del 22/09 - usar como test de regresion)
======================================================================
    filas COHERENTE 53 de 53 - citas 43 de 43
    descartadas por ROL: 5 runtime - 2 negada/extra-declarado -> 36 de chrome
    ids con COHERENTE en >1 documento: 2 de 18
      `factura`  DISJUNTO  ['datos de venta','todavia no emitiste ningun comprobante']
                        vs ['facturado este mes','nueva factura','te deben','ultimas emitidas']
      `volver`   solapa    ['entrar','entrar con otra cuenta'] en ambos
    -> 1 hallazgo, 0 falsos positivos. El contraste (uno disjunto, uno solapado) ES el control:
       si marcara los dos, no discriminaria.

Y el hallazgo que produce es el mismo falso verde de C3-25-A, **sin el proto y sin sucesion**.

LIMITE, DECLARADO
=================
Solo habla de sujetos medidos >=2 veces (en ese corpus: 2 de 18). NO reemplaza al puntero de
sucesion de C3-25-E. Su potencia crece donde esta el riesgo: algo se re-mide *porque* alguien
dudo de su veredicto.
"""
import io
import os
import re

# --- extraccion de citas: pares HOMOGENEOS ---------------------------------------------------
# NO usar [<<"](...)[>>"]: abre con << y cierra con ", y deja << en el cuerpo, asi que captura el
# texto ENTRE dos citas legitimas. Fabrico 2 citas de 16 en la corrida del 22/09.
CITA = re.compile(r'«([^«»`]{4,45})»|"([^"`]{4,45})"')

# --- los CINCO descartes por ROL. Cada uno con su caso real del corpus del 22/09. --------------
# 1) jerga de metodo, rutas y nombres de archivo: no son texto de pantalla.
JERGA = re.compile(r'^(h-a4|bl-|c3-|fe\d|pr ?#?\d|data-testid|espera real|innertext|page\.|'
                   r'waitfor|retry|desk|m390|proto|app|\S+\.(tsx|ts|py|png|mjs|html|md)$)', re.I)

# 2) VALOR DE RUNTIME: montos, cifras, nulls. Un prototipo estatico NO puede contenerlos.
#    Casos: "$0,00 - 0 facturas - 0 impagas" / "Se enfria - 40 dias" / "Total aproximado: $30.000,0000"
RUNTIME = re.compile(r'\$|\d{2,}|\bnull\b')

# 3) cita dentro de una NEGACION: el autor afirma que eso NO ocurre.
#       bi -> "**no** es el caso de \"rentabilidad null\""
# 4) cita de OTRO DOCUMENTO, no de una pantalla.
#       apar -> "el framing original (\"pendiente de redeploy\") estaba desactualizado"
# 5) elemento que el autor YA DECLARO ausente del proto: el gate "descubriria" lo que la fila dice.
#       presu -> "un boton adicional \"Ver tambien los reemplazados\" (elemento extra, no carencia)"
CONTEXTO_DESCARTA = re.compile(
    r'\*\*no\*\*[^"«]{0,40}$'          # (3)
    r'|\bno es el caso\b[^"«]{0,30}$'  # (3)
    r'|framing original[^"«]{0,10}$'   # (4)
    r'|bot[óo]n adicional[^"«]{0,10}$'  # (5)
    r'|elemento extra')                     # (5)

# AVISO, y NO es arreglable: con comillas rectas la apertura y el cierre son el MISMO caracter,
# asi que '..."), entre "...' sigue produciendo basura. Es propiedad del delimitador, no del
# regex. Por eso este detector compara CONJUNTOS: una cita basura no coincide con nada y, al
# aparecer en un solo documento, no produce disjuncion espuria. Se diluye, no miente.

ACENTUADA = re.compile(r'[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}')


def chrome_por_sujeto(docs, ids=None, veredicto='COHERENTE'):
    """{sujeto: {documento: set(chrome citado)}} con los 5 descartes por rol aplicados.

    docs: rutas de archivos markdown. ids: padron opcional para filtrar sujetos.
    Devuelve tambien los denominadores, porque un instrumento sin denominador no se audita.
    """
    por_sujeto = {}
    filas = citas = 0
    desc = {'runtime': 0, 'contexto': 0, 'jerga': 0}
    for d in docs:
        doc = os.path.basename(d)
        for linea in io.open(d, encoding='utf-8', errors='replace').read().split('\n'):
            if not linea.startswith('|'):
                continue
            cel = [c.strip() for c in linea.strip('|').split('|')]
            if len(cel) < 3 or veredicto not in cel[1].upper():
                continue
            filas += 1
            suj = cel[0].strip('`* ').split('`')[0].split(' (')[0].strip('` ')
            if ids is not None and suj not in ids:
                continue
            cuerpo = ' '.join(cel[2:])
            for m in CITA.finditer(cuerpo):
                c = (m.group(1) or m.group(2) or '').strip(' .,:;+')
                if not c or not ACENTUADA.search(c):
                    continue
                citas += 1
                if JERGA.match(c):
                    desc['jerga'] += 1
                    continue
                if RUNTIME.search(c):
                    desc['runtime'] += 1
                    continue
                if CONTEXTO_DESCARTA.search(cuerpo[:m.start()]):
                    desc['contexto'] += 1
                    continue
                por_sujeto.setdefault(suj, {}).setdefault(doc, set()).add(c.lower())
    return por_sujeto, {'filas': filas, 'citas': citas, 'descartadas': desc}


def contradicciones_intra_corpus(por_sujeto):
    """Sujetos medidos en >1 documento cuyo chrome citado es DISJUNTO.

    Devuelve (disjuntos, solapados). Los DOS se reportan: el solapado es el control de que el
    detector discrimina. Un detector que solo imprime hallazgos no se distingue de uno que
    marca todo. Ver memoria/un-instrumento-que-no-mira-nunca-falla.md
    """
    disjuntos, solapados = [], []
    for suj, v in sorted(por_sujeto.items()):
        if len(v) < 2:
            continue
        inter = set.intersection(*v.values())
        fila = (suj, {d: sorted(s) for d, s in v.items()}, sorted(inter))
        (solapados if inter else disjuntos).append(fila)
    return disjuntos, solapados


def listas_complementarias_solapadas(a, b, universo=None):
    """C3-28 - el control GRATIS: dos conjuntos que un documento presenta como complementarios.

    Encontro que la seccion 6 del contrato BL-Q3 v2 declara `agenda` invalidado Y vigente, a
    siete lineas de distancia. Devuelve (interseccion, cobertura). La cobertura es el segundo
    hallazgo: ese mismo parrafo declara 25 de 54, con 29 sin declaracion. Un ratchet que no
    declara su cobertura parece completo.
    """
    inter = sorted(set(a) & set(b))
    cobertura = None
    if universo is not None:
        u = set(universo)
        cobertura = {'declarados': len((set(a) | set(b)) & u),
                     'universo': len(u),
                     'sin_declaracion': sorted(u - set(a) - set(b))}
    return inter, cobertura


if __name__ == '__main__':
    import sys
    import glob
    if len(sys.argv) < 2:
        print(__doc__)
        print('uso: python 2026-09-29-detector-contradiccion-intra-corpus-C3-26.py <glob de docs>')
        print("ej : ... 'coordinacion/cerrado/2026-09-22/2026-09-22_dato_frontend*.md'")
        sys.exit(0)
    docs = sorted(f for pat in sys.argv[1:] for f in glob.glob(pat))
    assert docs, 'CONTROL: el glob no matcheo ningun documento. Vacio no es hallazgo.'
    por, den = chrome_por_sujeto(docs)
    d = den['descartadas']
    quedan = den['citas'] - sum(d.values())
    print('documentos: {0} de {0} - filas COHERENTE {1} de {1} - citas {2} de {2}'.format(
        len(docs), den['filas'], den['citas']))
    print('descartadas por ROL: {0} runtime - {1} negada/extra-declarado - {2} jerga '
          '-> quedan {3} de chrome'.format(d['runtime'], d['contexto'], d['jerga'], quedan))
    disj, sol = contradicciones_intra_corpus(por)
    print('sujetos con veredicto en >1 documento: {0} de {1}'.format(len(disj) + len(sol), len(por)))
    for suj, v, _ in disj:
        print('\n  [DISJUNTO] `{0}`'.format(suj))
        for dd, s in v.items():
            print('       [{0}] {1}'.format(dd[:52], s))
    for suj, v, inter in sol:
        print('\n  [ok] `{0}` solapa en {1} (control: el detector DISCRIMINA)'.format(suj, inter))
    if not disj and not sol:
        print('\nAVISO: ningun sujeto medido dos veces, el detector no tiene nada que comparar.')
        print('       Eso NO es "sin contradicciones", es "sin universo". Correr el control positivo.')
    sys.exit(1 if disj else 0)
