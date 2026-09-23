import { useCallback, useEffect, useRef, useState } from 'react';

import { estadoDeServicio, KEY_GOOGLE_CALENDAR, listarCatalogo, type EstadoConexion } from '@copiloto/core';

/**
 * BL-W11/BL-V23: dos pantallas de este módulo (Mi día, Agenda) necesitan el mismo desempate para
 * Google Calendar — ni `/mi-dia/calendario` ni `/mi-dia/agenda` distinguen "nunca conectada" de
 * "caída" (ambas mandan `conectado: false`); esa señal vive aparte, en el catálogo (K-09).
 * Fail-soft: sin catálogo (caído o backend viejo) queda en `null`, que el llamador lee como
 * "nunca conectada" — el caso menos alarmante ante la duda, y el que ya mostraban las dos
 * pantallas antes de que existiera este desempate.
 */
export function useEstadoGoogleCalendar(): {
  estadoGoogleCalendar: EstadoConexion | null;
  recargarEstadoGoogleCalendar: () => Promise<void>;
} {
  const [estado, setEstado] = useState<EstadoConexion | null>(null);
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (vivo.current && res.status === 'ok') {
        setEstado(estadoDeServicio(res.servicios, KEY_GOOGLE_CALENDAR));
      }
    } catch {
      /* fail-soft: sin catálogo, degrada a "nunca conectada". */
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void recargar();
    return () => {
      vivo.current = false;
    };
  }, [recargar]);

  return { estadoGoogleCalendar: estado, recargarEstadoGoogleCalendar: recargar };
}
