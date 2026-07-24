import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { leerPerfilNegocio, type ModoCeremonia } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `IndicadorModoCeremonia` — el estado del contrato de modos §4 en el glass principal: *"estado
 * siempre visible sin abrir nada"*, sin tener que entrar a Ajustes → Mi negocio para saberlo.
 *
 * 🔴 **Read-only, SIN segunda opción tocable — Decisión B, confirmada de nuevo para este indicador**
 * (`respuesta_planificacion-a-frontend_selector-es-indicador-read-only-hoy-B-manda-lectura-1`): el
 * automático se OFRECE por una conversación del copiloto cuando el tenant demuestra que dicta
 * completo (addendum §3), nunca se elige de una lista. Por eso esto es una `View`, no un `Pressable`:
 * un control que no responde al toque es peor que no tener control.
 *
 * Placement: primer hijo de `ChatView`, **fuera de `PanelDeslizable`** — mismo lugar que
 * `ModoClinicoToggle` en documed, y por la misma razón que su propio código documenta: el panel
 * "está congelado", los cambios de esta clase van en la capa de contenido que vive adentro suyo, no
 * en la cáscara. Cero riesgo sobre el invariante de los 2 dueños de `panelY`.
 *
 * 🔴 **Doble señal, nunca sólo color** (mismo criterio que `ModoClinicoToggle` — accesibilidad: un
 * indicador que dependiera sólo del tinte falla para quien no distingue el color del punto). El texto
 * siempre nombra el modo.
 *
 * 🔴 **Fail-closed también acá, mismo criterio que `PantallaPerfilNegocio`.** Mientras carga, si falla,
 * o si el endpoint no está disponible, se muestra "Pedir confirmación" — nunca "Automático" por un
 * instante de arranque ni por un error de red. Un default permisivo por una lectura fallida es la
 * clase de bug que se descubre por un registro que nadie autorizó.
 *
 * 🔴 **Se relee al recuperar el FOCO**, no sólo al montar — mismo criterio que la actividad reciente
 * del escritorio: si el emprendedor cambia el modo en Ajustes y vuelve al chat, tiene que ver el modo
 * real, no el que había cuando esta pantalla se montó por primera vez.
 */
export function IndicadorModoCeremonia() {
  const tema = useTema();
  const [modo, setModo] = useState<ModoCeremonia>('confirmacion');

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void leerPerfilNegocio()
        .then((res) => {
          if (!vivo) return;
          // `no_disponible` y `perfil: null` (tenant que nunca configuró nada) caen los dos en el
          // default fail-closed del `useState` de arriba — no hay nada que sobreescribir.
          if (res.status === 'ok' && res.perfil) setModo(res.perfil.modoCeremonia);
        })
        .catch(() => {
          // Silencio deliberado: un error de red no puede mostrar "Automático" ni un cartel de error
          // sobre un indicador secundario — se queda en el default fail-closed.
        });
      return () => {
        vivo = false;
      };
    }, []),
  );

  const activo = modo === 'automatico';

  return (
    <View
      testID="indicador-modo-ceremonia"
      style={[
        styles.contenedor,
        {
          borderColor: activo ? tema.color.exito : tema.glass.chip,
          paddingHorizontal: tema.espacio.sm,
          paddingVertical: tema.espacio.xs,
          gap: tema.espacio.xs,
          borderRadius: tema.radio.completo,
        },
      ]}
    >
      <View
        testID="indicador-modo-ceremonia-punto"
        style={[styles.punto, { backgroundColor: activo ? tema.color.exito : tema.color.textoTenue }]}
      />
      <Text
        testID="indicador-modo-ceremonia-texto"
        style={{ color: tema.color.texto, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}
      >
        {activo ? 'Automático' : 'Pedir confirmación'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  punto: { width: 6, height: 6, borderRadius: 3 },
});
