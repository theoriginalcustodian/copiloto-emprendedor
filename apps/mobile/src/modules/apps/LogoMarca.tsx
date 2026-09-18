/**
 * `LogoMarca` — el logo real de un servicio de terceros, en su tile.
 *
 * 🔴 **Se iguala por el eje LARGO, no por el ancho.** Los seis logos tienen proporciones distintas
 * (Docs es vertical, Drive y Mercado Pago apaisados, Gmail casi cuadrado). Fijar el ancho deja a Docs
 * flaco y a Drive gigante al lado de sus vecinos; fijar el alto hace lo inverso. Lo que el ojo compara
 * en una columna de tiles es **cuánto ocupa** cada marca, así que la medida se aplica al lado que
 * domina y el otro sale de la proporción del `viewBox`.
 *
 * 🔴 **El tile va BLANCO, no arena.** Estas marcas no se tiñen: sobre el arena del sistema, el rojo de
 * Gmail y el azul de Calendar se ensucian. El blanco es la única superficie que las deja decir su
 * color — y es lo que hace que se reconozcan de un vistazo, que es para lo que están.
 *
 * El `accessibilityLabel` lo pone quien lo usa: el nombre del servicio ya se lee al lado, y repetirlo
 * en el ícono haría que el lector de pantalla lo diga dos veces.
 */
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGOS_MARCA } from './logosMarca';
import { useTema } from '../../theme/ThemeProvider';

export interface LogoMarcaProps {
  /** `id` del servicio en el catálogo del backend (`gmail`, `googledrive`, …). */
  servicio: string;
  /** Lo que mide el lado largo del logo. El corto sale de la proporción. */
  tamano?: number;
  testID?: string;
}

/** `true` si hay logo real para ese servicio — quien no lo tenga sigue con el ícono genérico. */
export function hayLogoDe(servicio: string): boolean {
  return LOGOS_MARCA[servicio] != null;
}

export function LogoMarca({ servicio, tamano = 24, testID }: LogoMarcaProps) {
  const tema = useTema();
  const logo = LOGOS_MARCA[servicio];
  if (logo == null) return null;

  const ancho = logo.proporcion >= 1 ? tamano : Math.round(tamano * logo.proporcion);
  const alto = logo.proporcion >= 1 ? Math.round(tamano / logo.proporcion) : tamano;

  return (
    <View
      testID={testID}
      style={{
        width: 42,
        height: 42,
        borderRadius: tema.radio.sm,
        backgroundColor: tema.color.superficieAlta,
        borderWidth: 1,
        borderColor: tema.color.borde,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgXml xml={logo.xml} width={ancho} height={alto} />
    </View>
  );
}
