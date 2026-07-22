import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import {
  agruparEnColumnas,
  EscritorioFunciones,
  KEYS_OPERATIVAS,
  TILES,
  type FuncionKey,
} from './EscritorioFunciones';

/** Las keys esperadas, EXPLÍCITAS y no `TILES.length`: así agregar/sacar una función obliga a
 *  nombrarla acá, igual criterio que `GlassIcon.test.tsx` con el catálogo de íconos. */
const KEYS_ESPERADAS: FuncionKey[] = [
  'facturacion', 'ingresos', 'gastos', 'presupuestos', 'clientes',
  'midia', 'inteligencia', 'contabilidad', 'ajustes',
];

async function envolver(props: Parameters<typeof EscritorioFunciones>[0] = {}) {
  return render(
    <ThemeProvider>
      <EscritorioFunciones {...props} />
    </ThemeProvider>,
  );
}

describe('agruparEnColumnas — invariante genérico, sin acoplar al conteo de TILES', () => {
  it('nunca deja más de `filasPorColumna` elementos en una columna', () => {
    const columnas = agruparEnColumnas([1, 2, 3, 4, 5, 6, 7], 2);
    columnas.forEach((col) => expect(col.length).toBeLessThanOrEqual(2));
  });

  it('preserva el orden de los items al aplanar las columnas', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const columnas = agruparEnColumnas(items, 2);
    expect(columnas.flat()).toEqual(items);
  });

  it('con filasPorColumna mayor que el total, arma una sola columna', () => {
    expect(agruparEnColumnas([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
});

describe('EscritorioFunciones — el escritorio del copiloto', () => {
  // Sin número en el nombre: el conteo cambia cada vez que entra una función, y un título que dice
  // "6 funciones" sobre siete es una mentira que nadie corrige porque el test pasa igual.
  it('TILES tiene exactamente las keys del emprendedor, en el orden del diseño', () => {
    expect(TILES.map((t) => t.key)).toEqual(KEYS_ESPERADAS);
  });

  it('🔴 las PRIMERAS CUATRO son las operativas — es lo único que se ve sin scrollear', () => {
    // El orden de `TILES` decide qué aparece en pantalla, y se había degradado solo: cada función
    // nueva se agregaba al final por defecto, hasta que el emprendedor abría la app y veía las
    // cuatro que menos usa, con Facturación fuera de pantalla. Este test es lo que frena a quien
    // meta una función nueva arriba sin decidirlo — una regla escrita sin test se degrada igual.
    expect(TILES.slice(0, 4).map((t) => t.key)).toEqual([...KEYS_OPERATIVAS]);
  });

  it('🔴 ningún ícono se repite dentro del grid', () => {
    // Entrar por un glifo y llegar a otra función desorienta. Ya pasó en Ajustes con `note`.
    const iconos = TILES.map((t) => t.icono);
    expect(new Set(iconos).size).toBe(iconos.length);
  });

  it('🔴 los cascarones retirados no volvieron al grid', () => {
    // `redes` era un cascarón y `recientes` duplicaba la lista que ya vive abajo de este mismo grid.
    // Un tile que abre una pantalla vacía le enseña al emprendedor que hay funciones que no andan.
    const keys: string[] = TILES.map((t) => t.key);
    expect(keys).not.toContain('redes');
    expect(keys).not.toContain('recientes');
    // `apps` no se borró: se mudó a Ajustes. No es una función del negocio.
    expect(keys).not.toContain('apps');
  });

  it.each(KEYS_ESPERADAS)('renderiza el tile "%s" con su testID', async (key) => {
    await envolver();
    expect(screen.getByTestId(`tile-${key}`)).toBeTruthy();
  });

  it('al tocar un tile, llama a onFuncion con la key correspondiente', async () => {
    const onFuncion = jest.fn();
    await envolver({ onFuncion });

    fireEvent.press(screen.getByTestId('tile-facturacion'));

    expect(onFuncion).toHaveBeenCalledWith('facturacion');
    expect(onFuncion).toHaveBeenCalledTimes(1);
  });

  it('tocar un tile sin onFuncion no crashea (callback opcional)', async () => {
    await envolver();
    expect(() => fireEvent.press(screen.getByTestId('tile-ajustes'))).not.toThrow();
  });

  it('pinta la actividad que le pasan, sin inventar ninguna', async () => {
    // El mock hardcodeado se borró: este componente RECIBE la actividad, no la consulta ni la
    // fabrica. Sin items y sin estar cargando, dice que no hay movimientos — nunca datos ajenos.
    await envolver({ actividad: [], cargandoActividad: false });

    expect(screen.getByTestId('escritorio-actividad-vacia')).toBeTruthy();
  });

  it('vocabulario del emprendedor: nada de "paciente"/"clínico"/"consulta médica" en las etiquetas', async () => {
    await envolver();
    const prohibidas = /paciente|clínic|consulta médica/i;
    TILES.forEach((t) => expect(t.label).not.toMatch(prohibidas));
  });
});
