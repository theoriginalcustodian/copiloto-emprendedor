import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import type { CatalogService } from '../../lib/api';
import { ServiceCard } from './ServiceCard';

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
};

describe('ServiceCard', () => {
  it('usa el ícono de marca real (ServiceIcon) para una key mapeada, no la marca-letra', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    const card = screen.getByTestId('service-card-gmail');
    // gmail está mapeado en `design-system/serviceIcons.tsx` -> renderiza un <svg>, no un span
    // con la inicial (fiel al diseño, líneas 335-365 del mock).
    expect(card.querySelector('svg')).toBeInTheDocument();
  });

  it('NO muestra descripción (el diseño no la tiene — card compacta)', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    expect(screen.queryByText(BASE_SERVICE.description)).not.toBeInTheDocument();
  });

  it('estado conectado: muestra dot verde + "CONECTADO", sin botón conectar', () => {
    render(<ServiceCard service={BASE_SERVICE} onConnect={vi.fn()} />);
    expect(screen.getByTestId('service-card-gmail')).toHaveAttribute('data-state', 'connected');
    expect(screen.getByText('CONECTADO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /conectar/i })).not.toBeInTheDocument();
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
