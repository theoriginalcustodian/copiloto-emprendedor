import { useEffect, useRef, useState } from 'react';

import {
  ETIQUETA_CATEGORIA,
  formatearFechaLarga,
  formatearImporte,
  obtenerGasto,
  type Gasto,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/gastos/DetalleGasto.tsx` — mismo criterio: se RE-PIDE por id
 * aunque la lista ya tenga el objeto (puede estar viejo), y mientras llega el fresco se pinta el
 * de la lista para evitar un salto en blanco. Sin editar ni borrar (contrato §12 del móvil, ídem
 * acá): un gasto se corrige antes de guardarlo, no en el detalle.
 */
type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

const ETIQUETA_ORIGEN: Record<string, string> = {
  voz: 'Lo dictaste',
  foto: 'Salió de una foto',
};

export interface DetalleGastoProps {
  /** El de la lista — se usa para pintar de entrada mientras llega el fresco. */
  gasto: Gasto;
  onCerrar: () => void;
}

function Dato({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID: string }) {
  return (
    <p className="detalle-gasto__dato" data-testid={testID}>
      <span className="detalle-gasto__dato-etiqueta">{etiqueta}</span>
      <span className="detalle-gasto__dato-valor">{valor}</span>
    </p>
  );
}

export function DetalleGasto({ gasto, onCerrar }: DetalleGastoProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [fresco, setFresco] = useState<Gasto | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerGasto(gasto.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') {
          setFresco(res.gasto);
          setEstado('ok');
          return;
        }
        setEstado(res.status === 'no_encontrado' ? 'no_encontrado' : 'no_disponible');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [gasto.id]);

  // Mientras llega el fresco se muestra el de la lista: es el mismo gasto y evita un salto en
  // blanco. Cuando llega, gana el del servidor.
  const g = fresco ?? gasto;
  const origen = ETIQUETA_ORIGEN[g.origen];

  return (
    <div className="detalle-gasto" data-testid="detalle-gasto">
      <div className="detalle-gasto__scroll" data-testid="detalle-gasto-scroll">
        <p className="detalle-gasto__monto" data-testid="detalle-gasto-monto">
          {formatearImporte(g.monto)}
        </p>

        {estado === 'cargando' && (
          <div data-testid="detalle-gasto-cargando" className="detalle-gasto__loading">
            <Skeleton height={16} radius={8} />
            <Skeleton height={16} radius={8} />
          </div>
        )}

        {estado === 'no_encontrado' && (
          <p className="detalle-gasto__aviso" data-testid="detalle-gasto-no-encontrado">
            No encontramos ese gasto.
          </p>
        )}

        {estado === 'no_disponible' && (
          <p className="detalle-gasto__aviso" data-testid="detalle-gasto-no-disponible">
            El detalle todavía no está disponible en tu copiloto.
          </p>
        )}

        {estado === 'error' && (
          <p className="detalle-gasto__error" data-testid="detalle-gasto-error">
            No pudimos cargar el detalle.
          </p>
        )}

        <div className="detalle-gasto__datos">
          <Dato etiqueta="Categoría" valor={ETIQUETA_CATEGORIA[g.categoria]} testID="detalle-gasto-categoria" />
          {/* H-A4-6: `g.fecha` llega "YYYY-MM-DD" (sin hora) del backend. `Larga` porque acá SÍ
              importa el año — es el detalle, no la card. */}
          <Dato etiqueta="Fecha" valor={formatearFechaLarga(g.fecha)} testID="detalle-gasto-fecha" />
          {g.proveedor != null && (
            <Dato etiqueta="Proveedor" valor={g.proveedor} testID="detalle-gasto-proveedor" />
          )}
          {g.medioPago != null && (
            <Dato etiqueta="Cómo lo pagaste" valor={g.medioPago} testID="detalle-gasto-medio-pago" />
          )}
          {origen != null && <Dato etiqueta="Origen" valor={origen} testID="detalle-gasto-origen" />}
        </div>

        {/* Lo que dictó, textual: el registro de lo que dijo antes de corregir. */}
        {g.descripcion != null && g.descripcion !== '' && (
          <p className="detalle-gasto__descripcion" data-testid="detalle-gasto-descripcion">
            «{g.descripcion}»
          </p>
        )}

        {g.montoSugerido != null && (
          <p className="detalle-gasto__sugerido" data-testid="detalle-gasto-monto-sugerido">
            Del ticket leímos: {formatearImporte(g.montoSugerido)}
          </p>
        )}

        <div className="detalle-gasto__acciones" data-testid="detalle-gasto-acciones">
          <Button variant="cancel" onClick={onCerrar} data-testid="detalle-gasto-cerrar">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
