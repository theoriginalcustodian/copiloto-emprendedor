import './ajustes.css';

/**
 * `PantallaAndamiaje` — port de `apps/mobile/src/modules/ajustes/PantallaAndamiaje.tsx`. Andamiaje
 * HONESTO para "Mi plan": un vacío explícito, nunca un dato de mentira. Un solo componente
 * reusable (título/ícono/mensaje) en vez de triplicar el mismo JSX.
 */
export interface PantallaAndamiajeProps {
  titulo: string;
  /** Emoji — mismo criterio que el resto de web (sin catálogo `GlassIcon` propio). */
  icono: string;
  /** Qué va a vivir acá y por qué todavía no. Texto explícito, nunca un dato de mentira. */
  mensaje: string;
  testID?: string;
}

export function PantallaAndamiaje({ titulo, icono, mensaje, testID = 'pantalla-andamiaje' }: PantallaAndamiajeProps) {
  return (
    <div className="ajustes-andamiaje" data-testid={testID}>
      <header className="ajustes-andamiaje__header">
        <span className="ajustes-andamiaje__icono" aria-hidden="true">{icono}</span>
        <h1 className="ajustes-andamiaje__title">{titulo}</h1>
      </header>
      <p className="ajustes-andamiaje__vacio" data-testid="andamiaje-vacio">
        {mensaje}
      </p>
    </div>
  );
}
