import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. El catálogo (otra sección de la pantalla) se apaga como no disponible. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    leerPerfilNegocio: vi.fn(),
    guardarPerfilNegocio: vi.fn(),
    listarConceptos: vi.fn().mockResolvedValue({ status: 'no_disponible' }),
  };
});

import { guardarPerfilNegocio, leerPerfilNegocio, type PerfilNegocio } from '@copiloto/core';

import { PantallaPerfilNegocio } from './PantallaPerfilNegocio';

const mockLeer = vi.mocked(leerPerfilNegocio);
const mockGuardar = vi.mocked(guardarPerfilNegocio);

const PERFIL: PerfilNegocio = {
  queVende: 'Instalaciones eléctricas',
  aQuien: 'ambos',
  nombreComercial: 'Electricidad Pérez',
  horarioAtencion: 'Lunes a viernes de 8 a 17',
  telefono: '341 590 6309',
  email: 'contacto@elgalpon.com.ar',
  formalidad: 'cercano',
  largoRespuesta: 'breve',
  nombreCopiloto: 'Copi',
  modoCeremonia: 'confirmacion',
  actualizadoEn: '2026-07-21T22:14:03.120Z',
};

async function montar() {
  render(<PantallaPerfilNegocio />);
  await waitFor(() => expect(screen.getByTestId('perfil-negocio-telefono')).toBeInTheDocument());
}

describe('PantallaPerfilNegocio — BL-J10 (teléfono y email)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeer.mockResolvedValue({ status: 'ok', perfil: PERFIL });
    mockGuardar.mockResolvedValue({ status: 'ok', perfil: PERFIL });
  });

  it('precarga teléfono y email del perfil guardado', async () => {
    await montar();
    expect(screen.getByTestId('perfil-negocio-telefono')).toHaveValue('341 590 6309');
    expect(screen.getByTestId('perfil-negocio-email')).toHaveValue('contacto@elgalpon.com.ar');
  });

  it('guardar válido llama al backend con teléfono y email junto al resto de Negocio', async () => {
    await montar();
    fireEvent.change(screen.getByTestId('perfil-negocio-telefono'), { target: { value: '011 4444 5555' } });

    fireEvent.click(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({
      telefono: '011 4444 5555',
      email: 'contacto@elgalpon.com.ar',
    });
  });

  it('🔴 formato inválido: avisa en el campo y NO llama al backend', async () => {
    await montar();
    fireEvent.change(screen.getByTestId('perfil-negocio-telefono'), { target: { value: '590 630' } });
    fireEvent.change(screen.getByTestId('perfil-negocio-email'), { target: { value: 'sin-arroba' } });

    fireEvent.click(screen.getByTestId('perfil-negocio-guardar-negocio'));

    expect(await screen.findByTestId('perfil-negocio-telefono-error')).toHaveTextContent(
      'Poné al menos 8 dígitos, con característica',
    );
    expect(screen.getByTestId('perfil-negocio-email-error')).toHaveTextContent('Falta el @ o el dominio');
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('corregir el campo borra su aviso', async () => {
    await montar();
    fireEvent.change(screen.getByTestId('perfil-negocio-telefono'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('perfil-negocio-guardar-negocio'));
    expect(await screen.findByTestId('perfil-negocio-telefono-error')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('perfil-negocio-telefono'), { target: { value: '341 590 6309' } });

    expect(screen.queryByTestId('perfil-negocio-telefono-error')).not.toBeInTheDocument();
  });

  it('vaciar teléfono y email es válido (perfil a medio llenar) y viaja como string vacío', async () => {
    await montar();
    fireEvent.change(screen.getByTestId('perfil-negocio-telefono'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('perfil-negocio-email'), { target: { value: '' } });

    fireEvent.click(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({ telefono: '', email: '' });
  });
});

describe('PantallaPerfilNegocio — fila-resumen de tono (K-15 / BL-X7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeer.mockResolvedValue({ status: 'ok', perfil: PERFIL });
  });

  it('refleja el valor guardado y navega a la pantalla de tono', async () => {
    const onAbrirTono = vi.fn();
    render(<PantallaPerfilNegocio onAbrirTono={onAbrirTono} />);
    expect(await screen.findByTestId('perfil-negocio-tono-resumen')).toHaveTextContent('Cercano · Breve · Copi');
    fireEvent.click(screen.getByTestId('perfil-negocio-tono-fila'));
    expect(onAbrirTono).toHaveBeenCalledTimes(1);
  });

  it('el editor de tono ya NO vive acá (sin selects duplicados)', async () => {
    await montar();
    expect(screen.queryByTestId('perfil-negocio-formalidad')).not.toBeInTheDocument();
    expect(screen.queryByTestId('perfil-negocio-largo')).not.toBeInTheDocument();
  });
});
