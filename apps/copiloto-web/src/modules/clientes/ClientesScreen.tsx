import { useCallback, useEffect, useRef, useState } from 'react';

import { listarClientes, obtenerCliente, type Cliente, type DuplicadoCliente } from '@copiloto/core';

import { Button, Skeleton, Surface } from '../../design-system';
import { FichaCliente } from './FichaCliente';
import { FormularioCliente } from './FormularioCliente';
import { TarjetaCliente } from './TarjetaCliente';
import './clientes.css';

const SKELETON_ROWS = 3;
/** Lo que tarda en dispararse la búsqueda desde la última tecla — mismo valor que mobile. */
const ESPERA_BUSQUEDA_MS = 350;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * `ClientesScreen` — M-WEB módulo 2: port de `apps/mobile/src/modules/clientes/PantallaClientes.tsx`
 * a `copiloto-web`. MISMA lógica: la búsqueda la hace el backend (con debounce), el alta a mano no
 * espera a la voz, la cartera vacía OFRECE el alta. Lo que NO se porta 1:1: `RefreshControl`
 * (gesto táctil) → botón "Actualizar" explícito, mismo criterio que `GastosScreen`.
 *
 * Repintado Tarea 3 (anatomía de función, CLAUDE.md §5), calcado de `#clientes` en
 * `Prototipo frontend/odobi-ui/prototipo/index.html`: stack (nombre + "Tu cartera", label FIJO —
 * esta función no tiene mes) + bloque negro (`Surface variant="bloque"`, la cifra accionable es
 * el TAMAÑO de la cartera, no plata) + rótulo "Con movimiento" con pill de alta "Nuevo cliente".
 */
export function ordenarAlfabetico(clientes: readonly Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

/** `creadoEn` cae en el mes calendario actual (huso local del navegador — mismo criterio que el
 * resto de la UI, que nunca normaliza a UTC para mostrar fechas). */
function esDeEsteMes(iso: string): boolean {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return false;
  const ahora = new Date();
  return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
}

export interface ClientesScreenProps {
  /** D14 — id de un cliente a abrir apenas monta (fila de Actividad, botón "Ver cliente" de
   * `TarjetaClientePropuesto`). El shell lo resetea a `null` en cada cambio de tab (ver
   * `AppShell`/`DesktopShell`), así que un remount posterior sin id nuevo no reabre la ficha vieja. */
  clienteIdInicial?: number;
}

export function ClientesScreen({ clienteIdInicial }: ClientesScreenProps = {}) {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [actualizando, setActualizando] = useState(false);
  const [ficha, setFicha] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState<{ edita: Cliente | null } | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<DuplicadoCliente | null>(null);
  /**
   * "Le vendiste a N clientes" tiene que ser el tamaño de TODA la cartera, no el de una búsqueda
   * filtrada — se actualiza sólo con una respuesta SIN `q` (dentro de `cargar`) y mientras el
   * usuario busca queda congelado en el último valor real conocido. Recalcularlo sobre el
   * subconjunto filtrado mostraría una cifra que baja con cada letra tipeada, que no es lo que
   * dice ser.
   *
   * ⚠️ `agregadosEsteMes` sólo cuenta sobre la página YA CARGADA (el backend de `/clientes` no
   * manda un agregado del tenant completo) — si `total > clientes.length` (cartera grande,
   * paginada) esto puede subcontar. Escalado a planificación:
   * `coordinacion/abierto/2026-09-07_hallazgo_frontend1-clientes-a-planificacion_monto-y-comprobantes-por-cliente-no-existen-en-la-api.md`.
   */
  const [carteraBase, setCarteraBase] = useState<{ total: number; agregadosEsteMes: number } | null>(null);
  // Ver el comentario equivalente en GastosScreen: `vivo.current = true` va DENTRO del setup del
  // efecto (no sólo en `useRef(true)`) por StrictMode.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargar = useCallback(
    (silencioso = false): Promise<void> => {
      if (!silencioso) setEstado('cargando');
      const qActual = busquedaAplicada;
      return listarClientes(qActual !== '' ? { q: qActual } : {})
        .then((res) => {
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            setEstado('no_disponible');
            setClientes([]);
            return;
          }
          setClientes(res.clientes);
          setTotal(res.total);
          setEstado('ok');
          if (qActual === '') {
            setCarteraBase({
              total: res.total,
              agregadosEsteMes: res.clientes.filter((c) => c.origen === 'derivado' && esDeEsteMes(c.creadoEn))
                .length,
            });
          }
        })
        .catch(() => {
          if (vivo.current) setEstado('error');
        });
    },
    [busquedaAplicada],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function actualizar() {
    setActualizando(true);
    await cargar(true);
    if (vivo.current) setActualizando(false);
  }

  function alGuardar(cliente: Cliente) {
    setFormulario(null);
    setAvisoDuplicado(null);
    void cargar(true);
    setFicha(cliente);
  }

  function alDuplicado(duplicado: DuplicadoCliente) {
    setFormulario(null);
    setAvisoDuplicado(duplicado);
  }

  function textoDuplicado(d: DuplicadoCliente): string {
    const quien = d.dueno?.nombre;
    if (d.por === 'nombre') {
      return quien != null && quien !== ''
        ? `Ya tenés un cliente con ese nombre: ${quien}.`
        : 'Ya tenés un cliente con ese nombre.';
    }
    if (d.por === 'documento') {
      return quien != null && quien !== ''
        ? `Ese documento ya es de ${quien}.`
        : 'Ese documento ya es de un cliente que tenés en la cartera.';
    }
    return quien != null && quien !== ''
      ? `Ese cliente ya está en tu cartera: ${quien}.`
      : 'Ese cliente ya está en tu cartera.';
  }

  const abrirDueno = useCallback(async (id: number) => {
    setAvisoDuplicado(null);
    const res = await obtenerCliente(id);
    if (res.status === 'ok' && vivo.current) setFicha(res.ficha.cliente);
  }, []);

  // D14 — abre la ficha de `clienteIdInicial` apenas monta (fila de Actividad, "Ver cliente" del
  // chat). El componente se REMONTA en cada entrada al tab Clientes (ver los shells: `activeTab
  // === 'clientes' && <ClientesScreen .../>`), así que este efecto sólo corre una vez por entrada
  // — no hace falta "consumir" el prop para evitar reaperturas espurias.
  useEffect(() => {
    if (clienteIdInicial != null) void abrirDueno(clienteIdInicial);
  }, [clienteIdInicial, abrirDueno]);

  const hayClientes = clientes.length > 0;
  const buscando = busquedaAplicada !== '';
  const clientesOrdenados = ordenarAlfabetico(clientes);

  return (
    <div className="clientes-screen" data-testid="pantalla-clientes">
      <header className="clientes-screen__stack">
        <span className="clientes-screen__nombre-fila">
          <span className="clientes-screen__nombre">Clientes</span>
          {estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="clientes-actualizar"
              className="clientes-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        {/* "Tu cartera" es un label FIJO (mockup: `.atras .per`), no un período — a diferencia de
            gastos/ingresos esta función no tiene mes: es el tamaño total de la cartera. */}
        <span className="clientes-screen__periodo">Tu cartera</span>
      </header>

      {estado === 'cargando' && (
        <div className="clientes-screen__loading" data-testid="clientes-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={56} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="clientes-screen__empty" data-testid="clientes-error">
          <p>No pudimos cargar tu cartera.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="clientes-screen__empty" data-testid="clientes-no-disponible">
          Tus clientes todavía no están disponibles en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="clientes-screen__body">
          {formulario != null ? (
            <FormularioCliente
              edita={formulario.edita}
              onGuardado={alGuardar}
              onDuplicado={alDuplicado}
              onAbrirCliente={(c) => { setFormulario(null); setFicha(c); }}
              onCancelar={() => setFormulario(null)}
            />
          ) : (
            <>
              {/* Bloque negro (CLAUDE.md §5): acá la cifra NO es plata, es el TAMAÑO de la
                  cartera (mockup: `.cli-n`) — "Le vendiste a" + N clientes + cuántos se agregaron
                  solos este mes (detectados al facturar/presupuestar, sin alta manual). Ver el
                  comentario de `carteraBase` sobre por qué esto se congela mientras se busca. */}
              <Surface variant="bloque" className="clientes-resumen" data-testid="clientes-resumen">
                <p className="clientes-resumen__label">Le vendiste a</p>
                <p className="clientes-resumen__cifra" data-testid="clientes-resumen-cifra">
                  {carteraBase?.total ?? total}
                  <span className="clientes-resumen__unidad">
                    {(carteraBase?.total ?? total) === 1 ? 'cliente' : 'clientes'}
                  </span>
                </p>
                <span className="clientes-resumen__chip" data-testid="clientes-resumen-chip">
                  {(carteraBase?.agregadosEsteMes ?? 0) === 1
                    ? '1 se agregó solo este mes'
                    : `${carteraBase?.agregadosEsteMes ?? 0} se agregaron solos este mes`}
                </span>
              </Surface>

              {avisoDuplicado != null && (
                <div className="clientes-screen__duplicado" data-testid="clientes-duplicado">
                  <p>{textoDuplicado(avisoDuplicado)}</p>
                  {avisoDuplicado.dueno != null && (
                    <Button
                      variant="cancel"
                      onClick={() => void abrirDueno((avisoDuplicado.dueno as Cliente).id)}
                      data-testid="clientes-duplicado-abrir"
                    >
                      Abrir ese cliente
                    </Button>
                  )}
                </div>
              )}

              <label className="clientes-screen__buscar">
                <span>Buscar</span>
                <input
                  data-testid="clientes-buscar"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre del cliente"
                  autoCapitalize="none"
                />
              </label>

              {/* Rótulo de sección + alta, en la misma fila (CLAUDE.md §5): el pill NUNCA es un
                  FAB — compite con el mic. "Con movimiento" y "Nuevo cliente" son el rótulo y el
                  verbo textuales del mockup (`.fila-lbl`/`.nuevo`), no genéricos inventados. */}
              <div className="clientes-screen__fila-lbl">
                <span className="clientes-screen__lista-lbl">Con movimiento</span>
                <button
                  type="button"
                  className="clientes-screen__pill-nuevo"
                  onClick={() => { setAvisoDuplicado(null); setFormulario({ edita: null }); }}
                  data-testid="clientes-nuevo"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Nuevo cliente
                </button>
              </div>

              {!hayClientes && (
                <p className="clientes-screen__empty" data-testid="clientes-vacio">
                  {buscando
                    ? 'No encontramos ningún cliente con ese nombre.'
                    : 'Tu cartera se va a armar sola con lo que factures y presupuestes — y mientras tanto podés cargar el primero a mano.'}
                </p>
              )}

              <div className="clientes-screen__lista">
                {clientesOrdenados.map((c) => (
                  <TarjetaCliente key={c.id} cliente={c} onSelect={setFicha} />
                ))}
              </div>

              {hayClientes && total > clientes.length && (
                <p className="clientes-screen__total" data-testid="clientes-total">
                  Mostrando {clientes.length} de {total} clientes.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {ficha != null && (
        <FichaCliente
          cliente={ficha}
          onCerrar={() => setFicha(null)}
          onEditar={(c) => { setFicha(null); setFormulario({ edita: c }); }}
        />
      )}
    </div>
  );
}
