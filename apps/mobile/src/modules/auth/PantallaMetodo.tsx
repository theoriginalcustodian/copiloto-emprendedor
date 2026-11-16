import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PORTADA } from '../../theme/identidadPalette';
import { useTema } from '../../theme/ThemeProvider';
import { BotonProveedor } from './BotonProveedor';
import { estilosEntrada } from './layoutEntrada';
import { useSession } from './useSession';


export interface PantallaMetodoProps {
  /** «Continuar con mail»: el camino del formulario. */
  onMail: () => void;
}

/**
 * «Elegí cómo seguir» — la pantalla 2 del flujo «Entrada a Odobi» (Martin 12/11). Una sola puerta para
 * registrarse o entrar: Odobi decide si la cuenta es nueva o ya existe, así nadie tiene que saber de
 * antemano qué botón le toca.
 *
 * - **Apple**: sólo en iOS. Se dibuja ya (decisión de Martin), pero el backend todavía no tiene `Sign in with Apple`:
 *   al tocarlo avisa que llega pronto. Cuando exista el endpoint, se cablea acá sin tocar el layout.
 * - **Google**: el `loginConGoogle` de siempre. Para Google, entrar y crear cuenta son el mismo acto.
 * - **Mail**: quien llegó por «Empecemos» va a crear la cuenta; quien vuelve, a entrar (lo decide `EntradaSesion`).
 */
export function PantallaMetodo({ onMail }: PantallaMetodoProps) {
  const tema = useTema();
  const { loginConGoogle } = useSession();
  const [procesandoGoogle, setProcesandoGoogle] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function manejarGoogle() {
    setAviso(null);
    setProcesandoGoogle(true);
    const resultado = await loginConGoogle();
    setProcesandoGoogle(false);
    if (resultado.ok || resultado.error === 'cancelado') return;
    setAviso(
      resultado.error === 'no-habilitada'
        ? 'Tu cuenta todavía no está habilitada. Escribinos para activarla.'
        : 'No pudimos conectarnos. Probá de nuevo en un toque.',
    );
  }

  return (
    <ScrollView
      testID="metodo-screen"
      style={{ backgroundColor: PORTADA.fondo }}
      contentContainerStyle={[estilosEntrada.scroll, { paddingHorizontal: tema.espacio.lg }]}
      bounces={false}
    >
      {/* Pieza de marca sobre terracota: íconos oscuros en la barra de estado en las dos pieles. */}
      <StatusBar style="dark" />
      {/* El logotipo en blanco sobre la terracota (3,16:1, exento por WCAG 1.4.3 y además texto grande).
          Ocupa todo el alto libre; lo que se toca queda abajo, al alcance del pulgar. */}
      <View style={estilosEntrada.zonaMarca}>
        <Text testID="metodo-wordmark" accessibilityRole="header" style={[estilosEntrada.wordmark, { color: PORTADA.marca, fontFamily: tema.fuente.display }]}>
          Odobi
        </Text>
      </View>

      {/* Una sola línea, como el «Iniciaste sesión por última vez…» de Bumble. Si hay un aviso, ocupa su lugar. */}
      <Text
        testID={aviso != null ? 'metodo-aviso' : 'metodo-ayuda'}
        accessibilityLiveRegion="polite"
        style={[estilosEntrada.linea, { color: PORTADA.tinta, fontFamily: tema.fuente.uiMedium }]}
      >
        {aviso ?? 'Si es tu primera vez, la cuenta se crea sola.'}
      </Text>

      <View style={{ gap: 12 }}>
        {/* Apple sólo en iPhone: en Android Sign in with Apple pide un flujo web y casi nadie tiene Apple ID. */}
        {Platform.OS === 'ios' && (
          <BotonProveedor
            testID="metodo-apple"
            proveedor="apple"
            etiqueta="Continuar con Apple"
            onPress={() => setAviso('Entrar con Apple llega muy pronto. Usá Google o tu mail.')}
          />
        )}
        <BotonProveedor testID="metodo-google" proveedor="google" etiqueta="Continuar con Google" cargando={procesandoGoogle} onPress={manejarGoogle} />
        <BotonProveedor testID="metodo-mail" proveedor="mail" etiqueta="Continuar con mail" onPress={onMail} />
      </View>

      <Text style={[styles.centro, styles.legal, { color: PORTADA.tinta, fontFamily: tema.fuente.ui }]}>
        Al continuar aceptás los Términos y la Política de privacidad.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  legal: { fontSize: 12, lineHeight: 17, marginTop: 20 },
  centro: { textAlign: 'center' },
});
