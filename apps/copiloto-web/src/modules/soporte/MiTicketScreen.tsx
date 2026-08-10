import { useCallback, useEffect, useRef, useState } from 'react';

import { obtenerMiTicket, type MensajeTicketPropio, type TicketPropio } from '@copiloto/core';

import { Badge, Button, Skeleton } from '../../design-system';
import './miTicket.css';

const ETIQUETA_ESTADO: Record<TicketPropio['estado'], string> = {
  abierto: 'Abierto',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
};

function variantePorEstado(estado: TicketPropio['estado']): 'ok' | 'warning' | 'neutral' {
  if (estado === 'abierto') return 'warning';
  if (estado === 'respondido') return 'ok';
  return 'neutral';
}

/** Igual criterio que `fechaCorta` de `AdminScreen.tsx` — dato ilegible es información, un cartel de
 *  error no. No se comparte el helper: son dos módulos sin dependencia entre sí. */
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

export interface MiTicketScreenProps {
  ticketId: number;
  onVolver: () => void;
}

/**
 * `MiTicketScreen` — S6-11: a dónde lleva tocar una fila `ticket_respuesta` de Actividad. Hilo
 * COMPLETO (mensajes del usuario y del operador), de sólo lectura — responder de nuevo es por el
 * chat de soporte (SOP5), no desde acá; este hito sólo pide "que se vea la respuesta", no un
 * composer nuevo.
 *
 * 🔴 **[ASSUMED_PENDING_VERIFY]** — consume `obtenerMiTicket` (`@copiloto/core`), que pega contra
 * `GET /soporte/tickets/{id}`, un endpoint que TODAVÍA no existe en `main` al escribir esto (ver
 * `coordinacion/abierto/2026-08-10_pedido_frontend-a-todos_S6-11-...md`). Mientras no esté
 * desplegado, `estado` cae en `no_disponible` — no es un error de esta pantalla, es el estado
 * honesto de "todavía no". Mismo criterio que `ActividadScreen`/`listarActividad`.
 */
export function MiTicketScreen({ ticketId, onVolver }: MiTicketScreenProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ticket, setTicket] = useState<TicketPropio | null>(null);
  const [mensajes, setMensajes] = useState<MensajeTicketPropio[]>([]);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(() => {
    setEstado('cargando');
    obtenerMiTicket(ticketId)
      .then((r) => {
        if (!vivo.current) return;
        if (r.status === 'ok') {
          setTicket(r.ticket);
          setMensajes(r.mensajes);
          setEstado('ok');
          return;
        }
        setTicket(null);
        setMensajes([]);
        setEstado(r.status);
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="mi-ticket-screen" data-testid="pantalla-mi-ticket">
      <header className="mi-ticket-screen__header">
        <Button variant="ghost" onClick={onVolver} data-testid="mi-ticket-volver">
          ← Volver
        </Button>
        {ticket != null && (
          <div className="mi-ticket-screen__titulo">
            <span>{ticket.codigo}</span>
            <Badge variant={variantePorEstado(ticket.estado)}>{ETIQUETA_ESTADO[ticket.estado]}</Badge>
          </div>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="mi-ticket-screen__loading" data-testid="mi-ticket-cargando">
          <Skeleton height={56} radius={16} />
          <Skeleton height={56} radius={16} />
        </div>
      )}

      {estado === 'error' && (
        <div className="mi-ticket-screen__empty" data-testid="mi-ticket-error">
          <p>No pudimos cargar tu ticket.</p>
          <Button variant="cancel" onClick={cargar}>Reintentar</Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="mi-ticket-screen__empty" data-testid="mi-ticket-no-disponible">
          Tu ticket todavía no está disponible acá.
        </p>
      )}

      {estado === 'no_encontrado' && (
        <p className="mi-ticket-screen__empty" data-testid="mi-ticket-no-encontrado">
          No encontramos ese ticket.
        </p>
      )}

      {estado === 'ok' && ticket != null && (
        <div className="mi-ticket-screen__body">
          <p className="mi-ticket-screen__asunto">{ticket.asunto}</p>
          <ul className="mi-ticket-screen__mensajes" data-testid="mi-ticket-mensajes">
            {mensajes.map((m) => (
              <li
                key={m.id}
                className={
                  m.autor === 'operador'
                    ? 'mi-ticket-screen__msj mi-ticket-screen__msj--operador'
                    : 'mi-ticket-screen__msj'
                }
                data-testid={`mi-ticket-msj-${m.id}`}
              >
                <span className="mi-ticket-screen__autor">
                  {m.autor === 'operador' ? 'Operador' : 'Vos'} · {fechaCorta(m.created_at)}
                </span>
                <p>{m.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
