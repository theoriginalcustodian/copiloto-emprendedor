import { Alert, Linking, Text, View } from 'react-native';

import { formatearImporte, type LinkDeCobro } from '@copiloto/core';

import { FilaBotones } from '../../theme/glass/campos';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';
import { abrirLink, compartirLink } from '../../util/abrirYCompartir';

/**
 * `TarjetaLinkDeCobro` — el link de cobro de MercadoPago que el copiloto generó (BL-F2, hilo
 * `cobro-voz`). Sólo LECTURA + tres acciones: generar el link no cobra (el HITL ya pasó), así que acá
 * no hay gate ni estado.
 *
 * 🔴 **Compartir abre la hoja nativa (`Share`), que ya trae «Copiar».** No hay botón Copiar propio
 * porque el portapapeles exige `expo-clipboard`, una dependencia nativa congelada: sumarla es MAYOR y
 * la hoja de compartir cubre el caso (WhatsApp, mail y copiar). `abrirLink`/`compartirLink` son las
 * mismas piezas de la card de factura — un fallo se dice, no se pierde.
 *
 * 🔴 **No hay vencimiento porque el backend no lo manda** (`data = {url, amount, concept}`): no se
 * inventa uno. Si aparece en el contrato, se suma en `leerLinkDeCobro`.
 *
 * 🔴 **Los chips los deriva ESTA card de `payment_link`; no vienen del backend** (`card-cobro`, adenda
 * de planificación 2026-10-13): `choices` sólo transporta los tokens de confirmación y el cierre con
 * artifact va con `choices=None` (`motor/backend/agent/conversation_workflow.py:746,761,766`).
 *   - «Compartilo por WhatsApp» abre la hoja del sistema — igual que `fact-cae` del prototipo: Odobi no
 *     manda por WhatsApp ni necesita el teléfono; el contacto lo resuelve el share del celular.
 *   - «Mandalo por mail» abre un `mailto:` sin destinatario (el contacto del cliente no está en el dato).
 *
 * 🚫 **Dos frases del prototipo NO se pintan, porque hoy serían falsas en producción:**
 *   - «vence en 7 días»: la preference se arma sin `expires`
 *     (`motor/clients/agent/providers/mercadopago_gateway.py:86-96`) — el link
 *     no vence. Si el operador decide que venza, baja como contrato con `artifact.data.expira_at` y se
 *     pinta LEYENDO ese campo, nunca con un «7 días» escrito a mano.
 *   - «cuando pague, te aviso»: no hay push de cobro acreditado (backlog `AVISOCOBRO`). Lo cierto es lo
 *     que dice `NOTA_ANOTA_AL_APROBAR`: el ingreso se anota solo cuando MP aprueba (`apps/copiloto/mp_web.py:55-60`).
 */
export const NOTA_ANOTA_AL_APROBAR = 'Cuando Mercado Pago apruebe el pago, lo anoto como ingreso.';

/** `mailto:` sin destinatario con el link en el cuerpo. Puro, para poder probarlo sin la red. */
export function mailtoLinkDeCobro(link: LinkDeCobro): string {
  const monto = link.monto != null ? ` de ${formatearImporte(link.monto)}` : '';
  const concepto = link.concepto != null ? ` (${link.concepto})` : '';
  const asunto = 'Link de cobro';
  const cuerpo = `Hola, te paso el link para pagar${monto}${concepto}:\n${link.url}`;
  return `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

async function abrirCorreo(link: LinkDeCobro): Promise<void> {
  try {
    await Linking.openURL(mailtoLinkDeCobro(link));
  } catch {
    // No `abrirLink`: su aviso habla de un link «vencido», que acá sería falso (el link no vence).
    Alert.alert('No se pudo abrir el correo', 'No hay una app de correo disponible. Probá compartirlo.');
  }
}
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
        <Text testID={`${testID}-nota`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          {NOTA_ANOTA_AL_APROBAR}
        </Text>
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              etiqueta: 'Compartilo por WhatsApp',
              onPress: () => void compartirLink(link.url, 'el link de cobro'),
              variante: 'primario',
              testID: `${testID}-compartir`,
            },
            {
              etiqueta: 'Mandalo por mail',
              onPress: () => void abrirCorreo(link),
              variante: 'secundario',
              testID: `${testID}-mail`,
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
