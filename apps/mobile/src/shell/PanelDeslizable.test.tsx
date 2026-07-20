import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Jest (jest-expo) — render de RNTL 14 es ASYNC (await). El COMPORTAMIENTO del gesto (drag/snap/
// toggle) se valida en el device (Fase 6) + lo validó el spike de Fase 1; en jest cubrimos que las
// dos capas + el handle montan sin crashear (reanimated/gesture-handler no revientan bajo el harness).

import { ThemeProvider } from '../theme/ThemeProvider';
import { PanelDeslizable } from './PanelDeslizable';

async function envolver(props: Record<string, never> = {}) {
  return render(
    <ThemeProvider>
      <PanelDeslizable testID="panel" fondo={<Text>escritorio-fondo</Text>} {...props}>
        <Text>conversacion-frente</Text>
      </PanelDeslizable>
    </ThemeProvider>,
  );
}

describe('PanelDeslizable (Tarea 2.4)', () => {
  it('monta las dos capas (fondo Capa 0 + children Capa 1) y el grab-handle', async () => {
    await envolver();
    expect(screen.getByTestId('panel')).toBeTruthy();
    expect(screen.getByText('escritorio-fondo')).toBeTruthy();
    expect(screen.getByText('conversacion-frente')).toBeTruthy();
    expect(screen.getByTestId('panel-handle')).toBeTruthy();
  });

  it('el hint invita a deslizar por defecto', async () => {
    await envolver();
    expect(screen.getByTestId('panel-hint').props.children).toBe('Deslizá para ver funciones');
  });
});

// 🔴 El suite `PanelDeslizable — traba por captura viva` de DocuMed (props `bloqueado`/
// `hintBloqueado`) se retiró junto con esos props — ver el docstring de `PanelDeslizable.tsx` (decisión
// D6). No queda nada que ejercitar acá: el copiloto no tiene una grabación viva que se pueda "dejar
// corriendo sin darse cuenta" al deslizar el panel.
