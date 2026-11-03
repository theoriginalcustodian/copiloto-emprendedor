import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

/**
 * SM-N27 — el control durable de la CLASE, no del botón.
 *
 * El fix de la puerta (`empujarUnaVez.ts`) FALLA ABIERTO: una pantalla que es destino Y lanzadora y
 * llama `reabrirNavegacion()` sin su ruta vuelve a reabrir la puerta al LLEGAR, y el doble toque
 * apila otra copia sin que ningún test se ponga rojo. Este test enumera, sobre el código real, a
 * todos los que llaman `reabrirNavegacion` y exige que cada uno pase su ruta; y que quien además
 * lanza con `empujarUnaVez` declare `desde`. Agregar un destino-lanzador sin el argumento lo pone rojo.
 */
const RAIZ = join(__dirname, '..', '..');
const RAIZ_APP = join(RAIZ, 'app');

/** Llaman `reabrirNavegacion()` SIN ruta a propósito. Cada entrada lleva su motivo y se verifica viva. */
const SIN_RUTA_A_PROPOSITO: Record<string, string> = {
  'src/shell/PantallaPrincipal.tsx':
    'el escritorio es el lanzador raíz: nunca es el destino que cierra la puerta, siempre es un regreso',
  'src/modules/soporte/PantallaSoporte.tsx':
    'reabre deliberadamente por un toque del usuario dentro de la pantalla (abrirTicket), acotado a su lanzamiento',
};

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : archivos(p);
    return /\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [p] : [];
  });
}

/** Código sin comentarios: un docstring que NOMBRA la función no es una llamada. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Argumentos (texto crudo) de cada llamada `nombre(...)`, con paréntesis balanceados. */
function llamadas(src: string, nombre: string): string[] {
  const salida: string[] = [];
  const re = new RegExp(`\\b${nombre}\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length;
    let prof = 1;
    const ini = i;
    while (i < src.length && prof > 0) {
      if (src[i] === '(') prof += 1;
      else if (src[i] === ')') prof -= 1;
      i += 1;
    }
    salida.push(src.slice(ini, i - 1).trim());
  }
  return salida;
}

/** Separa por comas de nivel 0 (fuera de paréntesis, llaves y corchetes). */
function argumentosDeNivel0(a: string): string[] {
  const partes: string[] = [];
  let prof = 0;
  let ini = 0;
  for (let i = 0; i < a.length; i += 1) {
    const c = a[i];
    if (c === '(' || c === '{' || c === '[') prof += 1;
    else if (c === ')' || c === '}' || c === ']') prof -= 1;
    else if (c === ',' && prof === 0) {
      partes.push(a.slice(ini, i).trim());
      ini = i + 1;
    }
  }
  partes.push(a.slice(ini).trim());
  return partes.filter((x) => x !== '');
}

const rel = (p: string) => relative(RAIZ, p).split('\\').join('/');
const DEFINICION = 'src/navegacion/empujarUnaVez.ts';

const fuentes = [...archivos(RAIZ_APP), ...archivos(join(RAIZ, 'src'))]
  .map((p) => ({ ruta: rel(p), codigo: sinComentarios(readFileSync(p, 'utf8')) }))
  .filter((f) => f.ruta !== DEFINICION);

const conReabrir = fuentes.filter((f) => llamadas(f.codigo, 'reabrirNavegacion').length > 0);

describe('SM-N27 — todo destino-lanzador pasa su ruta a la puerta', () => {
  it('control de ceguera: el enumerador ve a los llamadores conocidos', () => {
    const rutas = conReabrir.map((f) => f.ruta);
    expect(rutas).toEqual(expect.arrayContaining(['app/ajustes.tsx', 'app/midia.tsx', 'src/shell/PantallaPrincipal.tsx']));
    expect(conReabrir.length).toBeGreaterThanOrEqual(9);
  });

  it('cada llamada sin ruta está en la lista de excepciones con motivo', () => {
    const infractores = conReabrir
      .filter((f) => llamadas(f.codigo, 'reabrirNavegacion').some((a) => a === ''))
      .map((f) => f.ruta)
      .filter((r) => !(r in SIN_RUTA_A_PROPOSITO));
    expect(infractores).toEqual([]);
  });

  it('las excepciones siguen vigentes (una excepción obsoleta se quita)', () => {
    for (const ruta of Object.keys(SIN_RUTA_A_PROPOSITO)) {
      const f = conReabrir.find((x) => x.ruta === ruta);
      expect({ ruta, vigente: f !== undefined && llamadas(f.codigo, 'reabrirNavegacion').some((a) => a === '') }).toEqual({
        ruta,
        vigente: true,
      });
    }
  });

  it('la ruta que se pasa es una literal que existe como pantalla en app/', () => {
    const malas: string[] = [];
    for (const f of conReabrir) {
      for (const a of llamadas(f.codigo, 'reabrirNavegacion').filter((x) => x !== '')) {
        const m = /^'(\/[a-z0-9-]+)'$/.exec(a);
        if (m === null || !existsSync(join(RAIZ_APP, `${m[1]!.slice(1)}.tsx`))) malas.push(`${f.ruta}: ${a}`);
      }
    }
    expect(malas).toEqual([]);
  });

  it('quien reabre con su ruta y además lanza con empujarUnaVez declara `desde` igual a esa ruta', () => {
    const malas: string[] = [];
    for (const f of conReabrir) {
      const propias = llamadas(f.codigo, 'reabrirNavegacion').filter((x) => x !== '');
      if (propias.length === 0) continue;
      for (const a of llamadas(f.codigo, 'empujarUnaVez')) {
        const partes = argumentosDeNivel0(a);
        if (partes[partes.length - 1] !== propias[0]) malas.push(`${f.ruta}: empujarUnaVez(${a})`);
      }
    }
    expect(malas).toEqual([]);
  });
});
