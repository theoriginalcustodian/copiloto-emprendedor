#!/usr/bin/env python3
"""Arma la lamina visual autocontenida del analisis del build de David.

Uso:  python3 audit/lamina/construir.py
Sale: audit/lamina/index.html  (una sola pagina, imagenes y fuente embebidas)

Por que existe: la lamina se proyecta en la reunion Y se manda por link. Con las
capturas referenciadas por ruta, el archivo suelto no sirve para lo segundo.

Las coordenadas de los pines van en PORCENTAJE del alto/ancho de cada captura,
no en pixeles: las cuatro capturas no tienen la misma resolucion (tres son
720x1600 y la de Inteligencia 576x1280).
"""
import base64
import os

RAIZ = os.path.dirname(os.path.abspath(__file__))
CAPS = os.path.join(RAIZ, 'capturas')
FUENTE = os.path.join(RAIZ, '..', '..', 'assets', 'fonts', 'PlusJakartaSans-Bold.ttf')


def datauri(path, mime):
    with open(path, 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()


# ---------------------------------------------------------------- contenido
# (severidad, titulo, cuerpo, fundamento, pin_x%, pin_y%)  — pin None = sin marcador
LAMINAS = [
    dict(
        n='01', img='02-chat.jpg', nombre='La pantalla de arranque',
        veredicto='La conversación está adelante y el escritorio detrás — la metáfora es correcta y '
                  'la ingeniería del panel es fina. Lo que falla es <strong>que la app arranca preguntando, '
                  'no informando</strong>.',
        hall=[
            ('c', 'Arranca preguntando, no informando',
             'El propio glosario del repo define Mi Día como <em>«el tablero donde el copiloto habla primero»</em>. '
             'Esa capacidad está construida —8 reglas deterministas— y el arranque no la usa: la primera pantalla '
             'le devuelve la pelota al usuario.',
             'Norman — <b>gulf of execution</b>. Un copiloto que abre con «Lucía no te contesta hace 31 días» '
             'demuestra su valor antes de que el usuario haga nada.', 50, 36),
            ('c', 'El cartel del gesto es el texto menos legible de la pantalla',
             '«DESLIZÁ PARA VER FUNCIONES» mide <span class="dato">2,90:1</span>. Y enseña el gesto difícil '
             'escondiendo el fácil: <strong>tocar el handle ya alterna el panel</strong> '
             '(<code>|&Delta;|&lt;5px</code> &rarr; toggle), pero el texto nunca dice «tocá».',
             '<b>WCAG 1.4.3</b> mínimo 4,5:1 · <b>2.5.1</b> Pointer Gestures', 50, 8),
            ('m', 'El texto de bienvenida es una constante estática',
             'El mismo el día 1 y el día 300 (<code>ListaMensajes.tsx:29</code>). Además mezcla dos taxonomías: '
             '«mandar un mail» y «buscar en tus archivos» son <strong>Apps</strong> (integraciones), no las '
             '<strong>Funciones</strong> que lista el escritorio.',
             'Nielsen #6 — reconocer antes que recordar', 50, 56),
            ('n', 'Chip «Pedir confirmación» sin objeto',
             'Flotando en una pantalla sin conversación, no se entiende qué confirma. El indicador de modo de '
             'ceremonia necesita algo a lo que referirse.',
             '', 24, 13),
            ('ok', 'El contrato del producto, en el primer texto que se lee',
             '«Antes de ejecutar algo importante, siempre te lo muestro para que lo confirmes». Esa frase es la '
             'tesis del producto y está bien puesta. <strong>No se toca.</strong>',
             '', None, None),
            ('ok', 'El mic es protagonista y la ingeniería del panel es de primer nivel',
             'Snap con la velocidad real del dedo, flick que decide por dirección arriba de 500 px/s, '
             '<code>ScrollView</code> de Gesture Handler para que tap y scroll no compitan. Todo documentado con '
             'el defecto que lo originó.',
             '', 50, 85),
        ]),

    dict(
        n='02', img='03-funciones.jpg', nombre='El escritorio de funciones',
        veredicto='Las pantallas de función <strong>no sobran</strong>: hacen cuatro cosas que la voz no puede hacer. '
                  'Lo que no funciona es presentarlas como nueve puertas iguales.',
        hall=[
            ('c', 'Nueve destinos planos, y dos quedan fuera de pantalla',
             '9 tiles de 104&nbsp;dp en 2 filas &rarr; 5 columnas, de las que entran tres y media. El scroll horizontal '
             'es la affordance más débil que existe en mobile, y además <strong>compite con el gesto vertical del '
             'panel</strong> en la misma superficie.',
             'Hick-Hyman — el costo de decidir crece con opciones <em>equiprobables</em>', 50, 14),
            ('m', 'La solapa cortada se lee como error, no como invitación',
             'El fade y la flecha están bien resueltos (aparecen solo si hay overflow, medidos con <code>onLayout</code>), '
             'pero una solapa partida al medio contra el borde se interpreta antes como recorte que como «hay más».',
             'Norman — <b>signifier</b>: una affordance sin signo claro no existe', 93, 27),
            ('m', 'Labels partidos a la mitad',
             '«Facturació/n», «Presupues/tos». El tile reserva dos líneas (bien pensado), pero 104&nbsp;dp no alcanzan '
             'para las palabras reales del dominio.',
             '', 18, 22),
            ('m', 'Ajustes está dos veces y Mi día está en el lugar equivocado',
             'Ajustes es tile <em>y</em> engranaje del header. Mi día —lo primero del día— pesa lo mismo que Clientes, '
             'que casi nunca se abre solo porque <em>la cartera se deriva de lo que emitiste</em>.',
             '<code>CONTEXT.md</code> — glosario del repo', 74, 34),
            ('m', 'Glass sin nada que refractar',
             'Bordes de tile a ~1,4:1 contra el fondo. <strong>Pero esto no es una discusión de diseño:</strong> el DoD '
             'del 05/08 ya decidió «sin glass, color pleno + relieve» porque el <code>BlurView</code> nunca desenfocó en '
             'Android. Es deuda declarada esperando su hito.',
             '<b>WCAG 1.4.11</b> pide 3:1 para identificar un control', 63, 22),
            ('n', 'El estado vacío no invita a nada',
             '«Todavía no hay movimientos» a <span class="dato">3,71:1</span>, y ocupa el 60% de la pantalla sin ofrecer '
             'el primer paso.',
             '', 48, 47),
        ]),

    dict(
        n='03', img='04-inteligencia.jpg', nombre='Inteligencia de Negocio',
        veredicto='La pantalla con más fallas medidas: <strong>cuatro labels de sección por debajo de 2:1</strong>, '
                  'dos colores que vienen de otra app y el acento haciendo de dato.',
        hall=[
            ('c', 'Cuatro labels de sección prácticamente invisibles',
             'FACTURACIÓN <span class="dato">1,35:1</span> · MES A MES <span class="dato">1,65:1</span> · '
             'EN CAJA <span class="dato">1,78:1</span> · ESTE MES <span class="dato">1,93:1</span>. '
             'Todos son terracota oscurecida sobre fondo oscuro.',
             '<b>WCAG 1.4.3</b> mínimo 4,5:1', 14, 34),
            ('c', 'Verde y rosa son de otra app — lo firma el propio código',
             '<code>SEMANTICOS_OSCURO</code> lleva el comentario <em>«no están en el DoD de ODOBI»</em>: son los '
             'semánticos heredados de <strong>DocuMed</strong>, la app clínica hermana. Contrastan bien, pero '
             'verde-menta y rosa neón son el vocabulario fintech del que Odobi se quiere diferenciar.',
             '<b>WCAG 1.4.1</b> — además, ingreso/gasto se distingue <em>solo</em> por tono', 35, 41),
            ('m', 'La terracota dejó de ser señal',
             'En esta pantalla hay terracota en cifras, labels, tab activa, ícono y borde: <strong>hay más terracota '
             'no tocable que tocable</strong>. Un acento que aparece en todos lados deja de informar.',
             'Decision B — «si es terracota, pasa algo al tocarlo»', 12, 47),
            ('m', 'El engranaje se come el título y tapa «Volver»',
             'Dos affordances de retroceso conviviendo, y una de ellas ilegible. Además el engranaje mide '
             '<span class="dato">42 dp</span>, debajo del mínimo de las dos plataformas.',
             '<b>Material 3</b> 48 dp · <b>Apple HIG</b> 44 pt · <b>Hoober</b> — la peor zona del pulgar', 88, 12),
            ('m', 'La tab «Preguntar» duplica el chat',
             'Dos puertas al mismo motor obligan a mantener dos contextos. Con el chip de contexto '
             '(«↩ Desde Inteligencia») alcanza una sola.',
             'Decision C — el puente', 26, 18),
            ('n', 'Siete «$0,00»',
             'Una cuenta sin datos mostrando ceros formateados se lee como error de carga. El estado vacío explícito '
             'comunica mejor — y es coherente con la regla del propio repo de no inventar datos.',
             '', 50, 57),
        ]),

    dict(
        n='04', img='01-login.jpg', nombre='El ingreso',
        veredicto='La pantalla más limpia de las cuatro. Tres detalles, ninguno estructural.',
        hall=[
            ('m', 'El label del botón primario no llega al mínimo',
             '<span class="dato">4,20:1</span> sobre el fill del botón — al filo, pero abajo. Conviene confirmarlo '
             'contra el token real antes de tocarlo.',
             '<b>WCAG 1.4.3</b>', 50, 66),
            ('n', 'El símbolo no es el monograma acordado',
             'Un squircle terracota con un signo de ondas. El monograma cerrado es <strong>la O real del wordmark '
             'con las ondas afuera</strong>. Dos signos parecidos conviviendo debilitan a los dos.',
             'Chaves — constancia del signo identificador', 50, 23),
            ('n', '«tu copiloto de negocio» vs «tu copiloto emprendedor»',
             'El handoff de marca fija el segundo. Elegir uno y usarlo en todos lados.',
             '', 50, 37),
            ('ok', 'Jerarquía correcta y sin ruido',
             'Dos métodos, uno primario lleno y uno secundario delineado, separados por un divisor con «o». '
             'Nada que sacar.',
             '', None, None),
        ]),
]


def render_lamina(l, img_uri):
    pines, tarjetas = [], []
    for i, (sev, tit, cuerpo, fund, px, py) in enumerate(l['hall'], 1):
        etq = '&#10003;' if sev == 'ok' else str(i)
        if px is not None:
            pines.append(
                f'<i class="mk {sev} pin" style="left:{px}%;top:{py}%">{etq}</i>')
        fund_html = f'<p class="fund">{fund}</p>' if fund else ''
        tarjetas.append(
            f'<div class="h {sev}"><i class="mk {sev}">{etq}</i><div>'
            f'<h3>{tit}</h3><p>{cuerpo}</p>{fund_html}</div></div>')
    return f'''
<section class="lamina">
  <div class="wrap">
    <div class="lamina-head">
      <div class="eyebrow">Pantalla {l['n']}</div>
      <h2>{l['nombre']}</h2>
      <p class="veredicto">{l['veredicto']}</p>
    </div>
    <div class="split">
      <div class="frame">
        <img src="{img_uri}" alt="Captura: {l['nombre']}">
        {''.join(pines)}
      </div>
      <div class="hallazgos">
        {''.join(tarjetas)}
      </div>
    </div>
  </div>
</section>'''


def main():
    plantilla = open(os.path.join(RAIZ, 'lamina.template.html'), encoding='utf-8').read()
    cuerpo = ''.join(render_lamina(l, datauri(os.path.join(CAPS, l['img']), 'image/jpeg'))
                     for l in LAMINAS)
    html = (plantilla
            .replace('__FONT__', datauri(FUENTE, 'font/ttf'))
            .replace('__LAMINAS__', cuerpo))
    # Los tres frames de la propuesta salen del mockup 10 (`mockups/10-arranque/`),
    # recortados limpios —sin la capa de anotación— para que se lean como producto
    # al lado de las capturas de David, no como una lámina anotada más.
    # Los tres de la voz contextual salen de `deck-assets/frames/` (los que genera
    # `frames.py`), sólo reducidos: son frames limpios por construcción, así que no
    # hay que recortarlos a mano como los de la propuesta.
    for marca, archivo in (('__IMG_P1__', '05-prop-midia.png'),
                           ('__IMG_P2__', '06-prop-chat.png'),
                           ('__IMG_P3__', '07-prop-escritorio.png'),
                           ('__IMG_V1__', '08-voz-lane1.png'),
                           ('__IMG_V2__', '08-voz-lane2.png'),
                           ('__IMG_V3__', '08-voz-lane3.png')):
        html = html.replace(marca, datauri(os.path.join(CAPS, archivo), 'image/png'))
    salida = os.path.join(RAIZ, 'index.html')
    with open(salida, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'OK  {salida}  ({os.path.getsize(salida)/1024:.0f} KB)')
    # Gate por peso: si sale mucho mas liviano que las capturas, algo no se embebio.
    minimo = sum(os.path.getsize(os.path.join(CAPS, l['img'])) for l in LAMINAS)
    if os.path.getsize(salida) < minimo:
        raise SystemExit('ERROR: el HTML pesa menos que las capturas — no se embebieron')


if __name__ == '__main__':
    main()
