/**
 * `AcumuladoAnual` — **«Acumulado del año»** (BL-X2): los últimos 12 meses facturados y qué
 * porcentaje del tope de monotributo representan.
 *
 * Viene de `ContabilidadScreen` (web), retirada al fusionarse Contabilidad en Inteligencia — mismo
 * movimiento que ya hizo mobile (`apps/mobile/src/modules/inteligencia/AcumuladoAnual.tsx`). **Se
 * movió, no se construyó**: el contrato, el fail-soft y el semáforo son los de allá.
 *
 * 🔴 Sigue leyendo de `GET /contabilidad/resumen` (se fusionó la PANTALLA, no el endpoint). Si ese
 * endpoint no está o falla, **no se dibuja nada**: un cartel de error acá diría que Inteligencia
 * falló cuando lo que falló es un agregado secundario.
 *
 * 🔴 Fail-soft del tope: sin escala vigente `tope` viene `null` y se muestra SÓLO el acumulado;
 * nunca un tope viejo presentado como vigente (dato falso sobre una obligación fiscal).
 */
import { useEffect, useRef, useState } from 'react';

import { formatearImporte, obtenerResumenContabilidad, type ResumenContabilidad } from '@copiloto/core';

import { Badge, type BadgeVariant, Surface } from '../../design-system';

const VARIANTE_SEMAFORO: Record<string, BadgeVariant> = {
  verde: 'ok',
  amarillo: 'warning',
  rojo: 'danger',
};

export function AcumuladoAnual({ testId = 'inteligencia-acumulado' }: { testId?: string }) {
  const [facturado, setFacturado] = useState<ResumenContabilidad['facturado'] | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    void obtenerResumenContabilidad()
      .then((res) => {
        if (!vivo.current || res.status === 'no_disponible') return;
        setFacturado(res.resumen.facturado);
      })
      .catch(() => {
        // Silencio deliberado: ver el docstring del módulo.
      });
    return () => {
      vivo.current = false;
    };
  }, []);

  if (facturado == null) return null;

  return (
    <Surface variant="card" className="inteligencia-screen__card" data-testid={testId}>
      <p className="inteligencia-screen__card-titulo">Acumulado del año</p>
      <p className="inteligencia-screen__card-cifra" data-testid={`${testId}-doce-meses`}>
        {formatearImporte(facturado.doceMeses)}
      </p>
      <p className="inteligencia-screen__acumulado-sub">Últimos 12 meses facturados</p>
      {facturado.tope != null && (
        <Badge variant={VARIANTE_SEMAFORO[facturado.tope.semaforo] ?? 'neutral'} className="inteligencia-screen__acumulado-tope">
          <span data-testid={`${testId}-tope`}>{facturado.tope.porcentaje}% del tope de monotributo</span>
        </Badge>
      )}
    </Surface>
  );
}
