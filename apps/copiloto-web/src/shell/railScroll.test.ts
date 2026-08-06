import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), mismo patrón que `desktopNoHexLiterals.test.ts`.
import desktopCss from './desktop.css?raw';

/**
 * Guard anti-regresión del scroll del rail.
 *
 * ⚠️ Qué mide y qué NO: esto es un guard de TEXTO sobre el CSS, no un gate de layout — jsdom no
 * hace layout, así que ningún test de esta suite puede ver si la barra realmente scrollea. El gate
 * real se corrió en navegador (Chromium, marcado de `Rail.tsx` + este mismo `desktop.css`) y quedó
 * medido en el PR: a 480px de alto, con el fix el último ítem llega a 412px con el rail terminando
 * en 480 (se alcanza); sin el fix queda en 559 (se pierde fuera de la pantalla).
 *
 * Este archivo existe sólo para que las dos declaraciones no se borren "limpiando" el CSS, porque
 * su ausencia NO da síntoma mientras los ítems entren en la ventana: el umbral medido es 625px de
 * alto, y a 700px la holgura es de 0px — o sea CERO ítems de margen. La próxima función que se
 * agregue al rail vuelve a romperlo, y de nuevo sin aviso.
 */
/**
 * Los comentarios del CSS se descartan ANTES de buscar las declaraciones. Sin esto el guard es
 * mudo: el comentario que explica por qué hace falta `min-height: 0` contiene esa misma cadena, así
 * que el test pasaba con la declaración BORRADA. Lo cazó el control diferencial (quitar la línea y
 * exigir rojo); sin ese control habría quedado un instrumento que confirma en vez de verificar.
 */
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('rail — la lista de funciones scrollea sin arrastrar el bloque inferior', () => {
  const bloqueRailItems = sinComentarios(desktopCss).match(/\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';

  it('`.rail__items` existe como regla en desktop.css', () => {
    // Control positivo: si el selector se renombra, los dos asserts de abajo pasarían sobre un
    // string vacío y este guard se volvería mudo en vez de romperse.
    expect(bloqueRailItems.trim()).not.toBe('');
  });

  it('`.rail__items` declara overflow-y: auto', () => {
    expect(bloqueRailItems).toMatch(/overflow-y:\s*auto/);
  });

  it('`.rail__items` declara min-height: 0 — sin esto el overflow-y no se activa nunca', () => {
    // `min-height:auto` es el default de un hijo flex: le impide encogerse bajo su contenido, con
    // lo cual el contenedor nunca queda más chico que la lista y `overflow-y` no tiene qué recortar.
    expect(bloqueRailItems).toMatch(/min-height:\s*0/);
  });

  it('`.rail` NO declara overflow-y — el scroll va en la lista, no en el rail', () => {
    // En `.rail` el scroll arrastraría `.rail__bottom` (Skin + Usuario, la puerta a Ajustes) fuera
    // de la vista, y su `overflow: hidden` recorta `.rail__label` durante la animación de ancho.
    const bloqueRail = sinComentarios(desktopCss).match(/\n\.rail\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bloqueRail.trim()).not.toBe('');
    expect(bloqueRail).not.toMatch(/overflow-y:/);
  });
});
