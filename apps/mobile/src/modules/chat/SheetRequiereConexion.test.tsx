/**
 * K-11 / BL-J8 — el sheet «conectá X» en contexto. ⚠️ Todo `fireEvent`/`render` va con `await` (RNTL 14).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RequiereConexion } from '@copiloto/core';

import { PHOSPHOR } from '../../theme/glass/phosphor';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GLIFOS_DECLARADOS, SheetRequiereConexion, resolverGlifo } from './SheetRequiereConexion';

const CONEXION: RequiereConexion = {
  service: 'gmail',
  label: 'Gmail',
  alcance: [
    { texto: 'Leer mails', condicion: 'ninguna' },
    { texto: 'Enviar mails', condicion: 'ninguna' },
  ],
  pendiente: null,
  connectPath: '/composio/connect?service=gmail',
};

async function montar(props: Partial<Parameters<typeof SheetRequiereConexion>[0]> = {}) {
  const onConectar = jest.fn();
  const onAhoraNo = jest.fn();
  await render(
    <ThemeProvider>
      <SheetRequiereConexion conexion={CONEXION} onConectar={onConectar} onAhoraNo={onAhoraNo} {...props} />
    </ThemeProvider>,
  );
  return { onConectar, onAhoraNo };
}

describe('SheetRequiereConexion', () => {
  it('muestra el nombre y el alcance del catálogo con «Conectar» y «Ahora no»', async () => {
    await montar();
    expect(screen.getByText('Conectá Gmail')).toBeTruthy();
    expect(screen.getByText('Enviar mails')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-conectar')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-ahora-no')).toBeTruthy();
  });

  it('cada botón dispara lo suyo', async () => {
    const { onConectar, onAhoraNo } = await montar();
    await fireEvent.press(screen.getByTestId('sheet-requiere-conexion-conectar'));
    await fireEvent.press(screen.getByTestId('sheet-requiere-conexion-ahora-no'));
    expect(onConectar).toHaveBeenCalledTimes(1);
    expect(onAhoraNo).toHaveBeenCalledTimes(1);
  });

  it('sin conexión (null) no renderiza nada', async () => {
    await montar({ conexion: null });
    expect(screen.queryByTestId('sheet-requiere-conexion')).toBeNull();
  });

  // PROTO4DEPS §A — el límite de cada permiso. El caso SIN condicion primero: es el de producción hoy.
  it('🔴 sin condicion (producción hoy): ninguna insignia y el texto igual que antes', async () => {
    await montar();
    expect(screen.queryByTestId('sheet-requiere-conexion-condicion-0')).toBeNull();
    expect(screen.queryByText('Solo lectura')).toBeNull();
    expect(screen.getByText('Leer mails')).toBeTruthy();
  });

  it('pinta la insignia de cada permiso con condicion: «Solo lectura» y «Nunca sin tu OK»', async () => {
    await montar({
      conexion: {
        ...CONEXION,
        service: 'mercadopago',
        label: 'Mercado Pago',
        alcance: [
          { texto: 'Leer tus cobros y movimientos', condicion: 'solo_lectura' },
          { texto: 'Armar links de cobro cuando vos confirmás', condicion: 'requiere_ok' },
          { texto: 'Ver tu perfil', condicion: 'ninguna' },
        ],
      },
    });
    expect(screen.getByTestId('sheet-requiere-conexion-condicion-0')).toHaveTextContent('Solo lectura');
    expect(screen.getByTestId('sheet-requiere-conexion-condicion-1')).toHaveTextContent('Nunca sin tu OK');
    expect(screen.queryByTestId('sheet-requiere-conexion-condicion-2')).toBeNull();
  });

  it('SM-I7: cada capacidad lleva su ícono, también con una condición que esta versión no conoce', async () => {
    await montar({
      conexion: {
        ...CONEXION,
        alcance: [
          { texto: 'Leer', condicion: 'solo_lectura' },
          { texto: 'Escribir', condicion: 'requiere_ok' },
          { texto: 'Otra', condicion: 'condicion_futura' as never },
        ],
      },
    });
    [0, 1, 2].forEach((i) => expect(screen.getByTestId(`sheet-requiere-conexion-icono-${i}`)).toBeTruthy());
    expect(screen.queryByTestId('sheet-requiere-conexion-icono-3')).toBeNull();
  });

  // SM-I7 · el lookup `PHOSPHOR[nombre] ?? []` pintaba un TILE VACÍO ante un nombre desconocido. El test (a) sale
  // verde con ese defecto puesto (nunca le manda un nombre desconocido): el que verifica el fix es el (b).
  // Cuenta los nodos con trazo (d) bajo el tile de la fila, recorriendo el árbol de instancias.
  type Nodo = { props?: { d?: unknown }; children?: readonly unknown[] };
  const contarTrazos = (n: Nodo): number =>
    (typeof n.props?.d === 'string' ? 1 : 0) + (n.children ?? []).reduce<number>((acc, c) => acc + (typeof c === 'object' && c !== null ? contarTrazos(c as Nodo) : 0), 0);
  const trazosDeLaFila = (i: number) => contarTrazos(screen.getByTestId(`sheet-requiere-conexion-icono-${i}`) as unknown as Nodo);

  it('SM-I7 (a): todo glifo que el sheet declara existe en PHOSPHOR, y «link» está (no «link-break»)', () => {
    GLIFOS_DECLARADOS.forEach((g) => expect(PHOSPHOR[g]?.length).toBeGreaterThan(0));
    expect(PHOSPHOR.link?.length).toBeGreaterThan(0);
    expect(PHOSPHOR.link).not.toEqual(PHOSPHOR['link-break']);
  });

  it('🔴 SM-I7 (b) CONTROL NEGATIVO: un icono INVENTADO cae al genérico y la fila se dibuja CON trazos', async () => {
    await montar({
      conexion: {
        ...CONEXION,
        alcance: [
          { texto: 'Cobros', condicion: 'ninguna', icono: 'no-existe-este-glifo' },
          { texto: 'Prototipo', condicion: 'solo_lectura', icono: 'toString' },
          { texto: 'Con link', condicion: 'ninguna', icono: 'link' },
        ],
      },
    });
    expect(screen.getByText('Cobros')).toBeTruthy();
    [0, 1, 2].forEach((i) => expect(trazosDeLaFila(i)).toBeGreaterThan(0));
  });

  it('SM-I7: resolverGlifo — icono existente gana; ausente/desconocido → condición; ni eso → genérico', () => {
    expect(resolverGlifo('link', 'solo_lectura')).toBe('link');
    expect(resolverGlifo(undefined, 'solo_lectura')).toBe('eye');
    expect(resolverGlifo('no-existe-este-glifo', 'requiere_ok')).toBe('check');
    expect(resolverGlifo('no-existe-este-glifo', 'condicion_futura')).toBe('plugs-connected');
    expect(resolverGlifo('constructor', 'ninguna')).toBe('plugs-connected');
  });

  // PROTO4DEPS §B — el bloque pendiente es del turno y opcional.
  it('🔴 sin pendiente: no se pinta nada (la hoja es la de siempre)', async () => {
    await montar();
    expect(screen.queryByTestId('sheet-requiere-conexion-pendiente')).toBeNull();
    expect(screen.queryByText(/Apenas conectes/)).toBeNull();
  });

  it('con pendiente: «Apenas conectes sigo con lo tuyo: <lo pedido>.»', async () => {
    await montar({ conexion: { ...CONEXION, pendiente: 'cuánto entró esta semana' } });
    expect(screen.getByTestId('sheet-requiere-conexion-pendiente')).toHaveTextContent(
      'Apenas conectes sigo con lo tuyo: cuánto entró esta semana.',
    );
  });

  it('muestra el error de «Conectar» si lo hay', async () => {
    await montar({ error: 'No pudimos pedir el link de Gmail. Probá de nuevo.' });
    expect(screen.getByTestId('sheet-requiere-conexion-error')).toBeTruthy();
  });
});
