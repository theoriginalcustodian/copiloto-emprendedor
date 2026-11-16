import { useEffect, useState } from 'react';

import { almacenClave } from '../adapters/almacen';

/**
 * Un aviso que se dice UNA sola vez en la vida de la instalación (Martin 14/11).
 *
 * Devuelve `true` la primera vez que algún componente lo pide y lo deja anotado; desde ahí, `false`. Para lo
 * que enseña algo que no hace falta repetir —«con Google conectado, los próximos traen su documento»—: dicho
 * una vez informa, dicho en cada presupuesto es ruido. Mismo criterio que la explicación de la calma en
 * `EstadoVacio`, que se retira con el uso.
 *
 * Mientras se lee el almacén devuelve `false`: mostrar el aviso un instante y sacarlo sería peor que no
 * mostrarlo. Sin almacén (falla al leer) también queda en `false` — un aviso opcional no se arriesga a salir
 * siempre.
 */
export function useAvisoUnaVez(clave: string, activo = true): boolean {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void (async () => {
      const visto = await almacenClave.leer(clave);
      if (visto != null) return;
      await almacenClave.guardar(clave, '1');
      if (vivo) setMostrar(true);
    })();
    return () => {
      vivo = false;
    };
  }, [clave, activo]);

  return mostrar;
}

/** «Con Google conectado…»: una sola vez, sea en un presupuesto del chat o en su detalle. */
export const CLAVE_AVISO_CONECTAR_GOOGLE = 'odobi-aviso-conectar-google';
export const AVISO_CONECTAR_GOOGLE =
  'Si conectás Google desde Apps, los próximos presupuestos traen su documento para mandar por mail o guardar en Drive.';
