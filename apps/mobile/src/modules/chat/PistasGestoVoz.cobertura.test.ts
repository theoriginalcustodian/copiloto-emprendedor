import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Jest (jest-expo) — `describe`/`it`/`expect` son globales.

/**
 * PISTAFIJARSOPORTE — toda pantalla que monta `<BotonVoz` monta también `<PistasGestoVoz`.
 *
 * Por qué por GLOB y no por nombre: «fijar» es un gesto de deslizar y mantener apretado, y la pista
 * del candado es la ALTERNATIVA que lo anuncia (WCAG 2.5.1). `PantallaSoporte` montaba el botón sin
 * la pista y ningún test lo notó, porque cada pantalla tenía su suite y ninguna preguntaba «¿falta
 * la pista?». Un test que enumera las pantallas por su nombre no ve a la que se agrega mañana; éste
 * enumera por lo que HACEN (montar el botón), así que la cuarta pantalla entra sola al control.
 *
 * Cuenta el montaje en JSX y descarta comentarios antes de buscar: un comentario que dice «acá va
 * `<PistasGestoVoz`» no es un montaje y satisfaría el control sin cumplirlo.
 */
const SRC = join(__dirname, '..', '..');
const ES_TEST = /\.test\.(web\.)?tsx?$/;

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) fuentes(p, acc);
    else if (/\.tsx$/.test(p) && !ES_TEST.test(p)) acc.push(p);
  }
  return acc;
}

/** Quita comentarios de bloque y de línea. Aproximado a propósito: sólo importa no contar prosa. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const montan = (patron: RegExp) =>
  fuentes(SRC)
    .filter((p) => patron.test(sinComentarios(readFileSync(p, 'utf8'))))
    .map((p) => relative(SRC, p).split('\\').join('/'))
    .sort();

describe('PISTAFIJARSOPORTE — cada pantalla con BotonVoz monta la pista del candado', () => {
  const conBoton = montan(/<BotonVoz[\s/>]/);
  const conPista = new Set(montan(/<PistasGestoVoz[\s/>]/));

  it('el control no es vacío: enumera las pantallas que montan <BotonVoz (denominador impreso)', () => {
    // Imprime el denominador: «verde sobre 0 archivos» no demuestra nada.
    console.log(
      `PISTAFIJARSOPORTE: ${conBoton.filter((f) => conPista.has(f)).length}/${conBoton.length} pantallas con <BotonVoz> montan <PistasGestoVoz>\n  ${conBoton.join('\n  ')}`,
    );
    // Piso: hoy son 3 (ChatView, MicFuncion, PantallaSoporte). Si un refactor deja el glob en 0,
    // el resto del archivo pasaría en vacío — esto lo vuelve rojo.
    expect(conBoton.length).toBeGreaterThanOrEqual(3);
  });

  it('ninguna pantalla con <BotonVoz> queda sin <PistasGestoVoz>', () => {
    const sinPista = conBoton.filter((f) => !conPista.has(f));
    expect(sinPista).toEqual([]);
  });
});
