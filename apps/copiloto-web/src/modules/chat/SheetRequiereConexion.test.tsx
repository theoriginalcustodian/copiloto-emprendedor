import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SheetRequiereConexion } from './SheetRequiereConexion';

const CONEXION = { service: 'gmail', label: 'Gmail', alcance: ['Leer mails', 'Enviar mails'], connectPath: '/composio/connect?service=gmail' };

describe('SheetRequiereConexion', () => {
  it('muestra el label y el alcance del catálogo, con «Conectar» y «Ahora no»', () => {
    render(<SheetRequiereConexion conexion={CONEXION} onConectar={() => {}} onAhoraNo={() => {}} />);
    expect(screen.getByText('Conectá Gmail')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-alcance').textContent).toContain('Enviar mails');
    expect(screen.getByTestId('sheet-requiere-conexion-conectar')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-ahora-no')).toBeTruthy();
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
