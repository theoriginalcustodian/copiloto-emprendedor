import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Text } from 'react-native';

import { PantallaTicket } from '../src/modules/soporte';
import { MarcoGlass } from '../src/theme/glass/MarcoGlass';
import { reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Mi ticket" (S6-11) — mismo patrón que `app/gastos.tsx`: ruta HOJA, se llega SÓLO desde
 * una fila `ticket_respuesta` de Actividad (`destinoDe`), nunca desde el escritorio.
 *
 * 🔴 **Reabre la puerta de navegación al ganar foco** — mismo motivo que toda ruta hoja de esta
 * carpeta: sin esto, la SIGUIENTE función que lance `empujarUnaVez` queda muda.
 *
 * `ticketId` es OBLIGATORIO acá (a diferencia de `gastoId` en `gastos.tsx`, que abre un listado sin
 * id): esta pantalla no tiene un "listado de tickets" que mostrar sin uno — sólo se llega con un id
 * real desde `destinoDe`. Un deep-link roto (sin id, o no numérico) no inventa una pantalla vacía:
 * mejor un cartel honesto que un ticket que no es.
 */
function idDeParam(v: string | string[] | undefined): number | undefined {
  const crudo = Array.isArray(v) ? v[0] : v;
  if (crudo == null || !/^\d+$/.test(crudo)) return undefined;
  return Number(crudo);
}

export default function PantallaTicketRoute() {
  const params = useLocalSearchParams<{ ticketId?: string }>();
  const ticketId = idDeParam(params.ticketId);

  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  if (ticketId == null) {
    return (
      <MarcoGlass titulo="Tu ticket" icono="conversacion" testID="pantalla-ticket-sin-id">
        <Text testID="ticket-sin-id">No encontramos ese ticket.</Text>
      </MarcoGlass>
    );
  }

  return <PantallaTicket ticketId={ticketId} />;
}
