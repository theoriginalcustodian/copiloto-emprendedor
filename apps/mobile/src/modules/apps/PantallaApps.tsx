import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
// 🔴 `ScrollView` de Gesture Handler, no de `react-native` — misma regla y misma razón que en
// `EscritorioFunciones.tsx` (ver su docstring). Acá pesa todavía más: esta lista vive DENTRO del
// `GestureDetector` de `MarcoGlass`, así que un `ScrollView` de RN compite por el mismo dedo con el
// Pan que cierra el vidrio; el operador lo reportó como *"el glass de apps no se puede deslizar
// hacia abajo"*.
import { ScrollView } from 'react-native-gesture-handler';

import { desconectarServicio, listarCatalogo, pedirLinkDeVinculacion, type ServicioCatalogo } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import type { NombreIconoGlass } from '../../theme/glass/icons';

/**
 * `PantallaApps` — las integraciones del copiloto, con su estado real y el botón para vincularlas.
 *
 * 🔴 **Era un catálogo de papel.** Hasta el 2026-07-21 esta pantalla tenía los ocho servicios
 * HARDCODEADOS y no conectaba ninguno: listaba lo que el copiloto sabe hacer sin ofrecer forma de
 * habilitarlo. Se descubrió buscando otra cosa — el backend recomendó al operador *"entrar a Apps y
 * conectar Drive"* y al ir a verificar que ese camino existiera, no existía. El endpoint sí estaba
 * (`GET /catalog`, `GET /composio/connect`), cableado y vivo desde hacía tiempo; lo que faltaba era
 * el consumidor.
 *
 * 🔴 **La lista sale del backend.** `build_catalog` la arma desde la policy real de toolkits, así que
 * un servicio nuevo del lado del servidor aparece acá solo. La lista local se veía idéntica mientras
 * coincidiera y habría mentido en silencio el día que divergiera — el ícono es lo único que queda
 * del lado del cliente, porque es presentación pura y el backend no manda íconos.
 *
 * 🔴 **Volver del navegador NO significa "conectado".** Vincular ocurre afuera de la app: se abre el
 * link, el usuario autoriza (o abandona, o falla), y la app no se entera de cuál de las tres pasó.
 * Por eso al volver del navegador se RE-CONSULTA el catálogo y se pinta lo que diga `conectado` —
 * nunca lo que se supone que el usuario hizo. Es el mismo error que la app ya pagó dos veces esta
 * semana: afirmar un hecho por haber iniciado la acción que lo produciría.
 */

/** Ícono por servicio — presentación pura del lado del cliente: el backend no manda íconos. Un
 *  servicio sin entrada acá cae en `plug` (fail-open a "aparece con un ícono genérico", nunca a
 *  "no se muestra": omitir un servicio real es peor que mostrarlo con el ícono equivocado). */
const ICONO_POR_SERVICIO: Record<string, NombreIconoGlass> = {
  gmail: 'note',
  googledrive: 'folder',
  googlesheets: 'chart',
  googledocs: 'doc_search',
  googlecalendar: 'clock',
  hubspot: 'user',
  instagram: 'media',
  mercadopago: 'chart',
};
const ICONO_POR_DEFECTO: NombreIconoGlass = 'folder';

type EstadoCatalogo = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * Qué pierde el usuario al desconectar, dicho con las capacidades REALES que declara el backend
 * (`capabilities` del catálogo) en vez de un "¿estás seguro?" que no informa nada.
 *
 * Un servicio sin capacidades declaradas cae en una frase genérica — nunca en una lista vacía que
 * insinúe que no se pierde nada.
 */
function loQueSePierde(s: ServicioCatalogo): string {
  if (s.capacidades.length === 0) {
    return `El copiloto va a dejar de poder usar ${s.nombre} hasta que lo vuelvas a conectar.`;
  }
  const lista = s.capacidades.map((c) => c.toLowerCase()).join(', ');
  return `El copiloto va a dejar de poder ${lista} hasta que vuelvas a conectar ${s.nombre}.`;
}

/**
 * 🔴 **Drive tiene una consecuencia que no está en sus `capabilities`: la facturación.** Si el
 * emprendedor tiene activado "guardar mis facturas en Drive", desconectarlo deja ese ajuste prendido
 * sobre una capacidad que ya no existe y las facturas dejan de archivarse.
 *
 * Se dice en CONDICIONAL ("si tenés activado…") a propósito: esta pantalla no conoce el perfil
 * fiscal, y afirmar que el ajuste está prendido sin haberlo leído sería inventar un dato — el error
 * que este repo viene cazando toda la semana. Consultarlo desde acá acoplaría Apps a Facturación por
 * una línea de copy; el aviso honesto cuesta menos y no miente.
 *
 * El estado REAL ya se dice donde sí se conoce: Ajustes → Copia en tu Drive lo pinta con
 * `drive_conectado`.
 */
const CONSECUENCIA_EXTRA: Record<string, string> = {
  googledrive:
    'Si tenés activado "guardar mis facturas en Drive", tus facturas nuevas van a dejar de archivarse ahí.',
  mercadopago: 'Vas a dejar de poder generar links de cobro desde el chat.',
};

export function PantallaApps() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoCatalogo>('cargando');
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  /** El servicio cuyo link se está pidiendo — para no dejar el botón mudo mientras viaja el request. */
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  const [errorVinculo, setErrorVinculo] = useState<string | null>(null);
  /** La `key` del servicio que el usuario pidió desconectar y todavía no confirmó. */
  const [objetivoBaja, setObjetivoBaja] = useState<string | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  /** `silencioso`: una RE-carga no manda la lista al spinner. Ver `SeccionMisComprobantes.cargar`. */
  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return listarCatalogo()
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          return;
        }
        setServicios(res.servicios);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * 🔴 **Re-consultar al volver del navegador — y por eso `AppState` y no `useFocusEffect`.** El
   * navegador es otra APP: esta pantalla nunca pierde el foco de navegación, así que `useFocusEffect`
   * no dispara al volver. Lo que sí cambia es el estado de la aplicación (`background` → `active`).
   *
   * Sin esto, el usuario autoriza Google, vuelve, y la pantalla le sigue diciendo "No conectada"
   * sobre una conexión que ya existe: exactamente el bug del listado de comprobantes que se arregló
   * esta misma tarde, con otra cara.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (siguiente) => {
      if (siguiente === 'active') void cargar(true);
    });
    return () => sub.remove();
  }, [cargar]);

  async function vincular(servicio: ServicioCatalogo) {
    setPidiendo(servicio.key);
    setErrorVinculo(null);
    try {
      const res = await pedirLinkDeVinculacion(servicio.connectPath);
      if (!vivo.current) return;
      if (res.status === 'no_disponible') {
        setErrorVinculo(`Vincular ${servicio.nombre} todavía no está disponible.`);
        return;
      }
      // TODO(deuda gestionada, 2026-07-21 · dueño: sesión frontend · pagar en el próximo build EAS):
      // migrar a `expo-web-browser` (`openAuthSessionAsync`), que devuelve el control a la app sola al
      // terminar el OAuth. Se usa `Linking` porque `expo-web-browser` es un módulo NATIVO y exige
      // rebuild del binario — el operador tiene uno instalado y rebuildear para esto lo dejaría sin app
      // a mitad de una prueba. El costo del atajo es acotado y está cubierto: el usuario vuelve a mano
      // y la re-consulta del `AppState` repinta el estado real.
      const puede = await Linking.canOpenURL(res.url);
      if (!puede) {
        if (vivo.current) setErrorVinculo('No pudimos abrir el navegador en este teléfono.');
        return;
      }
      await Linking.openURL(res.url);
    } catch {
      if (vivo.current) setErrorVinculo(`No pudimos pedir el link de ${servicio.nombre}. Probá de nuevo.`);
    } finally {
      if (vivo.current) setPidiendo(null);
    }
  }

  /**
   * 🔴 **Al terminar NO se pinta "desconectado": se re-consulta.** Que el `DELETE` devuelva ok dice
   * que el pedido se aceptó, no que la conexión ya no exista — y si el backend fallara a medias, la
   * pantalla estaría afirmando una baja que no ocurrió. Misma disciplina que en `Conectar`.
   */
  async function confirmarBaja(servicio: ServicioCatalogo) {
    setDesconectando(true);
    setErrorVinculo(null);
    try {
      const res = await desconectarServicio(servicio);
      if (!vivo.current) return;
      if (res.status === 'no_disponible') {
        setErrorVinculo(`Desconectar ${servicio.nombre} todavía no está disponible.`);
        return;
      }
      setObjetivoBaja(null);
      await cargar(true);
    } catch {
      if (vivo.current) setErrorVinculo(`No pudimos desconectar ${servicio.nombre}. Probá de nuevo.`);
    } finally {
      if (vivo.current) setDesconectando(false);
    }
  }

  return (
    // Mismo ícono que el tile de entrada en `EscritorioFunciones` ('folder') — ver docstring de
    // `MarcoGlass`: entrar por un ícono y llegar a otro desorienta.
    <MarcoGlass titulo="Apps" icono="folder" testID="pantalla-apps">
      <ScrollView
        // 🔴 `flex:1` en el ScrollView MISMO, no sólo en su contenedor. Un ScrollView sin flex se
        // mide por su CONTENIDO: aunque el padre esté acotado, el hijo se estira más allá y lo
        // que sobra se recorta (overflow:hidden del vidrio) sin poder desplazarse. Verificado en
        // device: la lista de integraciones quedaba cortada en MercadoPago y el gesto no hacía nada.
        style={styles.scroll}
        testID="apps-lista"
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="apps-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, marginBottom: tema.espacio.sm }}
        >
          Lo que el copiloto puede hacer por vos. Conectá las que uses y se lo pedís en el chat, en
          lenguaje natural.
        </Text>

        {estado === 'cargando' && <ActivityIndicator testID="apps-cargando" color={tema.color.acento} />}

        {estado === 'error' && (
          <Text testID="apps-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tus integraciones. Probá de nuevo.
          </Text>
        )}

        {estado === 'no_disponible' && (
          <Text testID="apps-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            Las integraciones todavía no están disponibles.
          </Text>
        )}

        {errorVinculo != null && (
          <Text testID="apps-error-vinculo" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
            {errorVinculo}
          </Text>
        )}

        {estado === 'ok' &&
          servicios.map((s) => (
            <Row key={s.key} testID={`app-${s.key}`}>
              <View style={{ gap: tema.espacio.sm }}>
                <View style={[styles.fila, { gap: tema.espacio.sm }]}>
                  <GlassIcon name={ICONO_POR_SERVICIO[s.key] ?? ICONO_POR_DEFECTO} size={24} />
                  <View style={styles.textos}>
                    <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                      {s.nombre}
                    </Text>
                    <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: 2 }}>
                      {s.descripcion}
                    </Text>
                  </View>
                </View>

                {s.conectado ? (
                  <View style={{ gap: tema.espacio.sm }}>
                    <Text
                      testID={`app-${s.key}-conectada`}
                      style={{ color: tema.color.exito, fontSize: tema.tipo.chico }}
                    >
                      Conectada
                    </Text>

                    {objetivoBaja !== s.key ? (
                      <FilaBotones
                        compacto
                        testID={`app-${s.key}-baja-botones`}
                        botones={[
                          {
                            etiqueta: 'Desconectar',
                            onPress: () => { setObjetivoBaja(s.key); setErrorVinculo(null); },
                            variante: 'peligro',
                            testID: `app-${s.key}-desconectar`,
                          },
                        ]}
                      />
                    ) : (
                      /* 🔴 La confirmación NOMBRA lo que se pierde, con las capacidades reales del
                         backend. Un "¿estás seguro?" pelado no le da al usuario con qué decidir —
                         mismo criterio que la anulación de comprobantes, que dice "esto emite una
                         nota de crédito" en vez de "¿anular?". */
                      <View
                        testID={`app-${s.key}-confirmar-baja`}
                        style={{
                          backgroundColor: tema.color.superficieAlta,
                          borderRadius: tema.radio.md,
                          padding: tema.espacio.sm,
                          gap: tema.espacio.sm,
                        }}
                      >
                        <Text
                          testID={`app-${s.key}-baja-aviso`}
                          style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}
                        >
                          {loQueSePierde(s)}
                        </Text>
                        {CONSECUENCIA_EXTRA[s.key] != null && (
                          <Text
                            testID={`app-${s.key}-baja-consecuencia`}
                            style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}
                          >
                            {CONSECUENCIA_EXTRA[s.key]}
                          </Text>
                        )}
                        <FilaBotones
                          testID={`app-${s.key}-baja-confirmar-botones`}
                          botones={[
                            {
                              etiqueta: desconectando ? 'Desconectando…' : 'Sí, desconectar',
                              onPress: () => void confirmarBaja(s),
                              variante: 'peligro',
                              deshabilitado: desconectando,
                              testID: `app-${s.key}-baja-si`,
                            },
                            {
                              etiqueta: 'No',
                              onPress: () => setObjetivoBaja(null),
                              deshabilitado: desconectando,
                              testID: `app-${s.key}-baja-no`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                ) : (
                  <FilaBotones
                    compacto
                    testID={`app-${s.key}-botones`}
                    botones={[
                      {
                        etiqueta: pidiendo === s.key ? 'Abriendo…' : 'Conectar',
                        onPress: () => void vincular(s),
                        deshabilitado: pidiendo != null,
                        testID: `app-${s.key}-conectar`,
                      },
                    ]}
                  />
                )}
              </View>
            </Row>
          ))}

        {estado === 'ok' && (
          <Text testID="apps-aviso-navegador" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: tema.espacio.sm }}>
            Conectar abre el navegador para que autorices con tu cuenta. Cuando vuelvas, esta pantalla
            se actualiza sola.
          </Text>
        )}
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenido: { flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  textos: { flexShrink: 1 },
});
