import { useCallback, useEffect, useRef, useState } from 'react';

import { listarClientes, obtenerCliente, type Cliente, type DuplicadoCliente } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
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
 */
export function ordenarAlfabetico(clientes: readonly Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
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
      return listarClientes(busquedaAplicada !== '' ? { q: busquedaAplicada } : {})
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
      <header className="clientes-screen__header">
        <h1 className="clientes-screen__title">Clientes</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="clientes-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
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
              <Button
                onClick={() => { setAvisoDuplicado(null); setFormulario({ edita: null }); }}
                data-testid="clientes-nuevo"
              >
                Nuevo cliente
              </Button>

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
