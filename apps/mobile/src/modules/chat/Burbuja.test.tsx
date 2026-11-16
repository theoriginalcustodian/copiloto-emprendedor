// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.
import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SKINS } from '../../theme/tokens';
import { Burbuja } from './Burbuja';
import { ListaMensajes } from './ListaMensajes';

/**
 * 14/11 (Martin) — el AVATAR del asistente se fue. Hasta acá cada mensaje de Odobi llevaba el isotipo en un
 * círculo negro (AVATARASIST, `index.html:3191`); en una charla de a dos el lado y el color de la burbuja ya
 * dicen quién habla, y el círculo se repetía en cada mensaje sin informar nada. Estos tests cuidan que no vuelva
 * por descuido y que la meta «✓✓ recibido» de la propia siga en su lugar.
 */
describe('Burbuja — sin avatar', () => {
  it('la burbuja del asistente muestra su texto, sin avatar ni isotipo', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="assistant" text="Hola, soy tu copiloto." />
      </ThemeProvider>,
    );

    expect(screen.getByText('Hola, soy tu copiloto.')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-avatar')).toBeNull();
    expect(screen.queryByTestId('marca')).toBeNull();
  });

  it('la burbuja del emprendedor tampoco, y conserva su meta', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="user" text="Cobrale 2500 a Lucía" recibido hora="9:12" />
      </ThemeProvider>,
    );

    expect(screen.getByText('Cobrale 2500 a Lucía')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-avatar')).toBeNull();
    expect(screen.getByTestId('chat-bubble-recibido')).toHaveTextContent('9:12 ✓✓ recibido');
  });

  it('en la lista se ven los tres mensajes y ninguno trae avatar', async () => {
    await render(
      <ThemeProvider>
        <ListaMensajes
          messages={[
            { id: 'a-1', role: 'assistant', text: 'Primero.' },
            { id: 'u-1', role: 'user', text: 'Dale.' },
            { id: 'a-2', role: 'assistant', text: 'Segundo.' },
          ]}
          onChoice={jest.fn()}
        />
      </ThemeProvider>,
    );

    // Control de ceguera: las tres burbujas están.
    expect(screen.getByText('Primero.')).toBeTruthy();
    expect(screen.getByText('Dale.')).toBeTruthy();
    expect(screen.getByText('Segundo.')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-avatar')).toBeNull();
  });
});

/**
 * SM-N43 — los colores de las burbujas salen del PROTOTIPO, no del acento. `prototipo/index.html:385-387` (`.mio`):
 * fill `--arena-30` #F8E2DB con tinta `--negro` #1A1512; `:330-331` (`.msg`): fill `--blanco` #FFFFFF. Hasta
 * SM-N43 estaban cruzadas: la propia era terracota profundo con tinta clara y la del asistente un crema que el
 * prototipo no contiene. El tema oscuro queda fuera (el prototipo no lo tiene) y conserva lo que pintaba.
 */
describe('Burbuja — **negrita** del asistente', () => {
  it('🔴 el asistente: los asteriscos NO se ven y el tramo queda en negrita', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="assistant" text="Anoté **$1.234** en Otros" />
      </ThemeProvider>,
    );
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(screen.getByText('$1.234')).toHaveStyle({ fontWeight: '700' });
  });

  it('control: lo que tipea el emprendedor es literal (los asteriscos se ven)', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="user" text="mirá **esto**" />
      </ThemeProvider>,
    );
    expect(screen.getByText('mirá **esto**')).toBeTruthy();
  });
});

describe('Burbuja — SM-N43: colores del prototipo', () => {
  const claro = SKINS.claro.glass;
  const oscuro = SKINS.oscuro.glass;

  it('🔴 tema claro: la propia es arena-30 con tinta negra y la del asistente es blanca', () => {
    expect([claro.mio1, claro.mio2]).toEqual(['#F8E2DB', '#F8E2DB']);
    expect(claro.tintaMio).toBe('#1A1512');
    expect([claro.asistente1, claro.asistente2]).toEqual(['#FFFFFF', '#FFFFFF']);
  });

  it('control negativo: la propia YA NO es el acento (ub1/ub2), que sigue siendo del HUD y los controles', () => {
    expect(claro.mio1).not.toBe(claro.ub1);
    expect(claro.mio2).not.toBe(claro.ub2);
    expect(claro.ub1).toBe('#B04A2E');
    expect(oscuro.mio1).toBe(oscuro.ub1); // oscuro: sin cambio de comportamiento
  });

  it('🔴 la tinta de la propia se pinta en el texto renderizado (no sólo se declara)', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="user" text="Cobrale 2500 a Lucía" />
      </ThemeProvider>,
    );
    const estilo = [screen.getByText('Cobrale 2500 a Lucía').props.style].flat(Infinity);
    expect(estilo.some((e: any) => e && e.color === claro.tintaMio)).toBe(true);
  });
});
