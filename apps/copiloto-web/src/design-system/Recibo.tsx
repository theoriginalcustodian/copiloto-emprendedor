import type { ReactNode } from 'react';

import { Button } from './Button';
import { Surface } from './Surface';

export interface LineaRecibo {
  etiqueta: string;
  valor: string;
  testId?: string;
}

export interface AccionRecibo {
  etiqueta: string;
  /** Con `href` es un link (Ver PDF); con `onClick`, un botón (Ver cliente). */
  href?: string;
  onClick?: () => void;
  testId?: string;
}

export interface ReciboProps {
  /** `data-testid` del contenedor (lo que ya usaban los tests de cada card). */
  testId: string;
  /** `exito`: confirmación de algo hecho. `neutro`: «no lo anotamos», «ya está». */
  tono?: 'exito' | 'neutro';
  /** Una línea: qué pasó. Es lo que anuncia el lector de pantalla. */
  titulo: ReactNode;
  lineas?: LineaRecibo[];
  /** Texto secundario (aviso, «preparando el PDF…»). */
  nota?: { texto: string; testId?: string };
  accion?: AccionRecibo;
}

/**
 * `Recibo` (BL-F1) — el estado terminal de una card del chat: qué pasó, sus datos y, si hay, la
 * acción que sigue. Un solo componente para factura, gasto, ingreso, presupuesto y cliente: antes
 * cada card mantenía su propio texto terminal y cada una decidía sola si anunciaba o no el resultado.
 *
 * 🔴 `role="status"` + `aria-live="polite"`: el resultado de una acción se ANUNCIA. Un lector de
 * pantalla que confirma «Guardar» y después no oye qué pasó no sabe si se guardó (WCAG 4.1.3).
 */
export function Recibo({ testId, tono = 'neutro', titulo, lineas, nota, accion }: ReciboProps) {
  const clases = `propuesta-card propuesta-card--terminal${tono === 'exito' ? ' propuesta-card--exito' : ''}`;
  return (
    <div className="chat-row chat-row--assistant" data-testid={testId}>
      <Surface variant="tile" className={clases} role="status" aria-live="polite">
        <p className="propuesta-card__factura-total" data-testid={`${testId}-titulo`}>
          {titulo}
        </p>
        {lineas?.map((l) => (
          <div className="propuesta-card__factura-row" key={l.etiqueta}>
            <span className="propuesta-card__factura-label">{l.etiqueta}</span>
            <span className="propuesta-card__factura-valor" data-testid={l.testId}>
              {l.valor}
            </span>
          </div>
        ))}
        {nota != null && (
          <p className="propuesta-card__aviso" data-testid={nota.testId}>
            {nota.texto}
          </p>
        )}
        {accion != null &&
          (accion.href != null ? (
            <a
              className="uc-btn uc-btn--primary"
              href={accion.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={accion.testId}
            >
              {accion.etiqueta}
            </a>
          ) : (
            <Button variant="cancel" onClick={accion.onClick} data-testid={accion.testId}>
              {accion.etiqueta}
            </Button>
          ))}
      </Surface>
    </div>
  );
}
