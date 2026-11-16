import { useTema } from '../ThemeProvider';
import { ICONO_DEL_SISTEMA } from './mapaIconos';
import { Glifo } from './Glifo';
import type { NombreIconoGlass } from './icons';

interface PropsGlassIcon {
  name: NombreIconoGlass;
  size?: number;
  /** Sólo sobre un fondo fijo que no cambia con la piel, como el chip pastel del escritorio. */
  color?: string;
}

/**
 * Ícono de función Odobi: el glifo del set (`glifos.ts`) que `mapaIconos.ts` le asigna a cada pantalla.
 *
 * Son de **un solo color**: el acento es señal (≤10 %), y un ícono que siempre lo lleva deja de señalar nada.
 * Cada glifo trae su propio `viewBox` y su manera de dibujarse; eso lo resuelve `Glifo`.
 */
export function GlassIcon({ name, size = 24, color }: PropsGlassIcon) {
  const tema = useTema();
  return (
    <Glifo
      testID={`glass-icon-${name}`}
      nombre={ICONO_DEL_SISTEMA[name]}
      size={size}
      color={color ?? tema.color.texto}
    />
  );
}
