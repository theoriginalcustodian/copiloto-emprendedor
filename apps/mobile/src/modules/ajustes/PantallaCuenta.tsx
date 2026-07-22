import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * "Cuenta" — quién sos en el copiloto, y la salida.
 *
 * 🔴 **Muestra el email REAL de `GET /me`, no uno cacheado ni inventado.** Es el único dato de
 * identidad que el backend expone hoy (`MeResponse` = `cliente_id` + `email`), y es exactamente el
 * que importa acá: en este proyecto el tenant del teléfono resultó ser distinto del que el operador
 * creía, y no había forma de verlo desde la app. Una pantalla de cuenta que no dice con qué cuenta
 * estás adentro no sirve para nada.
 *
 * 🔴 **Cerrar sesión pide confirmación.** No es destructivo para los datos, pero sí lo es para el
 * trabajo en curso: hay que volver a escribir usuario y contraseña, y en un teléfono eso es fricción
 * real. Un toque accidental en una grilla de íconos no puede echarte.
 */
export function PantallaCuenta() {
  const tema = useTema();
  const { me, logout } = useSession();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <MarcoGlass titulo="Cuenta" icono="user" testID="pantalla-cuenta">
      <View style={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.md }]}>
        <Row testID="cuenta-identidad">
          <View style={{ gap: 2 }}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Estás usando el copiloto como
            </Text>
            {/* Sin email el backend devolvió `null` — se DICE, no se inventa un placeholder que
                parezca una dirección real. */}
            <Text
              testID="cuenta-email"
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
            >
              {me?.email ?? 'Tu cuenta no tiene un email asociado.'}
            </Text>
          </View>
        </Row>

        {!confirmando ? (
          <FilaBotones
            testID="cuenta-salir-botones"
            botones={[
              {
                etiqueta: 'Cerrar sesión',
                onPress: () => setConfirmando(true),
                variante: 'peligro',
                testID: 'cuenta-cerrar-sesion',
              },
            ]}
          />
        ) : (
          <View
            testID="cuenta-confirmar-salida"
            style={{
              backgroundColor: tema.color.superficieAlta,
              borderRadius: tema.radio.md,
              padding: tema.espacio.sm,
              gap: tema.espacio.sm,
            }}
          >
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
              Vas a tener que volver a entrar con tu usuario y contraseña. Tus datos y tus facturas
              no se borran.
            </Text>
            <FilaBotones
              testID="cuenta-confirmar-botones"
              botones={[
                {
                  etiqueta: 'Sí, cerrar sesión',
                  onPress: logout,
                  variante: 'peligro',
                  testID: 'cuenta-cerrar-sesion-si',
                },
                { etiqueta: 'No', onPress: () => setConfirmando(false), testID: 'cuenta-cerrar-sesion-no' },
              ]}
            />
          </View>
        )}
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
