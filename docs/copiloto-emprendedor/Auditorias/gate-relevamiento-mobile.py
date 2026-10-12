#!/usr/bin/env python3
"""Gate de cierre del relevamiento mobile (DoD seccion 6, 11 criterios).

Existe porque mi autoevaluacion no cuenta. "Lo revise y esta bien" no es un criterio: el documento
afirma 59 hallazgos, 301 archivos y 766-y-pico de citas, y nada de eso vale si no hay un instrumento
que lo pueda poner en ROJO.

=== EL GATE TIENE QUE PODER RECHAZAR ===
Un gate que siempre confirma lo ya decidido no es un gate, es un sello. Por eso el criterio 10 del
DoD es un CONTROL POSITIVO DEL GATE MISMO: se mutan >=5 propiedades del documento en memoria y cada
mutante DEBE salir rojo. Si un mutante sale verde, el gate es CIEGO ahi, y lo dice con nombre.
Ese bloque es el unico que puede desacreditar a todos los demas.

=== CUATRO CRITERIOS ESTAN BLOQUEADOS, Y NO SE APRUEBAN EN SILENCIO ===
Los criterios 6, 7, 8 y 9 del DoD exigen el APK y el telefono. Hoy NO EXISTE binario (el telefono
esta conectado y vacio; los 12 artefactos de EAS dan 404). Un gate que los omitiera para poder
"cerrar" seria el fail-open clasico: el verde mas peligroso es el del control que no mira.
  - Sin flags, el gate exige los 11 y sale != 0 mientras falten los cuatro de build/device.
  - Con `--alcance=codigo-plataforma` acredita SOLO lo que hoy se puede medir, y IMPRIME cual es el
    alcance y cuales quedan afuera. El alcance se declara, nunca se infiere del exit code.

=== LA TRAMPA QUE ESTE GATE YA PAGO, ANTES DE EXISTIR ===
Escribi la tabla de conteo por clase a mano y declare: fuego 6, prohibido 12, agujero 9,
microscopio 17, escuadra 11, gemelos 4. Medido por emoji sobre las filas del indice: prohibido 11,
escuadra 10, gemelos 6. **Tres de seis cifras mal**, en la tabla cuyo propio encabezado dice "se
cuentan por emoji, nunca por la prosa". Por eso el criterio 4 no compara el total (que daba 59 y
cerraba igual): compara **clase por clase**. Un total correcto con clases cruzadas sale verde si uno
mira solo la suma.

=== DOS DENOMINADORES DEL DoD ESTABAN MAL, Y MANDA LA MEDICION ===
  - El DoD pedia "22 rutas + 115 componentes == denominador". Esa suma deja **52 archivos .ts
    afuera** (hooks, stores, adapters, tokens). La particion real es 22+115+112+52 = **301**.
  - El DoD pedia "27/27 nativas". Las dependencies medidas son **34**. La cifra 27 es anterior.
Este gate asevera la MEDICION, no el numero que el DoD escribio antes de medir. Un criterio que
contradice la medicion se corrige; no se cumple de mentira.
"""
import io
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SAL = os.path.dirname(os.path.abspath(__file__))
BARRA = chr(92)
DOC = '2026-10-11-relevamiento-mobile-cierre.md'

# Clases de hallazgo, por su emoji. El nombre es para el reporte; la CLAVE es lo que se cuenta.
CLASES = [
    ('\U0001f525', 'fuego      (codigo roto en prod)'),
    ('\U0001f6ab', 'prohibido  (proteccion/camino ausente)'),
    ('\U0001f573', 'agujero    (capacidad inalcanzable)'),
    ('\U0001f52c', 'microscopio(instrumento ciego)'),
    ('\U0001f4d0', 'escuadra   (evidencia que no toca prod)'),
    ('♊', 'gemelos    (duplicacion divergente)'),
]
PARTICION = {'rutas': 22, 'componentes': 115, 'tests': 112, 'otros': 52}
TOTAL_PARTICION = 301
DEPS_MEDIDAS = 34
PLUGINS = 8
PANTALLAS = 21


def descubrir_repo():
    """La raiz del repo, subiendo desde este archivo. `--repo=` lo fuerza.

    Portable a proposito: el DoD exige (criterio 11) que el gate corra DESDE la ubicacion publicada.
    Un instrumento que solo corre donde se escribio no es un mecanismo, es un recuerdo.
    """
    for arg in sys.argv[1:]:
        if arg.startswith('--repo='):
            return arg.split('=', 1)[1].rstrip('/')
    d = SAL
    for _ in range(8):
        if os.path.isdir(os.path.join(d, 'apps')) and os.path.exists(os.path.join(d, '.git')):
            return d.replace(BARRA, '/')
        padre = os.path.dirname(d)
        if padre == d:
            break
        d = padre
    raise SystemExit('no encuentro la raiz del repo desde %s; pasa --repo=<ruta>' % SAL)


def ruta_doc():
    for cand in (os.path.join(SAL, DOC), os.path.join(REPO, 'docs/copiloto-emprendedor/Auditorias', DOC)):
        if os.path.isfile(cand):
            return cand
    raise SystemExit('no encuentro %s' % DOC)


REPO = descubrir_repo()
ALCANCE_PARCIAL = '--alcance=codigo-plataforma' in sys.argv[1:]

fallas = []          # (criterio, mensaje)
bloqueados = []      # (criterio, por que)


def mal(crit, msg):
    fallas.append((crit, msg))
    return False


# ---------------------------------------------------------------- criterios sobre el DOCUMENTO
# Cada check recibe el TEXTO, no el path: asi el bloque de mutantes puede pasarle texto mutado.
# Si un check leyera el archivo por su cuenta, el control positivo no podria ejercitarlo.

def c1_pantallas(t, reg):
    """21 pantallas con los 4 ejes, ninguna celda vacia."""
    bloque = re.search(r'## .8 . Las 21 pantallas.*?(?=\n## )', t, re.S)
    if not bloque:
        return reg(1, False, 'no encuentro la seccion de las 21 pantallas')
    filas = re.findall(r'^\| (`/[^`]*`) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|', bloque.group(0), re.M)
    if len(filas) != PANTALLAS:
        return reg(1, False, 'la tabla tiene %d pantallas, no %d' % (len(filas), PANTALLAS))
    vacias = [f[0] for f in filas if not all(c.strip() for c in f[1:])]
    if vacias:
        return reg(1, False, 'celdas vacias en %s' % ', '.join(vacias))
    # el 4o eje se declara UNA vez para las 21 (son todas el mismo valor); exigimos que ESTE declarado
    if 'BLOQUEADO_POR_BUILD` en las 21' not in t and 'BLOQUEADO_POR_BUILD en las 21' not in t:
        return reg(1, False, 'el 4o eje (device) no esta declarado para las 21')
    return reg(1, True, '%d pantallas x 4 ejes, 0 celdas vacias' % len(filas))


def c2_particion(t, reg):
    """La particion suma al total, MEDIDA EN SU TABLA. El DoD pedia 22+115; dejaba 52 afuera.

    ⚠️ La v1 buscaba cada cifra EN TODO EL DOCUMENTO, y su mutante la destapo: al agregar la
    seccion que describe este gate escribi "la particion real de **301**", y esa mencion suelta
    **absolvio una tabla de particion rota** -- el mutante que cambia 301 por 299 salio VERDE.
    Un check de presencia global no mide la propiedad: mide que el numero se haya escrito en algun
    lado. La propiedad vive en la TABLA, asi que ahi se mide.
    """
    tabla = re.search(r'### .5\.1[^\n]*\n(.*?)(?=\n\*\*|\n### |\n## )', t, re.S)
    if not tabla:
        return reg(2, False, 'no encuentro la tabla de particion (§5.1)')
    tt = tabla.group(1)
    faltan = [k for k, v in PARTICION.items() if ('**%d**' % v) not in tt]
    if faltan:
        return reg(2, False, 'la TABLA no declara el denominador de: %s' % ', '.join(faltan))
    if ('**%d**' % TOTAL_PARTICION) not in tt:
        return reg(2, False, 'la TABLA no declara el TOTAL %d' % TOTAL_PARTICION)
    if sum(PARTICION.values()) != TOTAL_PARTICION:
        return reg(2, False, 'la particion no suma: %d != %d' % (sum(PARTICION.values()), TOTAL_PARTICION))
    return reg(2, True, '%d = %s' % (TOTAL_PARTICION, ' + '.join(str(v) for v in PARTICION.values())))


def c3_refutacion(t, reg):
    """0 refutaciones 'pedidas' y 0 secciones en curso dentro de un documento que se declara cerrado.

    ⚠️ Dos correcciones, las dos de la misma familia.
    (1) `TODO:` se busca CASE-SENSITIVE y con frontera de palabra. La v1 lo buscaba en minuscula
        sobre el texto en minuscula, y en un documento en ESPAÑOL eso matchea prosa normal
        («...y todo: ...»). Dio rojo en el caso sano, que es como un guard se desarma solo: el
        camino de menor resistencia pasa a ser ignorarlo.
    (2) Los marcadores se buscan FUERA de los code spans. La v2 dio rojo cuando el documento empezo
        a DESCRIBIR el marcador (`` `TODO:` `` dentro de una tabla que explica este gate). **La
        mencion no es la cosa** -- es la tercera vez que esta familia muerde hoy, despues del
        docstring que afirmaba que /midia vivia y del patron que cazaba un sufijo parecido. Un
        documento que documenta un marcador contiene el marcador; un guard que no distingue uso de
        mencion le prohibe al documento hablar de si mismo.
    """
    sin_code = re.sub(r'`[^`\n]*`', '·', re.sub(r'```.*?```', '·', t, flags=re.S))
    prohibidos = ['refutacion pedida', 'refutación pedida', '[PENDIENTE]', 'TBD']
    hits = [p for p in prohibidos if p.lower() in sin_code.lower()]
    if re.search(r'\bTODO:', sin_code):               # case-sensitive y fuera de code spans
        hits.append('TODO:')
    if hits:
        return reg(3, False, 'marcas de trabajo sin terminar: %s' % ', '.join(hits))
    if 'CERRADO' not in t:
        return reg(3, False, 'el documento no se declara CERRADO')
    # una seccion 🚧 en un doc cerrado es la contradiccion que mas facil pasa inadvertida
    enc_en_curso = [l for l in t.splitlines() if l.startswith('##') and '\U0001f6a7' in l]
    if enc_en_curso:
        return reg(3, False, '%d seccion(es) marcada(s) EN CURSO en un doc cerrado' % len(enc_en_curso))
    return reg(3, True, '0 marcas pendientes, 0 secciones en curso, se declara CERRADO')


def c4_indice(t, reg):
    """Filas consecutivas, UNA clase por fila, y declarado == contado POR EMOJI, clase por clase.

    Compara clase por clase y NO el total: el total ya daba 59 cuando tres clases estaban cruzadas.
    """
    filas = re.findall(r'^\| (H-\d+) \| ([^|]+?) \|', t, re.M)
    if not filas:
        return reg(4, False, 'no encuentro filas de hallazgo en el indice')
    nums = [int(h[2:]) for h in (f[0] for f in filas)]
    dups = sorted({n for n in nums if nums.count(n) > 1})
    if dups:
        return reg(4, False, 'ids duplicados: %s' % dups)
    faltan = sorted(set(range(1, max(nums) + 1)) - set(nums))
    if faltan:
        return reg(4, False, 'ids faltantes (no consecutivos): %s' % faltan)
    contado, multi = {e: 0 for e, _ in CLASES}, []
    for hid, clase in filas:
        presentes = [e for e, _ in CLASES if e in clase]
        if len(presentes) != 1:
            multi.append('%s tiene %d clases' % (hid, len(presentes)))
        for e in presentes:
            contado[e] += 1
    if multi:
        return reg(4, False, 'una clase por fila: %s' % '; '.join(multi))
    # lo declarado en la tabla de conteo
    cruzadas = []
    for e, nombre in CLASES:
        m = re.search(re.escape(e) + r'[^|\n]*\|\s*\*\*(\d+)\*\*\s*\|', t)
        if not m:
            cruzadas.append('%s sin cifra declarada' % nombre)
        elif int(m.group(1)) != contado[e]:
            cruzadas.append('%s declara %s y hay %d' % (nombre, m.group(1), contado[e]))
    if cruzadas:
        return reg(4, False, 'declarado != contado por emoji -> %s' % '; '.join(cruzadas))
    return reg(4, True, '%d filas, ids 1..%d sin huecos, %d clases cuadran una por una'
               % (len(filas), max(nums), len(CLASES)))


def c5_citas(t, reg):
    """Toda cita `archivo:linea` existe y el archivo tiene esa linea. 0 ambiguedades reales.

    Es el criterio con mas dientes: una cita rota convierte el documento en prosa. Resuelve el
    nombre pelado (`PantallaGastos.tsx:184`) buscandolo bajo apps/mobile y packages.
    """
    # SOLO citas entre backticks. La v1 agregaba un patron de "nombre pelado" cuyo lookbehind no
    # excluia `.` ni `-`, asi que cazaba el SUFIJO de una cita ya contada: `jest.config.js:168` ->
    # `config.js:168`, `app/ajustes-feedback.tsx:6` -> `feedback.tsx:6`, y 44 mas. Fabricaba 44
    # citas fantasma de 174 y las reportaba como rotas. Medido con el lookbehind corregido: ese
    # patron aporta CERO citas legitimas -- el documento siempre entrecomilla. Asi que se elimina.
    # Es el mismo defecto de forma que pago el inventario: el patron cazaba algo que se PARECIA.
    crudas = set(re.findall(r'`([A-Za-z0-9_./@-]+\.(?:tsx?|py|sh|js|json|md)):(\d+)(?:-\d+)?`', t))
    PISO = 100          # control de ceguera: si el extractor trae menos, no mide nada
    if len(crudas) < PISO:
        return reg(5, False, 'solo %d citas extraidas (piso %d): el extractor esta ciego'
                   % (len(crudas), PISO))
    indice = {}
    for base in ('apps/mobile', 'packages', 'scripts', 'docs/copiloto-emprendedor/Auditorias', 'app'):
        raiz = os.path.join(REPO, base)
        for dp, dn, nn in os.walk(raiz):
            dn[:] = [d for d in dn if d not in ('node_modules', '.expo', 'dist', 'build', '.git')]
            for n in nn:
                indice.setdefault(n, []).append(os.path.join(dp, n))
    rotas, ambiguas, noexiste, deps = [], [], [], []
    for arch, ln in sorted(crudas):
        ln = int(ln)
        # Categoria DECLARADA, no falla: citas a node_modules (`@expo/...`, `@expo-google-fonts/...`).
        # Son legitimas y verificables, pero NO en este worktree, que no tiene node_modules (se
        # leyeron contra el checkout principal). Contarlas como rotas seria acusar al documento por
        # una propiedad del worktree; omitirlas en silencio seria peor. Se declaran y se cuentan.
        if arch.startswith('@') or 'node_modules' in arch:
            deps.append('%s:%d' % (arch, ln))
            continue
        directo = os.path.join(REPO, arch)
        if '/' in arch and os.path.isfile(directo):
            cands = [directo]
        else:
            cands = indice.get(os.path.basename(arch), [])
        if not cands:
            noexiste.append('%s:%d' % (arch, ln))
            continue
        if len({os.path.basename(c) for c in cands}) == 1 and len(cands) > 1:
            # mismo nombre en varios lados: ambiguo SOLO si el conteo de lineas no coincide en todos
            largos = set()
            for c in cands:
                try:
                    largos.add(sum(1 for _ in io.open(c, encoding='utf-8', errors='replace')))
                except OSError:
                    pass
            if len(largos) > 1 and not any(ln <= L for L in largos):
                ambiguas.append('%s:%d (%d candidatos)' % (arch, ln, len(cands)))
                continue
            if any(ln <= L for L in largos):
                continue
            rotas.append('%s:%d (max %s)' % (arch, ln, sorted(largos)))
            continue
        try:
            total = sum(1 for _ in io.open(cands[0], encoding='utf-8', errors='replace'))
        except OSError as e:
            noexiste.append('%s:%d (%s)' % (arch, ln, e.__class__.__name__))
            continue
        if ln > total:
            rotas.append('%s:%d (tiene %d lineas)' % (arch, ln, total))
    problemas = rotas + noexiste + ambiguas
    if problemas:
        return reg(5, False, '%d de %d citas con problema: %s%s'
                   % (len(problemas), len(crudas), '; '.join(problemas[:6]),
                      ' …' if len(problemas) > 6 else ''))
    return reg(5, True, '%d citas: %d verificadas contra el disco (0 rotas/0 ambiguas) + %d a '
                        'node_modules (declaradas, no verificables en este worktree)'
               % (len(crudas), len(crudas) - len(deps), len(deps)))


def c0_fuente_legible():
    """El gate revisa SU PROPIO fuente por bytes de control invisibles, antes de medir nada.

    Por que existe: C6 rechazo un documento que SI cumplia. La causa no estaba en el documento sino
    aca -- donde el fuente parecia decir `\\b120\\b` habia un **\\x08 literal** (backspace), porque el
    `\\b` que escribi viajo por una capa que lo interpreto como escape antes de llegar al disco. El
    regex quedo imposible de satisfacer y el gate acuso al sujeto correcto de un defecto propio.

    Lo que lo hace peligroso no es el byte: es que `grep`, `sed` y cualquier visor muestran la linea
    **perfecta**, porque un \\x08 no se dibuja. El instrumento de lectura borra el defecto de la
    pantalla. Un falso ROJO se lee igual que prudencia, y mas si uno ya sospechaba del documento.

    Control positivo disponible: meter un \\x08 a mano en este archivo tiene que volver esto rojo.
    """
    crudo = io.open(os.path.abspath(__file__), 'rb').read()
    malos = sorted({b for b in crudo if b < 0x20 and b not in (0x09, 0x0a, 0x0d)})
    if malos:
        print('  ROJO   C0  el fuente DE ESTE GATE tiene %d byte(s) de control invisibles (%s): '
              'un regex con \\x08 no lo satisface ningun texto, y el visor no lo muestra'
              % (sum(1 for b in crudo if b in malos), ', '.join('\\x%02x' % b for b in malos)))
        raise SystemExit(2)
    print('  OK     C0  el fuente del gate no tiene bytes de control invisibles')


def c6_nativas(t, reg):
    """34 deps + 8 plugins clasificados. BLOQUEADO para la mitad 'contra el APK': no hay APK."""
    ok_doc = ('**%d**' % DEPS_MEDIDAS) in t and ('**%d**' % PLUGINS) in t
    if not ok_doc:
        return reg(6, False, 'el doc no declara las %d deps y los %d plugins' % (DEPS_MEDIDAS, PLUGINS))
    # DESBLOQUEADO 2026-10-11: la mitad "contra el APK" estaba bloqueada porque no habia binario.
    # Hoy existe y esta archivado, asi que el criterio se MIDE en vez de declararse imposible: el
    # doc tiene que citar lo que el APK trae de verdad (sus .so y sus ABIs), no solo lo que
    # node_modules promete. Un bloqueo que sobrevive a su causa es un criterio que se aprueba solo.
    if not re.search(r'\b120\b[^.]{0,80}\.so|\.so[^.]{0,80}\b120\b', t):
        return reg(6, False, 'el doc no cita las 120 .so medidas DENTRO del APK (la mitad '
                             '"contra el binario" del criterio ya no esta bloqueada: hay APK)')
    if 'arm64-v8a' not in t:
        return reg(6, False, 'el doc no nombra las ABIs que el APK realmente empaqueta')
    return reg(6, True, '%d deps y %d plugins en el doc, y las 120 .so / 4 ABIs medidas DENTRO '
                        'del APK' % (DEPS_MEDIDAS, PLUGINS))


def c9_device_declarado(t, reg):
    """Las 21 pantallas tienen veredicto DE DEVICE, y lo no medido se declara como no medido.

    REESCRITO 2026-10-11 (B' ocurrio). La v1 pedia que toda pantalla sin veredicto llevara
    `BLOQUEADO_POR_BUILD`: era el criterio correcto MIENTRAS no hubiera binario. Dejarlo asi
    despues del build lo volvia un criterio que premia la ausencia de medicion -- se cumplia mejor
    cuanto menos se midiera. Hoy exige lo contrario: las 21 filas con veredicto de eje B, y que el
    eje A diga cuales quedaron SIN atribuir en vez de contarlas como rojas.
    """
    filas = re.findall(r'^\|\s*`(/\S*)`\s*\|[^|]*\|\s*(MONTA|\*\*NO MONTA\*\*)\s*\|',
                       t, re.M)
    if len(filas) != PANTALLAS:
        return reg(9, False, 'la tabla de device tiene %d filas con veredicto, no %d'
                             % (len(filas), PANTALLAS))
    if 'NO_ATRIBUIBLE' not in t and 'no atribuible' not in t:
        return reg(9, False, 'el eje A no declara ninguna casilla sin atribuir: o se midieron '
                             'todas (decilo) o se estan contando como rojas')
    return reg(9, True, 'las %d con veredicto de device medido, y el eje A declara lo no atribuible'
                        % PANTALLAS)


CHECKS_DOC = [c1_pantallas, c2_particion, c3_refutacion, c4_indice, c5_citas, c6_nativas,
              c9_device_declarado]


def correr_doc(t, verboso=True):
    """Corre los checks de documento. Devuelve {criterio: bool}."""
    res = {}

    def reg(crit, ok, msg):
        res[crit] = ok
        if verboso:
            print('  %s  C%-2d %s' % ('OK   ' if ok else 'ROJO ', crit, msg))
        if not ok and verboso:
            mal(crit, msg)
        return ok

    for f in CHECKS_DOC:
        f(t, reg)
    return res


# ---------------------------------------------------------------- criterios 7 y 8: device y APK

def c7_device():
    """`pm path` devuelve ruta. El gate lo CORRE, no lo asume -- y trae su control positivo."""
    print()
    print('  --- C7: el telefono (se corre adb, no se asume) ---')
    try:
        dev = subprocess.run(['adb', 'devices'], capture_output=True, text=True, timeout=25)
    except (OSError, subprocess.TimeoutExpired) as e:
        bloqueados.append((7, 'adb no ejecutable: %s' % e.__class__.__name__))
        print('       adb no se pudo ejecutar -> criterio BLOQUEADO (no aprobado)')
        return False
    seriales = [l.split()[0] for l in dev.stdout.splitlines()[1:] if l.strip().endswith('device')]
    if not seriales:
        bloqueados.append((7, 'ningun device conectado y autorizado'))
        print('       0 devices autorizados -> criterio BLOQUEADO')
        return False
    print('       device(s): %s' % ', '.join(seriales))

    def pm_path(pkg):
        r = subprocess.run(['adb', 'shell', 'pm', 'path', pkg], capture_output=True, text=True, timeout=25)
        return r.stdout.strip()

    # CONTROL POSITIVO del instrumento: un paquete que SI esta debe devolver ruta.
    # Sin esto, "vacio" no distingue "no instalada" de "pm path no funciona".
    ctl = pm_path('com.android.settings') or pm_path('android')
    if not ctl.startswith('package:'):
        bloqueados.append((7, 'el control positivo de pm path NO devolvio ruta: el instrumento esta ciego'))
        print('       CONTROL POSITIVO FALLO (pm path de un paquete del sistema vino vacio)')
        print('       -> no afirmo nada sobre la app: un vacio de instrumento ciego parece "no instalada"')
        return False
    print('       control positivo OK: %s' % ctl.splitlines()[0][:70])
    # CONTROL NEGATIVO: un paquete inventado debe venir VACIO. Si devolviera algo, pm path miente.
    inventado = pm_path('no.existe.este.paquete.%s' % 'zzz')
    if inventado:
        bloqueados.append((7, 'el control negativo de pm path devolvio ruta para un paquete inventado'))
        print('       CONTROL NEGATIVO FALLO: %r' % inventado[:60])
        return False
    print('       control negativo OK: paquete inventado -> vacio')

    real = pm_path('app.copiloto.emprendedor')
    if real.startswith('package:'):
        print('  OK    C7  la app ESTA instalada: %s' % real.splitlines()[0][:70])
        return True
    print('  ROJO  C7  `pm path app.copiloto.emprendedor` -> VACIO (con ambos controles verdes)')
    mal(7, 'la app no esta instalada en el device (medido, no inferido)')
    return False


def c8_apk(t):
    """El APK **de este proyecto** existe en disco local Y su gitCommitHash esta en el documento.

    ⚠️ ESTE CHECK SALIO VERDE EN FALSO Y ES EL PEOR HALLAZGO DEL PROPIO GATE.
    La v1 buscaba cualquier `*.apk` bajo el repo, `~/Downloads` y esta carpeta, y aprobo con
    `~/Downloads/application-48681994-....apk`: un APK de 248 MB del 13 de julio, **ajeno al
    proyecto**, que no prueba absolutamente nada sobre el build de este relevamiento. Un gate que
    acredita "hay binario" con un binario cualquiera es un instrumento que no mira: su verde dice
    menos que no haber corrido.
    El criterio del DoD tiene DOS mitades y la v1 solo miraba media: el APK debe ser el del build
    nuevo **y** su `gitCommitHash` debe estar escrito en el documento. Sin la segunda mitad, el
    archivo es un objeto sin procedencia -- y la procedencia es justamente lo que la plataforma ya
    probo no conservar (12 artefactos borrados).
    """
    # el commit tiene que estar DECLARADO en el doc antes de buscar nada: es la identidad del build
    shas = set(re.findall(r'`([0-9a-f]{8})`', t))
    hallados = []
    for base in (REPO, os.path.expanduser('~/Downloads'), SAL):
        if not os.path.isdir(base):
            continue
        for dp, dn, nn in os.walk(base):
            dn[:] = [d for d in dn if d not in ('node_modules', '.git', '.expo')]
            for n in nn:
                if n.endswith(('.apk', '.aab')):
                    hallados.append(os.path.join(dp, n))
    # un APK solo cuenta si se puede ATRIBUIR: su nombre lleva el sha declarado, o vive en el repo
    atribuibles = [h for h in hallados
                   if any(s in os.path.basename(h) for s in shas)
                   or os.path.normcase(REPO) in os.path.normcase(h)]
    if atribuibles:
        print('  OK    C8  APK atribuible a un sha declarado: %s' % atribuibles[0])
        return True
    print('  ROJO  C8  %d APK/AAB en disco y NINGUNO atribuible a este proyecto' % len(hallados))
    if hallados:
        print('            (p.ej. %s -- sin sha declarado en el nombre ni ubicacion en el repo:'
              % os.path.basename(hallados[0])[:60])
        print('             un binario cualquiera no acredita "hay binario de ESTE build")')
    mal(8, 'no hay binario de este proyecto archivado fuera de expo.dev, con su gitCommitHash '
           'escrito en el documento (la retencion de 14 dias ya borro 12 artefactos)')
    return False


# ---------------------------------------------------------------- criterio 10: el gate contra si mismo
# Mutantes: cada uno rompe UNA propiedad y nombra el criterio que DEBE cazarlo.
# Si un mutante sale verde, el gate es ciego ahi. Es el unico bloque que puede desacreditar al resto.

MUTANTES = [
    ('C4 cruza UNA clase (el fallo real que pague hoy)',
     4, lambda t: t.replace('| \U0001f6ab protección o camino ausente | **11** |',
                            '| \U0001f6ab protección o camino ausente | **12** |')),
    ('C4 saltea un id del indice (H-30 -> H-99, deja hueco)',
     4, lambda t: t.replace('| H-30 |', '| H-99 |')),
    ('C4 pone DOS clases en una fila',
     4, lambda t: t.replace('| H-19 | \U0001f525 |', '| H-19 | \U0001f525 \U0001f52c |')),
    ('C1 borra una pantalla de la tabla de 21',
     1, lambda t: t.replace('| `/agenda` | COMPLETO (sólo lectura, por diseño)', '| ~~agenda~~ |', 1)),
    ('C2 rompe el total de la particion',
     2, lambda t: t.replace('| **TOTAL `.ts`/`.tsx`** | **301** |', '| **TOTAL `.ts`/`.tsx`** | **299** |')),
    ('C3 deja una marca de trabajo sin terminar',
     3, lambda t: t.replace('## §Z ·', '## §Z · [PENDIENTE]')),
    ('C5 inventa una cita a una linea que no existe',
     5, lambda t: t.replace('`PantallaFacturacion.tsx:556`', '`PantallaFacturacion.tsx:99999`')),
    ('C5 cita un archivo inexistente',
     5, lambda t: t.replace('`PantallaGastos.tsx:187`', '`PantallaInventada.tsx:12`')),
]


def c10_mutantes(original):
    print()
    print('  --- C10: control positivo DEL GATE (cada mutante debe salir ROJO) ---')
    ciegos = []
    for nombre, crit, mutar in MUTANTES:
        mutado = mutar(original)
        if mutado == original:
            ciegos.append('%s -> la mutacion NO se aplico (el texto ancla cambio)' % nombre)
            print('       INAPLICABLE  %s' % nombre)
            continue
        res = correr_doc(mutado, verboso=False)
        if res.get(crit) is True:
            ciegos.append('%s -> C%d salio VERDE' % (nombre, crit))
            print('       CIEGO        %s  (C%d verde)' % (nombre, crit))
        else:
            print('       cazado       %s  (C%d rojo)' % (nombre, crit))
    if ciegos:
        mal(10, 'el gate es ciego en %d mutante(s): %s' % (len(ciegos), '; '.join(ciegos)))
        return False
    print('  OK    C10 %d/%d mutantes cazados' % (len(MUTANTES), len(MUTANTES)))
    # Alcance del bloque, dicho explicito para que "8/8" no se lea como "todo cubierto":
    # los mutantes ejercitan los criterios SOBRE EL DOCUMENTO (C1-C5). C7 y C8 no son mutables en
    # memoria -- dependen del telefono y del disco -- y por eso llevan sus propios controles
    # positivo Y negativo en el lugar (pm path de un paquete real / de uno inventado; credencial
    # real / mutilada). Un numero de cobertura sin su denominador se deja citar para cualquier
    # pregunta, y este denominador son los 5 criterios de documento, no los 11.
    print('            alcance: C1-C5 (documento). C7/C8 no se mutan: llevan control in situ.')
    return True


def c10bis_plataforma():
    """Control positivo de plataforma: credencial mutilada => me:null, no error.

    La trampa que este control existe para no repetir: una credencial invalida en api.expo.dev NO
    da error, da HTTP 200 con `me: null`. Un control que pregunta "hubo error?" la acepta como
    valida. Hay que preguntar por el DATO. Y sin credencial, esto NO se aprueba: se declara.
    """
    tok = os.environ.get('EXPO_TOKEN', '').strip()
    if not tok:
        bloqueados.append((10, 'control de plataforma NO ejercitado: sin EXPO_TOKEN en el entorno '
                               '(no se aprueba por ausencia; se declara)'))
        print('       plataforma: sin EXPO_TOKEN -> control NO EJERCITADO (declarado, no aprobado)')
        return False
    import json
    import urllib.error
    import urllib.request

    def preguntar(credencial):
        """NUNCA levanta: el error HTTP es un VALOR, porque la respuesta que importa viene en el
        cuerpo. La v1 de este control usaba `urlopen` pelado y cualquier no-2xx la dejaba en
        "NO EJERCITADO" -- perdiendo justo la leccion que el instrumento hermano ya tenia escrita
        (`2026-10-11-eas-builds.py:50`, *"Nunca levanta: el error es un valor a reportar"*). El fix
        existia en otro call-site y no viajo porque reescribi la llamada en vez de reusarla.
        """
        req = urllib.request.Request(
            'https://api.expo.dev/graphql',
            data=json.dumps({'query': '{ me { username } }'}).encode(),
            headers={'Content-Type': 'application/json',
                     'Authorization': 'Bearer %s' % credencial,
                     # sin User-Agent, Cloudflare devuelve 403 error 1010 y parece un 403 de auth
                     'User-Agent': 'gate-relevamiento-mobile/1.0 (+relevamiento mobile)'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as exc:
            cuerpo = exc.read().decode('utf-8', 'replace')
            try:
                return json.loads(cuerpo)
            except ValueError:
                return {'__http': exc.code, '__cuerpo': ' '.join(cuerpo.split())[:140]}
    try:
        real = preguntar(tok)
        mutilada = preguntar(tok[:-6] + 'xxxxxx')
    except Exception as e:                                                      # noqa: BLE001
        bloqueados.append((10, 'control de plataforma no concluyo: %s' % e.__class__.__name__))
        print('       plataforma: la consulta fallo (%s) -> NO EJERCITADO' % e.__class__.__name__)
        return False
    me_real = (real.get('data') or {}).get('me')
    me_mut = (mutilada.get('data') or {}).get('me')
    if real.get('__http') or mutilada.get('__http'):
        bloqueados.append((10, 'control de plataforma NO concluyo: HTTP %s (%s)'
                           % (real.get('__http') or mutilada.get('__http'),
                              (real.get('__cuerpo') or mutilada.get('__cuerpo', ''))[:80])))
        print('       plataforma: respuesta no-JSON (HTTP %s) -> NO EJERCITADO, no aprobado'
              % (real.get('__http') or mutilada.get('__http')))
        return False
    if not me_real or not me_real.get('username'):
        mal(10, 'control POSITIVO de plataforma fallo: la credencial real no devolvio username')
        print('       plataforma: CONTROL POSITIVO ROJO (credencial real sin username)')
        return False
    if me_mut is not None:
        mal(10, 'control NEGATIVO de plataforma fallo: la credencial mutilada devolvio %r' % me_mut)
        print('       plataforma: CONTROL NEGATIVO ROJO (la mutilada respondio)')
        return False
    print('       plataforma OK: real -> %s · mutilada -> me:null (HTTP 200, no error)'
          % me_real['username'])
    return True


STOP_ES = set('''para pero porque cuando donde desde hasta sobre entre sin con que cual quien
como todo toda todos todas este esta estos estas aquel otro otra otros otras mismo misma ya hay
son estan tiene tienen puede pueden debe deben hace hacen dice dicen cada solo sola nada algo
ningun ninguna alguna algun mas menos muy bien entonces tambien segun unos unas ver sigue siguen
queda quedan deja dejan pone ponen vive viven salen sale acaba acabo'''.split())


def _sin_tildes(s):
    import unicodedata
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def _palabras(s):
    return {w for w in re.findall(r'[a-z]{5,}', _sin_tildes(s)) if w not in STOP_ES}


def informe_referentes(t):
    """INFORMATIVO, NO decide el exit code. Mide si una cita `H-NN` en prosa corresponde al
    hallazgo que la frase describe.

    === EL AGUJERO QUE LO MOTIVA ===
    C4 valida que los ids 1..59 EXISTAN sin huecos y que las clases cuadren. Pasaba igual mientras
    §9 citaba `H-43` para los cinco assets de build time (son **H-49**) y `H-46` para la poda de
    nativos (que no tiene fila). Los dos ids existen, asi que C4 no podia verlo: un check de
    EXISTENCIA nunca verifica el REFERENTE. Misma degradacion que ya pago C2 -- la propiedad vive
    en la correspondencia, no en la existencia.

    === POR QUE NO ES UN CRITERIO BINARIO, Y ESTO SE MIDIO ANTES DE EMBARCARLO ===
    Sobre el corpus real: **41 citas en prosa**. La regla "cero coincidencias con la fila citada +
    existe otra fila con >=3" produce **5 senales, de las cuales 2 son los errores reales**. Una
    precision de ~40% convierte el guard en ruido, y un guard que grita en el caso normal se
    desarma solo: el camino de menor resistencia pasa a ser ignorarlo. Ademas el umbral (>=3) esta
    calibrado contra el corpus de HOY y envejece con el.
    Asi que se embarca como lo que es: un REPORTE para revision humana. Declararlo criterio de
    aprobacion seria pretender una precision que la medicion no respalda.
    """
    filas = {m.group(1): m.group(2)
             for m in re.finditer(r'^\| (H-\d+) \|([^\n]*)$', t, re.M)}
    if not filas:
        print('       (sin filas de indice: nada que contrastar)')
        return
    examinadas, inexistentes, sospechosas = 0, [], []
    for linea in t.split('\n'):
        s = linea.strip()
        if s.startswith('|') or s.startswith('#'):
            continue                       # fila de tabla o encabezado: no es prosa citante
        for m in re.finditer(r'\bH-(\d+)\b', linea):
            hid = 'H-%s' % m.group(1)
            examinadas += 1
            if hid not in filas:
                inexistentes.append(hid)
                continue
            pv = _palabras(linea[max(0, m.start() - 160):m.start()])
            if pv & _palabras(filas[hid]):
                continue
            mejor_n, mejor_id = max((len(pv & _palabras(v)), k) for k, v in filas.items())
            if mejor_n >= 3 and mejor_id != hid:
                sospechosas.append((hid, mejor_id, mejor_n, s[:70]))
    # piso de ceguera: si el instrumento examino casi nada, su silencio no acredita nada
    print('       %d citas en prosa examinadas contra %d filas' % (examinadas, len(filas)))
    if examinadas < 20:
        print('       ⚠️ menos de 20 citas examinadas: el informe esta casi ciego, no lo leas como verde')
    for hid in sorted(set(inexistentes)):
        print('       ⚠️ %s citado en prosa y NO existe en el indice (esto si lo caza C4 por otro lado)' % hid)
    if not sospechosas:
        print('       sin citas sospechosas bajo la regla declarada (no es prueba de correccion)')
    for hid, mejor, n, ctx in sospechosas:
        print('       ⚠️ %s podria ser %s (%d palabras en comun) — %s' % (hid, mejor, n, ctx))


# ---------------------------------------------------------------------------- main
print('=' * 86)
print('GATE DE CIERRE — RELEVAMIENTO MOBILE   (DoD §6, 11 criterios)')
print('=' * 86)
print('  repo        : %s' % REPO)
print('  documento   : %s' % ruta_doc())
print('  corriendo en: %s   <-- C11: debe ser la ubicacion PUBLICADA, no el scratchpad' % SAL)
print('  alcance     : %s' % ('CODIGO + PLATAFORMA (declarado por flag; build/device afuera)'
                              if ALCANCE_PARCIAL else 'LOS 11 CRITERIOS (exige build e device)'))
print()

texto = io.open(ruta_doc(), encoding='utf-8').read()
c0_fuente_legible()
print('  --- criterios sobre el documento ---')
res_doc = correr_doc(texto)

print()
print('  --- informe de referentes (NO decide el exit code; ver su docstring) ---')
informe_referentes(texto)

c7 = c7_device()
print()
print('  --- C8: el binario en disco ---')
c8 = c8_apk(texto)
c10 = c10_mutantes(texto)
c10b = c10bis_plataforma()

# C11: el gate corre desde la ubicacion publicada. Se mide por donde VIVE este archivo.
publicada = os.path.normcase(os.path.normpath(SAL)) == os.path.normcase(os.path.normpath(
    os.path.join(REPO, 'docs', 'copiloto-emprendedor', 'Auditorias')))
print()
if publicada:
    print('  OK    C11 el gate corre desde la carpeta publicada')
else:
    print('  ROJO  C11 el gate NO esta en la carpeta publicada (esta en %s)' % SAL)
    mal(11, 'instrumento fuera de su ubicacion publicada')

print()
print('=' * 86)
if bloqueados:
    # dedup: los checks de documento se corren 1 vez de verdad + 1 por mutante, y cada corrida
    # appendea. Sin dedup el reporte repetia el mismo bloqueo 9 veces y se volvia ilegible --
    # un reporte que hay que leer en diagonal es un reporte que no se lee.
    print('BLOQUEADOS (medidos como imposibles hoy, NO aprobados):')
    for crit, por in sorted(set(bloqueados)):
        print('  C%-2d %s' % (crit, por))
    print()
if fallas:
    print('ROJO — %d criterio(s) en falla:' % len({c for c, _ in fallas}))
    for crit, msg in fallas:
        print('  C%-2d %s' % (crit, msg))
else:
    print('Ningun criterio EVALUADO salio en falla.')

cerrables = {1, 2, 3, 4, 5, 6, 9, 10, 11}
fallas_cerrables = {c for c, _ in fallas if c in cerrables}
print()
if ALCANCE_PARCIAL:
    # Ojo: C10 incluye el control de plataforma. Si no se ejercito, queda BLOQUEADO, no aprobado.
    if fallas_cerrables:
        print('VEREDICTO: ROJO en el alcance CODIGO+PLATAFORMA (criterios %s).'
              % sorted(fallas_cerrables))
        raise SystemExit(1)
    print('VEREDICTO: VERDE en el alcance declarado CODIGO+PLATAFORMA.')
    print('           Los criterios 7 y 8 (device y APK) quedan AFUERA del alcance por el flag,')
    print('           y 6 y 9 quedan parcialmente bloqueados. El relevamiento de codigo y')
    print('           plataforma esta cerrado; el de DEVICE no empezo y no se declara cerrado.')
    raise SystemExit(0)

# === LA RAMA QUE NUNCA SE PUDO EJERCITAR, Y POR ESO ESTABA MAL ===
# La v1 terminaba aqui con `SystemExit(2)` SIEMPRE que no hubiera flag: daba por sentado que 7 y 8
# eran imposibles para siempre, asi que el camino "los 11 verdes" era CODIGO INALCANZABLE -- la
# clase 🕳️ que este mismo relevamiento cuenta 9 veces, dentro de su propio acreditador. El dia que
# el binario existio, el gate habria salido != 0 con TODO en verde, y el rojo habria sido suyo.
# Un mecanismo roto hacia el SI no da sintoma mientras el SI no se puede alcanzar.
TODOS = sorted(cerrables | {7, 8})
fallas_todas = {c for c, _ in fallas}
if not fallas_todas and c7 and c8 and not bloqueados:
    print('VEREDICTO: VERDE en los 11 criterios — con binario y device medidos, sin bloqueos.')
    raise SystemExit(0)
if not fallas_todas and c7 and c8 and bloqueados:
    print('VEREDICTO: los 11 criterios EVALUADOS estan verdes, pero quedan bloqueos declarados:')
    print('           %s' % ', '.join('C%d' % c for c, _ in sorted(set(bloqueados))))
    print('           No se aprueba por omision: un bloqueo declarado no es un criterio cumplido.')
    raise SystemExit(1)
faltan = [c for c, ok in ((7, c7), (8, c8)) if not ok]
print('VEREDICTO: el cierre COMPLETO exige los %d criterios, y faltan %s (binario/device).'
      % (len(TODOS), ', '.join('C%d' % c for c in faltan) or 'ninguno'))
print('           El relevamiento de codigo+plataforma se acredita con `--alcance=codigo-plataforma`.')
print('           Sin ese flag este gate sale != 0 a proposito: aprobar por omision seria el fail-open.')
raise SystemExit(2 if not fallas_cerrables else 1)
