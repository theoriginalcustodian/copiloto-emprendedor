import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { leerPerfilNegocio } from '@copiloto/core';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { Chevron } from './Chevron';

/**
 * Las entradas de Ajustes. Nació como port 1:1 del rediseño de vidrio de documed y creció a 8; el
 * 2026-07-22 volvió a 6 sacando andamiajes y fusionando los pares que se pisaban; el 2026-10-06 (DEC-8)
 * salió «Mi plan» y quedaron 5 -- ver `FILAS_AJUSTES` para el detalle de qué se fue a dónde.
 */
export type AjusteKey =
  | 'perfilNegocio'
  | 'facturacionAfip'
  | 'apps'
  | 'cuenta'
  | 'apariencia'
  | 'comoUsar'
  | 'soporte'
  | 'feedback';

interface DefinicionFilaAjuste {
  key: AjusteKey;
  label: string;
  /** La segunda línea de la fila. SALE DEL MAPA (`index.html` §ajustes, `.aj-fila .t > span`), no se inventa:
   * el test la lee de la fuente y la compara. */
  subtitulo: string;
  icono: NombreIconoGlass;
}

/**
 * Las 8 filas de Ajustes, en orden de cuándo se necesitan.
 *
 * 🔴 SM-Z5 (decidido por el operador, 2026-11-03): Ajustes pasa de GRILLA de íconos (tiles de 3 columnas)
 * a LISTA de filas, como el mapa: ícono chico, título, subtítulo y chevron, agrupadas en una tarjeta por
 * rótulo. Lo que NO se tiró con la forma:
 *
 * 🔴 **Quedó en 6 el 2026-07-22, y lo que se sacó importa más que lo que quedó.** De los 8 anteriores,
 * **tres eran `PantallaAndamiaje`** —el placeholder vacío— y había **dos pares que se pisaban**:
 * *Datos personales* vs *Cuenta*, y *Planes disponibles* vs *Plan actual*. Dos filas para un solo
 * concepto es exactamente lo que confunde a alguien que entró a configurar algo: no sabe cuál de los
 * dos es el que busca, y entra a los dos.
 *
 * - *Datos personales* → **absorbido por «Mi cuenta»**.
 * - *Planes disponibles* + *Plan actual* → **fusionados en «Mi plan»**, que salió después (DEC-8 / SM-N42).
 * - *Configuración del sistema* → su única fila (el lugar reservado de «No molestar») **se mudó a
 *   «Mi cuenta»**; no justificaba una entrada propia.
 * - *Skins* → **«Apariencia»**, en castellano como el resto de la app.
 * - **«Apps conectadas» llega del escritorio**: no es una función del negocio, es configuración de
 *   conexiones que se tocan una vez.
 * - **«Cómo hablarle» (la 3ª fila de «La app» del mapa) NO existe en la app, a propósito**: la pantalla
 *   se fundió en «Cómo usar la app» y el tono y la forma de responder viven en «Mi negocio». Es una
 *   enmienda fundada, no un olvido; el test la nombra (`ENMIENDAS_DEL_MAPA`) para que una fila NUEVA
 *   del mapa sí rompa y esta no.
 *
 * 🔴 Ningún ícono se repite ENTRE FILAS -- entrar por un ícono y llegar a otra pantalla desorienta.
 * Cada fila usa el ícono de función que lleva su MISMO nombre en el set de 21 (`icons.ts`). La MUESTRA de
 * color real sigue viviendo en la pantalla de destino (`PantallaSkins.tsx`); acá sólo cambia el glifo.
 */
const FILAS_AJUSTES: readonly DefinicionFilaAjuste[] = [
  // Primero: es lo que hay que completar el día 1. `miNegocio` porque la mitad de esa pantalla es
  // literalmente cómo conversa el copiloto.
  { key: 'perfilNegocio', label: 'Mi negocio', subtitulo: 'Qué vendés, a quién y tu horario', icono: 'miNegocio' },
  // Perfil fiscal + vínculo con ARCA + ambiente. `perfilFiscal` (escudo con check) separa la función
  // (Facturación, en el escritorio) de su configuración (esta pantalla).
  { key: 'facturacionAfip', label: 'Facturación ARCA', subtitulo: 'CUIT, condición y punto de venta', icono: 'perfilFiscal' },
  { key: 'apps', label: 'Apps conectadas', subtitulo: 'Gmail, Drive, Calendar, Mercado Pago', icono: 'appsConectadas' },
  { key: 'cuenta', label: 'Mi cuenta', subtitulo: 'Mail, contraseña y cerrar sesión', icono: 'cuenta' },
  // `apariencia` es un semicírculo claro/oscuro, dibujado para esto.
  { key: 'apariencia', label: 'Apariencia', subtitulo: 'Claro u oscuro', icono: 'apariencia' },
  /**
   * ── AYUDA (Ola 5) ────────────────────────────────────────────────────────
   * Las tres del prototipo, que hasta el 2026-09-18 vivían **escondidas adentro de Mi cuenta** como
   * filas sueltas. Ahí no las encontraba nadie: para pedir ayuda había que entrar a la pantalla de
   * la cuenta, que es donde uno va a cambiar el mail.
   *
   * **`comoHablarle` es el ÍCONO, no la pantalla.** El glifo (burbuja con ecualizador) sigue siendo
   * el de "guía de uso": el set lo separa del de grabar (cápsula de micrófono).
   */
  { key: 'comoUsar', label: 'Cómo usar la app', subtitulo: 'Te lo muestro paso a paso, con ejemplos', icono: 'comoHablarle' },
  { key: 'soporte', label: 'Soporte técnico', subtitulo: 'Contanos el problema y abrimos un ticket', icono: 'soporte' },
  { key: 'feedback', label: 'Contanos qué tal', subtitulo: 'Sugerencias y cosas que no funcionan', icono: 'feedback' },
];

/**
 * Los tres grupos del mapa (`index.html` §ajustes): «Tu negocio» / «La app» / «Ayuda». Cada grupo es una
 * tarjeta con su rótulo (el mapa lo dibuja en mayúsculas por CSS: acá `textTransform`, el texto queda como
 * en la fuente). «Mi plan» —4º de «Tu negocio» en versiones viejas del mapa— salió de la beta (DEC-8).
 *
 * Del encabezado «El Galpón · Martín Cairo» se muestra el nombre comercial (`perfilNegocio`, SM-N9); el
 * nombre de la PERSONA no, porque `/me` no lo trae: no se fabrica.
 */
const GRUPOS_AJUSTES: readonly { id: string; rotulo: string; keys: readonly AjusteKey[] }[] = [
  { id: 'negocio', rotulo: 'Tu negocio', keys: ['perfilNegocio', 'facturacionAfip', 'apps'] },
  { id: 'app', rotulo: 'La app', keys: ['cuenta', 'apariencia'] },
  { id: 'ayuda', rotulo: 'Ayuda', keys: ['comoUsar', 'soporte', 'feedback'] },
];

const FILAS_POR_GRUPO = GRUPOS_AJUSTES.map((g) => ({
  ...g,
  filas: FILAS_AJUSTES.filter((f) => g.keys.includes(f.key)),
}));

export interface PantallaAjustesProps {
  /** Un handler único para las entradas de la lista -- la fila tocada se identifica por `key`; el
   * `router.push` real vive en la ruta que monta esta pantalla, no acá. */
  onAjuste?: (key: AjusteKey) => void;
}

/**
 * El nombre comercial para el encabezado (SM-N9). Es una lectura aparte (`perfilNegocio`), pero el dato
 * EXISTE: el motivo para no pintarlo era de costo, no de imposibilidad. Sin nombre cargado
 * (`nombreComercial === ''`, el emprendedor nuevo), ausente o con la lectura caída devuelve `undefined`:
 * `MarcoGlass` no dibuja la etiqueta y el encabezado queda como antes, sin hueco ni texto de relleno.
 */
function useNombreComercial(): string | undefined {
  const [nombre, setNombre] = useState<string | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void leerPerfilNegocio()
      .then((res) => {
        if (!vivo || res.status !== 'ok' || !res.perfil) return;
        const n = res.perfil.nombreComercial.trim();
        if (n !== '') setNombre(n);
      })
      .catch(() => {
        // Secundario: un error de red no pinta cartel; el encabezado queda sin etiqueta.
      });
    return () => {
      vivo = false;
    };
  }, []);
  return nombre;
}

/** `.aj-fila .ic{width:38px;height:38px}` y el svg de 18-21 px adentro (`index.html:1512`, 2115-2131). */
const LADO_ICONO = 38;
const TAMANO_ICONO = 22;

/**
 * Pantalla Ajustes -- lista de filas agrupadas por rótulo. Esta pantalla sólo cablea la navegación
 * (identifica QUÉ fila se tocó), nunca decide a dónde va cada una.
 */
export function PantallaAjustes({ onAjuste }: PantallaAjustesProps) {
  const tema = useTema();
  const nombreComercial = useNombreComercial();
  const g = tema.glass;

  return (
    <MarcoGlass titulo="Ajustes" icono="ajustes" etiqueta={nombreComercial} testID="pantalla-ajustes">
      {/* `flex:1` en el ScrollView MISMO (ver PantallaApps): con los rótulos de grupo la pantalla ya no
          entra en un teléfono chico y sin scroll lo que sobra se recorta sin aviso. */}
      <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: tema.espacio.md }}>
        <Text testID="ajustes-intro" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, marginBottom: tema.espacio.sm }}>
          Los datos de tu negocio, tus apps y cómo se comporta Odobi.
        </Text>
        <View style={styles.lista}>
          {FILAS_POR_GRUPO.map((grupo) => (
            <View key={grupo.id} style={styles.grupo}>
              <Text
                testID={`ajustes-grupo-${grupo.id}`}
                // `.lista-lbl{font-size:11px;letter-spacing:.14em;text-transform:uppercase}` (`index.html:448`).
                style={{
                  color: tema.color.textoTenue,
                  fontSize: 11,
                  letterSpacing: 0.14 * 11,
                  textTransform: 'uppercase',
                  fontFamily: tema.fuente.uiSemibold,
                }}
              >
                {grupo.rotulo}
              </Text>
              <View style={[styles.tarjeta, { backgroundColor: g.s1, borderColor: g.chip }]}>
                {grupo.filas.map((f, i) => (
                  <Pressable
                    key={f.key}
                    testID={`ajuste-tile-${f.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={f.label}
                    accessibilityHint={f.subtitulo}
                    onPress={() => onAjuste?.(f.key)}
                    // `.aj-fila + .aj-fila{border-top}` (`index.html:1511`): la línea separa, no enmarca.
                    style={pressableStyle(
                      [styles.fila, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: g.chip }],
                      PRESS_FADE,
                    )}
                  >
                    <View style={[styles.icono, { backgroundColor: g.chip }]}>
                      <GlassIcon name={f.icono} size={TAMANO_ICONO} />
                    </View>
                    <View style={styles.textos}>
                      <Text numberOfLines={1} style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>
                        {f.label}
                      </Text>
                      <Text numberOfLines={2} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: 2 }}>
                        {f.subtitulo}
                      </Text>
                    </View>
                    <Chevron />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  lista: { gap: 16 },
  grupo: { gap: 8 },
  // `.grupo{border-radius;padding:4px var(--s2)}` (`index.html:949`): una tarjeta por rótulo.
  tarjeta: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
  // `.aj-fila{gap:12px;padding:13px 0;min-height:64px}` (`index.html:1510`).
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, minHeight: 64 },
  icono: { width: LADO_ICONO, height: LADO_ICONO, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0 },
});
