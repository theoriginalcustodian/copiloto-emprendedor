import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PantallaClientes } from '../src/modules/clientes/PantallaClientes';
import { reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Clientes" — mismo patrón que `app/gastos.tsx`. `PantallaClientes` trae su propio
 * `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * Reabre la puerta de navegación al ganar foco: `empujarUnaVez` la cerró al abrir este glass, y una
 * pantalla que no la reabre deja rota la navegación de la SIGUIENTE que sí lance algo.
 */
export default function PantallaClientesRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  return <PantallaClientes />;
}
