import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerPerfilNegocio: jest.fn() };
});

import { leerPerfilNegocio, type PerfilNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { IndicadorModoCeremonia } from './IndicadorModoCeremonia';

const mockLeer = leerPerfilNegocio as jest.MockedFunction<typeof leerPerfilNegocio>;

function perfil(over: Partial<PerfilNegocio> = {}): PerfilNegocio {
  return {
    queVende: '', aQuien: 'ambos', nombreComercial: '', horarioAtencion: '', formalidad: 'cercano',
    largoRespuesta: 'breve', nombreCopiloto: '', modoCeremonia: 'confirmacion', actualizadoEn: '', ...over,
  };
}

async function montar() {
  return render(
    <ThemeProvider>
      <IndicadorModoCeremonia />
    </ThemeProvider>,
  );
}

describe('IndicadorModoCeremonia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('🔴 fail-closed: arranca en "Pedir confirmación" ANTES de que la respuesta llegue', async () => {
    // El `useState` inicial, no una carrera: si el fetch tardara, no puede haber un instante donde
    // se lea "Automático" sin que el backend lo haya confirmado todavía.
    mockLeer.mockReturnValue(new Promise(() => {})); // nunca resuelve en este test
    await montar();

    expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Pedir confirmación');
  });

  it('muestra "Automático" sólo cuando el backend lo confirma', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: perfil({ modoCeremonia: 'automatico' }) });
    await montar();

    await waitFor(() =>
      expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Automático'),
    );
  });

  it('🔴 `no_disponible` se queda en el default fail-closed, no en un cartel de error', async () => {
    mockLeer.mockResolvedValue({ status: 'no_disponible' });
    await montar();

    expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Pedir confirmación');
  });

  it('🔴 `perfil: null` (tenant que nunca configuró nada) también fail-closed', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: null });
    await montar();

    expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Pedir confirmación');
  });

  it('🔴 un error de red no rompe ni muestra "Automático" — silencio, default fail-closed', async () => {
    mockLeer.mockRejectedValue(new Error('network'));
    await montar();

    expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Pedir confirmación');
  });

  it('nunca es tocable — no hay Pressable, ni una segunda opción (Decisión B)', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: perfil({ modoCeremonia: 'automatico' }) });
    await montar();

    await waitFor(() => expect(screen.getByTestId('indicador-modo-ceremonia-texto')).toHaveTextContent('Automático'));
    expect(screen.getByTestId('indicador-modo-ceremonia').props.accessibilityRole).toBeUndefined();
  });
});
