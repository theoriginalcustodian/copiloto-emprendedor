#!/usr/bin/env python3
"""Arma el zip del arbol de producto para mandarle a alguien de afuera.

Uso:  python3 deck-assets/exportar-arbol.py

Sale en ~/Desktop/odobi-arbol-<fecha>.zip

Dos cosas que hace y por que:

1. RESUELVE LAS DEPENDENCIAS DE VERDAD. El arbol linkea imagenes, fuentes y los
   9 mockups; mandar solo el HTML no sirve. Se parsea cada HTML, se sigue cada
   src/href/url() y se verifica que exista. Si algo falta, aborta.

2. SANEA EL TEXTO INTERNO. Los DECISIONES.md se escribieron para uso interno y
   mencionan a David por nombre, incluido un juicio sobre su trabajo. Eso se
   neutraliza EN LA COPIA que se exporta — el repo queda intacto, porque ahi la
   historia de las decisiones sirve. Tambien se saca la referencia al analisis
   Chaves, que es material de discusion, no de entrega.
"""
import os, re, glob, shutil, zipfile, tempfile, datetime, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# carpetas que NUNCA salen: material de evaluacion interna
EXCLUIR = ('isotipo-comparativa', 'tipografia-libre', 'wise-ab')

SANEO = [
    # (archivo glob, viejo, nuevo)
    ('arbol/index.html',
     'de trazo subpixel del ANALISIS-CHAVES es específica de 16px. -->',
     'de trazo fino aplica a tamaños chicos, no a escala display. -->'),
    ('mockups/09-mi-dia/DECISIONES.md',
     'el error que Martin señaló de David',
     'el exceso de profundidad que Martin descartó'),
    ('mockups/03-home-conversacional/DECISIONES.md',
     'inconsistencia que David notaría en el deck',
     'inconsistencia visible en el deck'),
    ('mockups/05-facturacion/DECISIONES.md',
     'inconsistencia que David notaría',
     'inconsistencia visible'),
    ('arbol/DECISIONES.md',
     'Creado 07/08/2026 para la reunión con David.',
     'Creado 07/08/2026.'),
]

def dependencias():
    """Todos los archivos que el arbol necesita, siguiendo referencias."""
    nec, faltan = set(), set()
    def seguir(f, base):
        for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\'>]+)|url\(\s*["\']?([^"\')\s]+)',
                             open(os.path.join(RAIZ, f)).read()):
            ref = (m.group(1) or m.group(2)).split('#')[0].split('?')[0]
            if not ref or ref.startswith(('http', 'data:', 'mailto')):
                continue
            p = os.path.normpath(os.path.join(base, ref))
            (nec if os.path.exists(os.path.join(RAIZ, p)) else faltan).add(p)
    seguir('arbol/index.html', 'arbol')
    nec.add('arbol/index.html')
    for f in glob.glob(os.path.join(RAIZ, 'mockups', '*', 'index.html')):
        r = os.path.relpath(f, RAIZ); nec.add(r); seguir(r, os.path.dirname(r))
    for f in glob.glob(os.path.join(RAIZ, 'explorations', 'splash-o', '*.html')):
        r = os.path.relpath(f, RAIZ); nec.add(r); seguir(r, os.path.dirname(r))
    nec |= {os.path.relpath(p, RAIZ) for p in glob.glob(os.path.join(RAIZ, 'mockups', '*', 'DECISIONES.md'))}
    nec |= {'arbol/DECISIONES.md', 'assets/fonts/PlusJakartaSans-OFL.txt'}
    nec = {p for p in nec if os.path.isfile(os.path.join(RAIZ, p))
           and not any(x in p for x in EXCLUIR)}
    return sorted(nec), sorted(faltan)

LEEME = """ODOBI - ARBOL DE PRODUCTO
=========================

COMO ABRIRLO
------------
Descomprimir y abrir  arbol/index.html  en el navegador (doble click).
No necesita servidor ni internet: es HTML estatico y todo esta incluido.

QUE ES
------
El recorrido completo de la app en orden narrativo: 9 pantallas madre y sus
27 estados. Cada tarjeta es una pantalla real del prototipo; al hacer click
se abre el mockup completo con sus anotaciones y el fundamento de cada
decision de diseno.

  0 - El sistema         las tres decisiones que ordenan todo (26/07)
  1 - La entrada         splash + primer minuto
  2 - El dia a dia       Mi dia + Chat  <- el corazon del argumento
      EL PUENTE          Decision C funcionando (recorrido para ver en vivo)
  3 - El patron madre    HITL: "vos confirmas, Odobi ejecuta"
  4 - Dos features       facturacion y presupuestos, mismo componente
  5 - Lo que lo sostiene conexiones, cuenta, plan y limites

QUE MIRAR PRIMERO
-----------------
El bloque 0. Sin las tres decisiones, las pantallas parecen elecciones de
gusto. Despues el PUENTE (la banda negra del medio): es lo unico del sistema
que no se entiende explicandolo, hay que recorrerlo.

NOTAS
-----
- Tipografia: Plus Jakarta Sans Bold (display) + Inter (UI). Reemplaza a
  NeueEinstellung, cuya licencia de app (USD 375/ano) quedo fuera de
  presupuesto. Licencia SIL OFL incluida en assets/fonts/.
- El mockup 08 (plan y limites) es el UNICO material de vision: el backend
  no expone plan ni consumo, y el numero de acciones/mes esta a calibrar.
  Todo lo demas son features implementadas.
- Las cifras son de mockup pero internamente consistentes entre pantallas
  (286 - 194 = 92; la factura de Gomez es el mismo dato en 09, 03 y 02).
- Cada carpeta de mockups/ trae su DECISIONES.md: tabla elemento -> decision
  -> fundamento -> alternativa descartada y por que.
- En el bloque 1, la tarjeta del splash muestra una PRUEBA del isotipo de
  cuatro arcos con todas las lineas en terracota. Es una prueba de marca:
  la animacion vigente sigue siendo la de la O.

CONTENIDO
---------
  arbol/            el mapa navegable (ABRIR ACA)
  mockups/          las 9 pantallas madre + sus DECISIONES.md
  deck-assets/      laminas 2560x1440 y frames limpios de telefono
  explorations/     prototipo animado del splash
  assets/fonts/     Plus Jakarta Sans Bold + licencia OFL
"""

def main():
    archivos, faltan = dependencias()
    if faltan:
        print("REFERENCIAS ROTAS, no se exporta:")
        for f in sorted(faltan): print("   x", f)
        return 1

    escenario = tempfile.mkdtemp(prefix='odobi-export-')
    try:
        for p in archivos:
            d = os.path.join(escenario, p)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copy2(os.path.join(RAIZ, p), d)

        aplicados = 0
        for objetivo, viejo, nuevo in SANEO:
            d = os.path.join(escenario, objetivo)
            if not os.path.exists(d): continue
            s = open(d).read()
            if viejo in s:
                open(d, 'w').write(s.replace(viejo, nuevo)); aplicados += 1

        # control: que no quede ningun juicio sobre el trabajo de David
        sospechosas = []
        for p in archivos:
            d = os.path.join(escenario, p)
            if not p.endswith(('.html', '.md')): continue
            for i, l in enumerate(open(d, errors='ignore').read().split('\n'), 1):
                if 'David' in l and re.search(r'error|falla|no cumple|notaría|Chaves', l):
                    sospechosas.append(f"{p}:{i}")
        if sospechosas:
            print("QUEDAN MENCIONES A REVISAR:")
            for s in sospechosas: print("   !", s)
            return 1

        fecha = datetime.date.today().isoformat()
        destino = os.path.join(os.path.expanduser('~'), 'Desktop', f'odobi-arbol-{fecha}.zip')
        if os.path.exists(destino): os.remove(destino)
        with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr('odobi-arbol/LEEME.txt', LEEME)
            for p in archivos:
                z.write(os.path.join(escenario, p), 'odobi-arbol/' + p)
        print(f"{destino}")
        print(f"{len(archivos)+1} archivos · {os.path.getsize(destino)/1024/1024:.1f} MB · "
              f"{aplicados}/{len(SANEO)} saneos aplicados")
        return 0
    finally:
        shutil.rmtree(escenario, ignore_errors=True)

if __name__ == '__main__':
    sys.exit(main())
