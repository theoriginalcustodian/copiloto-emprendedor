import { useSession } from '../auth/useSession';

/**
 * `AvatarCuenta` — la ÚNICA puerta a Ajustes en el shell angosto (BL-X1; port de
 * `apps/mobile/src/modules/midia/AvatarCuenta.tsx`). Ajustes ya no es un tab ni un tile de
 * Funciones: se entra por el disco con la inicial, arriba a la derecha de Mi día y de Funciones,
 * igual que en el prototipo. En escritorio esa puerta es el bloque de usuario del Rail.
 */
export function AvatarCuenta({ onPress }: { onPress: () => void }) {
  const { me } = useSession();
  const inicial = (me?.cliente_id?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <button
      type="button"
      className="avatar-cuenta"
      data-testid="avatar-cuenta"
      aria-label="Tu cuenta y ajustes"
      onClick={onPress}
    >
      {inicial}
    </button>
  );
}
