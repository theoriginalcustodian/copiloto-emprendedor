import { useEffect, useState } from 'react';

import { hayConexionCaida } from '@copiloto/core';

import { catalog } from '../lib/api/catalog';
import { useSession } from '../auth/useSession';

/**
 * ¿Hay ≥ 1 servicio con la conexión caída? (K-09 / BL-J4). Fail-soft: si el catálogo no responde o
 * un backend anterior no manda `status`, el punto queda apagado — nunca avisa de algo que no se sabe.
 */
function useConexionCaida(): boolean {
  const [avisa, setAvisa] = useState(false);
  useEffect(() => {
    let vivo = true;
    catalog()
      .then((res) => {
        const servicios = (res.services ?? []).map((s) => ({ estado: s.status ?? 'nunca_conectado' }));
        if (vivo) setAvisa(hayConexionCaida(servicios));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return avisa;
}

/**
 * `AvatarCuenta` — la ÚNICA puerta a Ajustes en el shell angosto (BL-X1; port de
 * `apps/mobile/src/modules/midia/AvatarCuenta.tsx`). Ajustes ya no es un tab ni un tile de
 * Funciones: se entra por el disco con la inicial, arriba a la derecha de Mi día y de Funciones,
 * igual que en el prototipo. En escritorio esa puerta es el bloque de usuario del Rail.
 */
export function AvatarCuenta({ onPress }: { onPress: () => void }) {
  const { me } = useSession();
  const avisa = useConexionCaida();
  const inicial = (me?.cliente_id?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <button
      type="button"
      className="avatar-cuenta"
      data-testid="avatar-cuenta"
      aria-label={avisa ? 'Tu cuenta y ajustes — hay algo para mirar' : 'Tu cuenta y ajustes'}
      onClick={onPress}
    >
      {inicial}
      {avisa && <span className="avatar-cuenta__punto" data-testid="avatar-cuenta-punto" aria-hidden="true" />}
    </button>
  );
}
