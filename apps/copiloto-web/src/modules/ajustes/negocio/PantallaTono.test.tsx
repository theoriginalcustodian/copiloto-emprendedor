import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@copiloto/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@copiloto/core')>()),
  leerPerfilNegocio: vi.fn(),
  guardarPerfilNegocio: vi.fn(),
  leerEjemploDeTono: vi.fn(),
}));

import { guardarPerfilNegocio, leerEjemploDeTono, leerPerfilNegocio, type PerfilNegocio } from '@copiloto/core';

import { PantallaTono } from './PantallaTono';

const PERFIL: PerfilNegocio = {
  queVende: '', aQuien: 'ambos', nombreComercial: '', horarioAtencion: '', telefono: '', email: '',
  formalidad: 'cercano', largoRespuesta: 'breve', nombreCopiloto: 'Copi', modoCeremonia: 'confirmacion',
  actualizadoEn: '2026-07-21T22:14:03.120Z',
};

const EJEMPLOS: Record<string, string> = {
  'cercano/breve': 'Dale, ya te dejo el presupuesto listo.',
  'cercano/detallado': 'Dale, te armo el presupuesto con el detalle de cada ítem.',
  'formal/breve': 'Presupuesto listo para su revisión.',
  'formal/detallado': 'He preparado el presupuesto con el detalle de cada ítem para su revisión.',
};

describe('PantallaTono — «Cómo hablarle» (K-15 / BL-X7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leerPerfilNegocio).mockResolvedValue({ status: 'ok', perfil: PERFIL });
    vi.mocked(guardarPerfilNegocio).mockResolvedValue({ status: 'ok', perfil: PERFIL });
    vi.mocked(leerEjemploDeTono).mockImplementation(async (f, l) => EJEMPLOS[`${f}/${l}`] ?? null);
  });

  it('cambiar Formalidad o Largo recalcula el ejemplo, ANTES de guardar (4 combinaciones)', async () => {
    render(<PantallaTono />);
    expect(await screen.findByTestId('tono-ejemplo')).toHaveTextContent(EJEMPLOS['cercano/breve']);
    fireEvent.change(screen.getByTestId('tono-largo'), { target: { value: 'detallado' } });
    await waitFor(() => expect(screen.getByTestId('tono-ejemplo')).toHaveTextContent(EJEMPLOS['cercano/detallado']));
    fireEvent.change(screen.getByTestId('tono-formalidad'), { target: { value: 'formal' } });
    await waitFor(() => expect(screen.getByTestId('tono-ejemplo')).toHaveTextContent(EJEMPLOS['formal/detallado']));
    fireEvent.change(screen.getByTestId('tono-largo'), { target: { value: 'breve' } });
    await waitFor(() => expect(screen.getByTestId('tono-ejemplo')).toHaveTextContent(EJEMPLOS['formal/breve']));
    expect(guardarPerfilNegocio).not.toHaveBeenCalled();
  });

  it('sin ejemplo (endpoint no disponible) se omite; no se inventa uno', async () => {
    vi.mocked(leerEjemploDeTono).mockResolvedValue(null);
    render(<PantallaTono />);
    await screen.findByTestId('tono-seccion');
    expect(screen.queryByTestId('tono-ejemplo')).not.toBeInTheDocument();
  });

  it('Guardar manda sólo las tres claves de tono (parcial)', async () => {
    render(<PantallaTono />);
    await screen.findByTestId('tono-seccion');
    fireEvent.change(screen.getByTestId('tono-formalidad'), { target: { value: 'formal' } });
    fireEvent.click(screen.getByTestId('tono-guardar'));
    await waitFor(() => expect(guardarPerfilNegocio).toHaveBeenCalledTimes(1));
    expect(vi.mocked(guardarPerfilNegocio).mock.calls[0][0]).toEqual({
      formalidad: 'formal',
      largoRespuesta: 'breve',
      nombreCopiloto: 'Copi',
    });
    expect(await screen.findByTestId('tono-guardado')).toBeInTheDocument();
  });

  it('contrato foco-en-BODY: el foco va al primer campo CUANDO LLEGA EL DATO, no antes (control de timing)', async () => {
    let resolver!: (v: Awaited<ReturnType<typeof leerPerfilNegocio>>) => void;
    vi.mocked(leerPerfilNegocio).mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<PantallaTono />);
    // Mientras carga no hay campo: el foco NO puede estar en ningún campo (y un hook que sólo mirara el montaje tampoco lo logra después).
    expect(document.activeElement).toBe(document.body);
    resolver({ status: 'ok', perfil: PERFIL });
    const campo = await screen.findByTestId('tono-formalidad');
    await waitFor(() => expect(document.activeElement).toBe(campo));
  });
});
