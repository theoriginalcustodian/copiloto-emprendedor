import { useEffect, useRef, useState } from 'react';

import { formatearImporte, listarComprobantes, listarImpagos } from '@copiloto/core';

import { Surface } from '../../design-system';

/** `fechaISO` es `YYYY-MM-DD` (sólo fecha, sin hora -- `date.isoformat()` del backend). Se le agrega
 *  una hora LOCAL explícita antes de parsear: sin esto, `new Date('2026-08-31')` cae a medianoche
 *  UTC, que en Argentina (UTC-3) retrocede al día anterior -- movería facturas del último día del
 *  mes al período equivocado. */
function enMesActual(fechaISO: string | null, ahora: Date): boolean {
  if (fechaISO == null) return false;
  const d = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
}

/**
 * Suma importes decimales (string) **sin pasar por `Number`** -- misma regla de plata que
 * `formatoDinero.ts` (`packages/core`), que documenta la sumatoria como "hace falta una librería
 * decimal" pero no la trae. Acá no hay batch de sumas fuera de esta pantalla que justifique agregar
 * una dependencia nueva, así que se resuelve con `BigInt` sobre centavos enteros -- exacto, sin
 * punto flotante, sin librería nueva. Un valor no numérico se ignora (no rompe la suma del resto).
 */
function sumarImportesCentavos(valores: readonly string[]): string {
  let totalCentavos = 0n;
  for (const valor of valores) {
    const limpio = valor.trim();
    if (!/^-?\d+(\.\d+)?$/.test(limpio)) continue;
    const negativo = limpio.startsWith('-');
    const sinSigno = negativo ? limpio.slice(1) : limpio;
    const [entera = '0', decimales = ''] = sinSigno.split('.');
    const centavosTexto = `${decimales}00`.slice(0, 2);
    const centavos = BigInt(entera) * 100n + BigInt(centavosTexto);
    totalCentavos += negativo ? -centavos : centavos;
  }
  const negativoFinal = totalCentavos < 0n;
  const abs = negativoFinal ? -totalCentavos : totalCentavos;
  return `${negativoFinal ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

export interface ResumenFacturacionProps {
  cuit: string;
  testID?: string;
}

/**
 * "Bloque negro" de Facturación (Tarea 3, gramática Monzo, CLAUDE.md §5) -- port de la anatomía ya
 * aplicada en `gastos/ResumenMes.tsx` a esta función. LA cifra accionable acá es lo facturado en el
 * mes -- no el total histórico ni "lo que me deben" (eso ya tiene su propia sección, `SeccionMeDeben`).
 *
 * 🔴 **Sin endpoint de resumen propio.** A diferencia de `obtenerResumenGastos()`, la API de
 * facturación no tiene un agregado por período -- este componente arma la cifra del lado del cliente
 * a partir de `listarComprobantes` (hasta 50 más recientes, sin filtro de período en el backend) +
 * `listarImpagos()`, cruzados por `id`. Es una aproximación sobre lo más reciente, no un total
 * histórico exacto del mes si hubiera más de 50 comprobantes -- documentado acá porque no hay campo
 * en la API para pedirlo mejor sin tocar backend (fuera de alcance de este PR de sólo-estilo).
 */
export function ResumenFacturacion({ cuit, testID = 'facturacion-resumen' }: ResumenFacturacionProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [totalPeriodo, setTotalPeriodo] = useState<string | null>(null);
  const [facturasPeriodo, setFacturasPeriodo] = useState(0);
  const [impagasPeriodo, setImpagasPeriodo] = useState(0);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    let cancelado = false;
    setEstado('cargando');
    Promise.all([listarComprobantes(cuit), listarImpagos()])
      .then(([resComprobantes, resImpagos]) => {
        if (cancelado || !vivo.current) return;
        if (resComprobantes.status === 'no_disponible') {
          setEstado('no_disponible');
          return;
        }
        const ahora = new Date();
        // `estado === 'emitida'` deja afuera anuladas Y notas de crédito -- "facturado" es lo que
        // quedó en pie, no lo que se neutralizó después.
        const delPeriodo = resComprobantes.comprobantes.filter(
          (c) => c.estado === 'emitida' && enMesActual(c.fechaEmision, ahora),
        );
        const idsImpagos = new Set(
          resImpagos.status === 'ok' ? resImpagos.comprobantes.map((f) => f.id) : [],
        );
        if (!cancelado && vivo.current) {
          setTotalPeriodo(sumarImportesCentavos(delPeriodo.map((c) => c.total)));
          setFacturasPeriodo(delPeriodo.length);
          setImpagasPeriodo(delPeriodo.filter((c) => c.id != null && idsImpagos.has(c.id)).length);
          setEstado('ok');
        }
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => {
      cancelado = true;
      vivo.current = false;
    };
  }, [cuit]);

  return (
    <Surface variant="bloque" className="facturacion-resumen" data-testid={testID}>
      <p className="facturacion-resumen__periodo" data-testid={`${testID}-periodo`}>
        Facturado este mes
      </p>
      {/* Nunca "$0" cuando el dato falta -- sólo cuando SE SABE que fue cero (estado `ok`) se
          formatea la cifra real, que puede legítimamente ser "$0". */}
      <p className="facturacion-resumen__total" data-testid={`${testID}-total`}>
        {estado === 'ok' && totalPeriodo != null ? formatearImporte(totalPeriodo) : '—'}
      </p>
      {estado === 'ok' && (
        <span className="facturacion-resumen__comp" data-testid={`${testID}-comp`}>
          {facturasPeriodo} {facturasPeriodo === 1 ? 'factura' : 'facturas'} ·{' '}
          {impagasPeriodo} {impagasPeriodo === 1 ? 'impaga' : 'impagas'}
        </span>
      )}
      {estado === 'error' && (
        <p className="facturacion-resumen__aviso" data-testid={`${testID}-error`}>
          No pudimos calcular lo facturado este mes.
        </p>
      )}
    </Surface>
  );
}
