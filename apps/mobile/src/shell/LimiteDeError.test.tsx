/**
 * Item 0.5b — sin `ErrorBoundary`, un throw en render deja la app en NEGRO y sin rastro.
 *
 * Medido antes de escribir esto: 0 `ErrorBoundary` / `componentDidCatch` / `getDerivedStateFromError`
 * en los 215 archivos de `apps/mobile`, 0 en `apps/copiloto-web`. Consultado `documed-front` (la app
 * canónica de UI, regla 3.ter): tampoco lo tiene, así que no había nada que portar.
 *
 * Por qué importa acá y no es teoría: este repo ya tuvo dos incidentes de pantalla que no responde
 * ([[glass-apilado-empujar-una-vez]], [[test-en-carpeta-app-es-una-ruta]]). La diferencia entre
 * "se rompió y avisa" y "se quedó negra" es este componente.
 *
 * Lo que se verifica es lo que el usuario ve Y lo que queda registrado — un fallback bonito que no
 * deja rastro sólo cambia el color del silencio.
 */
import React from 'react';
import { Text } from 'react-native';
// `render` de RNTL 14 es ASYNC (await) — lo documenta `PanelDeslizable.test.tsx` en este mismo
// directorio. Sin el await, `screen` responde "render function has not been called".
import { render, screen } from '@testing-library/react-native';

import { LimiteDeError } from './LimiteDeError';

function Explota(): React.ReactElement {
  throw new Error('boom de prueba');
}

describe('LimiteDeError', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React escribe el error en consola por diseño; se silencia para no ensuciar la salida del runner,
    // pero se conserva el spy para poder afirmar que el boundary registró SU propio rastro.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('un throw en render muestra algo al usuario, no una pantalla en blanco', async () => {
    await render(
      <LimiteDeError>
        <Explota />
      </LimiteDeError>,
    );

    expect(screen.getByText(/algo se rompió/i)).toBeTruthy();
  });

  it('deja rastro del error, no sólo la pantalla bonita', async () => {
    const registrados: unknown[] = [];
    await render(
      <LimiteDeError alFallar={(e) => registrados.push(e)}>
        <Explota />
      </LimiteDeError>,
    );

    expect(registrados).toHaveLength(1);
    expect((registrados[0] as Error).message).toBe('boom de prueba');
  });

  it('CONTROL NEGATIVO: si nada falla, no se entromete', async () => {
    await render(
      <LimiteDeError>
        <Text>contenido normal</Text>
      </LimiteDeError>,
    );

    expect(screen.getByText('contenido normal')).toBeTruthy();
    expect(screen.queryByText(/algo se rompió/i)).toBeNull();
  });
});
