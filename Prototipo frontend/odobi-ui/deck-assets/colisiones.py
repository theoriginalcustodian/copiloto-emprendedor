#!/usr/bin/env python3
"""Detecta anotaciones que se superponen al frame del teléfono o se salen del canvas.

Uso:  python3 deck-assets/colisiones.py

Mide de verdad: inyecta un script en cada mockup, lo corre en Chrome headless y lee
los rectángulos reales con getBoundingClientRect. No estima anchos de texto ni
confía en una inspección visual — que es exactamente como se colaron las
superposiciones del 08/08 (se habían mirado 2 láminas de 27).

Salida: por mockup, cada `.hand` que pisa un `.phone` (con los px de solape) o que
se desborda del `.canvas`.
"""
import glob, os, re, json, subprocess, tempfile, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"



# NO listar clases de frame a mano. La primera version de esta sonda solo miraba
# `.phone` y reporto "OK" sobre 00-mapa, que usa `.mini`: cero frames encontrados,
# cero colisiones, falso negativo silencioso. Ahora se detecta cualquier bloque
# pintado (fondo o borde) con area suficiente, y se informa cuantos se encontraron
# por lane: un 0 tiene que gritar, no pasar por OK.
SONDA = """
<script id="__sonda">
window.addEventListener('load', function(){
  setTimeout(function(){
    var out = [], AREA_MIN = 4000;
    function pintado(el){
      var s = getComputedStyle(el);
      var bg = s.backgroundColor, tieneBg = bg && bg !== 'transparent' &&
               !/rgba\\(0,\\s*0,\\s*0,\\s*0\\)/.test(bg);
      var tieneBorde = parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0;
      return tieneBg || tieneBorde;
    }
    document.querySelectorAll('.canvas').forEach(function(cv, ci){
      var cr = cv.getBoundingClientRect();
      var manos = Array.from(cv.parentElement.querySelectorAll('.hand'));
      // bloques candidatos: pintados, con area suficiente, que no sean anotacion
      var bloques = Array.from(cv.querySelectorAll('*')).filter(function(el){
        if (el.closest('.hand') || el.classList.contains('overlay')) return false;
        var r = el.getBoundingClientRect();
        if (r.width * r.height < AREA_MIN) return false;
        return pintado(el);
      }).map(function(el){
        var r = el.getBoundingClientRect();
        return {r:r, cls:(el.className||'').toString().split(' ')[0]};
      });
      // quedarse con los contenedores de mas afuera (evita contar hijos anidados).
      // El contenedor tiene que ser ESTRICTAMENTE mayor: si dos bloques comparten
      // rectangulo (un wrapper y su hijo), cada uno "contiene" al otro y el filtro
      // los borraba a los dos -> el lane quedaba sin nada que evaluar.
      var area = function(x){ return x.r.width * x.r.height; };
      var raiz = bloques.filter(function(b){
        return !bloques.some(function(o){ return o !== b && area(o) > area(b) &&
          o.r.left <= b.r.left+1 && o.r.top <= b.r.top+1 &&
          o.r.right >= b.r.right-1 && o.r.bottom >= b.r.bottom-1; });
      });
      out.push({lane:ci+1, tipo:'__frames', n:raiz.length,
                clases:raiz.map(function(b){return b.cls}).join(',')});
      manos.forEach(function(h){
        var r = h.getBoundingClientRect();
        var txt = (h.textContent||'').replace(/\\s+/g,' ').trim().slice(0,46);
        var peor = null;
        raiz.forEach(function(b){
          var ox = Math.min(r.right,b.r.right) - Math.max(r.left,b.r.left);
          var oy = Math.min(r.bottom,b.r.bottom) - Math.max(r.top,b.r.top);
          if (ox > 2 && oy > 2 && (!peor || ox*oy > peor.ox*peor.oy))
            peor = {ox:Math.round(ox), oy:Math.round(oy), cls:b.cls};
        });
        if (peor) out.push({lane:ci+1, tipo:'PISA .'+peor.cls, ox:peor.ox, oy:peor.oy, txt:txt});
        if (r.bottom > cr.bottom - 2)
          out.push({lane:ci+1, tipo:'SE SALE DEL CANVAS', ox:0,
                    oy:Math.round(r.bottom-cr.bottom), txt:txt});
      });
    });
    var pre = document.createElement('pre');
    pre.id = '__reporte';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }, 500);
});
</script>
"""

def analizar(ruta):
    html = open(ruta).read()
    abs_html = re.sub(r'(url\(["\']?)\.\./\.\./', r'\1file://' + RAIZ + '/', html)
    pagina = abs_html.replace('</head>', SONDA + '</head>')
    tmp = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, dir=os.path.dirname(ruta))
    tmp.write(pagina); tmp.close()
    try:
        r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                            '--window-size=1400,3000', '--virtual-time-budget=4000',
                            '--dump-dom', 'file://' + tmp.name],
                           capture_output=True, text=True, timeout=90)
        m = re.search(r'<pre id="__reporte">(.*?)</pre>', r.stdout, re.S)
        if not m:
            return None
        return json.loads(m.group(1).replace('&quot;','"').replace('&amp;','&')
                          .replace('&lt;','<').replace('&gt;','>'))
    finally:
        os.unlink(tmp.name)

def main():
    total = 0
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'mockups', '*', 'index.html'))):
        nombre = os.path.basename(os.path.dirname(ruta))
        res = analizar(ruta)
        if res is None:
            print(f"  ?? {nombre}: la sonda no devolvió reporte"); total += 1; continue
        frames = [p for p in res if p['tipo'] == '__frames']
        problemas = [p for p in res if p['tipo'] != '__frames']
        vacios = [f for f in frames if f['n'] == 0]
        if vacios:
            print(f"  !! {nombre}: {len(vacios)} lane(s) SIN bloques que evaluar — "
                  f"el reporte de esos lanes no vale")
            total += len(vacios)
        if not problemas:
            print(f"  OK {nombre}  ({'/'.join(str(f['n']) for f in frames)} bloques por lane)")
            continue
        print(f"  ** {nombre}: {len(problemas)} problema(s)  "
              f"({'/'.join(str(f['n']) for f in frames)} bloques por lane)")
        for p in problemas:
            solape = f"{p['ox']}x{p['oy']}px" if p['ox'] else f"{p['oy']}px abajo"
            print(f"       lane{p['lane']} · {p['tipo']} ({solape}) · \"{p['txt']}\"")
        total += len(problemas)
    print(f"\n{total} colisiones en total")
    return 1 if total else 0

if __name__ == '__main__':
    sys.exit(main())
