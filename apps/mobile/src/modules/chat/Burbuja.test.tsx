// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.
import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Burbuja } from './Burbuja';
import { ListaMensajes } from './ListaMensajes';

/**
 * AVATARASIST — el isotipo del asistente va en TODO mensaje suyo (`index.html:3191`, helper `O`), y la burbuja
 * del emprendedor no lo lleva (en su lugar va la meta «✓✓ recibido»). Lo táctil —que quede pegado al borde
 * inferior de la burbuja y que un texto largo no lo empuje fuera de la fila— es del device.
 */
describe('Burbuja — AVATARASIST: el isotipo del asistente', () => {
  it('🔴 la burbuja del asistente lleva el avatar (la Marca del design system) junto a su texto', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="assistant" text="Hola, soy tu copiloto." />
      </ThemeProvider>,
    );

    expect(screen.getByText('Hola, soy tu copiloto.')).toBeTruthy();
    const avatar = screen.getByTestId('chat-bubble-avatar');
    // El avatar ES la `Marca` (no un placeholder vacío): control de que el sujeto contiene el isotipo.
    expect(screen.getAllByTestId('marca')).toHaveLength(1);
    expect(avatar).toBeTruthy();
  });

  it('🔴 la burbuja del emprendedor NO lleva avatar', async () => {
    await render(
      <ThemeProvider>
        <Burbuja role="user" text="Cobrale 2500 a Lucía" recibido hora="9:12" />
      </ThemeProvider>,
    );

    expect(screen.getByText('Cobrale 2500 a Lucía')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-avatar')).toBeNull();
    expect(screen.queryByTestId('marca')).toBeNull();
    // Y la meta que la acompaña sigue ahí: el avatar no la desplazó.
    expect(screen.getByTestId('chat-bubble-recibido')).toHaveTextContent('9:12 ✓✓ recibido');
  });

  it('🔴 en la lista, UN avatar por mensaje del asistente — ninguno por el del emprendedor', async () => {
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

    // Se miraron las tres burbujas (control de ceguera) y sólo las dos del asistente traen avatar.
    expect(screen.getByText('Primero.')).toBeTruthy();
    expect(screen.getByText('Dale.')).toBeTruthy();
    expect(screen.getByText('Segundo.')).toBeTruthy();
    expect(screen.getAllByTestId('chat-bubble-avatar')).toHaveLength(2);
  });
});
