import { leerArtefactoEnlace, leerDatosNegocio } from '@copiloto/core';

import { Button, Surface } from '../../design-system';
import type { ReplyCard } from '../../lib/api';
import './chat.css';

export interface ArtifactViewProps {
  card: ReplyCard;
}

/**
 * Render de un artefacto terminal por `card.kind` (Task 17, prioridad #1 = share button de
 * `payment_link`). Reusa el tipo `ReplyCard` del contrato de API (`lib/api/types.ts`) en vez de
 * duplicar un shape local — un solo lugar define "qué trae el card".
 *
 * `kind:'confirm'` (el gate HITL) NUNCA llega acá: lo sigue renderizando `HitlCard` — `Bubble` es
 * quien filtra ese kind antes de montar este componente (ver `Bubble.tsx`). Cualquier otro kind sin
 * `url` en `data`, o un kind no reconocido, no renderiza nada (degradación silenciosa: el texto del
 * bubble ya comunicó lo que pasó, el artifact es un plus, no la única fuente).
 */
export function ArtifactView({ card }: ArtifactViewProps) {
  const data = card.data ?? {};
  const url = typeof data.url === 'string' ? data.url : undefined;

  // `datos_negocio` (preg-datos, C-D5) — la respuesta de LECTURA a «¿cuánto entró este mes?». Gemela de
  // `TarjetaDatosNegocio` (mobile): una fila por cifra, `chip` y `nota` sólo si vienen. `valor` llega ya
  // formateado por el backend y se pinta TAL CUAL. Sin titulo/cifras legibles el parser da `null` y cae a
  // «no renderiza nada» (queda el texto del bubble), igual que cualquier kind desconocido.
  const datosNegocio = leerDatosNegocio(card);
  if (datosNegocio) {
    return (
      <Surface variant="card" blur className="datos-negocio" data-testid="datos-negocio">
        <div className="datos-negocio__cabecera">
          <h3 className="datos-negocio__titulo" data-testid="datos-negocio-titulo">
            {datosNegocio.titulo}
          </h3>
          {datosNegocio.chip != null && (
            <span className="datos-negocio__chip" data-testid="datos-negocio-chip">
              {datosNegocio.chip}
            </span>
          )}
        </div>
        <dl className="datos-negocio__cifras">
          {datosNegocio.cifras.map((cifra, i) => (
            <div key={`${i}-${cifra.clave}`} className="datos-negocio__fila" data-testid={`datos-negocio-cifra-${i}`}>
              <dt className="datos-negocio__clave">{cifra.clave}</dt>
              <dd className="datos-negocio__valor">{cifra.valor}</dd>
            </div>
          ))}
        </dl>
        {datosNegocio.nota != null && (
          <p className="datos-negocio__nota" data-testid="datos-negocio-nota">
            {datosNegocio.nota}
          </p>
        )}
      </Surface>
    );
  }

  if (card.kind === 'payment_link' && url) {
    const share = () => {
      // Web Share API primero (prioridad #1 del spec — hoja nativa de compartir en mobile); sin
      // soporte (desktop viejo, o jsdom en test) degrada a copiar el link al portapapeles.
      if (navigator.share) void navigator.share({ title: 'Link de pago', url });
      else void navigator.clipboard?.writeText(url);
    };
    return (
      <div className="artifact artifact--payment">
        <Button onClick={share}>Compartir link de pago</Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Pagar ${String(data.amount ?? '')}
        </a>
      </div>
    );
  }

  // `calendar_event` y doc/sheet/file/email_draft: el MISMO parser que la tarjeta mobile (SM-D1), así el
  // contrato de los artefactos con enlace vive en un solo lugar.
  const enlace = leerArtefactoEnlace(card);
  if (enlace?.kind === 'calendar_event') {
    return (
      <div className="artifact artifact--calendar">
        <span>{enlace.titulo}</span>
        {enlace.url != null && (
          <a href={enlace.url} target="_blank" rel="noopener noreferrer">
            {enlace.etiqueta}
          </a>
        )}
      </div>
    );
  }

  if (enlace?.url != null) {
    return (
      <a className="artifact" href={enlace.url} target="_blank" rel="noopener noreferrer">
        {enlace.etiqueta}
      </a>
    );
  }

  return null; // 'confirm' u otros kinds sin data reconocida: los maneja HitlCard, no ArtifactView.
}
