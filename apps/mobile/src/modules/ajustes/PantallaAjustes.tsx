import { StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Las 6 entradas de Ajustes -- port 1:1 del rediseño de vidrio (staging `documed/apps/mobile/src/
 * modules/ajustes/PantallaAjustes.tsx`, pedido del operador 2026-07-19: *"hay que incluir iconos
 * también de datos personales, configuración del sistema, planes disponibles y plan actual... también
 * mover los skins a un icono nuevo"*). El set de 6 ya era genérico en el origen (nada clínico) y no
 * necesitó vocabulario a adaptar.
 */
export type AjusteKey =
  | 'datosPersonales'
  | 'configuracionSistema'
  | 'planesDisponibles'
  | 'planActual'
  | 'skins'
  | 'cuenta';

interface DefinicionTileAjuste {
  key: AjusteKey;
  label: string;
  icono: NombreIconoGlass;
}

/**
 * 🔴 Ningún ícono se repite DENTRO de este grid -- elegir mal acá es entrar a la pantalla equivocada.
 * El catálogo de glifos (`icons.ts`) tiene 10 nombres semánticos fijos y ninguno significa
 * literalmente "paleta de colores" -- para Skins se optó por `media` (ojo/preview) en vez de agregar
 * un ícono nuevo al catálogo compartido, que vive fuera del alcance de este módulo. La MUESTRA de
 * color real vive en la pantalla de destino (`PantallaSkins.tsx`), no en este tile.
 */
const TILES_AJUSTES: readonly DefinicionTileAjuste[] = [
  { key: 'datosPersonales', label: 'Datos personales', icono: 'note' },
  { key: 'configuracionSistema', label: 'Configuración del sistema', icono: 'settings' },
  { key: 'planesDisponibles', label: 'Planes disponibles', icono: 'folder' },
  { key: 'planActual', label: 'Plan actual', icono: 'chart' },
  { key: 'skins', label: 'Skins', icono: 'media' },
  { key: 'cuenta', label: 'Cuenta', icono: 'user' },
];

/** 2 filas de 3 -- número fijo de tiles, `flexDirection:'row'` + `flex:1` da columnas exactas sin
 * cálculo porcentual de `flexWrap`. */
const FILAS_TILES_AJUSTES: readonly (readonly DefinicionTileAjuste[])[] = [
  TILES_AJUSTES.slice(0, 3),
  TILES_AJUSTES.slice(3, 6),
];

export interface PantallaAjustesProps {
  /** Un handler único para las 6 entradas del grid -- el tile tocado se identifica por `key`; el
   * `router.push` real vive en la ruta que monta esta pantalla, no acá. */
  onAjuste?: (key: AjusteKey) => void;
}

/**
 * Pantalla Ajustes -- grilla de iconos con las 6 entradas. Los skins tienen su propia pantalla
 * (`PantallaSkins`, tile "Skins"); las 3 entradas sin fuente de datos real todavía (Datos personales,
 * Planes disponibles, Plan actual) se resuelven con `PantallaAndamiaje` -- esta pantalla sólo cablea
 * la navegación (identifica QUÉ tile se tocó), nunca decide a dónde va cada una.
 */
export function PantallaAjustes({ onAjuste }: PantallaAjustesProps) {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Ajustes" icono="settings" testID="pantalla-ajustes">
      <View style={[styles.contenedor, { padding: tema.espacio.md }]}>
        <View style={styles.grid}>
          {FILAS_TILES_AJUSTES.map((fila, iFila) => (
            <View key={iFila} style={styles.filaGrid}>
              {fila.map((t) => (
                <Tile
                  key={t.key}
                  testID={`ajuste-tile-${t.key}`}
                  accessibilityLabel={t.label}
                  onPress={() => onAjuste?.(t.key)}
                  style={styles.tile}
                >
                  <GlassIcon name={t.icono} size={46} />
                  {/* `numberOfLines={2}` acota el peor caso: una etiqueta más larga que las actuales
                      no puede volver a romper la grilla creciendo a 3 líneas — se recorta con "…",
                      que es visible y arreglable, en vez de desalinear todo en silencio. */}
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.labelTile,
                      { color: tema.color.texto, fontFamily: tema.fuente.uiSemibold },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Tile>
              ))}
            </View>
          ))}
        </View>
      </View>
    </MarcoGlass>
  );
}

/**
 * 🔴 **Alto reservado para la etiqueta.** Sin esto cada tile mide lo que mida su etiqueta:
 * "Configuración del sistema" envuelve a 2 líneas y "Skins" o "Cuenta" entran en 1, así que las cards
 * de una misma fila saldrían de alturas distintas. Se arregla en la CAUSA -- la etiqueta de altura
 * variable -- reservando siempre 2 líneas: todas las cards pasan a medir lo mismo SOLAS, y ese "lo
 * mismo" es exactamente el tamaño de la card más grande. Un `height` a mano en el `Tile` sería un
 * número mágico que además puede achicar las cards de 1 línea.
 */
const ALTO_LABEL = 30;

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  grid: { gap: 12 },
  filaGrid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  // `lineHeight` explícito para que 2 líneas entren exactas en `ALTO_LABEL` en vez de depender del
  // interlineado por defecto de cada plataforma.
  labelTile: { fontSize: 11.5, lineHeight: 14, height: ALTO_LABEL, textAlign: 'center' },
});
