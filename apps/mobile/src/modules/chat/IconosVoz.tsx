import Svg, { Path } from 'react-native-svg';

import { Glifo } from '../../theme/glass/Glifo';

/**
 * Los íconos del composer de voz tal como los dibuja el prototipo ODOBI (`ICO_VOZ`,
 * `Prototipo frontend/odobi-ui/prototipo/index.html:2846-2855`): Phosphor, `viewBox` 256, relleno.
 * Desde el 15/11 Martin eligió otro dibujo para el tacho y la pausa (salen de `glifos.ts`); reproducir y enviar
 * siguen siendo los Phosphor del prototipo, trazo 1:1.
 *
 * Son decorativos: el control que los contiene lleva el `accessibilityLabel`, así que el SVG se oculta
 * a los lectores de pantalla (un nombre duplicado sería ruido).
 */
const TRAZO_PLAY =
  'M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40.05l143.83,88Z';
const TRAZO_ENVIAR =
  'M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z';

interface IconoVozProps {
  color: string;
  /** Lado en dp. El prototipo usa 19 (tacho/pausa/play) y 20 (enviar). */
  tamano?: number;
}

function IconoVoz({ trazo, color, tamano }: IconoVozProps & { trazo: string }) {
  return (
    <Svg
      width={tamano}
      height={tamano}
      viewBox="0 0 256 256"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={trazo} fill={color} />
    </Svg>
  );
}

export function IconoTachoVoz({ color, tamano = 19 }: IconoVozProps) {
  return <Glifo nombre="voz-tacho" size={tamano} color={color} decorativo />;
}

export function IconoPausaVoz({ color, tamano = 19 }: IconoVozProps) {
  return <Glifo nombre="voz-pausa" size={tamano} color={color} decorativo />;
}

export function IconoPlayVoz({ color, tamano = 19 }: IconoVozProps) {
  return <IconoVoz trazo={TRAZO_PLAY} color={color} tamano={tamano} />;
}

export function IconoEnviarVoz({ color, tamano = 20 }: IconoVozProps) {
  return <IconoVoz trazo={TRAZO_ENVIAR} color={color} tamano={tamano} />;
}
