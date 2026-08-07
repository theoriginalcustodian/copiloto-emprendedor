import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Se mockea SÓLO la capa de transporte de admin (`lib/api/admin`), no el design-system ni los
// providers: mismo criterio que AccountScreen.test.tsx — así el test ejercita el cableado real
// (Badge/Surface/Skeleton/Button de verdad) en vez de una promesa de que existe.
vi.mock('../../lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/admin')>();
  return {
    ...actual,
    adminSalud: vi.fn(),
    adminUso: vi.fn(),
    adminErrores: vi.fn(),
    adminSoporte: vi.fn(),
    adminAuditoria: vi.fn(),
    adminCambiarEstadoTenant: vi.fn(),
    adminReintentarError: vi.fn(),
  };
});

import '../../design-system/themes.css';
import { ThemeProvider, THEMES } from '../../design-system/ThemeProvider';
import { ForbiddenError } from '../../lib/api';
import {
  AdminNoDisponibleError,
  adminAuditoria,
  adminCambiarEstadoTenant,
  adminErrores,
  adminReintentarError,
  adminSalud,
  adminSoporte,
  adminUso,
} from '../../lib/api/admin';
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

// CONS6 — fixtures de A5/A4/A6, con las claves exactas del SELECT de cada módulo backend.
const ERRORES = {
  errores: [
    {
      id: 42,
      motivo_prohibido: null,
      fingerprint: 'fp-abc',
      workflow: 'FacturaWorkflow',
      error_type: 'TimeoutError',
      costura: null,
      estado: 'pendiente',
      ultima_nota: 'el gate rechazó el parche',
      dedupe_count: 7,
      intentos: 2,
      created_at: '2026-08-06T10:00:00Z',
      updated_at: '2026-08-06T12:00:00Z',
      tenants_afectados: 3,
    },
  ],
};

const SOPORTE = {
  tickets: [
    {
      id: 1,
      cliente_id: 'cliente-uno',
      tipo: 'bug',
      texto: 'no me deja facturar',
      created_at: '2026-08-06T11:00:00Z',
      derivo_en_autosanacion: true,
      estado_reparacion: 'reparado',
      origen: { archivo: 'afip_gateway.py' },
      ultima_nota: null,
      dedupe_count: 1,
    },
    {
      id: 2,
      cliente_id: 'cliente-dos',
      tipo: 'idea',
      texto: 'estaría bueno exportar a excel',
      created_at: '2026-08-06T11:30:00Z',
      derivo_en_autosanacion: false,
      estado_reparacion: null,
      origen: null,
      ultima_nota: null,
      dedupe_count: null,
    },
  ],
};

const AUDITORIA = {
  total: 1,
  eventos: [
    {
      id: 12,
      cliente_id: 'cliente-uno',
      admin_user_id: 'admin-uuid-largo',
      admin_email: 'operador@ejemplo.com',
      accion: 'tenant.estado',
      detalle: { de: 'active', a: 'suspended' },
      resultado: 'exitoso',
      created_at: '2026-08-07T02:14:33Z',
    },
  ],
};

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
    // Las tres de CONS6 arrancan resolviendo vacío: los tests de A1/A3 no deben romperse por una
    // promesa sin mockear, y un test que necesita datos los pisa con su propio `mockResolvedValue`.
    vi.mocked(adminErrores).mockReset().mockResolvedValue({ errores: [] });
    vi.mocked(adminSoporte).mockReset().mockResolvedValue({ tickets: [] });
    vi.mocked(adminAuditoria).mockReset().mockResolvedValue({ eventos: [], total: 0 });
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

describe('AdminScreen — CONS6 (A5 Errores + A4 Soporte + A6 Auditoría)', () => {
  beforeEach(() => {
    vi.mocked(adminSalud).mockReset().mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockReset().mockResolvedValue(USO);
    vi.mocked(adminErrores).mockReset().mockResolvedValue(ERRORES);
    vi.mocked(adminSoporte).mockReset().mockResolvedValue(SOPORTE);
    vi.mocked(adminAuditoria).mockReset().mockResolvedValue(AUDITORIA);
  });

  it('A5: muestra el error agrupado, con "veces" y "cuentas" SEPARADOS', async () => {
    renderAdmin();
    // 7 repeticiones sobre 3 cuentas no es lo mismo que 7 sobre 1: si la pantalla mostrara un solo
    // número, dos situaciones que piden respuestas opuestas se verían iguales.
    await waitFor(() => expect(screen.getByTestId('admin-dlq-fila-fp-abc')).toBeInTheDocument());
    const fila = screen.getByTestId('admin-dlq-fila-fp-abc');
    expect(fila).toHaveTextContent('FacturaWorkflow');
    expect(fila).toHaveTextContent('TimeoutError');
    expect(screen.getByTestId('admin-dlq-tenants-fp-abc')).toHaveTextContent('3');
    expect(fila).toHaveTextContent('el gate rechazó el parche');
  });

  it('A5: un error sin intentos dice "sin intentos", no una nota vacía', async () => {
    vi.mocked(adminErrores).mockResolvedValue({
      errores: [{ ...ERRORES.errores[0]!, ultima_nota: null }],
    });
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-dlq-fila-fp-abc')).toHaveTextContent('sin intentos'),
    );
  });

  it('A4: un ticket derivado muestra su estado de reparación; uno no derivado dice "sin derivar"', async () => {
    // Los dos casos juntos: sin trauma asociado NO se puede distinguir "esperando" de "el
    // clasificador dijo que no", así que la pantalla no debe afirmar ninguna de las dos.
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-ticket-1')).toBeInTheDocument());
    expect(screen.getByTestId('admin-ticket-reparacion-1')).toHaveTextContent('reparado');
    expect(screen.getByTestId('admin-ticket-reparacion-2')).toHaveTextContent('sin derivar');
  });

  it('A4: el texto del emprendedor se muestra (está DENTRO del boundary, a diferencia de A5)', async () => {
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-ticket-1')).toHaveTextContent('no me deja facturar'),
    );
  });

  it('A6: el `detalle` se renderiza sin asumir claves fijas', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-auditoria-detalle-12')).toBeInTheDocument());
    expect(screen.getByTestId('admin-auditoria-detalle-12')).toHaveTextContent('de: active');
    expect(screen.getByTestId('admin-auditoria-detalle-12')).toHaveTextContent('a: suspended');
  });

  it('A6: un `detalle` con OTRAS claves también se muestra -- control del anterior', async () => {
    // Sin este caso, un formateador que leyera `detalle.de`/`detalle.a` a mano pasaría el test de
    // arriba y mostraría vacío en la próxima acción que se agregue. El DoD del contrato pide
    // justamente esto: renderizar sin asumir la forma.
    vi.mocked(adminAuditoria).mockResolvedValue({
      total: 1,
      eventos: [
        {
          ...AUDITORIA.eventos[0]!,
          accion: 'error.reintentar',
          detalle: { trauma_id: 42, motivo: 'manual' },
        },
      ],
    });
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-auditoria-detalle-12')).toHaveTextContent('trauma_id: 42'),
    );
    expect(screen.getByTestId('admin-auditoria-detalle-12')).toHaveTextContent('motivo: manual');
  });

  it('A6: la pantalla lee `eventos`, la clave que manda el handler', async () => {
    // Guard de la costura, no del render. El 2026-08-07 el handler devolvía `{auditoria: [...]}` y
    // se alineó a `{eventos, total}` unas horas después; el cliente se rompió como corresponde
    // (`AdminNoDisponibleError`), pero nada en la suite fijaba la clave. Esto lo fija: si vuelve a
    // cambiar, falla acá con el nombre del problema en el título, no en producción con una tabla
    // que parece "no hay eventos todavía".
    vi.mocked(adminAuditoria).mockResolvedValue(AUDITORIA);
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-auditoria-fila-12')).toBeInTheDocument(),
    );
  });

  it('A6: sin detalle, muestra un guion en vez de "{}" o "null"', async () => {
    vi.mocked(adminAuditoria).mockResolvedValue({
      total: 1,
      eventos: [{ ...AUDITORIA.eventos[0]!, detalle: null }],
    });
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-auditoria-detalle-12')).toHaveTextContent('—'),
    );
  });

  it('las tres áreas vacías dicen qué falta, en vez de mostrar una tabla sin filas', async () => {
    vi.mocked(adminErrores).mockResolvedValue({ errores: [] });
    vi.mocked(adminSoporte).mockResolvedValue({ tickets: [] });
    vi.mocked(adminAuditoria).mockResolvedValue({ eventos: [], total: 0 });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-dlq-vacio')).toBeInTheDocument());
    expect(screen.getByTestId('admin-soporte-vacio')).toBeInTheDocument();
    expect(screen.getByTestId('admin-auditoria-vacia')).toBeInTheDocument();
  });

  it('si UNA de las tres áreas nuevas falla, la pantalla no muestra las otras a medias', async () => {
    // `Promise.all` es deliberado: una consola que pinta 4 áreas sanas y calla la que reventó le
    // miente al operador sobre el estado del sistema. Mejor un error honesto.
    vi.mocked(adminAuditoria).mockRejectedValue(new AdminNoDisponibleError('/admin/auditoria'));
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-no-disponible')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-dlq')).not.toBeInTheDocument();
  });

  it.each(THEMES)('las áreas nuevas renderizan bajo el tema "%s"', async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-dlq')).toBeInTheDocument());
    expect(screen.getByTestId('admin-soporte')).toBeInTheDocument();
    expect(screen.getByTestId('admin-auditoria')).toBeInTheDocument();
  });
});

/**
 * CONS7a — la única acción que MUTA que hoy tiene todo lo que necesita.
 *
 * (CONS7b, el reintento, NO está: `GET /admin/errores` no devuelve el `id` del trauma ni el motivo
 * del bloqueo, así que la pantalla no tiene con qué llamar al endpoint ni con qué deshabilitar el
 * botón. Pedido emitido al buzón el 2026-08-07; implementarlo inventando de dónde sacar el `id`
 * sería exactamente codificar la esperanza sobre la costura.)
 */
describe('AdminScreen — CONS7a (suspender / reactivar una cuenta)', () => {
  beforeEach(() => {
    vi.mocked(adminSalud).mockReset().mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockReset().mockResolvedValue(USO);
    vi.mocked(adminErrores).mockReset().mockResolvedValue({ errores: [] });
    vi.mocked(adminSoporte).mockReset().mockResolvedValue({ tickets: [] });
    vi.mocked(adminAuditoria).mockReset().mockResolvedValue({ eventos: [], total: 0 });
    vi.mocked(adminCambiarEstadoTenant).mockReset();
  });

  async function montarYEscribir(id: string) {
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-tenant')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('admin-tenant-input'), { target: { value: id } });
  }

  it('sin id escrito, los dos botones están deshabilitados', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-tenant')).toBeInTheDocument());
    expect(screen.getByTestId('admin-tenant-suspender')).toBeDisabled();
    expect(screen.getByTestId('admin-tenant-reactivar')).toBeDisabled();
  });

  it('con id escrito se habilitan — control positivo del anterior', async () => {
    // Sin esto, un `disabled` fijo pasaría el test de arriba y la pantalla no serviría para nada.
    await montarYEscribir('cliente-uno');
    expect(screen.getByTestId('admin-tenant-suspender')).toBeEnabled();
    expect(screen.getByTestId('admin-tenant-reactivar')).toBeEnabled();
  });

  it('suspender dispara POST con el id y el status correctos', async () => {
    vi.mocked(adminCambiarEstadoTenant).mockResolvedValue({
      cliente_id: 'cliente-uno',
      de: 'active',
      a: 'suspended',
    });
    await montarYEscribir('cliente-uno');
    fireEvent.click(screen.getByTestId('admin-tenant-suspender'));
    await waitFor(() =>
      expect(adminCambiarEstadoTenant).toHaveBeenCalledWith('cliente-uno', 'suspended'),
    );
  });

  it('reactivar manda `active` — la vuelta existe, no sólo la ida', async () => {
    vi.mocked(adminCambiarEstadoTenant).mockResolvedValue({
      cliente_id: 'cliente-uno',
      de: 'suspended',
      a: 'active',
    });
    await montarYEscribir('cliente-uno');
    fireEvent.click(screen.getByTestId('admin-tenant-reactivar'));
    await waitFor(() =>
      expect(adminCambiarEstadoTenant).toHaveBeenCalledWith('cliente-uno', 'active'),
    );
  });

  it('muestra `de → a`, no un "listo" — el endpoint es idempotente', async () => {
    // Suspender algo ya suspendido responde 200 igual. Un "listo" pelado no distinguiría "lo
    // cambié" de "ya estaba así", y esas dos cosas le importan a quien está mirando.
    vi.mocked(adminCambiarEstadoTenant).mockResolvedValue({
      cliente_id: 'cliente-uno',
      de: 'suspended',
      a: 'suspended',
    });
    await montarYEscribir('cliente-uno');
    fireEvent.click(screen.getByTestId('admin-tenant-suspender'));
    await waitFor(() =>
      expect(screen.getByTestId('admin-tenant-ok')).toHaveTextContent('suspended → suspended'),
    );
  });

  it('el error del backend se muestra INLINE con su texto, no como excepción', async () => {
    vi.mocked(adminCambiarEstadoTenant).mockRejectedValue(new Error('tenant no encontrado'));
    await montarYEscribir('fantasma');
    fireEvent.click(screen.getByTestId('admin-tenant-suspender'));
    await waitFor(() =>
      expect(screen.getByTestId('admin-tenant-error')).toHaveTextContent('tenant no encontrado'),
    );
    // Y la consola sigue en pie: un error de negocio no tumba la pantalla entera.
    expect(screen.getByTestId('admin-workers')).toBeInTheDocument();
  });

  it('mientras está en vuelo, deshabilita AMBOS botones y dice cuál se está ejecutando', async () => {
    let resolver: (v: { cliente_id: string; de: string; a: 'suspended' }) => void = () => {};
    vi.mocked(adminCambiarEstadoTenant).mockReturnValue(
      new Promise((r) => {
        resolver = r;
      }),
    );
    await montarYEscribir('cliente-uno');
    fireEvent.click(screen.getByTestId('admin-tenant-suspender'));

    await waitFor(() =>
      expect(screen.getByTestId('admin-tenant-suspender')).toHaveTextContent('Suspendiendo…'),
    );
    // El otro también se bloquea: dos mutaciones simultáneas sobre el mismo tenant no tienen
    // orden definido. Y sigue diciendo "Reactivar", no "Reactivando…" — se ve CUÁL está en vuelo.
    expect(screen.getByTestId('admin-tenant-reactivar')).toBeDisabled();
    expect(screen.getByTestId('admin-tenant-reactivar')).toHaveTextContent('Reactivar');

    resolver({ cliente_id: 'cliente-uno', de: 'active', a: 'suspended' });
    await waitFor(() =>
      expect(screen.getByTestId('admin-tenant-suspender')).toHaveTextContent('Suspender'),
    );
  });

  it('tras una mutación exitosa recarga la consola, para que Auditoría muestre el rastro', async () => {
    vi.mocked(adminCambiarEstadoTenant).mockResolvedValue({
      cliente_id: 'cliente-uno',
      de: 'active',
      a: 'suspended',
    });
    await montarYEscribir('cliente-uno');
    const antes = vi.mocked(adminAuditoria).mock.calls.length;
    fireEvent.click(screen.getByTestId('admin-tenant-suspender'));
    await waitFor(() =>
      expect(vi.mocked(adminAuditoria).mock.calls.length).toBeGreaterThan(antes),
    );
  });

  it('NO existe ningún control de acción en lote en la UI', async () => {
    // DoD del contrato. La ausencia del lote es parte del diseño, así que se testea como tal.
    await montarYEscribir('cliente-uno');
    const botones = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(botones.filter((t) => /todos|lote|masiv|seleccionad/i.test(t))).toEqual([]);
  });
});

/**
 * CONS7b — reintentar UN error. Desbloqueado el 2026-08-07 cuando `GET /admin/errores` empezó a
 * devolver `id` y `motivo_prohibido` (pedido → contrato → sustrato, todo por el buzón).
 *
 * Es la acción de más riesgo del sprint y **no reversible**, así que los dos sentidos del gate se
 * testean por separado: un botón siempre habilitado pasa el caso permitido, y uno siempre
 * deshabilitado pasa el caso prohibido. Sólo el par prueba que discrimina.
 */
describe('AdminScreen — CONS7b (reintentar un error)', () => {
  const ERROR_PERMITIDO = { ...ERRORES.errores[0]!, id: 42, motivo_prohibido: null };
  const ERROR_PROHIBIDO = {
    ...ERRORES.errores[0]!,
    id: 99,
    fingerprint: 'fp-afip',
    workflow: 'AfipFacturaWorkflow',
    tenants_afectados: 1,
    motivo_prohibido: 'dominio DIAGNOSTIC_ONLY: afip_gateway -- efecto irreversible y externo',
  };

  beforeEach(() => {
    vi.mocked(adminSalud).mockReset().mockResolvedValue(SALUD_SANA);
    vi.mocked(adminUso).mockReset().mockResolvedValue(USO);
    vi.mocked(adminSoporte).mockReset().mockResolvedValue({ tickets: [] });
    vi.mocked(adminAuditoria).mockReset().mockResolvedValue({ eventos: [], total: 0 });
    vi.mocked(adminErrores).mockReset().mockResolvedValue({ errores: [ERROR_PERMITIDO] });
    vi.mocked(adminReintentarError).mockReset();
  });

  it('un error reintentable tiene el botón ACTIVO y no muestra motivo', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeInTheDocument());
    expect(screen.getByTestId('admin-reintentar-42')).toBeEnabled();
    expect(screen.queryByTestId('admin-motivo-42')).not.toBeInTheDocument();
  });

  it('un dominio prohibido lo deshabilita CON el motivo del backend visible en el DOM', async () => {
    vi.mocked(adminErrores).mockResolvedValue({ errores: [ERROR_PROHIBIDO] });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-99')).toBeDisabled());
    // Visible como texto, NO como `title`: un tooltip no existe en touch ni lo lee un lector de
    // pantalla en el mismo flujo (DoD del contrato).
    const motivo = screen.getByTestId('admin-motivo-99');
    expect(motivo).toBeInTheDocument();
    expect(motivo).toHaveTextContent('afip_gateway');
    expect(motivo).not.toHaveAttribute('title');
  });

  it('el texto del motivo NO lo redacta el front: es el string del backend, tal cual', async () => {
    vi.mocked(adminErrores).mockResolvedValue({
      errores: [{ ...ERROR_PROHIBIDO, motivo_prohibido: 'un motivo completamente distinto' }],
    });
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-motivo-99')).toHaveTextContent(
        'un motivo completamente distinto',
      ),
    );
  });

  it('el copy dice "1 de N" cuando el error afecta a varias cuentas', async () => {
    // La fila está agrupada por firma; el `id` es de UN representante. "Reintentar" a secas sobre
    // una fila que dice "3 cuentas" haría creer que se reintentaron las 3.
    vi.mocked(adminErrores).mockResolvedValue({
      errores: [{ ...ERROR_PERMITIDO, tenants_afectados: 3 }],
    });
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId('admin-reintentar-42')).toHaveTextContent('Reintentar (1 de 3)'),
    );
  });

  it('con UNA sola cuenta afectada, el copy es "Reintentar" a secas — control del anterior', async () => {
    vi.mocked(adminErrores).mockResolvedValue({
      errores: [{ ...ERROR_PERMITIDO, tenants_afectados: 1 }],
    });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeInTheDocument());
    expect(screen.getByTestId('admin-reintentar-42').textContent).toBe('Reintentar');
  });

  it('reintentar manda el `id` del trauma, no el fingerprint', async () => {
    vi.mocked(adminReintentarError).mockResolvedValue({ trauma_id: 42, estado: 'pendiente' });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeEnabled());
    fireEvent.click(screen.getByTestId('admin-reintentar-42'));
    await waitFor(() => expect(adminReintentarError).toHaveBeenCalledWith(42));
  });

  it('un 409 del backend se muestra inline con su motivo, y no tumba la pantalla', async () => {
    // La UI no debería llegar acá (el botón está deshabilitado si hay motivo), pero el listado
    // puede estar desactualizado respecto del gate — y el guard real es el backend, no la pantalla.
    vi.mocked(adminReintentarError).mockRejectedValue(
      new Error('dominio DIAGNOSTIC_ONLY: afip_gateway'),
    );
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeEnabled());
    fireEvent.click(screen.getByTestId('admin-reintentar-42'));
    await waitFor(() =>
      expect(screen.getByTestId('admin-reintento-aviso-42')).toHaveTextContent('afip_gateway'),
    );
    expect(screen.getByTestId('admin-workers')).toBeInTheDocument();
  });

  it('tras reintentar recarga, para que el estado nuevo y la auditoría se vean', async () => {
    vi.mocked(adminReintentarError).mockResolvedValue({ trauma_id: 42, estado: 'pendiente' });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeEnabled());
    const antes = vi.mocked(adminAuditoria).mock.calls.length;
    fireEvent.click(screen.getByTestId('admin-reintentar-42'));
    await waitFor(() => expect(vi.mocked(adminAuditoria).mock.calls.length).toBeGreaterThan(antes));
  });

  it('NO hay ningún control de reintento en LOTE — la ausencia es parte del diseño', async () => {
    vi.mocked(adminErrores).mockResolvedValue({
      errores: [ERROR_PERMITIDO, { ...ERROR_PERMITIDO, id: 43, fingerprint: 'fp-dos' }],
    });
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('admin-reintentar-42')).toBeInTheDocument());
    const textos = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(textos.filter((t) => /todos|lote|masiv|seleccionad/i.test(t))).toEqual([]);
    // Y no hay checkboxes de selección múltiple.
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });
});
