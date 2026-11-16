import { useEffect, useState } from 'react';

import { leerPerfilNegocio } from '@copiloto/core';

/**
 * El nombre comercial del negocio (SM-N9). Es una lectura aparte (`perfilNegocio`). Sin nombre cargado
 * (`nombreComercial === ''`, el emprendedor nuevo), ausente o con la lectura caída devuelve `undefined`: quien
 * lo use no dibuja nada en su lugar, ni hueco ni texto de relleno.
 */
export function useNombreComercial(): string | undefined {
  const [nombre, setNombre] = useState<string | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void leerPerfilNegocio()
      .then((res) => {
        if (!vivo || res.status !== 'ok' || !res.perfil) return;
        const n = res.perfil.nombreComercial.trim();
        if (n !== '') setNombre(n);
      })
      .catch(() => {
        // Secundario: un error de red no pinta cartel.
      });
    return () => {
      vivo = false;
    };
  }, []);
  return nombre;
}
