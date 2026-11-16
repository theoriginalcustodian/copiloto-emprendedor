import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';


import { cambiarModoDemo, demoActivo, HAY_MODO_DEMO } from '../../demo/modoDemo';
import { elevacion } from '../../theme/BloqueCifra';
import { conAlfa } from '../../theme/glass/conAlfa';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { Chevron } from './Chevron';
import { useNombreComercial } from './negocio/useNombreComercial';

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

/** `.aj-fila .ic{width:38px;height:38px}` y el svg de 18-21 px adentro (`index.html:1512`, 2115-2131). */
const LADO_ICONO = 38;
const TAMANO_ICONO = 22;

/**
 * Pantalla Ajustes -- lista de filas agrupadas por rótulo. Esta pantalla sólo cablea la navegación
 * (identifica QUÉ fila se tocó), nunca decide a dónde va cada una.
 */
/**
 * ⚠️ MODO DEMO — sólo en desarrollo, SACAR ANTES DEL PR (ver `demo/modoDemo.ts`). Prende y apaga los datos de
 * ejemplo; cambiarlo recarga la app.
 */
function InterruptorDemo() {
  const tema = useTema();
  const [activo, setActivo] = useState<boolean | null>(null);
  useEffect(() => {
    void demoActivo().then(setActivo);
  }, []);
  return (
    <View style={styles.grupo}>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium, paddingHorizontal: 4 }}>
        Sólo en desarrollo
      </Text>
      <View style={[styles.demo, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
        <View style={styles.textos}>
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiMedium }}>Datos de ejemplo</Text>
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
            Un electricista con Mercado Pago y Google conectados. No toca tu cuenta ni guarda nada.
          </Text>
        </View>
        <Switch
          testID="ajustes-modo-demo"
          value={activo === true}
          disabled={activo == null}
          onValueChange={(v) => {
            setActivo(v);
            void cambiarModoDemo(v);
          }}
          trackColor={{ true: tema.color.acento }}
        />
      </View>
    </View>
  );
}

export function PantallaAjustes({ onAjuste }: PantallaAjustesProps) {
  const tema = useTema();
  const nombreComercial = useNombreComercial();
  // `g.chip` casi no se veía como separador: la línea sale de la tinta, al 10 %.
  const linea = conAlfa(tema.color.texto, 0.1);

  return (
    <MarcoGlass titulo="Ajustes" icono="ajustes" sinIcono etiqueta={nombreComercial} testID="pantalla-ajustes">
      {/* `flex:1` en el ScrollView MISMO (ver PantallaApps): con los rótulos de grupo la pantalla ya no
          entra en un teléfono chico y sin scroll lo que sobra se recorta sin aviso. */}
      <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: tema.espacio.md, paddingBottom: tema.espacio.xl + tema.espacio.md }}>
        <Text testID="ajustes-intro" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22, paddingHorizontal: 4, marginBottom: tema.espacio.lg }}>
          Los datos de tu negocio, tus apps y cómo se comporta Odobi.
        </Text>
        <View style={styles.lista}>
          {FILAS_POR_GRUPO.map((grupo) => (
            <View key={grupo.id} style={styles.grupo}>
              <Text
                testID={`ajustes-grupo-${grupo.id}`}
                accessibilityRole="header"
                // Rediseño (Martin 15/11): rótulo en display, como en las demás pantallas (antes caja alta de 11 px).
                style={{ color: tema.color.texto, fontSize: tema.tipo.grande, fontFamily: tema.fuente.display, paddingHorizontal: 4 }}
              >
                {grupo.rotulo}
              </Text>
              {/* Martin 14/11: la misma tarjeta que el resto de la app —blanca, sin borde, con la elevación suave—
                  en vez del vidrio con borde. El ícono va en su tile arena (`CLAUDE.md` §4) y la línea entre filas
                  arranca donde arranca el texto: así separa los renglones sin cortar la columna de íconos. */}
              <View style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
                {grupo.filas.map((f, i) => (
                  <Pressable
                    key={f.key}
                    testID={`ajuste-tile-${f.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={f.label}
                    accessibilityHint={f.subtitulo}
                    onPress={() => onAjuste?.(f.key)}
                    style={pressableStyle(styles.fila, PRESS_FADE)}
                  >
                    <View style={[styles.icono, { backgroundColor: tema.color.tileFuncion.arena }]}>
                      <GlassIcon name={f.icono} size={TAMANO_ICONO} color={tema.color.tileFuncion.tinta} />
                    </View>
                    <View style={[styles.cuerpoFila, i > 0 && { borderTopWidth: 1, borderTopColor: linea }]}>
                      <View style={styles.textos}>
                        <Text numberOfLines={1} style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiMedium }}>
                          {f.label}
                        </Text>
                        <Text numberOfLines={2} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
                          {f.subtitulo}
                        </Text>
                      </View>
                      <Chevron />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {HAY_MODO_DEMO && <InterruptorDemo />}
        </View>
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  // 28 entre grupos y 10 entre rótulo y tarjeta: el rótulo tiene que leerse pegado a SU tarjeta, no flotando
  // a mitad de camino entre dos (antes 16 y 8 — casi lo mismo, y no se sabía a cuál pertenecía).
  lista: { gap: 28 },
  grupo: { gap: 10 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16 },
  tarjeta: { borderRadius: 22, paddingLeft: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icono: { width: LADO_ICONO, height: LADO_ICONO, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cuerpoFila: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 14,
    paddingRight: 16,
  },
  textos: { flex: 1, minWidth: 0, gap: 3 },
});
