import { SKINS, type NombreSkin } from './tokens';

/**
 * El **knob de luminosidad** por skin (`PaletaCruda.luminosidad`) — lo que hace que subir o bajar el
 * tono de un tema sea cambiar UN número y no perseguir hex sueltos por el archivo.
 *
 * Estos tests no afirman "se ve lindo": afirman las tres propiedades **estructurales** que hacen que
 * el knob siga funcionando cuando alguien lo mueva dentro de seis meses.
 *
 *  1. Los tres skins de color **suben** de luminancia respecto del fondo crudo del template.
 *  2. `medicalWhite` y `black` **NO se mueven** (uno ya es claro, el otro es negro por diseño).
 *  3. El fondo aclarado **arrastra** a las superficies derivadas — la trampa real: si `fondo` se
 *     aclarara solo, `superficie` seguiría saliendo del crudo y quedaría MÁS OSCURA que su propio
 *     fondo. Las cards se verían hundidas en vez de levantadas, que es lo contrario de todo el
 *     diseño ("profundidad y transparencias"). Ese bug no lo canta el tipo ni el linter: se ve en el
 *     device, tarde. Por eso vive acá.
 */

/** Luminancia relativa aproximada (ITU-R BT.601). Alcanza para ordenar dos tonos del mismo tema:
 *  no se busca precisión colorimétrica, se busca "¿este es más claro que aquel?". */
function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Los fondos CRUDOS del template, antes de aplicar el knob. Copiados a propósito (no importados):
 *  si alguien cambia un `fondoBase` en `tokens.ts`, este test tiene que fallar y obligar a mirar —
 *  un baseline que se auto-actualiza no es un baseline. */
const FONDO_CRUDO: Record<NombreSkin, string> = {
  cian: '#050e18',
  violeta: '#0e0722',
  ambar: '#0f0b06',
  medicalWhite: '#eef3fa',
  black: '#050608',
};

const CON_LUZ: NombreSkin[] = ['cian', 'violeta', 'ambar'];
const SIN_LUZ: NombreSkin[] = ['medicalWhite', 'black'];

describe('knob de luminosidad', () => {
  it.each(CON_LUZ)('%s se aclara respecto del fondo crudo del template', (skin) => {
    expect(luminancia(SKINS[skin].color.fondo)).toBeGreaterThan(luminancia(FONDO_CRUDO[skin]));
  });

  it.each(SIN_LUZ)('%s NO se mueve — es su identidad, no una calibración pendiente', (skin) => {
    expect(SKINS[skin].color.fondo).toBe(FONDO_CRUDO[skin]);
  });

  it.each(CON_LUZ)('%s: las superficies siguen al fondo aclarado, no al crudo', (skin) => {
    const { fondo, superficie, superficieAlta } = SKINS[skin].color;
    // Una superficie SIEMPRE va por encima de su fondo: es lo que la despega del vidrio.
    expect(luminancia(superficie)).toBeGreaterThan(luminancia(fondo));
    expect(luminancia(superficieAlta)).toBeGreaterThan(luminancia(superficie));
  });

  it('subir el knob no rompe la identidad de color del skin', () => {
    // Se mezcla hacia el ACENTO, no hacia el blanco: si fuera hacia el blanco, los tres oscuros
    // convergerían al mismo gris y dejarían de distinguirse entre sí.
    const fondos = CON_LUZ.map((s) => SKINS[s].color.fondo);
    expect(new Set(fondos).size).toBe(CON_LUZ.length);
  });
});
