import { useEffect, useRef, useState } from 'react';

import {
  formatearImporte,
  obtenerCliente,
  type Cliente,
  type FichaCliente as Ficha,
  type OperacionCliente,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/clientes/FichaCliente.tsx` — MISMO criterio: la ficha se pide
 * SIEMPRE al abrir (el listado no trae el historial), las secciones vacías se dicen (no se
 * esconden), y las operaciones se muestran con `formatearImporte`. En web no hay insets de status
 * bar que compensar (razón original del overlay `position:absolute` + `insets.top` en mobile) —
 * acá el overlay cubre sólo el área de contenido del módulo, vía CSS (`clientes.css`).
 */
type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

export interface FichaClienteProps {
  cliente: Cliente;
  onCerrar: () => void;
  onEditar?: (cliente: Cliente) => void;
}

function Seccion({ titulo, items, testID }: { titulo: string; items: OperacionCliente[]; testID: string }) {
  return (
    <div className="ficha-cliente__seccion" data-testid={testID}>
      <p className="ficha-cliente__seccion-titulo">{titulo.toUpperCase()}</p>
      {items.length === 0 ? (
        <p className="ficha-cliente__seccion-vacio" data-testid={`${testID}-vacio`}>
          Todavía no vemos operaciones acá.
        </p>
      ) : (
        items.map((o) => (
          <div key={o.id} className="ficha-cliente__operacion" data-testid={`${testID}-${o.id}`}>
            <span className="ficha-cliente__operacion-detalle">{o.detalle}</span>
            <span className="ficha-cliente__operacion-total">{formatearImporte(o.total)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function FichaCliente({ cliente, onCerrar, onEditar }: FichaClienteProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerCliente(cliente.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') {
          setFicha(res.ficha);
          setEstado('ok');
          return;
        }
        setEstado(res.status === 'no_encontrado' ? 'no_encontrado' : 'no_disponible');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [cliente.id]);

  const datos = ficha?.cliente ?? cliente;

  return (
    <div className="ficha-cliente" data-testid="ficha-cliente">
      <div className="ficha-cliente__scroll" data-testid="ficha-cliente-scroll">
        <p className="ficha-cliente__nombre" data-testid="ficha-cliente-nombre">
          {datos.nombre}
        </p>

        {estado === 'cargando' && (
          <div data-testid="ficha-cliente-cargando" className="ficha-cliente__loading">
            <Skeleton height={16} radius={8} />
            <Skeleton height={16} radius={8} />
            <Skeleton height={80} radius={12} />
          </div>
        )}

        {estado === 'no_encontrado' && (
          <p className="ficha-cliente__aviso" data-testid="ficha-cliente-no-encontrado">
            No encontramos ese cliente.
          </p>
        )}

        {estado === 'no_disponible' && (
          <p className="ficha-cliente__aviso" data-testid="ficha-cliente-no-disponible">
            La ficha todavía no está disponible en tu copiloto.
          </p>
        )}

        {estado === 'error' && (
          <p className="ficha-cliente__error" data-testid="ficha-cliente-error">
            No pudimos cargar la ficha.
          </p>
        )}

        {estado === 'ok' && ficha != null && (
          <>
            {(datos.docNro != null || datos.domicilio != null || datos.email != null || datos.telefono != null) && (
              <div className="ficha-cliente__datos" data-testid="ficha-cliente-datos">
                {datos.docNro != null && (
                  <p>{datos.docTipo === 80 ? 'CUIT' : datos.docTipo === 96 ? 'DNI' : 'Doc'} {datos.docNro}</p>
                )}
                {datos.domicilio != null && <p>{datos.domicilio}</p>}
                {datos.telefono != null && <p>{datos.telefono}</p>}
                {datos.email != null && <p>{datos.email}</p>}
              </div>
            )}

            {datos.notas != null && datos.notas !== '' && (
              <p className="ficha-cliente__notas" data-testid="ficha-cliente-notas">
                {datos.notas}
              </p>
            )}

            <Seccion titulo="Presupuestos" items={ficha.presupuestos} testID="ficha-presupuestos" />
            <Seccion titulo="Facturas" items={ficha.facturas} testID="ficha-facturas" />
          </>
        )}

        <div className="ficha-cliente__acciones" data-testid="ficha-cliente-acciones">
          {onEditar != null && estado === 'ok' && (
            <Button onClick={() => onEditar(datos)} data-testid="ficha-cliente-editar">
              Editar
            </Button>
          )}
          <Button variant="cancel" onClick={onCerrar} data-testid="ficha-cliente-cerrar">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
