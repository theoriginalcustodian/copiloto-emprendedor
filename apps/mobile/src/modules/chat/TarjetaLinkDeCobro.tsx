import { Text, View } from 'react-native';

import { formatearImporte, type LinkDeCobro } from '@copiloto/core';

import { FilaBotones } from '../../theme/glass/campos';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';
import { abrirLink, compartirLink } from '../../util/abrirYCompartir';

/**
 * `TarjetaLinkDeCobro` — el link de cobro de MercadoPago que el copiloto generó (BL-F2, hilo
 * `cobro-voz`). Sólo LECTURA + dos acciones: generar el link no cobra (el HITL ya pasó), así que acá no
 * hay gate ni estado.
 *
 * 🔴 **Compartir abre la hoja nativa (`Share`), que ya trae «Copiar».** No hay botón Copiar propio
 * porque el portapapeles exige `expo-clipboard`, una dependencia nativa congelada: sumarla es MAYOR y
 * la hoja de compartir cubre el caso (WhatsApp, mail y copiar). `abrirLink`/`compartirLink` son las
 * mismas piezas de la card de factura — un fallo se dice, no se pierde.
 *
 * 🔴 **No hay vencimiento porque el backend no lo manda** (`data = {url, amount, concept}`): no se
 * inventa uno. Si aparece en el contrato, se suma en `leerLinkDeCobro`.
 */
export interface TarjetaLinkDeCobroProps {
  link: LinkDeCobro;
  testID?: string;
}

export function TarjetaLinkDeCobro({ link, testID = 'tarjeta-link-cobro' }: TarjetaLinkDeCobroProps) {
  const tema = useTema();
  return (
    <Tile testID={testID}>
      <View style={{ gap: tema.espacio.sm }}>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Link de cobro listo</Text>
        {link.monto != null && (
          <Text
            testID={`${testID}-monto`}
            accessibilityRole="header"
            style={{ color: tema.color.texto, fontSize: tema.tipo.grande, fontWeight: '500' }}
          >
            {formatearImporte(link.monto)}
          </Text>
        )}
        {link.concepto != null && (
          <Text testID={`${testID}-concepto`} style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            {link.concepto}
          </Text>
        )}
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              etiqueta: 'Compartir',
              onPress: () => void compartirLink(link.url, 'el link de cobro'),
              variante: 'primario',
              testID: `${testID}-compartir`,
            },
            {
              etiqueta: 'Abrir',
              onPress: () => void abrirLink(link.url, 'el link de cobro'),
              variante: 'secundario',
              testID: `${testID}-abrir`,
            },
          ]}
        />
      </View>
    </Tile>
  );
}
