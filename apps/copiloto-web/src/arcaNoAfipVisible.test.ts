import { describe, expect, it } from 'vitest';

/**
 * Gate BL-X5 (DA-11): «AFIP» ya no existe como nombre — es «ARCA». Ninguna pantalla de la web puede
 * decirle «AFIP» al usuario. Los IDENTIFICADORES internos (`estadoAfip`, `AmbienteAfip`,
 * `PantallaAfipSetup`, clases `afip-*`) NO se renombran: por eso se busca la palabra SUELTA
 * (`\bAFIP\b` / `\bAfip\b`) y no la subcadena — un identificador pegado a otra palabra no dispara.
 *
 * Mismo criterio de barrido que los `*NoHexLiterals.test.ts`: fuentes crudas de Vite (`?raw`),
 * comentarios descartados (un docstring puede nombrar el término histórico sin problema).
 */
const AFIP_PALABRA_SUELTA = /\b(AFIP|Afip)\b/g;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

export function afipVisibles(source: string): string[] {
  return sinComentarios(source).match(AFIP_PALABRA_SUELTA) ?? [];
}

const FUENTES = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FUENTES_DE_PRODUCCION = Object.entries(FUENTES).filter(
  ([ruta]) => !/\.test\.tsx?$/.test(ruta),
);

describe('web — «AFIP» no aparece en texto visible (BL-X5)', () => {
  it('control positivo: el detector SÍ ve «AFIP» suelto y NO ve identificadores ni comentarios', () => {
    expect(afipVisibles(`<h1>Facturación AFIP</h1>`)).toEqual(['AFIP']);
    expect(afipVisibles(`const t = 'portal de Afip';`)).toEqual(['Afip']);
    expect(afipVisibles(`estadoAfip(); type AmbienteAfip = 'x'; <PantallaAfipSetup />`)).toEqual([]);
    expect(afipVisibles(`// el portal de AFIP\n/* AFIP */ const ok = 1;`)).toEqual([]);
  });

  it('barre una cantidad razonable de archivos (el glob no quedó vacío)', () => {
    expect(FUENTES_DE_PRODUCCION.length).toBeGreaterThan(100);
  });

  it.each(FUENTES_DE_PRODUCCION)('%s no dice «AFIP» en código visible', (_ruta, source) => {
    const hits = afipVisibles(source);
    expect(hits, `«AFIP» suelto encontrado ${hits.length} vez/veces — usar «ARCA»`).toHaveLength(0);
  });
});
