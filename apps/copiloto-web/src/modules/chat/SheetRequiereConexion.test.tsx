import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RequiereConexion } from '@copiloto/core';

import { SheetRequiereConexion } from './SheetRequiereConexion';

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

describe('SheetRequiereConexion', () => {
  it('muestra el label y el alcance del catálogo, con «Conectar» y «Ahora no»', () => {
    render(<SheetRequiereConexion conexion={CONEXION} onConectar={() => {}} onAhoraNo={() => {}} />);
    expect(screen.getByText('Conectá Gmail')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-alcance').textContent).toContain('Enviar mails');
    expect(screen.getByTestId('sheet-requiere-conexion-conectar')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-ahora-no')).toBeTruthy();
  });

  // PROTO4DEPS §A/§B — el MISMO core alimenta las dos apps: si el tipo cambia y la web no, en cuanto el
  // backend mande objetos la hoja revienta («Objects are not valid as a React child»).
  it('🔴 sin condicion ni pendiente (producción hoy): ni insignia ni bloque pendiente', () => {
    render(<SheetRequiereConexion conexion={CONEXION} onConectar={() => {}} onAhoraNo={() => {}} />);
    expect(screen.queryByTestId('sheet-requiere-conexion-condicion-0')).toBeNull();
    expect(screen.queryByTestId('sheet-requiere-conexion-pendiente')).toBeNull();
  });

  it('pinta la insignia de cada permiso y el pendiente del turno', () => {
    render(
      <SheetRequiereConexion
        conexion={{
          ...CONEXION,
          alcance: [
            { texto: 'Leer tus cobros y movimientos', condicion: 'solo_lectura' },
            { texto: 'Armar links de cobro cuando vos confirmás', condicion: 'requiere_ok' },
          ],
          pendiente: 'cuánto entró esta semana',
        }}
        onConectar={() => {}}
        onAhoraNo={() => {}}
      />,
    );
    expect(screen.getByTestId('sheet-requiere-conexion-condicion-0').textContent).toBe('Solo lectura');
    expect(screen.getByTestId('sheet-requiere-conexion-condicion-1').textContent).toBe('Nunca sin tu OK');
    expect(screen.getByTestId('sheet-requiere-conexion-pendiente').textContent).toBe(
      'Apenas conectes sigo con lo tuyo: cuánto entró esta semana.',
    );
  });

  it('los dos botones tocan lo suyo', () => {
    const onConectar = vi.fn();
    const onAhoraNo = vi.fn();
    render(<SheetRequiereConexion conexion={CONEXION} onConectar={onConectar} onAhoraNo={onAhoraNo} />);
    fireEvent.click(screen.getByTestId('sheet-requiere-conexion-conectar'));
    fireEvent.click(screen.getByTestId('sheet-requiere-conexion-ahora-no'));
    expect(onConectar).toHaveBeenCalledTimes(1);
    expect(onAhoraNo).toHaveBeenCalledTimes(1);
  });

  it('sin conexión (null) no renderiza contenido', () => {
    render(<SheetRequiereConexion conexion={null} onConectar={() => {}} onAhoraNo={() => {}} />);
    expect(screen.queryByTestId('sheet-requiere-conexion')).toBeNull();
  });
});
