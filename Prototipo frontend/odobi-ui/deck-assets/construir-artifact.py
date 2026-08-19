#!/usr/bin/env python3
"""Arma una version AUTOCONTENIDA del arbol para publicar como pagina web.

Uso:  python3 deck-assets/construir-artifact.py
Sale: arbol/arbol-web.html   (una sola pagina, todo embebido)

Por que existe: el arbol normal linkea imagenes, fuentes y los 9 mockups. Para
mandar un ENLACE hace falta una unica pagina sin dependencias externas.

Que cambia respecto del arbol de disco:
- Imagenes y tipografia embebidas como data: URI.
- Al tocar una pantalla NO se abre el mockup HTML (serian 9 documentos con sus
  propios @keyframes y :root, que al fusionarse colisionan). Se abre un panel con
  la pantalla en grande y TODAS sus anotaciones como TEXTO. Se pierde la flecha
  que apunta al elemento; se gana texto legible, buscable y citable.

Requiere haber corrido antes los renders reducidos (ver RUTAS abajo).
"""
import os, re, glob, json, base64, html, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 🔴 Los insumos viven en el REPO, no en un scratchpad de sesión. Antes apuntaban a
# /private/tmp/.../scratchpad, que muere con la sesión: el 16/08 esto dejó el artefacto
# no regenerable, con la única copia ya desactualizada. Los genera `preparar-artifact.py`.
TMP = os.path.join(RAIZ, 'deck-assets', '_artifact')
FRAMES, MAPA, NOTAS = f'{TMP}/f1', f'{TMP}/mapa', f'{TMP}/notas.json'

def datauri(p, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode()

def img(nombre, carpeta=FRAMES):
    p = os.path.join(carpeta, nombre)
    return datauri(p, 'image/png') if os.path.exists(p) else ''

MONOGRAMA = ('M8.471 20.000Q6.765 20.000 5.287 19.397Q3.810 18.793 2.707 17.711Q1.605 16.629 0.991 15.163'
 'Q0.377 13.696 0.377 11.990Q0.377 10.263 0.980 8.806Q1.584 7.350 2.686 6.268Q3.789 5.186 5.266 4.593'
 'Q6.744 4.000 8.471 4.000Q10.198 4.000 11.675 4.603Q13.152 5.207 14.255 6.278Q15.357 7.350 15.971 8.806'
 'Q16.585 10.263 16.585 11.990Q16.585 13.696 15.961 15.163Q15.337 16.629 14.234 17.711Q13.131 18.793 11.664 19.397'
 'Q10.198 20.000 8.471 20.000ZM8.471 17.420Q9.615 17.420 10.572 17.014Q11.529 16.609 12.247 15.880'
 'Q12.965 15.152 13.350 14.153Q13.735 13.155 13.735 11.990Q13.735 10.824 13.350 9.836Q12.965 8.848 12.247 8.109'
 'Q11.529 7.371 10.572 6.975Q9.615 6.580 8.471 6.580Q7.347 6.580 6.390 6.975Q5.433 7.371 4.715 8.109'
 'Q3.997 8.848 3.602 9.836Q3.207 10.824 3.207 11.990Q3.207 13.155 3.602 14.153Q3.997 15.152 4.715 15.880'
 'Q5.433 16.609 6.390 17.014Q7.347 17.420 8.471 17.420Z')

def mono(px, color='var(--acento)', ondas='var(--acento)'):
    return (f'<svg viewBox="0 0 24 24" width="{px}" height="{px}" fill="none" aria-hidden="true">'
            f'<path d="{MONOGRAMA}" fill="{color}"/>'
            f'<path d="M17.901 5.404 A11.5 11.5 0 0 1 17.901 18.596" stroke="{ondas}" stroke-width="1.6" stroke-linecap="round"/>'
            f'<path d="M21.471 4.500 A15.0 15.0 0 0 1 21.471 19.500" stroke="{ondas}" stroke-width="1.1" stroke-linecap="round"/></svg>')


def splash_partes():
    """Saca CSS + frame del prototipo del splash para meterlos en un shadow root.

    :root -> :host porque dentro del shadow DOM :root no matchea; y se tira la
    regla de body, que ahi no aplica. La @font-face se reescribe al data URI.
    """
    src = open(os.path.join(RAIZ, 'explorations/splash-o/v2-inmersivo.html'), encoding='utf-8').read()
    css = src[src.find('<style>')+7:src.find('</style>')]
    # Un @font-face declarado DENTRO de un shadow root se ignora: el navegador solo
    # resuelve los del documento. Asi que se borra y se apunta a la familia que ya
    # declara la pagina ("PJS"). Si no, el wordmark cae al fallback sans-serif.
    css = re.sub(r'@font-face\s*\{[^}]*\}', '', css, count=1)
    css = css.replace('"PlusJakartaSans"', '"PJS"').replace("'PlusJakartaSans'", "'PJS'")
    # reemplazo simple, no anclado: en el original :root viene despues de un
    # comentario, y una regex que exigia '}' o inicio de archivo no lo tocaba
    # -> ninguna variable llegaba al shadow y todo caia al fallback.
    css = css.replace(':root', ':host')
    css = re.sub(r'(^|\})\s*body\s*\{[^}]*\}', r'\1', css)
    i = src.find('<div class="phone')
    d, j = 0, i
    while j < len(src):
        if src.startswith('<div', j): d += 1
        elif src.startswith('</div>', j):
            d -= 1
            if d == 0: break
        j += 1
    return css, src[i:j+6]

# (bloque, titulo, bajada, [(mockup, lane, titulo, resumen, flecha_previa)])
BLOQUES = [
 ("0", "El sistema", "Las tres decisiones que ordenan todo. Son esquemas de trabajo, no producto: explican <b>por qué</b> la app tiene la forma que tiene, antes de mostrar una sola pantalla.", [
   ("00-mapa",1,"El mapa — superficies y flujos","El ciclo completo: hacés → queda anotado → Odobi lo vigila → le preguntás.",""),
   ("00-mapa",2,"Decisión A — 3 tabs + Cuenta en el avatar","Frecuencia de uso + Jakob's Law. Se descartó la nav de 5.",""),
   ("00-mapa",3,"Decisión B — terracota = solo lo tocable","«Si es terracota, pasa algo al tocarlo.» Un color, un significado.",""),
   ("00-mapa",4,"Decisión C — el puente Mi día → Chat","Toda acción de tarjeta desemboca en el chat. Un solo gesto que aprender.",""),
 ]),
 ("1", "La entrada", "El splash largo se ve <b>una sola vez</b>: primer ingreso y post-logout. Los arranques siguientes usan una pieza corta que aterriza en Mi día.", [
   ("@splash",0,"El splash — animación","6,84 s. Cuatro formas nacen en el centro, crecen y salen; la última se contrae hacia el lugar exacto de la O.",""),
   ("@isotipo",0,"Isotipo — dos versiones","Las dos en terracota sobre negro tostado, a la misma escala.","o bien"),
   ("01-onboarding",1,"El reveal — «se dice o-DO-bi»","El aterrizaje del splash ES el reveal: no hay corte entre animación y UI.",""),
   ("01-onboarding",2,"La promesa — 6 servicios, 2 permisos","«Son dos minutos y te digo algo que no sabés.» Promesa concreta.","→"),
   ("01-onboarding",3,"La promesa cumplida — con plata real","El primer minuto termina con un número del negocio, no con un tour.","→"),
 ]),
 ("2", "El día a día", "<b>El corazón del argumento.</b> La app abre acá, no en el chat. Los números salen de una query real y las tarjetas de un detector determinista de 6 reglas, sin LLM. El segundo estado hace creíble al primero: cuando no hay nada que decir, Odobi se calla.", [
   ("09-mi-dia",1,"Mi día — apertura con avisos","Portada + 3 tarjetas del detector. Cada una: dato + consecuencia + acción.",""),
   ("09-mi-dia",2,"Mi día — sin avisos","Gómez pagó tras el reclamo. El silencio es verificable contra sus números.","al día siguiente"),
   ("03-home-conversacional",1,"Chat — llegada desde Mi día","El chip «↩ Desde tu aviso» + la propuesta ya armada. Es el puente.","tocás la acción"),
   ("03-home-conversacional",2,"Chat — pregunta libre","BI conversacional solo-lectura sobre queries reales. Preguntar no gasta.","preguntar"),
   ("03-home-conversacional",3,"La escucha","Terracota plena a pantalla completa: el único momento display de la UI.","hablarle"),
 ]),
 ("3", "El patrón madre", "«Vos confirmás, Odobi ejecuta.» Es LA pantalla del producto y un componente reutilizable: aparece igual en cobros, facturas y presupuestos. Ya existe implementado en el repo.", [
   ("04-confirmacion-hitl",1,"Propuesta con detalle editable","Encabezado + filas + alcance + decisión. Nada se ejecuta sin que lo veas.",""),
   ("04-confirmacion-hitl",2,"Edición de un campo","Corregís antes de confirmar. El error se ataja acá, no después.","→"),
   ("04-confirmacion-hitl",3,"El comprobante queda en el hilo","Lo ejecutado deja rastro donde se decidió. El chat es el libro.","→"),
 ]),
 ("4", "Dos features reales", "Facturación (ARCA) y Presupuestos están <b>implementadas</b>, no son visión. Las dos heredan el mismo HITL: la puerta es la misma, lo que cambia es el riesgo. Facturar es irreversible, así que lleva doble confirmación.", [
   ("05-facturacion",1,"Facturar por voz","Pide UNA cosa por vez. No inventa datos fiscales.",""),
   ("05-facturacion",2,"Segundo HITL — la emisión","Irreversibilidad frontal: emitir una factura no se deshace.","→"),
   ("05-facturacion",3,"Emitida — el CAE en el thread","El comprobante fiscal queda en la conversación donde se pidió.","→"),
   ("06-presupuestos",1,"Presupuesto por voz","Los ítems se piden uno a uno, no se inventan.","mismo patrón"),
   ("06-presupuestos",2,"Una sola puerta, riesgo proporcional","Un presupuesto se edita; una factura no. El HITL se ajusta al riesgo.","→"),
   ("06-presupuestos",3,"El ciclo completo","Anotado → aprobado → factura. El presupuesto de hoy es la factura de la semana que viene.","→"),
 ]),
 ("5", "Lo que lo sostiene", "Conexiones vive dentro de Cuenta, y Cuenta vive en el avatar. Para que no quede escondido hay tres salvaguardas: puntito en el avatar, tarjeta en Mi día si algo se cae, y consentimiento just-in-time al ejecutar.", [
   ("02-conexiones",1,"Just-in-time consent","El permiso llega con el pedido, no en un onboarding de 6 pantallas.",""),
   ("02-conexiones",2,"Conexión caída","El tablero admite estar incompleto en vez de mostrar un número mentiroso.","→"),
   ("02-conexiones",3,"Cuenta › Conexiones","Qué ve Odobi de cada servicio, y cómo cortarlo en un toque.","→"),
   ("08-plan-limites",1,"Cuenta — el destino del avatar","Resuelve el avatar sin destino de la nav vieja.","→"),
   ("08-plan-limites",2,"Qué cuenta como acción","<b>Hacer gasta, preguntar no.</b> Si preguntar gastara, el usuario dejaría de preguntar.","→"),
   ("08-plan-limites",3,"El límite","Dos salidas del mismo tamaño, sin urgencia fabricada. Al tope el input sigue vivo.","→"),
 ]),
]

PUENTE = [("09-mi-dia",1,"1","Mi día","Tocás «Reclamá el pago». La acción no ejecuta nada todavía.",""),
          ("03-home-conversacional",1,"2","Chat","Chip «↩ Desde tu aviso» + HITL armado. El contexto viaja con vos.","abre el chat"),
          ("04-confirmacion-hitl",1,"3","HITL","Propuesta → detalle editable → confirmar o cancelar.","revisás"),
          ("09-mi-dia",2,"4","Mi día","La tarjeta queda en estado resultado. El ciclo cierra donde empezó.","volvés")]

def main():
    for d in (FRAMES, MAPA, NOTAS):
        if not os.path.exists(d):
            sys.exit(f"Falta {d} — corré antes: python3 deck-assets/preparar-artifact.py")
    notas = json.load(open(NOTAS))
    fuente = datauri(os.path.join(RAIZ, 'assets/fonts/PlusJakartaSans-Bold.ttf'), 'font/ttf')

    # imagenes usadas
    imgs, usados = {}, set()
    for _, _, _, tarjetas in BLOQUES:
        for mk, ln, *_ in tarjetas:
            if not mk.startswith('@'): usados.add((mk, ln))
    for mk, ln, *_ in PUENTE: usados.add((mk, ln))
    for mk, ln in usados:
        carpeta = MAPA if mk == '00-mapa' else FRAMES
        u = img(f'{mk}-lane{ln}.png', carpeta)
        if not u: sys.exit(f"Falta render de {mk}-lane{ln}")
        imgs[f'{mk}-{ln}'] = u

    def panel_datos():
        d = {}
        for mk, ln in usados:
            lane = notas[mk][ln-1]
            d[f'{mk}-{ln}'] = {'tag': lane['tag'], 'sub': lane['sub'], 'notas': lane['notas']}
        return d

    ISOTIPO_DAVID = ('<path d="M11 3.5a8.5 8.5 0 1 0 0 17"/><path d="M11 7.5a4.5 4.5 0 1 0 0 9"/>'
                     '<path d="M16.5 8.8a4.8 4.8 0 0 1 0 6.4"/><path d="M19.5 6.5a9 9 0 0 1 0 11"/>')

    def miniatura_especial(k, px):
        if k == '@splash-0':
            return ('<span class="shot esp"><span class="esp-in">' + mono(px, 'var(--marca)', 'var(--apoyo)') +
                    '<span class="play-tag">▶ animación</span></span></span>')
        return ('<span class="shot esp"><span class="esp-in">'
                f'<svg viewBox="0 0 24 24" width="{px}" height="{px}" fill="none" stroke="var(--marca)" '
                f'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                f'{ISOTIPO_DAVID}</svg></span></span>')

    def tarjeta(mk, ln, tit, res, flecha, ancha=False, paso=None):
        k = f'{mk}-{ln}'
        fl = (f'<div class="flecha"><span>→</span>{f"<em>{html.escape(flecha)}</em>" if flecha not in ("","→") else ""}</div>'
              if flecha else '')
        num = f'<span class="paso">{paso}</span>' if paso else ''
        return fl + (
          f'<button class="card{" ancha" if ancha else ""}" data-k="{k}" type="button">'
          + (miniatura_especial(k, 108) if mk.startswith('@')
             else f'<span class="shot" style="background-image:var(--i-{k})"></span>')
          + (
          f'<span class="ref">{num}{"marca" if mk.startswith("@") else mk.split("-")[0] + " · lane " + str(ln)}</span>'
          f'<span class="h3">{tit}</span><span class="p">{res}</span></button>'))

    bloques_html = []
    for n, tit, baj, tarjetas in BLOQUES:
        cards = ''.join(tarjeta(mk, ln, t, r, f, ancha=(mk == '00-mapa'))
                        for mk, ln, t, r, f in tarjetas)
        bloques_html.append(
          f'<section class="bloque"><header class="bh"><span class="n">{n}</span>'
          f'<h2>{tit}</h2></header><p class="bd">{baj}</p><div class="fila">{cards}</div></section>')
        if n == "2":
            pc = ''.join(tarjeta(mk, ln, t, r, f, paso=p) for mk, ln, p, t, r, f in PUENTE)
            bloques_html.append(
              '<section class="puente"><div class="puente-in"><h2>El puente</h2>'
              '<p class="bd">Este es el recorrido que conviene ver entero: es lo único del sistema que '
              '<b>no se entiende explicándolo</b>. Toda acción de tarjeta abre el chat con el contexto ya '
              'cargado y la propuesta armada; confirmás; volvés a Mi día con la tarjeta en estado resultado. '
              'Un solo gesto que aprender, en todas las features.</p>'
              f'<div class="fila">{pc}</div></div></section>')

    scss, shtml = splash_partes()
    ESPECIAL = {
      '@splash-0': {'tag':'El splash — animación', 'sub':
        'Tempo Calmo, aparición Densa (Martin 29/07). 6,84 s: se ven una sola vez, en el primer '
        'ingreso y post-logout. Los arranques siguientes usan una pieza de 420 ms. Esta es la '
        'animación original en HTML/CSS, la misma de la que se portó el archivo Rive.'},
      '@isotipo-0': {'tag':'Isotipo — dos versiones', 'sub':
        'Versión A: cuatro arcos concéntricos, todo trazo. Versión B: la O real del wordmark '
        'con las ondas afuera. Las dos en terracota sobre negro tostado — 5,71:1, y como '
        'logotipo están exentas igual (WCAG 1.4.3).'},
    }
    varsimg = ':root{' + ''.join(f'--i-{k}:url({v});' for k, v in imgs.items()) + '}'

    PAGINA = f'''<meta charset="utf-8">
<style>{varsimg}
@font-face{{font-family:"PJS";src:url({fuente}) format("truetype");font-weight:700;font-display:swap}}
:root{{
  --lienzo:#F2EEE7; --sup:#FFFFFF; --estructura:#1A1512; --linea:#E2DACE;
  --texto:#1A1512; --texto-2:#5C534C; --acento:#B04A2E; --apoyo:#E8A088;
  --marca:#DE7250; --sombra:0 10px 26px rgba(26,21,18,.11); --sombra-alta:0 16px 34px rgba(26,21,18,.18);
  --display:"PJS","Arial Black",sans-serif;
  --ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  --nota:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
}}
@media (prefers-color-scheme:dark){{:root{{
  --lienzo:#1A1512; --sup:#261F1A; --linea:#3A322B; --texto:#F7F3EC; --texto-2:#B8AFA6;
  --acento:#DE7250; --sombra:0 10px 26px rgba(0,0,0,.35); --sombra-alta:0 16px 34px rgba(0,0,0,.5);
}}}}
:root[data-theme="dark"]{{
  --lienzo:#1A1512; --sup:#261F1A; --linea:#3A322B; --texto:#F7F3EC; --texto-2:#B8AFA6;
  --acento:#DE7250; --sombra:0 10px 26px rgba(0,0,0,.35); --sombra-alta:0 16px 34px rgba(0,0,0,.5);
}}
:root[data-theme="light"]{{
  --lienzo:#F2EEE7; --sup:#FFFFFF; --linea:#E2DACE; --texto:#1A1512; --texto-2:#5C534C;
  --acento:#B04A2E; --sombra:0 10px 26px rgba(26,21,18,.11); --sombra-alta:0 16px 34px rgba(26,21,18,.18);
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--lienzo);color:var(--texto);font-family:var(--ui);
     -webkit-font-smoothing:antialiased}}
.top{{background:var(--estructura);color:#F7F3EC;padding:30px 5vw 26px}}
.top-in{{max-width:1560px;margin:0 auto}}
.marca{{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--marca)}}
.marca span{{font-family:var(--display);font-size:22px}}
.top h1{{font-family:var(--display);font-size:clamp(24px,3.4vw,32px);line-height:1.12;
        margin:0 0 10px;text-wrap:balance}}
.top p{{margin:0;font-size:14.5px;line-height:1.5;color:#C9BFB4;max-width:68ch}}
.top p b{{color:#F7F3EC}}
.leyenda{{display:flex;gap:26px;flex-wrap:wrap;margin-top:18px;padding-top:16px;
         border-top:1px solid #3A322C;font-size:12.5px;color:#C9BFB4}}
.leyenda i{{font-style:normal;color:var(--apoyo)}}
.bloque,.puente{{max-width:1560px;margin:0 auto;padding:46px 5vw 0}}
.bh{{display:flex;align-items:baseline;gap:14px;margin:0 0 6px}}
.bh .n{{font-family:var(--display);font-size:32px;color:var(--texto-2);font-variant-numeric:tabular-nums}}
.bh h2{{font-family:var(--display);font-size:23px;margin:0;text-wrap:balance}}
.bd{{font-size:14px;line-height:1.5;color:var(--texto-2);max-width:74ch;margin:0 0 22px}}
.bd b{{color:var(--texto)}}
.fila{{display:flex;align-items:flex-start;gap:0;overflow-x:auto;padding-bottom:12px;
      scrollbar-width:thin}}
.flecha{{flex:0 0 auto;align-self:center;padding:0 12px;color:var(--texto-2);
        font-size:20px;margin-top:-52px;text-align:center}}
.flecha em{{display:block;font-family:var(--nota);font-style:normal;font-size:11px;
           margin-top:2px;white-space:nowrap}}
.card{{flex:0 0 auto;width:214px;background:none;border:0;padding:0;margin:0;text-align:left;
      font:inherit;color:inherit;cursor:pointer;display:block}}
.card.ancha{{width:330px}}
.shot{{display:block;width:214px;height:463px;border-radius:18px;border:1px solid var(--linea);
      background:var(--sup);overflow:hidden;box-shadow:var(--sombra);
      transition:transform .16s ease,box-shadow .16s ease}}
.card.ancha .shot{{width:330px;height:186px;border-radius:12px}}
.shot{{background-size:cover;background-position:top center;background-repeat:no-repeat}}
.card.ancha .shot{{background-size:contain;background-position:center;background-color:var(--lienzo)}}
.card:hover .shot,.card:focus-visible .shot{{transform:translateY(-4px);box-shadow:var(--sombra-alta)}}
.card:focus-visible{{outline:2px solid var(--acento);outline-offset:6px;border-radius:4px}}
.ref{{display:block;font-family:var(--nota);font-size:11px;letter-spacing:.06em;
     text-transform:uppercase;color:var(--texto-2);margin:11px 0 3px}}
.h3{{display:block;font-size:13.5px;line-height:1.32;font-weight:650;margin-bottom:5px}}
.p{{display:block;font-size:12.5px;line-height:1.36;color:var(--texto-2)}}
.shot.esp{{display:flex;align-items:center;justify-content:center;background:var(--estructura)}}
.esp-in{{display:flex;flex-direction:column;align-items:center;gap:16px}}
.play-tag{{font-family:var(--nota);font-size:11px;letter-spacing:.06em;color:var(--apoyo)}}
#pesp{{display:none}} #pesp.on{{display:block}}
.demo-caja{{--sc:.62;background:var(--estructura);border-radius:16px;padding:22px;display:flex;
           justify-content:center;align-items:flex-start;border:1px solid var(--linea);
           height:calc(844px * var(--sc) + 44px);overflow:hidden}}
.splash-host{{display:block;width:390px;height:844px;flex:0 0 auto;
             transform:scale(var(--sc));transform-origin:top center}}
@media (max-width:700px){{.demo-caja{{--sc:.42}}}}
.replay{{margin-top:14px;font-family:var(--nota);font-size:12px;padding:9px 16px;border-radius:999px;
        border:1px solid var(--linea);background:var(--sup);color:var(--texto);cursor:pointer}}
.replay:focus-visible{{outline:2px solid var(--acento);outline-offset:2px}}
.iso-par{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}
.iso-par figure{{margin:0;background:var(--estructura);border-radius:16px;padding:26px 10px 16px;text-align:center}}
.iso-par figcaption{{font-family:var(--nota);font-size:11px;color:var(--apoyo);margin-top:14px}}
.paso{{display:inline-flex;width:18px;height:18px;border-radius:50%;background:var(--acento);
      color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;
      margin-right:6px;vertical-align:-4px}}
.puente-in{{background:var(--estructura);border-radius:22px;padding:30px 32px 30px;color:#F7F3EC}}
.puente-in h2{{font-family:var(--display);font-size:22px;margin:0 0 6px}}
.puente-in .bd{{color:#C9BFB4}} .puente-in .bd b{{color:#F7F3EC}}
.puente-in .card{{color:#F7F3EC;width:198px}}
.puente-in .shot{{width:198px;height:428px;border-color:#3A322B}}
.puente-in .ref{{color:var(--apoyo)}} .puente-in .p{{color:#C9BFB4}}
.puente-in .flecha{{color:var(--apoyo)}}
.pie{{max-width:1560px;margin:52px auto 0;padding:0 5vw 72px}}
.pie-in{{background:var(--sup);border:1px solid var(--linea);border-radius:16px;padding:22px 26px}}
.pie h3{{font-family:var(--display);font-size:17px;margin:0 0 10px}}
.pie ul{{margin:0;padding-left:18px;font-size:13.5px;line-height:1.65;color:var(--texto-2)}}
.pie b{{color:var(--texto)}}
/* panel */
.velo{{position:fixed;inset:0;background:rgba(26,21,18,.62);backdrop-filter:blur(2px);
      display:none;align-items:flex-start;justify-content:center;padding:4vh 4vw;z-index:50;
      overflow:auto}}
.velo[open]{{display:flex}}
.panel{{background:var(--lienzo);border-radius:20px;max-width:1080px;width:100%;
       box-shadow:0 30px 80px rgba(0,0,0,.4);overflow:hidden}}
.panel-top{{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
           padding:24px 26px 0}}
.panel-top h2{{font-family:var(--display);font-size:20px;margin:0;text-wrap:balance}}
.panel-top p{{margin:6px 0 0;font-size:13px;line-height:1.5;color:var(--texto-2);max-width:70ch}}
.cerrar{{flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:1px solid var(--linea);
        background:var(--sup);color:var(--texto);font-size:20px;cursor:pointer;line-height:1}}
.cerrar:focus-visible{{outline:2px solid var(--acento);outline-offset:2px}}
.panel-cuerpo{{display:grid;grid-template-columns:340px 1fr;gap:30px;padding:22px 26px 30px}}
.panel-cuerpo #pimg{{width:100%;border-radius:16px;border:1px solid var(--linea);
   box-shadow:var(--sombra);background-size:cover;background-position:top center;
   background-repeat:no-repeat;aspect-ratio:390/844}}
.panel-cuerpo #pimg.ancha{{aspect-ratio:1900/1069;background-size:contain;background-color:var(--lienzo)}}
.panel-cuerpo #pimg{{cursor:zoom-in}}
/* Las láminas del mapa son apaisadas: en dos columnas quedan de 340px y no se
   leen. Con .horizontal el panel pasa a una sola columna y la imagen ocupa todo
   el ancho; las anotaciones bajan y se reparten en dos columnas. */
.panel-cuerpo.horizontal{{grid-template-columns:1fr}}
.panel-cuerpo.horizontal .notas{{display:block;columns:2;column-gap:30px}} /* display:block obligatorio: columns no aplica sobre un contenedor flex */
.panel-cuerpo.horizontal .notas li{{break-inside:avoid;margin-bottom:13px}}
.lupa{{position:fixed;inset:0;background:rgba(10,8,7,.94);display:none;z-index:80;
      align-items:center;justify-content:center;padding:2vh 2vw;cursor:zoom-out}}
.lupa[open]{{display:flex}}
.lupa .zi{{max-width:100%;max-height:96vh;background-size:contain;background-position:center;
          background-repeat:no-repeat;width:100%;height:96vh}}
.lupa .cerrar{{position:absolute;top:20px;right:24px}}
.zoom-tip{{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
          font-family:var(--nota);font-size:12px;color:#C9BFB4}}
.notas{{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:13px}}
.notas li{{font-family:var(--nota);font-size:12.5px;line-height:1.55;color:var(--texto);
          padding-left:14px;border-left:2px solid var(--linea)}}
.notas li.accent{{color:var(--acento);border-left-color:var(--acento)}}
.notas li.dim{{color:var(--texto-2)}}
.notas-tit{{font-family:var(--nota);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
           color:var(--texto-2);margin:0 0 12px}}
@media (max-width:820px){{.panel-cuerpo{{grid-template-columns:1fr}}}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important;animation:none!important}}}}
</style>

<div class="top"><div class="top-in">
  <div class="marca">{mono(26)}<span>Odobi</span></div>
  <h1>Árbol de producto — 9 pantallas madre, 27 estados</h1>
  <p>El recorrido completo de la app en orden narrativo: <b>qué es</b> → <b>cómo entrás</b> →
     <b>qué ves todos los días</b> → <b>cómo se ejecuta</b> → <b>qué lo sostiene</b>.
     <b>Tocá cualquier pantalla</b> para verla en grande con todas sus anotaciones.</p>
  <div class="leyenda">
    <span><i>■</i> Clic en la pantalla del panel para verla a tamaño completo.</span>
    <span><i>→</i> Las flechas son navegación real, no orden de lectura.</span>
    <span><i>◆</i> Plus Jakarta Sans Bold (display) + Inter (UI).</span>
  </div>
</div></div>

{''.join(bloques_html)}

<div class="pie"><div class="pie-in">
  <h3>Cómo leerlo</h3>
  <ul>
    <li><b>El bloque 0 primero.</b> Sin las tres decisiones, las pantallas parecen elecciones de gusto.</li>
    <li><b>El puente es la demo.</b> Es lo único que no se entiende explicándolo: hay que recorrerlo.</li>
    <li><b>El mockup 08 es el único material de visión.</b> El backend no expone plan ni consumo, y el
        número de acciones/mes está <b>a calibrar</b>. Todo lo demás son features implementadas.</li>
    <li><b>Las cifras son de mockup pero internamente consistentes</b> entre pantallas
        (286 − 194 = 92; la factura de Gómez es el mismo dato en tres pantallas).</li>
    <li><b>Tipografía:</b> Plus Jakarta Sans Bold, licencia SIL OFL. Reemplaza a NeueEinstellung,
        cuya licencia de app quedó fuera de presupuesto.</li>
  </ul>
</div></div>

<div id="mono-ref" hidden>{mono(150, "#DE7250", "#E8A088")}</div>
<div class="lupa" id="lupa" role="dialog" aria-modal="true" aria-label="Imagen a tamaño completo">
  <div class="zi" id="zi" role="img" aria-label=""></div>
  <button class="cerrar" id="cerrarlupa" type="button" aria-label="Cerrar">✕</button>
  <p class="zoom-tip">clic en cualquier lado para cerrar</p>
</div>
<div class="velo" id="velo" role="dialog" aria-modal="true" aria-labelledby="ptit">
  <div class="panel">
    <div class="panel-top">
      <div><h2 id="ptit"></h2><p id="psub"></p></div>
      <button class="cerrar" id="cerrar" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="panel-cuerpo" id="pcuerpo">
      <div id="pizq"><div id="pimg" role="img" aria-label=""></div></div>
      <div><p class="notas-tit" id="pnotastit">Anotaciones de diseño</p>
           <ul class="notas" id="pnotas"></ul></div>
    </div>
  </div>
</div>

<script>
const DATOS = {json.dumps(panel_datos(), ensure_ascii=False)};
const ESP = {json.dumps(ESPECIAL, ensure_ascii=False)};
const SPLASH_CSS = {json.dumps(scss)};
const SPLASH_HTML = {json.dumps(shtml)};
let timers = [];
function pintarSplash(cont){{
  cont.innerHTML = '';
  const caja = document.createElement('div'); caja.className = 'demo-caja';
  const host = document.createElement('div'); host.className = 'splash-host';
  const sr = host.attachShadow({{mode:'open'}});
  sr.innerHTML = '<style>' + SPLASH_CSS + '</style>' + SPLASH_HTML;
  caja.appendChild(host); cont.appendChild(caja);
  const btn = document.createElement('button');
  btn.className = 'replay'; btn.type = 'button'; btn.textContent = '↻ Reproducir de nuevo';
  cont.appendChild(btn);
  const T = {{grow:1900, stg:820, col:1450, set:780, lstg:150, let:720}}, ratio = .20;
  host.style.setProperty('--grow', T.grow+'ms');
  host.style.setProperty('--collapse', T.col+'ms');
  host.style.setProperty('--settle', T.set+'ms');
  host.style.setProperty('--letter', T.let+'ms');
  function correr(){{
    timers.forEach(clearTimeout); timers = [];
    const phone = sr.getElementById('phone');
    const blobs = Array.from(sr.querySelectorAll('.blob'));
    const last = sr.querySelector('.blob.last');
    const rest = sr.getElementById('rest');
    const bg = sr.querySelector('.finalbg');
    const paso = Math.round(T.grow * ratio);
    blobs.forEach((b,i) => b.style.setProperty('--d', (i*paso)+'ms'));
    const dc = (blobs.length-1)*paso + T.grow;
    if(last) last.style.setProperty('--dc', dc+'ms');
    if(bg) bg.style.setProperty('--dcbg', dc+'ms');
    if(rest){{
      rest.querySelectorAll('span').forEach((sp,i) => sp.style.animationDelay = (i*T.lstg)+'ms');
      if(last) last.style.setProperty('--ox', -(rest.getBoundingClientRect().width/2)+'px');
    }}
    phone.classList.remove('play','st-o','st-word','st-final');
    void phone.offsetWidth;
    phone.classList.add('play');
    const tO = dc + T.col - Math.round(T.col*.3), tW = dc + T.col + 300,
          tF = tW + T.lstg*3 + T.let + 120;
    timers.push(setTimeout(() => phone.classList.add('st-o'), tO));
    timers.push(setTimeout(() => phone.classList.add('st-word'), tW));
    timers.push(setTimeout(() => phone.classList.add('st-final'), tF));
  }}
  btn.addEventListener('click', correr);
  /* setTimeout y no requestAnimationFrame: el rAF se pausa cuando la pagina no
     esta visible (headless, pestaña en segundo plano) y la animacion no arranca.
     60 ms alcanza para que el panel ya este display:flex y midan los rects. */
  timers.push(setTimeout(correr, 60));
}}
function pintarIsotipo(cont){{
  const iso = '<path d="M11 3.5a8.5 8.5 0 1 0 0 17"/><path d="M11 7.5a4.5 4.5 0 1 0 0 9"/>'
            + '<path d="M16.5 8.8a4.8 4.8 0 0 1 0 6.4"/><path d="M19.5 6.5a9 9 0 0 1 0 11"/>';
  cont.innerHTML =
    '<div class="iso-par">'
    + '<figure><svg viewBox="0 0 24 24" width="150" height="150" fill="none" stroke="#DE7250" '
    + 'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + iso + '</svg>'
    + '<figcaption>versión A · cuatro arcos</figcaption></figure>'
    + '<figure>' + document.getElementById('mono-ref').innerHTML
    + '<figcaption>versión B · la o que habla</figcaption></figure></div>';
}}
const velo = document.getElementById('velo');
const lupa = document.getElementById('lupa');
let previo = null;
function ampliar(k, etiqueta){{
  const zi = document.getElementById('zi');
  zi.style.backgroundImage = 'var(--i-' + k + ')';
  zi.setAttribute('aria-label', etiqueta || '');
  lupa.setAttribute('open','');
  document.getElementById('cerrarlupa').focus();
}}
function cerrarLupa(){{ lupa.removeAttribute('open'); }}
function abrir(k){{
  const e = ESP[k];
  const d = e || DATOS[k]; if(!d) return;
  previo = document.activeElement;
  document.getElementById('ptit').textContent = d.tag || k;
  document.getElementById('psub').textContent = d.sub || '';
  const izq = document.getElementById('pizq');
  const cuerpo = document.getElementById('pcuerpo');
  const tit = document.getElementById('pnotastit');
  if(e){{
    cuerpo.classList.remove('horizontal');
    cuerpo.style.gridTemplateColumns = '1fr';
    tit.style.display = 'none';
    izq.innerHTML = '';
    if(k === '@splash-0') pintarSplash(izq); else pintarIsotipo(izq);
  }} else {{
    cuerpo.style.gridTemplateColumns = '';
    tit.style.display = '';
    const horizontal = k.startsWith('00-mapa');
    cuerpo.classList.toggle('horizontal', horizontal);
    izq.innerHTML = '<div id="pimg" role="img" tabindex="0"></div>';
    const im = document.getElementById('pimg');
    im.style.backgroundImage = 'var(--i-' + k + ')';
    im.classList.toggle('ancha', horizontal);
    im.setAttribute('aria-label', (d.tag || '') + ' — clic para ampliar');
    im.addEventListener('click', () => ampliar(k, d.tag));
    im.addEventListener('keydown', ev => {{ if(ev.key==='Enter'||ev.key===' '){{ ev.preventDefault(); ampliar(k, d.tag); }} }});
  }}
  const ul = document.getElementById('pnotas'); ul.innerHTML = '';
  (d.notas||[]).forEach(n => {{
    const li = document.createElement('li');
    if(n.k) li.className = n.k;
    li.textContent = n.t; ul.appendChild(li);
  }});
  velo.setAttribute('open',''); document.body.style.overflow='hidden';
  document.getElementById('cerrar').focus();
}}
function cerrar(){{
  timers.forEach(clearTimeout); timers = [];
  document.getElementById('pizq').innerHTML = '';
  velo.removeAttribute('open'); document.body.style.overflow='';
  if(previo) previo.focus();
}}
document.querySelectorAll('.card').forEach(b => b.addEventListener('click', () => abrir(b.dataset.k)));
document.getElementById('cerrar').addEventListener('click', cerrar);
velo.addEventListener('click', e => {{ if(e.target === velo) cerrar(); }});
lupa.addEventListener('click', cerrarLupa);
document.addEventListener('keydown', e => {{
  if(e.key !== 'Escape') return;
  if(lupa.hasAttribute('open')) cerrarLupa();
  else if(velo.hasAttribute('open')) cerrar();
}});
</script>'''

    destino = os.path.join(RAIZ, 'arbol', 'arbol-web.html')
    open(destino, 'w', encoding='utf-8').write(PAGINA)
    mb = os.path.getsize(destino)/1024/1024
    print(f"{destino}\n{mb:.2f} MB · {len(imgs)} imágenes · "
          f"{sum(len(v['notas']) for v in panel_datos().values())} anotaciones embebidas")
    return 0

if __name__ == '__main__':
    sys.exit(main())
