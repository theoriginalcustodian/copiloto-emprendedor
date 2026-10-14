import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import type { ReplyChoice } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ChipsDesambiguacion } from './ChipsDesambiguacion';

// SM-D1 (2026-10-14): hoy ningún productor del backend emite más de 2 choices (canario invertido
// `apps/copiloto/tests/test_choices_a_lo_sumo_dos_canario.py`), así que el «3+» sólo se ejercita acá,
// inyectando N sin backend. `ListaMensajes.choicesArtefactos.test.tsx` cubre 3 dentro de la lista.
const cinco: ReplyChoice[] = [1, 2, 3, 4, 5].map((n) => ({ label: `Ana ${n}`, value: `cliente:${n}` }));

async function montar(props: Partial<React.ComponentProps<typeof ChipsDesambiguacion>> = {}) {
  const onSelect = jest.fn();
  await render(
    <ThemeProvider>
      <ChipsDesambiguacion choices={cinco} onSelect={onSelect} {...props} />
    </ThemeProvider>,
  );
  return { onSelect };
}

describe('ChipsDesambiguacion — SM-D1: 3+ opciones', () => {
  it('con 5 choices pinta 5 opciones y ninguna se recorta', async () => {
    await montar();
    for (let i = 0; i < 5; i++) expect(screen.getByTestId(`chips-desambiguacion-opcion-${i}`)).toBeTruthy();
    expect(screen.queryByTestId('chips-desambiguacion-opcion-5')).toBeNull();
  });

  it('tocar la 5ª y la 3ª devuelve SU value y SU label (no se pisan entre sí)', async () => {
    const { onSelect } = await montar();
    await fireEvent.press(screen.getByTestId('chips-desambiguacion-opcion-4'));
    expect(onSelect).toHaveBeenLastCalledWith('cliente:5', 'Ana 5');
    await fireEvent.press(screen.getByTestId('chips-desambiguacion-opcion-2'));
    expect(onSelect).toHaveBeenLastCalledWith('cliente:3', 'Ana 3');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('control: con `deshabilitado` se ven las 5 pero ninguna manda', async () => {
    const { onSelect } = await montar({ deshabilitado: true });
    await fireEvent.press(screen.getByTestId('chips-desambiguacion-opcion-0'));
    expect(screen.getByTestId('chips-desambiguacion-opcion-4')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
