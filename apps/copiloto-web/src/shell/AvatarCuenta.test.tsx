import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarCuenta } from './AvatarCuenta';

const mockCatalog = vi.fn();
vi.mock('../lib/api/catalog', () => ({ catalog: () => mockCatalog() }));
vi.mock('../auth/useSession', () => ({ useSession: () => ({ me: { cliente_id: 'abc' } }) }));

const servicio = (status?: string) => ({ key: 'mercadopago', connected: status === 'conectado', ...(status ? { status } : {}) });

describe('AvatarCuenta — punto de estado (K-09 / BL-J4)', () => {
  beforeEach(() => mockCatalog.mockReset());

  it('≥ 1 servicio caído → punto encendido', async () => {
    mockCatalog.mockResolvedValue({ services: [servicio('conectado'), servicio('caido')] });
    render(<AvatarCuenta onPress={vi.fn()} />);
    expect(await screen.findByTestId('avatar-cuenta-punto')).toBeInTheDocument();
  });

  it('ninguno caído → apagado', async () => {
    mockCatalog.mockResolvedValue({ services: [servicio('conectado'), servicio('nunca_conectado')] });
    render(<AvatarCuenta onPress={vi.fn()} />);
    await waitFor(() => expect(mockCatalog).toHaveBeenCalled());
    expect(screen.queryByTestId('avatar-cuenta-punto')).not.toBeInTheDocument();
  });

  it('backend viejo (sin status) o catálogo caído → apagado, nunca inventa el aviso', async () => {
    mockCatalog.mockResolvedValueOnce({ services: [servicio()] });
    const { unmount } = render(<AvatarCuenta onPress={vi.fn()} />);
    await waitFor(() => expect(mockCatalog).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('avatar-cuenta-punto')).not.toBeInTheDocument();
    unmount();
    mockCatalog.mockRejectedValueOnce(new Error('x'));
    render(<AvatarCuenta onPress={vi.fn()} />);
    await waitFor(() => expect(mockCatalog).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('avatar-cuenta-punto')).not.toBeInTheDocument();
  });
});
