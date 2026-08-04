import { useCallback, useEffect, useRef, useState } from 'react';

import { listarPresupuestos, obtenerPresupuesto, type Presupuesto } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { DetallePresupuesto } from './DetallePresupuesto';
import { FormularioPresupuesto } from './FormularioPresupuesto';
import { TarjetaPresupuesto } from './TarjetaPresupuesto';
import './presupuestos.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'listado' | 'formulario';

export interface PresupuestosScreenProps {
  /** Id que llegó desde la lista de actividad — abre su detalle al montar. */
  presupuestoIdInicial?: number;
  /**
   * Lleva al gate de confirmación de factura con el borrador ya armado. El id que llega es de un
   * BORRADOR, no de una factura emitida — quien la implemente deposita al usuario en el gate que ya
   * existe, nunca emite por su cuenta.
   */
  onFacturar: (facturaId: string) => void;
}

/**
 * `PresupuestosScreen` — M-WEB módulo 5: port de
 * `apps/mobile/src/modules/presupuestos/PantallaPresupuestos.tsx` a `copiloto-web`. MISMA lógica: el
 * listado trae SÓLO los vigentes salvo que se pida el historial, corregir es un alta con
 * `reemplazaA` (no hay edición), y el detalle es un overlay que se relee tras cambiar de estado para
 * no dejar la card de atrás mostrando el valor viejo. Lo que NO se porta 1:1: `RefreshControl` (gesto
 * táctil) → botón "Actualizar" explícito, mismo criterio que `GastosScreen`/`ClientesScreen`.
 */
export function PresupuestosScreen({ onFacturar, presupuestoIdInicial }: PresupuestosScreenProps) {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [vista, setVista] = useState<Vista>('listado');
  const [corrigiendo, setCorrigiendo] = useState<Presupuesto | null>(null);
  const [detalle, setDetalle] = useState<Presupuesto | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  // `vivo.current = true` DENTRO del setup del efecto — StrictMode, ver el comentario equivalente en
  // GastosScreen/ClientesScreen.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(
    (silencioso = false): Promise<void> => {
      if (!silencioso) setEstado('cargando');
      return listarPresupuestos(verHistorial ? { incluirReemplazados: true } : {})
        .then((res) => {
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            setEstado('no_disponible');
            setPresupuestos([]);
            return;
          }
          setPresupuestos(res.presupuestos);
          setEstado('ok');
        })
        .catch(() => {
          if (vivo.current) setEstado('error');
        });
    },
    [verHistorial],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Abrir directo un ítem que llegó por la lista de actividad — se busca por id, no se confía en la
   * lista cargada (puede no estar en la página, o estar vieja). Si no se encuentra, no se abre nada. */
  useEffect(() => {
    if (presupuestoIdInicial == null) return;
    let cancelado = false;
    obtenerPresupuesto(presupuestoIdInicial).then((res) => {
      if (cancelado || !vivo.current) return;
      if (res.status === 'ok') setDetalle(res.presupuesto);
    });
    return () => { cancelado = true; };
  }, [presupuestoIdInicial]);

  async function actualizar() {
    setActualizando(true);
    await cargar(true);
    if (vivo.current) setActualizando(false);
  }

  function alCrear(nuevo: Presupuesto) {
    setVista('listado');
    setCorrigiendo(null);
    // Se RELEE en vez de insertar el objeto en la lista local: el alta puede haber reemplazado a
    // otro, que tiene que DESAPARECER del listado vigente.
    void cargar(true);
    setDetalle(nuevo);
  }

  function abrirCorreccion(p: Presupuesto) {
    setDetalle(null);
    setCorrigiendo(p);
    setVista('formulario');
  }

  function facturarDesdeDetalle(facturaId: string) {
    setDetalle(null);
    onFacturar(facturaId);
  }

  const hayPresupuestos = presupuestos.length > 0;

  return (
    <div className="presupuestos-screen" data-testid="pantalla-presupuestos">
      <header className="presupuestos-screen__header">
        <h1 className="presupuestos-screen__title">Presupuestos</h1>
        {estado === 'ok' && vista === 'listado' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="presupuestos-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="presupuestos-screen__loading" data-testid="presupuestos-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={64} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="presupuestos-screen__empty" data-testid="presupuestos-error">
          <p>No pudimos cargar tus presupuestos.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="presupuestos-screen__empty" data-testid="presupuestos-no-disponible">
          Los presupuestos todavía no están disponibles en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="presupuestos-screen__body">
          {vista === 'formulario' ? (
            <FormularioPresupuesto
              corrige={corrigiendo}
              onCreado={alCrear}
              onCancelar={() => {
                setVista('listado');
                setCorrigiendo(null);
              }}
            />
          ) : (
            <>
              <Button
                onClick={() => {
                  setCorrigiendo(null);
                  setVista('formulario');
                }}
                data-testid="presupuestos-nuevo"
              >
                Nuevo presupuesto
              </Button>

              {!hayPresupuestos && (
                <p className="presupuestos-screen__empty" data-testid="presupuestos-vacio">
                  {verHistorial
                    ? 'No hay presupuestos en el historial.'
                    : 'Todavía no hiciste ningún presupuesto. También podés pedírselo al copiloto por chat.'}
                </p>
              )}

              <div className="presupuestos-screen__lista">
                {presupuestos.map((p) => (
                  <TarjetaPresupuesto key={p.id} presupuesto={p} onSelect={setDetalle} />
                ))}
              </div>

              {/* El historial existe porque corregir saca al anterior del listado vigente. */}
              <Button
                variant="ghost"
                onClick={() => setVerHistorial((v) => !v)}
                data-testid="presupuestos-toggle-historial"
              >
                {verHistorial ? 'Ver sólo los vigentes' : 'Ver también los reemplazados'}
              </Button>
            </>
          )}
        </div>
      )}

      {detalle != null && (
        <DetallePresupuesto
          presupuesto={detalle}
          onCerrar={() => setDetalle(null)}
          onFacturar={facturarDesdeDetalle}
          onCorregir={abrirCorreccion}
          // El estado cambió en la hoja: se pisa la fila de atrás con lo que devolvió el backend.
          onEstadoCambiado={(actualizado) => {
            setPresupuestos((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
            setDetalle(actualizado);
          }}
        />
      )}
    </div>
  );
}
