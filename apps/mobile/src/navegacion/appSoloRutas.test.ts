import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * 🔴 **`app/` es el árbol de RUTAS de expo-router: todo archivo ahí adentro se convierte en una
 * pantalla navegable.** No es una carpeta más.
 *
 * El `require.context` que arma el router (`node_modules/expo-router/_ctx.android.js`) excluye
 * exactamente tres cosas —`+api`, `+html`, `+middleware`— y **nada más**:
 *
 * ```
 * /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.ios|\.web)?\.[tj]sx?$/
 * ```
 *
 * Un `*.test.tsx` ahí adentro **entra al bundle como ruta** y se ejecuta en el teléfono, donde
 * `jest` no existe: el arranque muere con un error y la app queda inutilizable. Pasó el 2026-07-21
 * — puse `app/ajustes.test.tsx` para cubrir el cableado de los tiles de Ajustes, los 322 tests
 * pasaron en verde, y el operador reportó la app bloqueada con un error minutos después. Ningún
 * gate lo vio porque en jest el archivo es un test perfectamente válido; el problema es **dónde**
 * vive, no qué hace.
 *
 * Este test es el "no puede volver por construcción" de esa lección. Los tests que necesiten
 * importar una ruta viven en `src/` e importan `../../../app/<ruta>` — el import cruza, el archivo
 * no.
 */
const RAIZ_APP = join(__dirname, '..', '..', 'app');

function archivosRecursivos(dir: string, prefijo = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    return entrada.isDirectory()
      ? archivosRecursivos(join(dir, entrada.name), relativo)
      : [relativo];
  });
}

describe('app/ contiene SÓLO rutas', () => {
  it('ningún archivo de test vive dentro de app/', () => {
    const infractores = archivosRecursivos(RAIZ_APP).filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f));

    expect(infractores).toEqual([]);
  });

  /** Control: si el listado estuviera roto (ruta mal armada, carpeta vacía), el test de arriba
   *  pasaría por vacío y no verificaría nada — el modo de falla más silencioso que hay. */
  it('CONTROL: el listado de app/ efectivamente encuentra las rutas', () => {
    const archivos = archivosRecursivos(RAIZ_APP);

    expect(archivos).toContain('_layout.tsx');
    expect(archivos).toContain('ajustes.tsx');
    expect(archivos.length).toBeGreaterThan(5);
  });
});
