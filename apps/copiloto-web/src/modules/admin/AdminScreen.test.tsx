import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Se mockea SÓLO la capa de transporte de admin (`lib/api/admin`), no el design-system ni los
// providers: mismo criterio que AccountScreen.test.tsx — así el test ejercita el cableado real
// (Badge/Surface/Skeleton/Button de verdad) en vez de una promesa de que existe.
vi.mock('../../lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/admin')>();
  return { ...actual, adminSalud: vi.fn(), adminUso: vi.fn() };
});

import '../../design-system/themes.css';
import { ThemeProvider, THEMES } from '../../design-system/ThemeProvider';
import { ForbiddenError } from '../../lib/api';
import { AdminNoDisponibleError, adminSalud, adminUso } from '../../lib/api/admin';
import { AdminScreen } from './AdminScreen';

const SALUD_SANA = {
  ok: true,
  workers: { task_queue: 'agent-emprendedor', pollers: 2, ok: true },
  schedules: { total: 4, pausados: 0, sin_proxima_corrida: 0, ok: true },
};

const SALUD_ROTA = {
  ok: false,
  workers: { task_queue: 'agent-emprendedor', pollers: 0, ok: false },
  schedules: { total: 4, pausados: 1, sin_proxima_corrida: 2, ok: false },
};

const USO = {
  horas: 24,
  gasto_llm: [
    { cliente_id: 'cliente-uno', turnos_llm: 10, tokens_totales: 5000, modelo_mas_usado: 'sonnet' },
  ],
  uso_tools: [{ cliente_id: 'cliente-uno', tool: 'registrar_gasto', llamadas: 3 }],
  error_rate_tools: [
    { cliente_id: 'cliente-uno', errores: 1, llamadas_totales: 4, error_rate_pct: 25 },
  ],
};

const USO_VACIO = { horas: 24, gasto_llm: [], uso_tools: [], error_rate_tools: [] };

function renderAdmin() {
  return render(
    <ThemeProvider>
      <AdminScreen />
    </ThemeProvider>,
  );
}

describe('AdminScreen (CONS5 — A1 Salud + A3 Uso)', () => {
  beforeEach(() => {
    vi.mocked(adminSalud).mockReset();
    vi.mocked(adminUso).mockReset();
  });

  it('muestra los datos de salud y de uso cuando ambos endpoints responden', async () => {
    vi.mocked(adminSalud).mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockResolvedValue(USO);
    renderAdmin();

    await waitFor(() => expect(screen.getByTestId('admin-workers')).toBeInTheDocument());
    expect(screen.getByTestId('admin-pollers')).toHaveTextContent('2');
    expect(screen.getByTestId('admin-salud-badge')).toHaveTextContent('Todo en orden');
    expect(screen.getByTestId('admin-gasto')).toHaveTextContent('5.000');
  });

  it('con salud NO ok, el estado se muestra como que requiere atención', async () => {
    // Control negativo del test anterior: sin esto, un badge fijo en "Todo en orden" pasaría igual.
    vi.mocked(adminSalud).mockResolvedValue(SALUD_ROTA);
    vi.mocked(adminUso).mockResolvedValue(USO);
    renderAdmin();

    await waitFor(() =>
      expect(screen.getByTestId('admin-salud-badge')).toHaveTextContent('Requiere atención'),
    );
    expect(screen.getByTestId('admin-sin-proxima')).toHaveTextContent('2');
  });

  it('muestra el esqueleto mientras carga', () => {
    vi.mocked(adminSalud).mockReturnValue(new Promise(() => {}));
    vi.mocked(adminUso).mockReturnValue(new Promise(() => {}));
    renderAdmin();
    expect(screen.getByTestId('admin-cargando')).toBeInTheDocument();
  });

  it('si /admin/* no está montado, lo dice — no muestra un error de parseo ni datos en cero', async () => {
    vi.mocked(adminSalud).mockRejectedValue(new AdminNoDisponibleError('/admin/salud'));
    vi.mocked(adminUso).mockRejectedValue(new AdminNoDisponibleError('/admin/uso'));
    renderAdmin();

    await waitFor(() => expect(screen.getByTestId('admin-no-disponible')).toBeInTheDocument());
    // Lo que NO debe pasar: pintar la consola con ceros como si el sistema estuviera sano.
    expect(screen.queryByTestId('admin-workers')).not.toBeInTheDocument();
  });

  it('un 403 se muestra como falta de permiso, distinto de "no está montado"', async () => {
    vi.mocked(adminSalud).mockRejectedValue(new ForbiddenError('admin claim required'));
    vi.mocked(adminUso).mockRejectedValue(new ForbiddenError('admin claim required'));
    renderAdmin();

    await waitFor(() => expect(screen.getByTestId('admin-sin-permiso')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-no-disponible')).not.toBeInTheDocument();
  });

  it('una ventana sin datos dice "sin actividad", no cero', async () => {
    vi.mocked(adminSalud).mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockResolvedValue(USO_VACIO);
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-gasto-vacio')).toBeInTheDocument());
  });

  it('un error_rate nulo se muestra como "sin llamadas", NO como 0%', async () => {
    // El SQL divide por `nullif(...)`: null = no hubo llamadas. Pintarlo 0% diría "todo sano"
    // sobre una ventana vacía — exactamente el instrumento que confirma en vez de verificar.
    vi.mocked(adminSalud).mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockResolvedValue({
      ...USO,
      error_rate_tools: [
        { cliente_id: 'cliente-uno', errores: 0, llamadas_totales: 0, error_rate_pct: null },
      ],
    });
    renderAdmin();

    await waitFor(() =>
      expect(screen.getByTestId('admin-rate-cliente-uno')).toHaveTextContent('sin llamadas'),
    );
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    vi.mocked(adminSalud).mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockResolvedValue(USO);
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-screen')).toBeInTheDocument());
  });
});
