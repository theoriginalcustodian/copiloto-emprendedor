import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  leerPerfilNegocio: jest.fn(),
  guardarPerfilNegocio: jest.fn(),
  leerEjemploDeTono: jest.fn(),
}));

import { guardarPerfilNegocio, leerEjemploDeTono, leerPerfilNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { PantallaTono } from './PantallaTono';

const mockLeer = leerPerfilNegocio as jest.MockedFunction<typeof leerPerfilNegocio>;
const mockGuardar = guardarPerfilNegocio as jest.MockedFunction<typeof guardarPerfilNegocio>;
const mockEjemplo = leerEjemploDeTono as jest.MockedFunction<typeof leerEjemploDeTono>;

const PERFIL = {
  queVende: '', aQuien: 'ambos' as const, nombreComercial: '', horarioAtencion: '', telefono: '', email: '',
  formalidad: 'cercano' as const, largoRespuesta: 'breve' as const, nombreCopiloto: 'Copi',
  modoCeremonia: 'confirmacion' as const, actualizadoEn: '2026-07-21T22:14:03.120Z',
};

const EJEMPLOS: Record<string, string> = {
  'cercano/breve': 'Dale, ya te dejo el presupuesto listo.',
  'formal/breve': 'Presupuesto listo para su revisión.',
  'cercano/detallado': 'Dale, te armo el presupuesto con el detalle.',
  'formal/detallado': 'He preparado el presupuesto con el detalle.',
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaTono onVolver={jest.fn()} />
    </ThemeProvider>,
  );
}

describe('PantallaTono — «Cómo hablarle» (K-15 / BL-X7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLeer.mockResolvedValue({ status: 'ok', perfil: PERFIL });
    mockGuardar.mockResolvedValue({ status: 'ok', perfil: PERFIL });
    mockEjemplo.mockImplementation(async (f, l) => EJEMPLOS[`${f}/${l}`] ?? null);
  });

  it('muestra el ejemplo de la combinación guardada y lo re-consulta al cambiar ANTES de guardar', async () => {
    await montar();
    expect(await screen.findByText(EJEMPLOS['cercano/breve'])).toBeTruthy();
    expect(mockEjemplo).toHaveBeenCalledWith('cercano', 'breve');
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('sin ejemplo (endpoint no disponible): se omite, no se inventa', async () => {
    mockEjemplo.mockResolvedValue(null);
    await montar();
    await waitFor(() => expect(mockEjemplo).toHaveBeenCalled());
    expect(screen.queryByTestId('tono-ejemplo')).toBeNull();
  });

  it('mapeo `hablar`: Cercano primero con su descripcion, label «Cómo lo llamás» y la nota «se guarda aparte»', async () => {
    await montar();
    await screen.findByTestId('tono-guardar');
    expect(screen.getByText('Te habla de vos, corto y directo.')).toBeTruthy();
    expect(screen.getByText('Más medido, sin modismos.')).toBeTruthy();
    expect(screen.getByText('Te explica el porqué de cada número.')).toBeTruthy();
    expect(screen.getByText('Cómo lo llamás')).toBeTruthy();
    expect(screen.getByTestId('tono-nota').props.children).toBe(
      'Esto se guarda aparte del perfil de tu negocio: cambiar el tono no te hace reescribir nada más.',
    );
    // Orden de pantalla: Cercano antes que Formal.
    const ids: string[] = [];
    const visitar = (n: any): void => {
      if (!n || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(visitar);
      if (typeof n.props?.testID === 'string') ids.push(n.props.testID);
      visitar(n.children);
    };
    visitar(screen.toJSON());
    const i = (re: RegExp) => ids.findIndex((x) => re.test(x));
    expect(i(/cercano/i)).toBeGreaterThanOrEqual(0);
    expect(i(/cercano/i)).toBeLessThan(i(/formal(?!idad)/i));
  });

  it('Guardar manda sólo las tres claves de tono (parcial)', async () => {
    await montar();
    await screen.findByTestId('tono-guardar');
    await fireEvent.press(screen.getByTestId('tono-guardar'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));
    expect(mockGuardar).toHaveBeenCalledWith({ formalidad: 'cercano', largoRespuesta: 'breve', nombreCopiloto: 'Copi' });
    expect(await screen.findByTestId('tono-guardado')).toBeTruthy();
  });
});
