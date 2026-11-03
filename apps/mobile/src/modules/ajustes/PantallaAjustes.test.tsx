import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { leerPerfilNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaAjustes, type AjusteKey } from './PantallaAjustes';

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  leerPerfilNegocio: jest.fn(),
}));
const leerMock = leerPerfilNegocio as jest.Mock;

beforeEach(() => leerMock.mockResolvedValue({ status: 'ok', perfil: null }));

async function envolver(onAjuste?: (key: AjusteKey) => void) {
  return render(
    <ThemeProvider>
      <PantallaAjustes onAjuste={onAjuste} />
    </ThemeProvider>,
  );
}

/** Las 5 entradas EXPLÍCITAS y en orden, no `TILES_AJUSTES.length`: sacar o agregar una obliga a
 *  nombrarla acá. Quedaron 5 tras sacar «Mi plan» (DEC-8: plan y límites no entran en la beta). */
const TILE_KEYS: AjusteKey[] = [
  'perfilNegocio',
  'facturacionAfip',
  'apps',
  'cuenta',
  'apariencia',
];

describe('PantallaAjustes (lista de filas, SM-Z5)', () => {
  it('renderiza las 5 entradas del grid', async () => {
    await envolver();
    for (const key of TILE_KEYS) {
      expect(screen.getByTestId(`ajuste-tile-${key}`)).toBeTruthy();
    }
  });

  it('tocar un tile dispara onAjuste con la key correcta', async () => {
    const onAjuste = jest.fn();
    await envolver(onAjuste);

    await fireEvent.press(screen.getByTestId('ajuste-tile-apariencia'));
    expect(onAjuste).toHaveBeenCalledWith('apariencia');

    await fireEvent.press(screen.getByTestId('ajuste-tile-cuenta'));
    expect(onAjuste).toHaveBeenCalledWith('cuenta');
  });

  it('las 5 etiquetas visibles son las esperadas — en castellano y sin pares que se pisen', async () => {
    await envolver();
    expect(screen.getByText('Mi negocio')).toBeTruthy();
    expect(screen.getByText('Facturación ARCA')).toBeTruthy();
    expect(screen.getByText('Apps conectadas')).toBeTruthy();
    expect(screen.getByText('Mi cuenta')).toBeTruthy();
    expect(screen.getByText('Apariencia')).toBeTruthy();
  });

  it('🔴 CONTROL NEGATIVO: no hay tile «Mi plan» — DEC-8, el plan no entra en la beta', async () => {
    // Un test de presencia no se pone rojo si la fila vuelve: el próximo port del prototipo la
    // reintroduce con la suite verde. Por eso se afirma la AUSENCIA, por key y por etiqueta.
    await envolver();
    expect(screen.queryByTestId('ajuste-tile-miPlan')).toBeNull();
    expect(screen.queryByText('Mi plan')).toBeNull();
  });

  it('🔴 los pares que se pisaban ya no están', async () => {
    // Dos tiles para un solo concepto es lo que confunde a quien entró a configurar algo: no sabe
    // cuál de los dos es el que busca. `Datos personales` duplicaba `Cuenta` y las dos de plan se
    // duplicaban entre sí — y las tres eran andamiaje vacío.
    await envolver();
    for (const viejo of ['Datos personales', 'Planes disponibles', 'Plan actual', 'Skins', 'Configuración del sistema']) {
      expect(screen.queryByText(viejo)).toBeNull();
    }
  });

  it('mapeo `ajustes`: tres grupos con su rótulo y cada tile bajo el suyo', async () => {
    await envolver();
    const ids: string[] = [];
    const visitar = (n: any): void => {
      if (!n || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(visitar);
      if (typeof n.props?.testID === 'string') ids.push(n.props.testID);
      visitar(n.children);
    };
    visitar(screen.toJSON());
    const i = (id: string) => ids.indexOf(id);
    expect(screen.getByTestId('ajustes-grupo-negocio').props.children).toBe('Tu negocio');
    expect(screen.getByTestId('ajustes-grupo-app').props.children).toBe('La app');
    expect(screen.getByTestId('ajustes-grupo-ayuda').props.children).toBe('Ayuda');
    // Orden de pantalla: rótulo del grupo → sus tiles → rótulo del siguiente.
    expect(i('ajustes-grupo-negocio')).toBeLessThan(i('ajuste-tile-perfilNegocio'));
    expect(i('ajuste-tile-apps')).toBeLessThan(i('ajustes-grupo-app'));
    expect(i('ajustes-grupo-app')).toBeLessThan(i('ajuste-tile-cuenta'));
    expect(i('ajuste-tile-apariencia')).toBeLessThan(i('ajustes-grupo-ayuda'));
    expect(i('ajustes-grupo-ayuda')).toBeLessThan(i('ajuste-tile-comoUsar'));
    // Los 8 tiles siguen presentes: agrupar no hace desaparecer ninguno.
    for (const k of ['perfilNegocio','facturacionAfip','apps','cuenta','apariencia','comoUsar','soporte','feedback']) {
      expect(screen.getByTestId(`ajuste-tile-${k}`)).toBeTruthy();
    }
  });

  it('sin onAjuste, tocar un tile no crashea (prop opcional)', async () => {
    await envolver();
    await fireEvent.press(screen.getByTestId('ajuste-tile-cuenta'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeTruthy();
  });
});

/**
 * SM-Z5: la lista se compara con el MAPA leyendo su fuente (`index.html` §ajustes de la rama), no con
 * literales copiados acá -- un test que repite los textos es verde por construcción. Si el mapa cambia un
 * subtítulo o agrega una fila, esto se pone rojo.
 */
const MAPA = join(__dirname, '../../../../../Prototipo frontend/odobi-ui/prototipo/index.html');

/** Filas del mapa que la app NO tiene A PROPÓSITO (enmiendas fundadas, ver `FILAS_AJUSTES`). */
const ENMIENDAS_DEL_MAPA = ['Cómo hablarle'];

function leerAjustesDelMapa(): { rotulo: string; filas: { titulo: string; subtitulo: string }[] }[] {
  const html = readFileSync(MAPA, 'utf8');
  const ini = html.indexOf('<div id="ajustes">');
  const fin = html.indexOf('<!-- ══════════ Ayuda › Cómo usar la app', ini);
  const seccion = html.slice(ini, fin);
  const grupos: { rotulo: string; filas: { titulo: string; subtitulo: string }[] }[] = [];
  // Cada `.lista-lbl` abre un grupo; las `.aj-fila` siguientes son suyas hasta el próximo rótulo.
  const rx = /<div class="lista-lbl">([^<]+)<\/div>|<span class="t"><b>([^<]+)<\/b><span>([^<]+)<\/span><\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(seccion)) !== null) {
    if (m[1]) grupos.push({ rotulo: m[1], filas: [] });
    else grupos[grupos.length - 1].filas.push({ titulo: m[2], subtitulo: m[3] });
  }
  return grupos;
}

describe('SM-Z5: Ajustes es una lista igual al mapa (leído de la fuente)', () => {
  it('control de ceguera: el parser del mapa ve 3 grupos y 9 filas', () => {
    const grupos = leerAjustesDelMapa();
    expect(grupos.map((g) => g.rotulo)).toEqual(['Tu negocio', 'La app', 'Ayuda']);
    expect(grupos.flatMap((g) => g.filas)).toHaveLength(9);
  });

  it('cada fila del mapa (menos las enmiendas) está en la app, con su título y su subtítulo', async () => {
    await envolver();
    const filasDelMapa = leerAjustesDelMapa().flatMap((g) => g.filas);
    const presentes = filasDelMapa.filter((f) => !ENMIENDAS_DEL_MAPA.includes(f.titulo));
    expect(presentes).toHaveLength(8);
    for (const f of presentes) {
      expect(screen.getByText(f.titulo)).toBeTruthy();
      expect(screen.getByText(f.subtitulo)).toBeTruthy();
    }
  });

  it('las enmiendas siguen siendo ausencias reales: «Cómo hablarle» no se dibuja', async () => {
    await envolver();
    for (const titulo of ENMIENDAS_DEL_MAPA) expect(screen.queryByText(titulo)).toBeNull();
  });

  it('los rótulos y el orden de los grupos son los del mapa', async () => {
    await envolver();
    const rotulos = leerAjustesDelMapa().map((g) => g.rotulo);
    const enApp = ['negocio', 'app', 'ayuda'].map((id) => screen.getByTestId(`ajustes-grupo-${id}`).props.children);
    expect(enApp).toEqual(rotulos);
  });

  it('cada fila lleva su chevron y ningún ícono se repite entre filas', async () => {
    await envolver();
    expect(screen.getAllByText('›', { includeHiddenElements: true })).toHaveLength(8);
    const filas = screen.getAllByTestId(/^ajuste-tile-/);
    expect(filas).toHaveLength(8);
    const iconos = filas.map((fila) => within(fila).getByTestId(/^glass-icon-/).props.testID);
    expect(new Set(iconos).size).toBe(8);
  });
});
describe('SM-N9: encabezado con el nombre comercial', () => {
  it('con nombre cargado lo muestra en la etiqueta del encabezado', async () => {
    leerMock.mockResolvedValue({ status: 'ok', perfil: { nombreComercial: 'El Galpón' } });
    await envolver();
    await waitFor(() => expect(screen.getByTestId('glass-etiqueta').props.children).toBe('El Galpón'));
  });

  it('sin nombre (emprendedor nuevo) no dibuja etiqueta ni hueco', async () => {
    leerMock.mockResolvedValue({ status: 'ok', perfil: { nombreComercial: '   ' } });
    await envolver();
    await waitFor(() => expect(leerMock).toHaveBeenCalled());
    expect(screen.queryByTestId('glass-etiqueta')).toBeNull();
  });

  it('sin perfil o con la lectura caída tampoco', async () => {
    leerMock.mockRejectedValue(new Error('red'));
    await envolver();
    await waitFor(() => expect(leerMock).toHaveBeenCalled());
    expect(screen.queryByTestId('glass-etiqueta')).toBeNull();
  });
});
