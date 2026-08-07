import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge, Button, Skeleton, Surface } from '../../design-system';
import { AdminNoDisponibleError, adminSalud, adminUso } from '../../lib/api/admin';
import type { AdminSalud, AdminUso } from '../../lib/api/admin';
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

export function AdminScreen() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [salud, setSalud] = useState<AdminSalud | null>(null);
  const [uso, setUso] = useState<AdminUso | null>(null);
  const [horas, setHoras] = useState<number>(24);
  const [detalle, setDetalle] = useState<string>('');

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
      // En paralelo: son dos áreas independientes y no tiene sentido serializarlas.
      const [s, u] = await Promise.all([adminSalud(), adminUso(ventana)]);
      if (!vivo.current) return;
      setSalud(s);
      setUso(u);
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
        </>
      )}
    </div>
  );
}
