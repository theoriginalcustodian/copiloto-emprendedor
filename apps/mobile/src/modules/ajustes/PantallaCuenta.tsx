import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '../auth';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * "Mi cuenta" — quién sos en el copiloto, la salida, y los ajustes generales de la app.
 *
 * 🔴 **Absorbió dos tiles el 2026-07-22** (contrato de reestructuración de Ajustes): *Datos
 * personales* —que era un andamiaje vacío duplicando este mismo concepto— y *Configuración del
 * sistema*, cuyo contenido entero era **una fila inerte**: el lugar reservado de «No molestar». Un
 * tile propio para una fila que no hace nada es de las cosas que enseñan que la app no anda.
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
    <MarcoGlass titulo="Mi cuenta" icono="cuenta" testID="pantalla-cuenta">
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

        {/* BETA-1a: fila, no tile propio — decisión del contrato (§3): la grilla de Ajustes recién
            reforzó su disciplina "sin ícono repetido" (8→6-7 tiles, 2026-07-22), y sumar un tile
            nuevo la rompería justo después de que se cuidó. Reversible: si nadie lo encuentra acá,
            promoverlo a tile propio es un cambio chico. */}
        <Row
          testID="cuenta-feedback"
          accessibilityLabel="Feedback"
          onPress={() => router.push('/ajustes-feedback')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tema.espacio.sm, flex: 1 }}>
            <GlassIcon name="grabar" size={22} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>
                Feedback
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                Contanos qué mejorarías, por texto o por voz.
              </Text>
            </View>
          </View>
        </Row>

        {/* 🔴 Llegó de "Configuración del sistema", y sigue SIN `onPress` a propósito. «No molestar»
            muta un ajuste GLOBAL del teléfono y necesita un restaurador ante crash: si el copiloto lo
            prende y la app se cae antes de apagarlo, el teléfono queda en silencio sin que nadie lo
            haya decidido. Eso es MAYOR —muta estado FUERA del sandbox— y se resuelve en otra tarea.
            Un toggle que no hace nada, o que sólo cambia visualmente, sería peor que esta fila: es un
            dato inventado aplicado a una acción. */}
        <Row testID="cuenta-no-molestar" accessibilityLabel="No molestar (pendiente)">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>
              No molestar
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Pendiente — muta un ajuste del sistema operativo, se implementa en otra tarea.
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
