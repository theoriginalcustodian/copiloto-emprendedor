import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import type { CatalogService } from '../../lib/api';
import { ServiceCard, loQueSePierde } from './ServiceCard';

const BASE_SERVICE: CatalogService = {
  key: 'gmail',
  display_name: 'Gmail',
  work_label: 'Mandar y leer emails',
  category: 'comunicacion',
  kind: 'composio',
  description: 'Conectá tu Gmail para que el copiloto redacte y envíe emails por vos.',
  capabilities: ['send_email'],
  connected: true,
  connect_path: '/composio/connect?service=gmail',
  disconnect_path: '/composio/connection?service=gmail',
};

describe('ServiceCard', () => {
  it('usa el ícono de marca real (ServiceIcon) para una key mapeada, no la marca-letra', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    const card = screen.getByTestId('service-card-gmail');
    // gmail está mapeado en `design-system/serviceIcons.tsx` -> renderiza un <svg>, no un span
    // con la inicial (fiel al diseño, líneas 335-365 del mock).
    expect(card.querySelector('svg')).toBeInTheDocument();
  });

  it('BL-W2: muestra la descripción por capacidad bajo el nombre', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    expect(screen.getByText(BASE_SERVICE.description)).toBeInTheDocument();
  });

  it('BL-W2: sin descripción no pinta un párrafo vacío', () => {
    render(<ServiceCard service={{ ...BASE_SERVICE, description: '' }} onConnect={vi.fn()} />);
    expect(screen.queryByTestId('service-card-description-gmail')).not.toBeInTheDocument();
  });

  it('estado conectado: muestra dot verde + "CONECTADO", sin botón conectar', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    expect(screen.getByTestId('service-card-gmail')).toHaveAttribute('data-state', 'connected');
    expect(screen.getByText('CONECTADO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /conectar/i })).not.toBeInTheDocument();
  });

  it('BL-C1: conectada + onDisconnect + disconnect_path -> ofrece «Desconectar» y pide confirmación que dice qué se pierde', () => {
    const onDisconnect = vi.fn().mockResolvedValue(undefined);
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Gmail' }));
    const confirm = screen.getByTestId('service-card-confirm-gmail');
    expect(confirm).toHaveTextContent('dejar de poder send_email');
    expect(onDisconnect).not.toHaveBeenCalled(); // un toque solo no corta nada
  });

  it('BL-C1: confirmar llama onDisconnect(service); cancelar no llama nada y cierra', async () => {
    const onDisconnect = vi.fn().mockResolvedValue(undefined);
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Gmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('service-card-confirm-gmail')).not.toBeInTheDocument();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Gmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith(BASE_SERVICE));
  });

  it('BL-C1: si el backend rechaza, la card sigue abierta y lo dice (no finge éxito)', async () => {
    const onDisconnect = vi.fn().mockRejectedValue(new Error('404'));
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Gmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos desconectarlo');
    expect(screen.getByTestId('service-card-confirm-gmail')).toBeInTheDocument();
  });

  it('BL-C1: sin disconnect_path (backend viejo) o sin handler no hay «Desconectar»', () => {
    const { rerender } = render(
      <ServiceCard service={{ ...BASE_SERVICE, disconnect_path: undefined }} onConnect={vi.fn()} onDisconnect={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /desconectar/i })).not.toBeInTheDocument();
    rerender(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /desconectar/i })).not.toBeInTheDocument();
  });

  it('BL-C1: Drive avisa en condicional de la consecuencia en la facturación; sin capacidades usa frase genérica', () => {
    expect(loQueSePierde({ ...BASE_SERVICE, key: 'googledrive', display_name: 'Google Drive' })).toContain(
      'Si tenés activado "guardar mis facturas en Drive"',
    );
    expect(loQueSePierde({ ...BASE_SERVICE, capabilities: [] })).toContain('dejar de poder usar Gmail');
  });

  it('estado sin-conectar: muestra botón "Conectar" que dispara onConnect(service)', () => {
    const onConnect = vi.fn();
    const disconnected = { ...BASE_SERVICE, connected: false };
    render(<ServiceCard service={disconnected} onConnect={onConnect} />);

    const button = screen.getByRole('button', { name: 'Conectar' });
    fireEvent.click(button);

    expect(onConnect).toHaveBeenCalledWith(disconnected);
    expect(screen.getByTestId('service-card-gmail')).toHaveAttribute('data-state', 'disconnected');
  });

  it('estado sin-conectar + connecting=true: deshabilita el botón y cambia el copy', () => {
    const disconnected = { ...BASE_SERVICE, connected: false };
    render(<ServiceCard service={disconnected} onConnect={vi.fn()} connecting />);
    const button = screen.getByRole('button', { name: 'Conectando…' });
    expect(button).toBeDisabled();
  });

  it('estado reconectar (override manual — sin señal real del catálogo todavía): badge + borde de alerta', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} state="reconnect" />);
    expect(screen.getByText('RECONECTAR')).toBeInTheDocument();
    expect(screen.getByTestId('service-card-gmail')).toHaveAttribute('data-state', 'reconnect');
  });
});
