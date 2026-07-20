/**
 * `CapaFuncion` — CÓMO abre y cierra una función del escritorio (Apps, Ajustes, Recientes, Redes
 * Sociales, Métricas, Facturación). **Punto único y swappable** — ver la nota al final si la
 * Medición 1 del handoff cambia esta decisión.
 *
 * 🔴 **Por qué CAPA y no ruta de expo-router.** `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`
 * (sesión hermana de DocuMed, mismo repo-fork, archivos IDÉNTICOS byte a byte a la fecha del handoff)
 * documenta un tirón reproducible al arrastrar hacia abajo el glass de una función — nunca el panel
 * principal. La corrección de premisa del handoff es la parte que importa acá:
 *
 *   > "No son dos configuraciones del mismo componente. Son DOS implementaciones de gesto distintas,
 *   > en dos archivos distintos, con dos hosts de navegación distintos." Chat → `PanelDeslizable.tsx`
 *   > (capa, sin tirón). Función → `MarcoGlass.tsx` + `presentation: transparentModal` (ruta, CON
 *   > tirón).
 *
 * La causa exacta sigue sin confirmar (la "Medición 1" del handoff — instrumentar `panelY` durante el
 * arrastre con dedo humano — es la que puede confirmarla, y NO se puede automatizar: `adb shell input
 * swipe` no reproduce el síntoma, medido). Pero entre dos mecanismos donde uno se comporta bien
 * (capa) y el otro no (ruta `transparentModal`), y sin evidencia todavía de que la ruta sea inocente,
 * elegir la ruta acá sería cargar el mismo riesgo sin necesidad — el copiloto no tiene que reproducir
 * `MarcoGlass.tsx` para nada. `CapaFuncion` es un `Animated.View` **absoluto** (nunca `flex:1`,
 * higiene A3 del handoff) montado como sibling DENTRO de la misma pantalla (`app/index.tsx`), sin
 * `router.push`, sin pantalla `transparentModal` propia.
 *
 * 🔴 **Sin gesto de arrastre para cerrar, a propósito.** El drag-to-dismiss es EXACTAMENTE la
 * superficie bajo sospecha en el handoff (el tirón ocurre *durante* el arrastre, no al soltar). Meterle
 * un `Gesture.Pan()` a esta capa para poder cerrarla deslizando reintroduciría la superficie que se
 * está investigando, en un componente nuevo, antes de tener la Medición 1. Cerrar es un tap explícito
 * en "Cerrar" — más simple, y no hay una hipótesis que investigar detrás.
 *
 * Comparte el mismo nivel de vidrio (`CristalVidrio` + `canonGlass`) que `PanelDeslizable`, así que el
 * look es indistinguible del panel principal aunque el mecanismo de apertura sea otro — el emprendedor
 * ve UNA superficie de vidrio, no dos sistemas.
 *
 * **Si la Medición 1 dijera que la capa NO es la causa** (o que el drag es seguro acá): este es el
 * único archivo a tocar. Encapsula la forma (`Animated.View` absoluto), el gesto (hoy: ninguno) y el
 * mecanismo de cierre (hoy: callback `onCerrar` desde el padre) — nada de esto se esparce en
 * `app/index.tsx` ni en `EscritorioFunciones.tsx`.
 *
 * 🔵 **Limitación conocida, documentada y no bloqueante:** sólo anima la ENTRADA (fade + slide-up al
 * montar). El padre desmonta la capa para cerrarla (sin animación de salida) — un `AnimatePresence`-
 * like de salida no está entre las dependencias del repo hoy y agregarlo es más superficie para medir
 * antes de la Medición 1. Higiene visual, no bloquea la validación del mecanismo.
 */
import { useEffect, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ALTO_HANDLE, CONFIG_SNAP, NIVEL_CANONICO } from '../../theme/glass/canonGlass';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

export interface CapaFuncionProps extends PropsWithChildren {
  /** El nombre de la función, tal como figura en su tile de entrada. */
  titulo: string;
  /** El mismo glifo del tile que la abrió — entrar por un ícono y llegar a otro desorienta. */
  icono: NombreIconoGlass;
  onCerrar: () => void;
  testID?: string;
}

export function CapaFuncion({ titulo, icono, onCerrar, testID, children }: CapaFuncionProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  // 0 = fuera de pantalla (recién montada) · 1 = en su lugar. Corre UNA vez al montar — ver
  // limitación de "sólo entrada" en el docstring del módulo.
  const progreso = useSharedValue(0);

  useEffect(() => {
    progreso.value = withTiming(1, CONFIG_SNAP);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar a propósito
  }, []);

  const estiloCapa = useAnimatedStyle(() => ({
    opacity: progreso.value,
    transform: [{ translateY: (1 - progreso.value) * 40 }],
  }));

  return (
    // NO lleva zIndex propio: `CapaFuncion` se monta como sibling DESPUÉS del `PanelDeslizable` en
    // `app/index.tsx`, y en RN el orden de pintado sigue el orden del árbol — alcanza con montarse
    // último. `StyleSheet.absoluteFill` cubre exactamente la pantalla, igual criterio que
    // `PanelDeslizable.tsx` (nunca `Dimensions.get('window')`).
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Animated.View style={[styles.panel, estiloCapa]}>
        <CristalVidrio nivel={NIVEL_CANONICO} style={styles.cristal}>
          {/* Clearance de la status bar: el vidrio es full-bleed, sólo el contenido respeta el inset —
              mismo criterio que `PanelDeslizable`/`MarcoGlass`. */}
          <View style={{ height: insets.top }} pointerEvents="none" />

          <View style={[styles.encabezado, { paddingHorizontal: tema.espacio.md, minHeight: ALTO_HANDLE }]}>
            <View style={[styles.identidad, { gap: tema.espacio.sm }]}>
              <GlassIcon name={icono} size={28} />
              <Text
                testID="capa-funcion-titulo"
                style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontFamily: tema.fuente.uiBold }}
              >
                {titulo}
              </Text>
            </View>
            {/* `PRESS_FADE`, no `PRESS_SCALE`: es un link de texto suelto, sin caja propia. */}
            <Pressable
              testID="capa-funcion-cerrar"
              onPress={onCerrar}
              hitSlop={12}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Cerrar</Text>
            </Pressable>
          </View>

          {children}
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Forma ABSOLUTA, nunca `flex:1` — higiene A3 del handoff (ver docstring del módulo): es la forma
  // que el spike de 60 fps / 0% jank validó, y la que usa `PanelDeslizable`.
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cristal: { flex: 1 },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
