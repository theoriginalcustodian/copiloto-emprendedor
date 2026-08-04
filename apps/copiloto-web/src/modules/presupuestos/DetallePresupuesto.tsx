import { useEffect, useRef, useState } from 'react';

import {
  cambiarEstadoPresupuesto,
  facturarPresupuesto,
  formatearFechaLarga,
  formatearImporte,
  obtenerPresupuesto,
  type EstadoPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import { Badge, Button, Skeleton } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/presupuestos/DetallePresupuesto.tsx` — overlay de ficha con las
 * acciones. MISMO criterio que `FichaCliente`: `position:absolute` + `inset:0` + scroll interno.
 *
 * 🔴 **Pide datos, a diferencia de `FichaCliente`.** El listado omite `items` a propósito — se pide
 * el detalle completo al montar. Arranca con lo que la card ya tenía (todo menos ítems) para no
 * mostrar la hoja en blanco.
 *
 * 🔴 **`hayBorradorPendiente` evita duplicar facturas.** `facturarPresupuesto` es idempotente en el
 * backend (mismo `factura_id` determinístico), pero cuando ya hay un borrador sin emitir
 * (`facturaId != null && !facturado`) se lleva directo a "Continuar la factura" en vez de reintentar
 * el POST — mismo criterio que mobile.
 *
 * 🔴 **No hay botón "Aprobar".** Aprobado sale gratis de Facturar; no hay "volver a pendiente" (el
 * backend lo rechaza con 409, la transición borraría que alguien ya respondió).
 */
const ETIQUETA_DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: 'Consumidor final' };

const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: 'Todavía sin respuesta',
  aprobado: 'Te lo aprobaron',
  desestimado: 'No te lo tomaron',
};

const VARIANTE_ESTADO: Record<EstadoPresupuesto, 'ok' | 'danger' | 'warning'> = {
  pendiente: 'warning',
  aprobado: 'ok',
  desestimado: 'danger',
};

type EstadoFacturar =
  | 'idle'
  | 'enviando'
  | 'ya_facturado'
  | 'falta_perfil'
  | 'estado_incompatible'
  | 'error'
  | 'no_disponible';

export interface DetallePresupuestoProps {
  /** El presupuesto de la card — sin `items`. El detalle completo se pide al montar. */
  presupuesto: Presupuesto;
  onCerrar: () => void;
  /** Lleva al gate de confirmación de factura con el borrador ya armado. */
  onFacturar: (facturaId: string) => void;
  /** El usuario quiere corregirlo: abre el formulario en modo "reemplaza a este". */
  onCorregir: (presupuesto: Presupuesto) => void;
  /** Cambió el estado acá adentro. La lista de atrás lo usa para no quedar mostrando el anterior. */
  onEstadoCambiado?: (presupuesto: Presupuesto) => void;
}

function Dato({ etiqueta, valor, testId }: { etiqueta: string; valor: string; testId?: string }) {
  return (
    <div className="detalle-presupuesto__dato">
      <span className="detalle-presupuesto__dato-etiqueta">{etiqueta}</span>
      <span className="detalle-presupuesto__dato-valor" data-testid={testId}>
        {valor}
      </span>
    </div>
  );
}

export function DetallePresupuesto({
  presupuesto: inicial,
  onCerrar,
  onFacturar,
  onCorregir,
  onEstadoCambiado,
}: DetallePresupuestoProps) {
  const [p, setP] = useState<Presupuesto>(inicial);
  const [cargandoItems, setCargandoItems] = useState(true);
  const [estadoFacturar, setEstadoFacturar] = useState<EstadoFacturar>('idle');
  const [facturaIdPrevia, setFacturaIdPrevia] = useState<string | null>(null);
  const [motivoEstado, setMotivoEstado] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  // `vivo.current = true` DENTRO del setup del efecto — StrictMode, ver el comentario equivalente en
  // GastosScreen/ClientesScreen.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerPresupuesto(inicial.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') setP(res.presupuesto);
        // no_encontrado/no_disponible: se deja lo que trajo la card, sin ítems.
      })
      .finally(() => {
        if (!cancelado && vivo.current) setCargandoItems(false);
      });
    return () => { cancelado = true; };
  }, [inicial.id]);

  async function facturar() {
    setEstadoFacturar('enviando');
    try {
      const res = await facturarPresupuesto(p.id);
      switch (res.status) {
        case 'ok':
          // No se marca nada como facturado acá: esto abrió un BORRADOR. `facturado` pasa a true
          // sólo cuando la emisión se confirma en el gate.
          onFacturar(res.facturaId);
          return;
        case 'ya_facturado':
          setFacturaIdPrevia(res.facturaId);
          setEstadoFacturar('ya_facturado');
          return;
        case 'falta_perfil_fiscal':
          setEstadoFacturar('falta_perfil');
          return;
        case 'estado_incompatible':
          setMotivoEstado(res.motivo);
          setEstadoFacturar('estado_incompatible');
          return;
        case 'no_encontrado':
        case 'no_disponible':
          setEstadoFacturar('no_disponible');
          return;
        default:
          setEstadoFacturar('error');
      }
    } catch {
      setEstadoFacturar('error');
    }
  }

  async function marcarDesestimado() {
    if (marcando) return;
    setMarcando(true);
    setMotivoEstado(null);
    try {
      const res = await cambiarEstadoPresupuesto(p.id, 'desestimado');
      if (res.status === 'ok') {
        setP(res.presupuesto);
        onEstadoCambiado?.(res.presupuesto);
        return;
      }
      if (res.status === 'transicion_invalida') setMotivoEstado(res.motivo);
      else setMotivoEstado('No pudimos marcar el presupuesto. Probá de nuevo.');
    } catch {
      setMotivoEstado('No pudimos marcar el presupuesto. Probá de nuevo.');
    } finally {
      if (vivo.current) setMarcando(false);
    }
  }

  /** Ya hay un borrador de factura sin emitir para este presupuesto — ver el docstring del módulo. */
  const hayBorradorPendiente = p.facturaId != null && !p.facturado;

  return (
    <div className="detalle-presupuesto" data-testid="detalle-presupuesto">
      <div className="detalle-presupuesto__scroll" data-testid="detalle-presupuesto-scroll">
        <div className="detalle-presupuesto__encabezado">
          <p className="detalle-presupuesto__titulo" data-testid="detalle-presupuesto-titulo">
            Presupuesto N° {p.numero}
          </p>
          <Button variant="ghost" onClick={onCerrar} data-testid="detalle-presupuesto-cerrar">
            Cerrar
          </Button>
        </div>

        <Dato etiqueta="Concepto" valor={p.concepto} testId="detalle-presupuesto-concepto" />
        {p.receptor.nombre !== '' && (
          <Dato etiqueta="Cliente" valor={p.receptor.nombre} testId="detalle-presupuesto-receptor" />
        )}
        {p.receptor.docTipo != null && p.receptor.docNro !== '' && (
          <Dato
            etiqueta="Documento"
            valor={`${ETIQUETA_DOC[p.receptor.docTipo] ?? `Tipo ${p.receptor.docTipo}`} ${p.receptor.docNro}`}
          />
        )}
        {p.receptor.contacto !== '' && <Dato etiqueta="Contacto" valor={p.receptor.contacto} />}
        {formatearFechaLarga(p.fecha) !== '' && (
          <Dato etiqueta="Fecha" valor={formatearFechaLarga(p.fecha)} testId="detalle-presupuesto-fecha" />
        )}

        <div className="detalle-presupuesto__seccion">
          <span className="detalle-presupuesto__seccion-titulo">Ítems</span>
          {cargandoItems && p.items.length === 0 && <Skeleton height={16} radius={8} />}
          {p.items.map((item) => (
            <div key={item.orden} className="detalle-presupuesto__item" data-testid={`detalle-presupuesto-item-${item.orden}`}>
              <span className="detalle-presupuesto__item-descripcion">{item.descripcion}</span>
              <span className="detalle-presupuesto__item-cantidad">
                {item.cantidad} × {formatearImporte(item.precioUnitario)}
              </span>
            </div>
          ))}
        </div>

        {/* El total sale del backend TAL CUAL, sin recomputarlo desde los ítems. */}
        <div className="detalle-presupuesto__dato detalle-presupuesto__dato--destacado">
          <span className="detalle-presupuesto__dato-etiqueta">Total</span>
          <span className="detalle-presupuesto__dato-valor detalle-presupuesto__dato-valor--destacado" data-testid="detalle-presupuesto-total">
            {formatearImporte(p.total)}
          </span>
        </div>

        {p.estado != null ? (
          <div data-testid="detalle-presupuesto-estado">
            <Badge variant={VARIANTE_ESTADO[p.estado]}>{ETIQUETA_ESTADO[p.estado]}</Badge>
          </div>
        ) : (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-estado-desconocido">
            No pudimos leer el estado de este presupuesto.
          </p>
        )}
        {p.sinRespuesta === true && (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-sin-respuesta">
            Hace más de un mes que no tenés respuesta. Quizá valga la pena preguntar.
          </p>
        )}
        {motivoEstado != null && (
          <p className="detalle-presupuesto__error" data-testid="detalle-presupuesto-motivo-estado">
            {motivoEstado}
          </p>
        )}

        {p.reemplazaA != null && (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-reemplaza-a">
            Reemplaza al presupuesto anterior (N° {p.reemplazaA}).
          </p>
        )}
        {p.reemplazadoPor != null && (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-reemplazado-por">
            Este presupuesto fue reemplazado por otro más nuevo (N° {p.reemplazadoPor}). Ya no es el
            vigente.
          </p>
        )}
        {p.facturado && (
          <p className="detalle-presupuesto__exito" data-testid="detalle-presupuesto-facturado">
            Ya se emitió la factura de este presupuesto.
          </p>
        )}

        {p.docLink != null ? (
          <div className="detalle-presupuesto__acciones-doc" data-testid="detalle-presupuesto-botones-doc">
            <Button variant="cancel" onClick={() => window.open(p.docLink ?? undefined, '_blank', 'noopener,noreferrer')} data-testid="detalle-presupuesto-ver-doc">
              Ver en Google Docs
            </Button>
          </div>
        ) : (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-sin-doc">
            Este presupuesto no tiene documento de Google. Conectá Google Docs desde Apps para que los
            próximos se generen solos — el presupuesto funciona igual sin él.
          </p>
        )}

        <div className="detalle-presupuesto__acciones" data-testid="detalle-presupuesto-acciones">
          {hayBorradorPendiente && p.facturaId != null ? (
            <Button onClick={() => onFacturar(p.facturaId as string)} data-testid="detalle-presupuesto-continuar-factura">
              Continuar la factura
            </Button>
          ) : (
            !p.facturado &&
            estadoFacturar !== 'ya_facturado' && (
              <Button
                onClick={() => void facturar()}
                disabled={estadoFacturar === 'enviando'}
                data-testid="detalle-presupuesto-facturar"
              >
                {estadoFacturar === 'enviando' ? 'Preparando…' : 'Facturar'}
              </Button>
            )
          )}
          <Button variant="cancel" onClick={() => onCorregir(p)} data-testid="detalle-presupuesto-corregir">
            Corregir
          </Button>
          {p.estado !== 'desestimado' && (
            <Button
              variant="cancel"
              onClick={() => void marcarDesestimado()}
              disabled={marcando}
              data-testid="detalle-presupuesto-desestimar"
            >
              {marcando ? 'Marcando…' : 'No me lo tomaron'}
            </Button>
          )}
        </div>

        {estadoFacturar === 'ya_facturado' && (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-ya-facturado">
            Este presupuesto ya se facturó{facturaIdPrevia != null ? ' (la factura ya existe).' : '.'}
          </p>
        )}
        {estadoFacturar === 'estado_incompatible' && (
          <p className="detalle-presupuesto__error" data-testid="detalle-presupuesto-estado-incompatible">
            {motivoEstado ?? 'Ese presupuesto no se puede facturar como está.'} Si al final te lo
            aceptaron, hacé un presupuesto nuevo.
          </p>
        )}
        {estadoFacturar === 'falta_perfil' && (
          <p className="detalle-presupuesto__error" data-testid="detalle-presupuesto-falta-perfil">
            Antes de facturar tenés que cargar tu CUIT en Ajustes → Facturación AFIP.
          </p>
        )}
        {estadoFacturar === 'error' && (
          <p className="detalle-presupuesto__error" data-testid="detalle-presupuesto-error">
            No pudimos completar la acción. Probá de nuevo.
          </p>
        )}
        {estadoFacturar === 'no_disponible' && (
          <p className="detalle-presupuesto__aviso" data-testid="detalle-presupuesto-no-disponible">
            Facturar desde un presupuesto todavía no está disponible.
          </p>
        )}
      </div>
    </div>
  );
}
