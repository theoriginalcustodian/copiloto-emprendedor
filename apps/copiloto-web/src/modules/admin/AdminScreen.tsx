import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { Badge, Button, Skeleton, Surface } from '../../design-system';
import {
  AdminNoDisponibleError,
  adminAuditoria,
  adminCambiarEstadoTenant,
  adminDetalleTicketSoporte,
  adminErrores,
  adminListarTicketsSoporte,
  adminReintentarError,
  adminResponderTicketSoporte,
  adminSalud,
  adminSoporte,
  adminTenants,
  adminUso,
} from '../../lib/api/admin';
import type {
  AdminSalud,
  AdminUso,
  CanalTicketSoporte,
  EstadoTenant,
  EstadoTicketSoporte,
  FilaAuditoria,
  FilaError,
  FilaTenant,
  FilaTicket,
  MensajeTicketSoporte,
  TicketSoporte,
} from '../../lib/api/admin';
import { ForbiddenError } from '../../lib/api';
import './admin.css';

/**
 * Consola de operador — CONS5, áreas A1 (Salud) y A3 (Uso y costo). **Reusa M-WEB, no crea**:
 * `Badge`/`Surface`/`Skeleton`/`Button` del design-system, el contrato CSS de `.X-screen`
 * (`flex:1; min-height:0; overflow-y:auto`) y la máquina de estados de lista de `ActividadScreen`
 * (`cargando | ok | error | no_disponible`).
 *
 * `no_disponible` NO es decorativo: `/admin/*` sólo existe si `serve.py` le pasa `admin_app` a
 * `web.py` (`web.py:1021-1023`), y cuando no está montado el front-door devuelve **200 con el
 * index.html de la SPA**, no un 404. `lib/api/admin.ts` traduce ese caso a
 * `AdminNoDisponibleError` para que acá se muestre "no está montado" en vez de un error de parseo.
 */
type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible' | 'sin_permiso';

const VENTANAS = [24, 72, 168] as const;

function etiquetaVentana(horas: number): string {
  if (horas === 24) return '24 h';
  if (horas === 168) return '7 días';
  return `${horas} h`;
}

/** Un `null` de `error_rate_pct` es "no hubo llamadas", NO "0% de error" — el SQL divide por
 *  `nullif(...)`. Mostrarlo como 0% diría "todo sano" sobre una ventana sin datos. */
function formatearErrorRate(pct: number | null): string {
  return pct == null ? 'sin llamadas' : `${pct}%`;
}

/** Fecha corta y local. Si el backend manda algo que `Date` no entiende, se muestra el crudo en vez
 *  de "Invalid Date": un dato ilegible es información, un cartel de error no. */
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * `detalle` de auditoría es un objeto ARBITRARIO — hoy `tenant.estado` manda `{de, a}`, mañana otra
 * acción mandará otras claves. Se renderiza recorriendo lo que venga (DoD del contrato A6:
 * "renderizarlo sin asumir claves fijas"); asumir `{de, a}` haría que la próxima acción se muestre
 * vacía sin que nadie se entere.
 */
function formatearDetalle(detalle: Record<string, unknown> | null): string {
  if (!detalle || Object.keys(detalle).length === 0) return '—';
  return Object.entries(detalle)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** El estado de un trauma decide el color del chip. Desconocido -> neutral, nunca "ok": inventarle
 *  buena salud a un estado que no conocemos es exactamente el instrumento que confirma. */
function variantePorEstado(estado: string | null): 'ok' | 'warning' | 'danger' | 'neutral' {
  if (estado === 'reparado' || estado === 'resuelto') return 'ok';
  if (estado === 'pendiente' || estado === 'en_curso') return 'warning';
  if (estado === 'fallido' || estado === 'descartado') return 'danger';
  return 'neutral';
}

/** SOP6/S6-13 — estados del ticket en castellano, DISTINGUIBLES a la vista (Badge con color
 * propio), no sólo por texto chico. Función DEDICADA, no reuso de `variantePorEstado`: ese mapa es
 * del dominio de traumas ('reparado'/'pendiente'/'fallido'...) — mismo string 'pendiente' en otro
 * dominio no significaría lo mismo, y reusarlo sería la trampa de "el nombre es una hipótesis". */
const ETIQUETA_ESTADO_TICKET: Record<EstadoTicketSoporte, string> = {
  abierto: 'Abierto',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
};

const ETIQUETA_CANAL_TICKET: Record<CanalTicketSoporte, string> = {
  soporte_tecnico: 'Soporte técnico',
  como_uso_la_app: 'Cómo uso la app',
};

function variantePorEstadoTicket(estado: EstadoTicketSoporte): 'ok' | 'warning' | 'neutral' {
  if (estado === 'abierto') return 'warning'; // pendiente de respuesta del operador
  if (estado === 'respondido') return 'ok';
  return 'neutral'; // cerrado
}

export function AdminScreen() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [salud, setSalud] = useState<AdminSalud | null>(null);
  const [uso, setUso] = useState<AdminUso | null>(null);
  const [errores, setErrores] = useState<FilaError[]>([]);
  const [tickets, setTickets] = useState<FilaTicket[]>([]);
  const [auditoria, setAuditoria] = useState<FilaAuditoria[]>([]);
  const [horas, setHoras] = useState<number>(24);
  const [detalle, setDetalle] = useState<string>('');

  // ---- CONS7a: suspender / reactivar un tenant ----
  const [tenantId, setTenantId] = useState('');
  // CTA1 — la lista tiene su propio estado de carga, separado del `estado` general de la pantalla.
  const [tenants, setTenants] = useState<FilaTenant[]>([]);
  const [tenantsEstado, setTenantsEstado] = useState<'cargando' | 'ok' | 'no_disponible'>('cargando');
  const [filtroTenant, setFiltroTenant] = useState('');
  // `enviando` guarda QUÉ acción está en vuelo, no un booleano: con dos botones sobre el mismo
  // campo, un `true` pelado deshabilitaría los dos sin decir cuál se está ejecutando.
  const [enviando, setEnviando] = useState<EstadoTenant | null>(null);
  const [resultadoTenant, setResultadoTenant] = useState<string | null>(null);
  const [errorTenant, setErrorTenant] = useState<string | null>(null);

  // ---- CONS7b: reintentar UN error ----
  // Guarda el `id` en vuelo, no un booleano: la tabla tiene un botón por fila y hay que bloquear
  // sólo el que se apretó (bloquear todos sería mentir sobre qué está pasando).
  const [reintentando, setReintentando] = useState<number | null>(null);
  const [avisoReintento, setAvisoReintento] = useState<{ id: number; texto: string; ok: boolean } | null>(
    null,
  );

  // ---- SOP6: tickets de soporte (hilo con el usuario), respondidos desde acá ----
  // Mismo criterio que CTA1: estado de carga PROPIO, separado del `Promise.all` general — al
  // escribir esto `/admin/soporte/tickets*` todavía no existe en `main`, y su ausencia no puede
  // apagar Salud/Uso/Errores/Soporte(feedback)/Auditoría, que sí funcionan.
  const [ticketsAdmin, setTicketsAdmin] = useState<TicketSoporte[]>([]);
  const [ticketsAdminEstado, setTicketsAdminEstado] = useState<'cargando' | 'ok' | 'no_disponible'>(
    'cargando',
  );
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<EstadoTicketSoporte | ''>('');
  const [filtroCodigoTicket, setFiltroCodigoTicket] = useState('');
  // El seleccionado y su detalle van separados: seleccionar es instantáneo (resalta la fila),
  // el detalle tarda un GET — sin esto el click parecería no responder hasta que la red vuelva.
  const [ticketSeleccionado, setTicketSeleccionado] = useState<number | null>(null);
  const [detalleTicket, setDetalleTicket] = useState<{
    ticket: TicketSoporte;
    mensajes: MensajeTicketSoporte[];
  } | null>(null);
  const [detalleTicketEstado, setDetalleTicketEstado] = useState<'cargando' | 'ok' | 'error'>('ok');
  const [textoRespuesta, setTextoRespuesta] = useState('');
  // Guarda CUÁL acción está en vuelo (responder vs. responder-y-cerrar), mismo motivo que
  // `enviando` de CTA1: dos botones sobre el mismo campo, un booleano pelado no diría cuál corre.
  const [respondiendo, setRespondiendo] = useState<'responder' | 'cerrar' | null>(null);
  const [avisoRespuesta, setAvisoRespuesta] = useState<{ texto: string; ok: boolean } | null>(null);

  // Mismo guard que ActividadScreen: no tocar estado tras desmontar.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const cargar = useCallback(async (ventana: number) => {
    setEstado('cargando');
    try {
      // En paralelo: son áreas independientes y no tiene sentido serializarlas.
      // A5/A4/A6 no dependen de `ventana` -- se recargan igual al cambiarla, y eso es deseable
      // (refresca), no un descuido: la alternativa es un segundo efecto y dos estados de carga
      // para ahorrar tres GET baratos contra una consola que mira una persona.
      const [s, u, e, t, a] = await Promise.all([
        adminSalud(),
        adminUso(ventana),
        adminErrores(),
        adminSoporte(),
        adminAuditoria(),
      ]);
      if (!vivo.current) return;
      setSalud(s);
      setUso(u);
      setErrores(e.errores);
      setTickets(t.tickets);
      setAuditoria(a.eventos);
      setEstado('ok');
    } catch (err) {
      if (!vivo.current) return;
      if (err instanceof AdminNoDisponibleError) {
        setDetalle(err.message);
        setEstado('no_disponible');
      } else if (err instanceof ForbiddenError) {
        // Distinto de "no montado": acá el backend contestó, y dijo que no.
        setDetalle(err.detail ?? 'Tu cuenta no tiene el permiso de administrador.');
        setEstado('sin_permiso');
      } else {
        setDetalle(err instanceof Error ? err.message : 'Error desconocido');
        setEstado('error');
      }
    }
  }, []);

  useEffect(() => {
    void cargar(horas);
  }, [cargar, horas]);

  /**
   * CTA1 — el listado de cuentas se carga APARTE del `Promise.all` de arriba, y no es una cuestión
   * de estilo: `GET /admin/tenants` todavía no existe en `main`, así que sumarlo a esa promesa haría
   * que su 404 tirara `AdminNoDisponibleError` y **la consola entera** —Salud, Uso, Errores,
   * Soporte, Auditoría— se apagara por un área que falta. Un área ausente no puede voltear a las
   * cinco que sí funcionan.
   *
   * Por eso además se traga cualquier error: esta sección degrada al campo manual de abajo, que es
   * exactamente lo que había antes de CTA1. Sin lista no se pierde nada; con lista se gana.
   */
  const cargarTenants = useCallback(async () => {
    setTenantsEstado('cargando');
    try {
      const r = await adminTenants();
      if (!vivo.current) return;
      setTenants(r.tenants);
      setTenantsEstado('ok');
    } catch {
      if (!vivo.current) return;
      setTenants([]);
      setTenantsEstado('no_disponible');
    }
  }, []);

  useEffect(() => {
    void cargarTenants();
  }, [cargarTenants]);

  /** SOP6/S6-9 — lista de tickets, filtrable por estado/código (el backend hace el filtro, no el
   * cliente: `limite` está topeado del lado del servidor y un filtro local mentiría sobre cuántos
   * hay en total). Mismo `try/catch` que traga y degrada de `cargarTenants` — sin lista, la
   * sección no desaparece: sólo pierde el filtro. */
  const cargarTicketsAdmin = useCallback(async () => {
    setTicketsAdminEstado('cargando');
    try {
      const r = await adminListarTicketsSoporte({
        estado: filtroEstadoTicket || undefined,
        codigo: filtroCodigoTicket.trim() || undefined,
      });
      if (!vivo.current) return;
      setTicketsAdmin(r.tickets);
      setTicketsAdminEstado('ok');
    } catch {
      if (!vivo.current) return;
      setTicketsAdmin([]);
      setTicketsAdminEstado('no_disponible');
    }
  }, [filtroEstadoTicket, filtroCodigoTicket]);

  useEffect(() => {
    void cargarTicketsAdmin();
  }, [cargarTicketsAdmin]);

  /** Abre (o cierra, si ya estaba abierto) el detalle de un ticket. Selección optimista +
   * detalle async, ver comentario de los estados. */
  const abrirDetalleTicket = useCallback(async (id: number) => {
    if (ticketSeleccionado === id) {
      setTicketSeleccionado(null);
      setDetalleTicket(null);
      return;
    }
    setTicketSeleccionado(id);
    setDetalleTicket(null);
    setTextoRespuesta('');
    setAvisoRespuesta(null);
    setDetalleTicketEstado('cargando');
    try {
      const r = await adminDetalleTicketSoporte(id);
      if (!vivo.current) return;
      setDetalleTicket(r);
      setDetalleTicketEstado('ok');
    } catch {
      if (!vivo.current) return;
      setDetalleTicketEstado('error');
    }
  }, [ticketSeleccionado]);

  /**
   * S6-10 — responder (y opcionalmente cerrar) el ticket abierto. El `estado` que se muestra
   * después de responder es el que **devuelve el servidor** (`r.estado`), nunca uno asumido por la
   * UI — mismo criterio que `cambiarEstado` de CTA1 con `de → a`.
   */
  const responderTicketAdmin = useCallback(
    async (cerrar: boolean) => {
      const id = ticketSeleccionado;
      const texto = textoRespuesta.trim();
      if (id == null || !texto || respondiendo) return;
      setRespondiendo(cerrar ? 'cerrar' : 'responder');
      setAvisoRespuesta(null);
      try {
        const r = await adminResponderTicketSoporte(id, texto, cerrar);
        if (!vivo.current) return;
        setAvisoRespuesta({ texto: `Respondido — el ticket quedó "${r.estado}".`, ok: true });
        setTextoRespuesta('');
        // Recarga DIRECTA, no vía `abrirDetalleTicket`: esa función togglea (cierra) cuando el id
        // ya está seleccionado, que es justo el caso acá — llamarla cerraría el panel en vez de
        // refrescarlo. La lista (S6-10: "el estado que se ve es el que devolvió el servidor")
        // también se recarga, para que la fila cambie de Badge sin que el operador refresque.
        try {
          const fresco = await adminDetalleTicketSoporte(id);
          if (vivo.current) setDetalleTicket(fresco);
        } catch {
          /* el aviso de éxito ya se mostró; un refresh fallido del detalle no lo invalida */
        }
        void cargarTicketsAdmin();
      } catch (err) {
        if (!vivo.current) return;
        setAvisoRespuesta({
          texto: err instanceof Error && err.message ? err.message : 'No se pudo responder.',
          ok: false,
        });
      } finally {
        if (vivo.current) setRespondiendo(null);
      }
    },
    [ticketSeleccionado, textoRespuesta, respondiendo, cargarTicketsAdmin],
  );

  // Filtro por email, en el cliente: son 19 cuentas hoy y el endpoint no ofrece búsqueda. Si esto
  // creciera a miles, el filtro se muda al backend — no antes, que sería inventar un parámetro que
  // el contrato no tiene.
  const filtroNormalizado = filtroTenant.trim().toLowerCase();
  const tenantsFiltrados = filtroNormalizado
    ? tenants.filter((t) => (t.email ?? '').toLowerCase().includes(filtroNormalizado))
    : tenants;

  /**
   * CONS7a. Patrón de `PasoResumen.tsx:56-80`, que es el canónico del repo: `enviando` deshabilita
   * y cambia el label, `try/finally` para no dejar el botón colgado si algo lanza, y el error de
   * negocio **inline como aviso**, no como excepción. No se crea un modal de confirmación genérico:
   * el contrato lo prohíbe explícitamente y no existe uno en `copiloto-web`.
   */
  const cambiarEstado = useCallback(
    async (status: EstadoTenant, idExplicito?: string) => {
      // CTA1: la fila de la lista pasa su `cliente_id`; el campo manual sigue usando el tipeado.
      // El id viaja como ARGUMENTO y no por estado: apretar el boton de una fila y que la accion
      // saliera contra lo ultimo que quedo escrito en el input seria un disparo al tenant
      // equivocado, sin sintoma.
      const id = (idExplicito ?? tenantId).trim();
      if (!id || enviando) return;
      setEnviando(status);
      setErrorTenant(null);
      setResultadoTenant(null);
      try {
        const r = await adminCambiarEstadoTenant(id, status);
        if (!vivo.current) return;
        // Se muestra `de → a` y no "listo": el endpoint es idempotente, así que suspender algo ya
        // suspendido responde 200 igual. Un "listo" pelado no distinguiría "lo cambié" de "ya
        // estaba así", y esas dos cosas le importan a quien está mirando.
        setResultadoTenant(`${r.cliente_id}: ${r.de} → ${r.a}`);
        // La acción quedó auditada del lado del backend; recargar trae la fila nueva a A6 sin que
        // el operador tenga que refrescar para comprobar que su acción dejó rastro.
        void cargar(horas);
        // CTA1: y recargar la lista, para que la fila muestre el estado nuevo (DoD del contrato).
        void cargarTenants();
      } catch (err) {
        if (!vivo.current) return;
        // El texto sale del backend (el `detail` del 404/422, o el `mensaje` de un 409), no se
        // redacta acá: si lo escribiera el front, el día que cambie el criterio la UI mentiría.
        setErrorTenant(
          err instanceof Error && err.message ? err.message : 'No se pudo cambiar el estado.',
        );
      } finally {
        if (vivo.current) setEnviando(null);
      }
    },
    [tenantId, enviando, cargar, cargarTenants, horas],
  );

  /**
   * CONS7b. Uno por vez y sin confirmación modal (el contrato prohíbe crear uno): el copy del botón
   * nombra lo que va a pasar, que es el patrón del repo.
   *
   * No se pide confirmación pese a ser irreversible porque el gate real ya corrió **antes**: si el
   * trauma fuera reintentable-prohibido, el botón está deshabilitado con el motivo a la vista. Una
   * confirmación sobre algo que el sistema ya validó entrena a apretar "sí" sin leer.
   */
  const reintentar = useCallback(
    async (fila: FilaError) => {
      if (fila.motivo_prohibido != null || reintentando != null) return;
      setReintentando(fila.id);
      setAvisoReintento(null);
      try {
        const r = await adminReintentarError(fila.id);
        if (!vivo.current) return;
        setAvisoReintento({ id: fila.id, texto: `vuelve a la cola (${r.estado})`, ok: true });
        void cargar(horas);
      } catch (err) {
        if (!vivo.current) return;
        // El 409 del backend trae el motivo en `detail.mensaje`; `client.ts` ya lo extrae. Se muestra
        // tal cual: acá tampoco se redacta el texto de un rechazo.
        setAvisoReintento({
          id: fila.id,
          texto: err instanceof Error && err.message ? err.message : 'No se pudo reintentar.',
          ok: false,
        });
      } finally {
        if (vivo.current) setReintentando(null);
      }
    },
    [reintentando, cargar, horas],
  );

  return (
    <div className="admin-screen" data-testid="admin-screen">
      <header className="admin-screen__header">
        <h1 className="admin-screen__titulo">Consola</h1>
        <div className="admin-screen__ventanas" role="group" aria-label="Ventana de tiempo">
          {VENTANAS.map((v) => (
            <Button
              key={v}
              variant={v === horas ? 'primary' : 'ghost'}
              onClick={() => setHoras(v)}
              aria-pressed={v === horas}
            >
              {etiquetaVentana(v)}
            </Button>
          ))}
        </div>
      </header>

      {estado === 'cargando' && (
        <div className="admin-screen__seccion" data-testid="admin-cargando">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={92} radius={16} />
          ))}
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="admin-screen__aviso" data-testid="admin-no-disponible">
          {detalle}
        </p>
      )}

      {estado === 'sin_permiso' && (
        <p className="admin-screen__aviso" data-testid="admin-sin-permiso">
          {detalle}
        </p>
      )}

      {estado === 'error' && (
        <div className="admin-screen__aviso" data-testid="admin-error">
          <p>No se pudo cargar la consola. {detalle}</p>
          <Button onClick={() => void cargar(horas)}>Reintentar</Button>
        </div>
      )}

      {estado === 'ok' && salud && uso && (
        <>
          {/* ---- A1 Salud ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-salud-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-salud-titulo">Salud</h2>
              {/* `BadgeProps` no extiende HTMLAttributes (design-system/Badge.tsx:7), así que el
                  testid va en un envoltorio en vez de pasarse al Badge — no se toca el primitivo
                  compartido por una necesidad de esta pantalla. */}
              <span data-testid="admin-salud-badge">
                <Badge variant={salud.ok ? 'ok' : 'danger'}>
                  {salud.ok ? 'Todo en orden' : 'Requiere atención'}
                </Badge>
              </span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-workers">
              <div className="admin-card__head">
                <h3>Workers</h3>
                <Badge variant={salud.workers.ok ? 'ok' : 'danger'}>
                  {salud.workers.ok ? 'activos' : 'sin pollers'}
                </Badge>
              </div>
              <dl className="admin-metricas">
                <div>
                  <dt>Cola</dt>
                  <dd>{salud.workers.task_queue}</dd>
                </div>
                <div>
                  <dt>Pollers</dt>
                  <dd data-testid="admin-pollers">{salud.workers.pollers}</dd>
                </div>
              </dl>
            </Surface>

            <Surface variant="card" className="admin-card" data-testid="admin-schedules">
              <div className="admin-card__head">
                <h3>Tareas programadas</h3>
                <Badge variant={salud.schedules.ok ? 'ok' : 'danger'}>
                  {salud.schedules.ok ? 'al día' : 'con retraso'}
                </Badge>
              </div>
              <dl className="admin-metricas">
                <div>
                  <dt>Total</dt>
                  <dd>{salud.schedules.total}</dd>
                </div>
                <div>
                  <dt>Pausadas</dt>
                  <dd>{salud.schedules.pausados}</dd>
                </div>
                <div>
                  <dt>Sin próxima corrida</dt>
                  <dd data-testid="admin-sin-proxima">{salud.schedules.sin_proxima_corrida}</dd>
                </div>
              </dl>
            </Surface>
          </section>

          {/* ---- A3 Uso y costo ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-uso-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-uso-titulo">Uso y costo</h2>
              <span className="admin-screen__ventana-activa">
                últimas {etiquetaVentana(uso.horas)}
              </span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-gasto">
              <h3>Consumo por cuenta</h3>
              {uso.gasto_llm.length === 0 ? (
                <p className="admin-screen__vacio" data-testid="admin-gasto-vacio">
                  Sin actividad en esta ventana.
                </p>
              ) : (
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Cuenta</th>
                      <th scope="col">Turnos</th>
                      <th scope="col">Tokens</th>
                      <th scope="col">Modelo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.gasto_llm.map((f) => (
                      <tr key={f.cliente_id}>
                        <td>{f.cliente_id.slice(0, 8)}</td>
                        <td>{f.turnos_llm}</td>
                        <td>{f.tokens_totales.toLocaleString('es-AR')}</td>
                        <td>{f.modelo_mas_usado ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>

            <Surface variant="card" className="admin-card" data-testid="admin-errores">
              <h3>Errores de herramientas</h3>
              {uso.error_rate_tools.length === 0 ? (
                <p className="admin-screen__vacio" data-testid="admin-errores-vacio">
                  Sin llamadas en esta ventana.
                </p>
              ) : (
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Cuenta</th>
                      <th scope="col">Errores</th>
                      <th scope="col">Llamadas</th>
                      <th scope="col">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.error_rate_tools.map((f) => (
                      <tr key={f.cliente_id}>
                        <td>{f.cliente_id.slice(0, 8)}</td>
                        <td>{f.errores}</td>
                        <td>{f.llamadas_totales}</td>
                        <td data-testid={`admin-rate-${f.cliente_id}`}>
                          {formatearErrorRate(f.error_rate_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </section>

          {/* ---- A5 Errores (DLQ agrupada por fingerprint) — CONS6 ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-dlq-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-dlq-titulo">Errores del sistema</h2>
              <span className="admin-screen__ventana-activa">
                agrupados por firma · {errores.length}
              </span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-dlq">
              {errores.length === 0 ? (
                <p className="admin-screen__vacio" data-testid="admin-dlq-vacio">
                  No hay errores registrados.
                </p>
              ) : (
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Dónde</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Veces</th>
                      <th scope="col">Cuentas</th>
                      <th scope="col">Último intento</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errores.map((f) => (
                      <tr key={f.fingerprint} data-testid={`admin-dlq-fila-${f.fingerprint}`}>
                        <td>{f.workflow ?? f.costura ?? '—'}</td>
                        <td>{f.error_type ?? '—'}</td>
                        <td>
                          <Badge variant={variantePorEstado(f.estado)}>{f.estado}</Badge>
                        </td>
                        {/* `dedupe_count` es cuántas veces pasó lo MISMO; `tenants_afectados`, a
                            cuántas cuentas distintas. Se muestran separados a propósito: 40 veces
                            en 1 cuenta y 40 en 40 cuentas piden respuestas opuestas. */}
                        <td>{f.dedupe_count}</td>
                        <td data-testid={`admin-dlq-tenants-${f.fingerprint}`}>
                          {f.tenants_afectados}
                        </td>
                        <td>{f.ultima_nota ?? 'sin intentos'}</td>
                        <td className="admin-dlq__accion">
                          <Button
                            variant="ghost"
                            data-testid={`admin-reintentar-${f.id}`}
                            disabled={f.motivo_prohibido != null || reintentando != null}
                            onClick={() => void reintentar(f)}
                          >
                            {/* El copy dice qué hace DE VERDAD: la fila está agrupada por firma y
                                puede mostrar N cuentas afectadas, pero el `id` es el de UN
                                representante — "Reintentar" a secas sobre una fila que dice "5
                                cuentas" haría creer que se reintentaron las 5. */}
                            {reintentando === f.id
                              ? 'Reintentando…'
                              : f.tenants_afectados > 1
                                ? `Reintentar (1 de ${f.tenants_afectados})`
                                : 'Reintentar'}
                          </Button>
                          {/* El motivo del bloqueo va como TEXTO VISIBLE, no como `title`: un
                              tooltip no existe en touch y un lector de pantalla no lo anuncia en el
                              mismo flujo. El texto sale del backend, tal cual. */}
                          {f.motivo_prohibido != null && (
                            <span
                              className="admin-dlq__motivo"
                              data-testid={`admin-motivo-${f.id}`}
                            >
                              {f.motivo_prohibido}
                            </span>
                          )}
                          {avisoReintento?.id === f.id && (
                            <span
                              className={
                                avisoReintento.ok ? 'admin-tenant__ok' : 'admin-tenant__error'
                              }
                              data-testid={`admin-reintento-aviso-${f.id}`}
                            >
                              {avisoReintento.texto}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </section>

          {/* ---- A4 Soporte (feedback entrante y su clasificación) — CONS6 ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-soporte-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-soporte-titulo">Soporte</h2>
              <span className="admin-screen__ventana-activa">{tickets.length} mensajes</span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-soporte">
              {tickets.length === 0 ? (
                <p className="admin-screen__vacio" data-testid="admin-soporte-vacio">
                  Nadie escribió todavía.
                </p>
              ) : (
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Cuándo</th>
                      <th scope="col">Cuenta</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Qué dijo</th>
                      <th scope="col">Reparación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} data-testid={`admin-ticket-${t.id}`}>
                        <td>{fechaCorta(t.created_at)}</td>
                        <td>{t.cliente_id.slice(0, 8)}</td>
                        <td>{t.tipo ?? '—'}</td>
                        <td title={t.texto ?? undefined}>
                          <span className="admin-tabla__texto-recorte">{t.texto ?? '—'}</span>
                        </td>
                        <td data-testid={`admin-ticket-reparacion-${t.id}`}>
                          {/* Sin trauma asociado NO se puede distinguir "esperando" de "el
                              clasificador dijo que no": esa clasificación es efímera y no deja
                              rastro durable. Se dice lo que se sabe, no lo que se supone. */}
                          {t.derivo_en_autosanacion ? (
                            <Badge variant={variantePorEstado(t.estado_reparacion)}>
                              {t.estado_reparacion ?? 'derivado'}
                            </Badge>
                          ) : (
                            <span className="admin-screen__ventana-activa">sin derivar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </section>

          {/* ---- SOP6: tickets de soporte (hilo con el usuario, responder desde acá) ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-tickets-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-tickets-titulo">Tickets de soporte</h2>
              <span className="admin-screen__ventana-activa">{ticketsAdmin.length} tickets</span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-tickets">
              {ticketsAdminEstado === 'no_disponible' && (
                <p className="admin-screen__ventana-activa" data-testid="admin-tickets-no-disp">
                  Los tickets de soporte todavía no están disponibles en este backend.
                </p>
              )}

              {ticketsAdminEstado !== 'no_disponible' && (
                <>
                  <div className="admin-tenant__form">
                    <label className="admin-tenant__label" htmlFor="admin-tickets-codigo">
                      Buscar por código
                    </label>
                    <input
                      id="admin-tickets-codigo"
                      className="admin-tenant__input"
                      data-testid="admin-tickets-filtro-codigo"
                      value={filtroCodigoTicket}
                      onChange={(e) => setFiltroCodigoTicket(e.target.value)}
                      placeholder="SOP-0007"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <label className="admin-tenant__label" htmlFor="admin-tickets-estado">
                      Estado
                    </label>
                    <select
                      id="admin-tickets-estado"
                      className="admin-tenant__input"
                      data-testid="admin-tickets-filtro-estado"
                      value={filtroEstadoTicket}
                      onChange={(e) => setFiltroEstadoTicket(e.target.value as EstadoTicketSoporte | '')}
                    >
                      <option value="">Todos</option>
                      <option value="abierto">Abierto</option>
                      <option value="respondido">Respondido</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </div>

                  {ticketsAdminEstado === 'ok' && ticketsAdmin.length === 0 && (
                    <p className="admin-screen__vacio" data-testid="admin-tickets-vacio">
                      Ningún ticket coincide con el filtro.
                    </p>
                  )}

                  {ticketsAdmin.length > 0 && (
                    <table className="admin-tabla" data-testid="admin-tickets-tabla">
                      <thead>
                        <tr>
                          <th scope="col">Código</th>
                          <th scope="col">Función</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Asunto</th>
                          <th scope="col">Última actividad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticketsAdmin.map((t) => (
                          <Fragment key={t.id}>
                            <tr
                              key={t.id}
                              data-testid={`admin-ticket-fila-${t.id}`}
                              className="admin-tickets__fila-clicable"
                              onClick={() => void abrirDetalleTicket(t.id)}
                              aria-expanded={ticketSeleccionado === t.id}
                            >
                              <td>{t.codigo}</td>
                              <td>{ETIQUETA_CANAL_TICKET[t.canal]}</td>
                              <td>
                                <Badge variant={variantePorEstadoTicket(t.estado)}>
                                  {ETIQUETA_ESTADO_TICKET[t.estado]}
                                </Badge>
                              </td>
                              <td title={t.asunto}>
                                <span className="admin-tabla__texto-recorte">{t.asunto}</span>
                              </td>
                              <td>{fechaCorta(t.updated_at)}</td>
                            </tr>
                            {ticketSeleccionado === t.id && (
                              <tr key={`${t.id}-detalle`} data-testid={`admin-ticket-detalle-${t.id}`}>
                                <td colSpan={5} className="admin-ticket-hilo__celda">
                                  {detalleTicketEstado === 'cargando' && (
                                    <p className="admin-screen__vacio">Cargando el hilo…</p>
                                  )}
                                  {detalleTicketEstado === 'error' && (
                                    <p className="admin-tenant__error">No se pudo cargar el hilo.</p>
                                  )}
                                  {detalleTicketEstado === 'ok' && detalleTicket && (
                                    <div className="admin-ticket-hilo">
                                      <ul className="admin-ticket-hilo__mensajes">
                                        {detalleTicket.mensajes.map((m) => (
                                          <li
                                            key={m.id}
                                            className={
                                              m.autor === 'operador'
                                                ? 'admin-ticket-hilo__msj admin-ticket-hilo__msj--operador'
                                                : 'admin-ticket-hilo__msj'
                                            }
                                          >
                                            <span className="admin-ticket-hilo__autor">
                                              {m.autor === 'operador' ? 'Operador' : 'Usuario'} ·{' '}
                                              {fechaCorta(m.created_at)}
                                            </span>
                                            <p>{m.texto}</p>
                                          </li>
                                        ))}
                                      </ul>

                                      {detalleTicket.ticket.estado !== 'cerrado' ? (
                                        <div className="admin-tenant__form">
                                          <label
                                            className="admin-tenant__label"
                                            htmlFor="admin-ticket-respuesta"
                                          >
                                            Respuesta
                                          </label>
                                          <textarea
                                            id="admin-ticket-respuesta"
                                            className="admin-tenant__input"
                                            data-testid="admin-ticket-respuesta-input"
                                            value={textoRespuesta}
                                            onChange={(e) => setTextoRespuesta(e.target.value)}
                                            rows={3}
                                          />
                                          <div className="admin-tenant__acciones">
                                            <Button
                                              variant="ghost"
                                              data-testid="admin-ticket-responder"
                                              disabled={!textoRespuesta.trim() || respondiendo != null}
                                              onClick={() => void responderTicketAdmin(false)}
                                            >
                                              {respondiendo === 'responder' ? 'Enviando…' : 'Responder'}
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              data-testid="admin-ticket-responder-cerrar"
                                              disabled={!textoRespuesta.trim() || respondiendo != null}
                                              onClick={() => void responderTicketAdmin(true)}
                                            >
                                              {respondiendo === 'cerrar'
                                                ? 'Enviando…'
                                                : 'Responder y cerrar'}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p
                                          className="admin-screen__ventana-activa"
                                          data-testid="admin-ticket-cerrado-aviso"
                                        >
                                          Este ticket está cerrado.
                                        </p>
                                      )}

                                      {avisoRespuesta != null && (
                                        <p
                                          className={
                                            avisoRespuesta.ok
                                              ? 'admin-tenant__ok'
                                              : 'admin-tenant__error'
                                          }
                                          data-testid="admin-ticket-respuesta-aviso"
                                        >
                                          {avisoRespuesta.texto}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </Surface>
          </section>

          {/* ---- CONS7a: suspender / reactivar un tenant ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-tenant-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-tenant-titulo">Estado de una cuenta</h2>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-tenant">
              <p className="admin-screen__ventana-activa">
                Suspender corta el acceso de esa cuenta a la app: el guard del backend responde 403
                en cada pedido mientras dure. Reactivar lo devuelve. Queda registrado en Auditoría.
              </p>

              {/* ---- CTA1: la lista de cuentas ---- */}
              {tenantsEstado === 'ok' && tenants.length > 0 && (
                <>
                  <div className="admin-tenant__form">
                    <label className="admin-tenant__label" htmlFor="admin-tenant-filtro">
                      Buscar por email
                    </label>
                    <input
                      id="admin-tenant-filtro"
                      className="admin-tenant__input"
                      data-testid="admin-tenant-filtro"
                      value={filtroTenant}
                      onChange={(e) => setFiltroTenant(e.target.value)}
                      placeholder={`${tenants.length} cuentas`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <table className="admin-tabla" data-testid="admin-tenant-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Cuenta</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Alta</th>
                        <th scope="col">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantsFiltrados.map((t) => (
                        <tr key={t.cliente_id} data-testid={`admin-tenant-fila-${t.cliente_id}`}>
                          {/* El email es lo que el operador reconoce; el id es lo que se opera. Se
                              muestran los dos: sin el id, un email repetido o vacío deja la fila sin
                              forma de saber sobre qué cuenta se está actuando. */}
                          <td title={t.cliente_id}>
                            <span className="admin-tabla__texto-recorte">{t.email ?? '—'}</span>
                          </td>
                          <td>
                            <Badge variant={t.status === 'active' ? 'ok' : 'danger'}>{t.status}</Badge>
                          </td>
                          <td>{fechaCorta(t.created_at)}</td>
                          <td className="admin-dlq__accion">
                            {/* Se ofrece la acción CONTRARIA a su estado. No es un guard —el POST es
                                idempotente y el backend audita el intento igual— es no ofrecer lo
                                que no hace nada. Un `status` desconocido cae en "Suspender", que es
                                lo conservador. */}
                            <Button
                              variant="ghost"
                              data-testid={`admin-tenant-accion-${t.cliente_id}`}
                              disabled={enviando != null}
                              onClick={() =>
                                void cambiarEstado(
                                  t.status === 'active' ? 'suspended' : 'active',
                                  t.cliente_id,
                                )
                              }
                            >
                              {t.status === 'active' ? 'Suspender' : 'Reactivar'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tenantsFiltrados.length === 0 && (
                    <p className="admin-screen__vacio" data-testid="admin-tenant-sin-match">
                      Ningún email coincide con «{filtroTenant}».
                    </p>
                  )}
                </>
              )}

              {/* El campo manual NO se borra cuando hay lista: es el camino que funciona si
                  `GET /admin/tenants` no está desplegado todavía (hoy, de hecho, no existe en
                  `main`). Sacarlo antes que el endpoint exista dejaría la sección sin NINGÚN control
                  usable — cambiar una capacidad rota por otra rota no es avanzar.
                  Y sigue sirviendo con lista: una cuenta cuyo id se conoce se opera sin buscarla. */}
              {tenantsEstado === 'no_disponible' && (
                <p className="admin-screen__ventana-activa" data-testid="admin-tenant-lista-no-disp">
                  El listado de cuentas todavía no está disponible en este backend. Se opera por id.
                </p>
              )}
              <div className="admin-tenant__form">
                <label className="admin-tenant__label" htmlFor="admin-tenant-id">
                  Id de la cuenta
                </label>
                <input
                  id="admin-tenant-id"
                  className="admin-tenant__input"
                  data-testid="admin-tenant-input"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="lo ves en Uso, Soporte o Auditoría"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="admin-tenant__acciones">
                  <Button
                    variant="ghost"
                    data-testid="admin-tenant-suspender"
                    disabled={!tenantId.trim() || enviando != null}
                    onClick={() => void cambiarEstado('suspended')}
                  >
                    {enviando === 'suspended' ? 'Suspendiendo…' : 'Suspender'}
                  </Button>
                  <Button
                    variant="ghost"
                    data-testid="admin-tenant-reactivar"
                    disabled={!tenantId.trim() || enviando != null}
                    onClick={() => void cambiarEstado('active')}
                  >
                    {enviando === 'active' ? 'Reactivando…' : 'Reactivar'}
                  </Button>
                </div>
              </div>

              {resultadoTenant != null && (
                <p className="admin-tenant__ok" data-testid="admin-tenant-ok">
                  {resultadoTenant}
                </p>
              )}
              {errorTenant != null && (
                <p className="admin-tenant__error" data-testid="admin-tenant-error">
                  {errorTenant}
                </p>
              )}
            </Surface>
          </section>

          {/* ---- A6 Auditoría (append-only: quién hizo qué en la consola) — CONS6 ---- */}
          <section className="admin-screen__seccion" aria-labelledby="admin-auditoria-titulo">
            <div className="admin-screen__seccion-head">
              <h2 id="admin-auditoria-titulo">Auditoría</h2>
              <span className="admin-screen__ventana-activa">
                {auditoria.length} acciones registradas
              </span>
            </div>

            <Surface variant="card" className="admin-card" data-testid="admin-auditoria">
              {auditoria.length === 0 ? (
                <p className="admin-screen__vacio" data-testid="admin-auditoria-vacia">
                  Todavía no se registró ninguna acción de operador.
                </p>
              ) : (
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Cuándo</th>
                      <th scope="col">Quién</th>
                      <th scope="col">Qué hizo</th>
                      <th scope="col">Sobre</th>
                      <th scope="col">Detalle</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((ev) => (
                      <tr key={ev.id} data-testid={`admin-auditoria-fila-${ev.id}`}>
                        <td>{fechaCorta(ev.created_at)}</td>
                        <td>{ev.admin_email ?? ev.admin_user_id?.slice(0, 8) ?? '—'}</td>
                        <td>{ev.accion}</td>
                        <td>{ev.cliente_id?.slice(0, 8) ?? '—'}</td>
                        <td
                          data-testid={`admin-auditoria-detalle-${ev.id}`}
                          title={formatearDetalle(ev.detalle)}
                        >
                          <span className="admin-tabla__texto-recorte">
                            {formatearDetalle(ev.detalle)}
                          </span>
                        </td>
                        <td>
                          <Badge variant={ev.resultado === 'exitoso' ? 'ok' : 'danger'}>
                            {ev.resultado ?? '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </section>
        </>
      )}
    </div>
  );
}
