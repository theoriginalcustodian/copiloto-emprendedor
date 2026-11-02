import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { hrefDeRuta } from '../src/modules/midia/destinoTarjeta';
import { PantallaTuDia } from '../src/modules/midia/PantallaTuDia';
import { dejarAvisoParaElChat } from '../src/navegacion/avisoParaElChat';
import { empujarUnaVez, reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de Tu día, la puerta «Ver tablero ›» de Mi día. Mantiene el nombre `midia` porque ya es el del glass
 * en `app/_layout.tsx`. Es lanzadora como Ajustes: abre la conexión o el comprobante de una tarjeta, y por
 * eso reabre la puerta al ganar foco (`empujarUnaVez`). El verbo que va al chat vuelve al shell, dueño del chat.
 */
export default function PantallaTuDiaRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  return (
    <PantallaTuDia
      onAjustes={() => empujarUnaVez('/ajustes')}
      onDestino={(ruta) => empujarUnaVez(hrefDeRuta(ruta))}
      onAvisoAlChat={(aviso) => {
        dejarAvisoParaElChat(aviso);
        router.back();
      }}
    />
  );
}
