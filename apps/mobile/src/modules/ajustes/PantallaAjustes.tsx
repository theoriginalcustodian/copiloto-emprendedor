import { StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Las entradas de Ajustes. Nació como port 1:1 del rediseño de vidrio de documed y creció a 8; el
 * 2026-07-22 volvió a 6 sacando andamiajes y fusionando los pares que se pisaban -- ver
 * `TILES_AJUSTES` para el detalle de qué se fue a dónde.
 */
export type AjusteKey =
  | 'perfilNegocio'
  | 'facturacionAfip'
  | 'apps'
  | 'miPlan'
  | 'cuenta'
  | 'apariencia'
  | 'comoHablarle';

interface DefinicionTileAjuste {
  key: AjusteKey;
  label: string;
  icono: NombreIconoGlass;
}

/**
 * Los 6 tiles de Ajustes, en orden de cuándo se necesitan.
 *
 * 🔴 **Quedó en 6 el 2026-07-22, y lo que se sacó importa más que lo que quedó.** De los 8 anteriores,
 * **tres eran `PantallaAndamiaje`** —el placeholder vacío— y había **dos pares que se pisaban**:
 * *Datos personales* vs *Cuenta*, y *Planes disponibles* vs *Plan actual*. Dos tiles para un solo
 * concepto es exactamente lo que confunde a alguien que entró a configurar algo: no sabe cuál de los
 * dos es el que busca, y entra a los dos.
 *
 * - *Datos personales* → **absorbido por «Mi cuenta»**.
 * - *Planes disponibles* + *Plan actual* → **fusionados en «Mi plan»** (una sola ruta de andamiaje).
 * - *Configuración del sistema* → su única fila (el lugar reservado de «No molestar») **se mudó a
 *   «Mi cuenta»**; no justificaba un tile propio.
 * - *Skins* → **«Apariencia»**, en castellano como el resto de la app.
 * - **«Apps conectadas» llega del escritorio**: no es una función del negocio, es configuración de
 *   conexiones que se tocan una vez. La pantalla no se reescribió — sólo cambió desde dónde se llega.
 *
 * 🔴 Ningún ícono se repite DENTRO de este grid -- elegir mal acá es entrar a la pantalla equivocada.
 * Desde ODOBI hito 5 cada tile usa el ícono de función que lleva su MISMO nombre en el set de 21
 * (`icons.ts`) -- Apariencia ya tiene un glifo propio (semicírculo claro/oscuro) y Facturación AFIP
 * dejó de compartir ícono con el tile de Facturación del escritorio (ver abajo). La MUESTRA de color
 * real sigue viviendo en la pantalla de destino (`PantallaSkins.tsx`); acá sólo cambia el glifo.
 */
const TILES_AJUSTES: readonly DefinicionTileAjuste[] = [
  // Primero: es lo que hay que completar el día 1. `miNegocio` porque la mitad de esa pantalla es
  // literalmente cómo conversa el copiloto.
  { key: 'perfilNegocio', label: 'Mi negocio', icono: 'miNegocio' },
  // Perfil fiscal + vínculo con ARCA + ambiente. Antes compartía ícono con el tile de Facturación del
  // escritorio (`doc_search`, catálogo viejo de 11 nombres, sin uno propio para "trámite/alta ante
  // ARCA"). El set de 21 SÍ tiene uno distinto (`perfilFiscal`, escudo con check) -- usarlo separa la
  // función (Facturación) de su configuración (esta pantalla), que es más preciso que compartir.
  { key: 'facturacionAfip', label: 'Facturación AFIP', icono: 'perfilFiscal' },
  // Antes `folder` (la carpeta que agrupa), heredado del escritorio. `appsConectadas` es el nombre
  // propio del set de 21 para este mismo concepto -- la pantalla es la misma, sólo cambió el glifo.
  { key: 'apps', label: 'Apps conectadas', icono: 'appsConectadas' },
  { key: 'miPlan', label: 'Mi plan', icono: 'miPlan' },
  { key: 'cuenta', label: 'Mi cuenta', icono: 'cuenta' },
  // Antes `media` (ojo/preview) -- el catálogo viejo no tenía ningún glifo que significara
  // literalmente "paleta de colores". El set de 21 sí: `apariencia` es un semicírculo claro/oscuro,
  // dibujado para esto.
  { key: 'apariencia', label: 'Apariencia', icono: 'apariencia' },
  /**
   * 🆕 2026-07-22 · La guía de uso: qué se le puede pedir al copiloto.
   *
   * **`comoHablarle` y no `grabar`**: el set de 21 separa el glifo de "guía de uso" (burbuja con
   * ecualizador) del de "grabar/mantené para hablar" (cápsula de micrófono) -- acá corresponde el
   * primero, porque esta pantalla es la guía, no la acción de grabar.
   *
   * Va **última** por la misma regla de orden que el escritorio: se entra una vez, al principio. Y va
   * en Ajustes —no como tile del escritorio— porque no es un verbo diario: ponerla arriba empujaría
   * fuera de pantalla algo que se usa todos los días.
   */
  { key: 'comoHablarle', label: 'Cómo hablarle', icono: 'comoHablarle' },
];

/** Cuántos tiles entran por fila. 3 en un ancho de teléfono deja la etiqueta legible sin recortar. */
const COLUMNAS = 3;

/**
 * Agrupa los tiles en filas de `COLUMNAS`.
 *
 * 🔴 **Reemplaza a dos `slice` hardcodeados** (`slice(0,3)` / `slice(3,6)`), que asumían exactamente 6
 * tiles: al sumar el séptimo (Facturación AFIP) el tile nuevo quedaba fuera de las dos filas y no se
 * renderizaba — un ícono que desaparece en silencio, sin error, sólo porque el array creció. Con esto,
 * agregar el octavo es agregar una línea a `TILES_AJUSTES` y nada más.
 *
 * La última fila se completa con `null` (ver `rellenar`): sin relleno, una fila de 1 tile con `flex:1`
 * lo estira a todo el ancho y la grilla se ve rota.
 */
function agruparEnFilas(
  tiles: readonly DefinicionTileAjuste[],
): readonly (readonly (DefinicionTileAjuste | null)[])[] {
  const filas: (DefinicionTileAjuste | null)[][] = [];
  for (let i = 0; i < tiles.length; i += COLUMNAS) {
    const fila: (DefinicionTileAjuste | null)[] = tiles.slice(i, i + COLUMNAS);
    while (fila.length < COLUMNAS) fila.push(null); // huecos invisibles, para que no se estiren
    filas.push(fila);
  }
  return filas;
}

const FILAS_TILES_AJUSTES = agruparEnFilas(TILES_AJUSTES);

export interface PantallaAjustesProps {
  /** Un handler único para las entradas del grid -- el tile tocado se identifica por `key`; el
   * `router.push` real vive en la ruta que monta esta pantalla, no acá. */
  onAjuste?: (key: AjusteKey) => void;
}

/**
 * Pantalla Ajustes -- grilla de iconos con las 6 entradas. La única sin fuente de datos real todavía
 * es "Mi plan", que se resuelve con `PantallaAndamiaje` y lo dice en pantalla. Esta pantalla sólo
 * cablea la navegación (identifica QUÉ tile se tocó), nunca decide a dónde va cada una.
 */
export function PantallaAjustes({ onAjuste }: PantallaAjustesProps) {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Ajustes" icono="ajustes" testID="pantalla-ajustes">
      <View style={[styles.contenedor, { padding: tema.espacio.md }]}>
        <View style={styles.grid}>
          {FILAS_TILES_AJUSTES.map((fila, iFila) => (
            <View key={iFila} style={styles.filaGrid}>
              {fila.map((t, iCol) =>
                // Hueco de relleno de la última fila: ocupa la columna para que los tiles reales
                // conserven su ancho, pero no dibuja nada ni recibe toques.
                t === null ? (
                  <View key={`hueco-${iCol}`} style={styles.tile} pointerEvents="none" />
                ) : (
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
                ),
              )}
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
