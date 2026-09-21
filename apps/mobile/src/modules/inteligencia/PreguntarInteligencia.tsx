import { router } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';

import { Composer } from '../chat/Composer';
import { dejarPendiente } from '../chat/mensajePendiente';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PreguntarInteligencia` — la solapa «Preguntar» de Inteligencia de Negocio (BL-X3).
 *
 * 🔴 **Ya no hay un mini-chat propio.** Antes era un Q&A sincrónico contra `POST /inteligencia/chat`,
 * paralelo al chat principal: dos hilos, dos historiales, y el sincrónico no sobrevivía a un corte.
 * Ahora la pregunta se deja como mensaje pendiente (`dejarPendiente`, el mismo puente de «Cómo usar la
 * app») y se vuelve al chat principal, que la envía al montar/enfocar: la respuesta llega en el hilo
 * durable (Temporal) con todo su contexto.
 */
export function PreguntarInteligencia() {
  const tema = useTema();

  const preguntar = useCallback((texto: string) => {
    const limpio = texto.trim();
    if (limpio === '') return;
    dejarPendiente(limpio);
    router.back();
  }, []);

  return (
    <KeyboardAvoidingView testID="preguntar-inteligencia" behavior="padding" style={styles.contenedor}>
      <View style={[styles.lista, { padding: tema.espacio.md }]}>
        <Text
          testID="preguntar-inteligencia-vacio"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center', padding: tema.espacio.lg }}
        >
          Preguntale a tu copiloto sobre tu negocio. Por ejemplo: «¿cuánto gasté este mes?» o «¿quién me
          debe?». La respuesta te espera en el chat.
        </Text>
      </View>
      <Composer sendStatus="idle" onSend={preguntar} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // SIN `backgroundColor` a propósito — vive dentro del vidrio de la función de IN.
  contenedor: { flex: 1 },
  lista: { flex: 1, justifyContent: 'center' },
});
