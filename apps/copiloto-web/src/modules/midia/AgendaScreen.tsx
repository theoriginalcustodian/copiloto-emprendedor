import { useCallback, useEffect, useRef, useState } from 'react';

import {
  TEXTO_NUEVO_EVENTO,
  dejarPendiente,
  franjaDeEvento,
  leerAgenda,
  rangoAgenda,
  type AgendaMiDia,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import './midia.css';

/**
 * `AgendaScreen` (BL-J13, K-13, ADR-004) — la agenda de los próximos días, sólo lectura: Hoy · Mañana ·
 * Esta semana · Sin hora, con los `titulo` EXACTOS que manda el backend (los 4 grupos vienen siempre).
 *
 * 🔴 **Con Calendar sin conectar NUNCA se dice «no tenés eventos»**: es falso, no sabemos nada. Se
 * ofrece conectar. Un endpoint caído (incluido un 400) degrada a un aviso; no rompe la pantalla.
 *
 * 🔴 **«Nuevo evento» no escribe en Calendar**: deja «Quiero agendar un evento» en el buzón del chat
 * principal (`dejarPendiente`, puente de BL-W9) y navega ahí. El alta la hace el agente con
 * `calendar_book` y confirm-gate HITL (ADR-004 §3).
 */
type Estado = 'cargando' | 'ok' | 'no_disponible';

export interface AgendaScreenProps {
  onVolver: () => void;
  /** Lleva al chat principal. Lo inyecta el shell (`changeTab('chat')`). */
  onAbrirChat: () => void;
}

export function AgendaScreen({ onVolver, onAbrirChat }: AgendaScreenProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [agenda, setAgenda] = useState<AgendaMiDia | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const res = await leerAgenda(rangoAgenda());
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setAgenda(res.agenda);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  return (
    <div className="midia-screen agenda-screen" data-testid="pantalla-agenda">
      <header className="midia-screen__header">
        <div className="agenda-screen__titulos">
          <button type="button" className="agenda-screen__volver" data-testid="agenda-volver" onClick={onVolver}>
            ← Mi día
          </button>
          <h1 className="midia-screen__title">Agenda</h1>
        </div>
        <Button
          variant="primary"
          data-testid="agenda-nuevo-evento"
          onClick={() => {
            dejarPendiente(TEXTO_NUEVO_EVENTO);
            onAbrirChat();
          }}
        >
          Nuevo evento
        </Button>
      </header>

      {estado === 'cargando' && <Skeleton height={64} />}

      {estado === 'no_disponible' && (
        <p className="midia-screen__calendario-invitacion" data-testid="agenda-no-disponible">
          No pudimos cargar tu agenda. Probá de nuevo en un momento.{' '}
          <button type="button" className="agenda-screen__volver" data-testid="agenda-reintentar" onClick={() => void cargar()}>
            Reintentar
          </button>
        </p>
      )}

      {estado === 'ok' && agenda != null && !agenda.conectado && (
        <p className="midia-screen__calendario-invitacion" data-testid="agenda-no-conectado">
          Conectá Google Calendar en Ajustes → Apps para ver acá tu agenda.
        </p>
      )}

      {estado === 'ok' && agenda != null && agenda.conectado && (
        <div className="agenda-screen__grupos">
          {agenda.grupos.map((g) => (
            <section key={g.id} className="agenda-screen__grupo" data-testid={`agenda-grupo-${g.id}`}>
              <h2 className="agenda-screen__grupo-titulo">{g.titulo}</h2>
              {g.eventos.length === 0 ? (
                <p className="midia-screen__calendario-invitacion" data-testid={`agenda-grupo-${g.id}-vacio`}>
                  Nada por acá.
                </p>
              ) : (
                <div className="midia-screen__calendario">
                  {g.eventos.map((ev) => {
                    const franja = franjaDeEvento(ev);
                    return (
                      <div key={ev.id} className="midia-screen__calendario-evento" data-testid={`agenda-evento-${ev.id}`}>
                        {franja != null && <span className="midia-screen__calendario-hora">{franja}</span>}
                        <span className="midia-screen__calendario-titulo">{ev.titulo}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
