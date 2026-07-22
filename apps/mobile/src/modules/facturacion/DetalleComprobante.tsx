/**
 * `DetalleComprobante` — el glass chico que se abre al tocar una card de "Mis comprobantes".
 *
 * 🔴 **Es un overlay LOCAL, no una ruta.** Podría haber sido un `transparentModal` como las funciones
 * del escritorio, y sería un error: el bug más caro de esta cáscara fue exactamente eso —dos glass
 * apilados dejaban la app muerta al toque (ver `navegacion/empujarUnaVez.ts`)—. Y acá ya estamos
 * DENTRO de una función; el detalle de una fila no es un destino, es un acercamiento a algo que ya
 * está en pantalla. Un overlay no toca el stack de navegación, así que no puede apilarse con nada.
 *
 * 🔴 **No pide datos FISCALES.** Todo lo del comprobante —número, CAE, total, receptor, estado— sale
 * de la fila que `GET /afip/comprobantes` ya trajo (confirmado con la sesión de backend: no hace falta
 * endpoint nuevo). El tap abre con datos que ya están en memoria: sin spinner, sin error de red en el
 * medio.
 *
 * ⚠️ **La excepción es el COBRO, y está acotada a propósito** (`SeccionCobro`, 2026-07-22). Un
 * comprobante fiscal es inmutable: una vez emitido, esos campos no cambian nunca, y por eso la copia
 * en memoria no puede envejecer. El cobro es lo contrario — es lo ÚNICO de esta ficha que cambia
 * después de emitida, y puede cambiar desde otro dispositivo o desde el chat. Ese dato sí se pregunta,
 * y sólo ese: la regla de arriba no se aflojó, se le encontró el borde.
 *
 * `nivel="informe"` y no `"conversacion"`: es el nivel que existe para las hojas que flotan DENTRO de
 * otro vidrio, y su opacidad (0.48) repone el velo que ocluye lo de atrás — con un nivel más
 * transparente, la lista de comprobantes se leería A TRAVÉS del detalle. El vidrio nunca se define
 * acá: sale entero de `CristalVidrio`.
 *
 * El fondo que captura el toque de afuera se pinta con `color.superficieAlta` — un token del tema,
 * no un scrim inventado (la app no tiene token de scrim y un hex propio violaría la regla cero-hex).
 */
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import type { Comprobante } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { FilaBotones } from '../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { nombreTipoComprobante } from './etiquetasComprobante';
import { SeccionCobro } from './SeccionCobro';

/**
 * Tipo 13 = nota de crédito. **No es una deuda de nadie**: es el papel que anula otra factura, así que
 * la sección de cobro no se ofrece sobre ella. Mismo criterio que el backend, que las deja afuera de
 * «me deben» — si entraran, la pantalla mostraría plata que nadie va a pagar nunca.
 */
const TIPO_NOTA_CREDITO = 13;

const ETIQUETA_DOC: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor final',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  emitida: 'Emitida',
  anulada: 'Anulada',
  nota_credito: 'Nota de crédito',
};

// El mapeo vive en `etiquetasComprobante.ts`: tenerlo acá adentro fue lo que hizo que la LISTA
// imprimiera el código crudo de la AFIP — no estaba a mano para reusar.
const nombreTipo = nombreTipoComprobante;

/** `0006-00000015` — el formato con el que AFIP identifica un comprobante. */
export function numeroFormateado(puntoVenta: number, nro: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(nro).padStart(8, '0')}`;
}

export interface DetalleComprobanteProps {
  comprobante: Comprobante;
  onCerrar: () => void;
  /** Se registró o se deshizo un cobro acá adentro. La pantalla lo usa para refrescar «Te deben», que
   *  vive en otra sección y no tiene forma de enterarse sola. */
  onCobroCambiado?: () => void;
  testID?: string;
}

function Dato({
  etiqueta,
  valor,
  testID,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  testID?: string;
  destacado?: boolean;
}) {
  const tema = useTema();
  return (
    <View style={styles.dato}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <Text
        testID={testID}
        style={{
          color: destacado ? tema.color.acento : tema.color.texto,
          fontFamily: destacado ? tema.fuente.uiBold : tema.fuente.ui,
          fontSize: destacado ? tema.tipo.grande : tema.tipo.base,
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

export function DetalleComprobante({
  comprobante: c,
  onCerrar,
  onCobroCambiado,
  testID = 'detalle-comprobante',
}: DetalleComprobanteProps) {
  const tema = useTema();

  /**
   * 🔴 **El orden importa y no es estético.** `driveLink` primero porque NO vence; `pdfUrl` es de
   * AfipSDK y muere a las 24 h. Ofrecer el que expira teniendo uno permanente sería darle al usuario
   * el peor de los dos links sin decírselo.
   *
   * Y es `webContentLink` (descarga el archivo), no `webViewLink` (abre el visor de Drive y deja al
   * usuario en una página en vez de con su PDF). El backend manda el correcto — no sustituirlo.
   */
  const link = c.driveLink ?? c.pdfUrl;
  const enDrive = c.driveLink != null;

  async function guardar() {
    if (link) await Linking.openURL(link);
  }

  async function compartir() {
    if (link) await Share.share({ message: link, url: link });
  }

  return (
    // El scrim cierra al tocar afuera — el gesto que cualquiera prueba primero con una hoja encima.
    <Pressable
      testID={`${testID}-scrim`}
      onPress={onCerrar}
      style={[styles.scrim, { backgroundColor: tema.color.superficieAlta }]}
    >
      {/* `onPress` vacío: sin esto, un toque DENTRO del panel burbujea al scrim y cierra la hoja
          justo cuando el usuario está leyéndola. */}
      <Pressable testID={testID} onPress={() => {}} style={styles.contenedorPanel}>
        {/* 🔴 El vidrio va DETRÁS con `absoluteFill`, no envolviendo al contenido.
            `CristalVidrio` tiene `flex: 1` en su capa interna, y `flex: 1` implica `flexBasis: 0`:
            dentro de un padre de altura automática arranca en cero y no tiene espacio libre del que
            crecer, así que **colapsa a una línea de 1px** — literalmente lo que se vio en device
            (2026-07-21): el overlay ocupaba la pantalla y del panel sólo quedaba su borde superior.
            Ese primitivo está hecho para LLENAR un contenedor con altura (así lo usan `MarcoGlass` y
            `PanelDeslizable`), no para envolver contenido que define la suya. Poniéndolo de fondo,
            el contenido manda la altura y el vidrio se estira detrás. */}
        <CristalVidrio nivel="informe" style={styles.panel} />
        <View style={{ padding: tema.espacio.lg, gap: tema.espacio.md }}>
            <View style={styles.encabezado}>
              <Text
                testID={`${testID}-titulo`}
                style={{ color: tema.color.texto, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.titulo }}
              >
                {nombreTipo(c.tipoCbte)}
              </Text>
              <Pressable
                testID={`${testID}-cerrar`}
                onPress={onCerrar}
                hitSlop={12}
                style={pressableStyle(undefined, PRESS_FADE)}
              >
                <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Cerrar</Text>
              </Pressable>
            </View>

            <Dato
              etiqueta="Número"
              valor={numeroFormateado(c.puntoVenta, c.nro)}
              testID={`${testID}-numero`}
            />
            <Dato etiqueta="CAE" valor={c.cae} destacado testID={`${testID}-cae`} />
            {c.caeVto != null && <Dato etiqueta="Vence el" valor={c.caeVto} />}
            {c.fechaEmision != null && <Dato etiqueta="Emitida el" valor={c.fechaEmision} />}
            <Dato etiqueta="Total" valor={c.total} testID={`${testID}-total`} />

            {/* 🔴 Los comprobantes anteriores al 2026-07-21 no tienen receptor: el dato no existía
                todavía. No es un error ni un vacío que haya que explicar — simplemente no se dibuja
                la fila. Inventar un "Sin datos" pondría el foco en una carencia nuestra. */}
            {c.receptorNombre != null && c.receptorNombre !== '' && (
              <Dato etiqueta="Cliente" valor={c.receptorNombre} testID={`${testID}-receptor`} />
            )}
            {c.docTipo != null && (
              <Dato
                etiqueta="Documento"
                valor={
                  c.docNro != null && c.docNro !== ''
                    ? `${ETIQUETA_DOC[c.docTipo] ?? `Tipo ${c.docTipo}`} ${c.docNro}`
                    : (ETIQUETA_DOC[c.docTipo] ?? `Tipo ${c.docTipo}`)
                }
                testID={`${testID}-documento`}
              />
            )}

            <Dato
              etiqueta="Estado"
              valor={ETIQUETA_ESTADO[c.estado] ?? c.estado}
              testID={`${testID}-estado`}
            />
            {/* 🔴 Sólo sobre una factura EMITIDA. Una anulada o una nota de crédito no son plata que
                alguien deba: ofrecer «ya me la pagaron» ahí contradice al propio documento que la
                ficha está mostrando dos líneas más arriba. */}
            {/* `id` es opcional en el tipo porque el payload que alimenta activities de Temporal no lo
                trae; las dos consultas que llegan a la app SÍ. Sin id no hay a qué preguntarle por el
                cobro, así que la sección no se dibuja — inventar una consulta a `/undefined/cobros`
                daría un 404 y la ficha diría "no pudimos consultar" sobre algo que ni se intentó. */}
            {c.id != null && (
              <SeccionCobro
                comprobanteId={c.id}
                cobrable={c.estado === 'emitida' && c.tipoCbte !== TIPO_NOTA_CREDITO}
                onCambio={onCobroCambiado}
                testID={`${testID}-cobro`}
              />
            )}

            {c.cbteAsocNro != null && (
              <Text testID={`${testID}-anulada-por`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                Anulada por la nota de crédito N° {c.cbteAsocNro}.
              </Text>
            )}

            {/* El aviso cuelga del HECHO de estar en Drive, no del ajuste: con el ajuste prendido y
                el archivado fallado, el usuario creería que su copia está a salvo. Ver `ArchivoDrive`. */}
            <Text
              testID={`${testID}-aviso-copia`}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            >
              {enDrive
                ? 'Guardada en tu Drive. Ese link no vence.'
                : 'El PDF de AFIP está disponible por 24 horas desde la emisión. Después vas a poder descargarlo desde el portal de AFIP con el CAE.'}
            </Text>

            {link != null && (
              <FilaBotones
                testID={`${testID}-botones`}
                botones={[
                  { etiqueta: 'Guardar', onPress: guardar, variante: 'primario', testID: `${testID}-guardar` },
                  { etiqueta: 'Compartir', onPress: compartir, variante: 'secundario', testID: `${testID}-compartir` },
                ]}
              />
            )}
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  contenedorPanel: { width: '100%', maxWidth: 460 },
  // El vidrio se estira detrás del contenido; el radio y el recorte los pone el primitivo.
  panel: { ...StyleSheet.absoluteFill },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dato: { gap: 2 },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});
