import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
// 🔴 `RefreshControl` de RNGH, no el de `react-native`: el scroll de RNGH espera a ESE handler
// (`waitFor`). Con el de RN, `onRefresh` se disparaba a mitad del arrastre (DEVICE15 H4).
import { RefreshControl } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import {
  borrarIngreso,
  formatearFechaCorta,
  formatearImporte,
  formatearMesDePeriodo,
  listarIngresos,
  obtenerResumenIngresos,
  type Ingreso,
  type OrigenIngreso,
  type ResumenIngresos as ResumenIngresosDato,
} from '@copiloto/core';

import { DIBUJO_MONEDAS } from './dibujoMonedas';
import { FormularioIngreso, type ValoresInicialesIngreso } from './FormularioIngreso';
import { ResumenIngresos } from './ResumenIngresos';
import { BuscadorActividad } from '../actividad/BuscadorActividad';
import { GLIFO_MERCADO_PAGO } from '../apps/logosMarca';
import { AvisoDictado, DockFuncion, inicialesDeIngreso, useDictadoPorFuncion, type ViaTexto } from '../voz';
import { elevacion } from '../../theme/BloqueCifra';
import { BotonAcceso, IconoLapiz } from '../../theme/BotonAcceso';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { conAlfa } from '../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { Glifo } from '../../theme/glass/Glifo';
import { useTema } from '../../theme/ThemeProvider';
import { VacioFuncion } from '../../theme/VacioFuncion';

const PLACEHOLDER_DOCK = 'Anotá un cobro, o hablá…';

/**
 * `PantallaIngresos` — la función "Ingresos": **todo lo que entró**, y el alta manual.
 *
 * 🔴 **Por qué existe como función propia y no dentro de Contabilidad** (addendum de INGRESOS): *«si
 * el emprendedor ve Gastos y no ve Ingresos, asume que la plata que entra no se registra»* — y no la
 * va a ir a buscar adentro de otra pantalla. La simetría con Gastos es lo que hace que se entienda sin
 * que nadie la explique. Por eso también el molde es el de `PantallaGastos`, portado y no reinventado.
 *
 * 🔴 **El problema que resuelve, sin vueltas:** hasta acá un cobro sólo existía si había pasado por
 * MercadoPago. El efectivo y las transferencias no dejaban rastro de ninguna clase, así que la caja
 * daba números **coherentes y falsos** — el error que no duele hasta que alguien compara con el banco.
 *
 * 🔴 **`origen` se muestra, y no es decoración.** Un cobro que el sistema **vio** (una factura
 * cobrada, MercadoPago) no es la misma evidencia que uno que alguien **tipeó**. Sin la marca, en tres
 * meses nadie sabría qué dato es duro y cuál es de memoria.
 *
 * 🔴 **Tres disparadores de recarga**, como en Gastos: al montar, al anotar, y el tirón — el único que
 * cubre lo que cambió AFUERA (el copiloto anotando por voz desde el chat, o una factura que se cobró
 * desde su propia ficha). Sin él, el dato viejo se ve idéntico al fresco.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';
type Vista = 'listado' | 'formulario';

/** Cómo se nombra cada procedencia **desde la vereda del emprendedor**. */
const ETIQUETA_ORIGEN: Record<OrigenIngreso, string> = {
  factura: 'de una factura',
  mercadopago: 'por MercadoPago',
  manual: 'lo anotaste vos',
  voz: 'lo dictaste por voz',
};

/** Glifo del tile según de dónde salió el cobro. Mercado Pago no usa éste: lleva su logo (`GLIFO_MERCADO_PAGO`). */
const GLIFO_ORIGEN: Record<OrigenIngreso, string> = {
  factura: 'file-text',
  mercadopago: 'wallet',
  manual: 'pen',
  voz: 'microphone',
};

export function PantallaIngresos() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [ingresos, setIngresos] = useState<readonly Ingreso[]>([]);
  const [resumen, setResumen] = useState<ResumenIngresosDato | null>(null);
  const [vista, setVista] = useState<Vista>('listado');
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // BL-J7/K-10 — ver el mismo comentario en `PantallaGastos.tsx`: dictado desde la fila de acciones
  // llena `concepto` (el campo libre "por qué trabajo"), no `monto` ni `cliente`.
  const [inicialesDictado, setInicialesDictado] = useState<ValoresInicialesIngreso | undefined>(undefined);
  const [errorMic, setErrorMic] = useState<string | null>(null);
  // `'voz'` sólo cuando el dictado por chat devolvió la propuesta del motor (igual que la card del chat);
  // `undefined` = alta manual, el backend asume `'manual'` en su ausencia.
  const [origenAlta, setOrigenAlta] = useState<OrigenIngreso | undefined>(undefined);
  const dictado = useDictadoPorFuncion('ingreso');
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const res = await listarIngresos();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setIngresos(res.ingresos);
        setEstado('ok');
        // El resumen es OTRA llamada y va aparte a propósito: `listarIngresos().total` suma filas
        // recientes sin recortar por fecha, así que no es «lo cobrado este mes». Si el resumen
        // falla, la lista igual se ve — pero sin un número que mienta arriba.
        const r = await obtenerResumenIngresos();
        if (!vivo.current) return;
        setResumen(r.status === 'ok' ? r.resumen : null);
        return;
      }
      setEstado('no_disponible');
    } catch {
      if (vivo.current) setEstado('no_disponible');
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    try {
      await cargar();
    } finally {
      if (vivo.current) setRefrescando(false);
    }
  }

  async function borrar(ingreso: Ingreso) {
    setError(null);
    const res = await borrarIngreso(ingreso.id);
    if (!vivo.current) return;
    // Se relee en vez de sacar la fila de la lista local: el TOTAL lo suma el backend, y quitarla acá
    // dejaría el total viejo al lado de la lista nueva. Dos números que se contradicen en la misma
    // pantalla destruyen la confianza en el que importa.
    if (res.status === 'ok') await cargar();
    else setError('No pudimos borrarlo. Probá de nuevo.');
  }

  // Ver `alDictarGasto` en `PantallaGastos.tsx`: propuesta del motor si hay, texto crudo en `concepto`
  // (el comportamiento de antes) si el camino está apagado o falló.
  async function alDictarIngreso(texto: string, via: ViaTexto) {
    setErrorMic(null);
    const propuesta = await dictado.dictar(texto);
    if (!vivo.current) return;
    setInicialesDictado(propuesta !== null ? inicialesDeIngreso(propuesta) : { concepto: texto });
    setOrigenAlta(propuesta !== null && via === 'dictado' ? 'voz' : undefined);
    setVista('formulario');
  }

  return (
    // `etiqueta` = el período del resumen («Agosto»), como `.per` del prototipo. Sin resumen no hay
    // período que decir, y no se inventa uno con la fecha del teléfono.
    <MarcoGlass
      titulo="Ingresos"
      icono="ingresos"
      sinIcono
      etiqueta={resumen != null ? formatearMesDePeriodo(resumen.periodo) : undefined}
      testID="pantalla-ingresos"
    >
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="ingresos-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="ingresos-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Los ingresos todavía no están disponibles en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && (
        <ScrollFormulario
          testID="ingresos-lista"
          contentContainerStyle={{ padding: tema.espacio.md, gap: 20, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="ingresos-refresh"
            />
          }
        >
          {/* Dictado por chat: «esperando» y, si cayó al texto crudo, el porqué (ver `PantallaGastos.tsx`). */}
          <AvisoDictado
            testID="ingresos-dictado"
            ocupado={dictado.ocupado}
            aviso={vista === 'formulario' && inicialesDictado !== undefined ? dictado.aviso : null}
          />

          {vista === 'formulario' ? (
            <FormularioIngreso
              iniciales={inicialesDictado}
              origen={origenAlta}
              onGuardado={() => { setInicialesDictado(undefined); setOrigenAlta(undefined); void cargar(); }}
              onCancelar={() => {
                setVista('listado');
                setInicialesDictado(undefined);
                setOrigenAlta(undefined);
                void cargar();
              }}
            />
          ) : (
            <>
              {/* El total lo suma el BACKEND. Sumarlo acá daría un segundo número para la misma
                  pregunta, y el día que difieran el emprendedor ve dos verdades. */}
              {resumen != null && <ResumenIngresos resumen={resumen} />}

              {/* BL-J7/K-10 — ver el mismo comentario en `PantallaGastos.tsx`: dictar acá abre el
                  formulario con `concepto` prellenado (K-10, `/transcribir`, sin sesión de chat). */}
              {/* Mismo criterio que Gastos (Martin 14/11, ver `BotonAcceso`): la vía manual va callada, en
                  tarjeta blanca; la terracota queda para el micrófono del dock. Acá no hay foto, así que es UNA
                  sola vía y ocupa el ancho. El verbo es el del repo: «Anotar que me pagaron». */}
              <View testID="ingresos-acciones">
                <BotonAcceso
                  testID="ingresos-nuevo"
                  onPress={() => { setInicialesDictado(undefined); setOrigenAlta(undefined); setVista('formulario'); }}
                  icono={<IconoLapiz color={tema.color.acentoTinta} />}
                  etiqueta="Anotar que me pagaron"
                />
              </View>

              {errorMic != null && (
                <Text testID="ingresos-mic-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {errorMic}
                </Text>
              )}

              {/* 🔴 Decisión C: la lista rica de ingresos (con `origen`, `borrable`) NO se toca — la
                  envuelve el buscador. Sin query, se muestra intacta; con query, pega a
                  `/actividad?funcion=ingresos&q=` y muestra el card uniforme. */}
              {/* Sin ingresos no hay buscador ni rótulo «Últimos» (ver `VacioFuncion`). */}
              {ingresos.length === 0 && (
                <VacioFuncion
                  testID="ingresos-vacio"
                  dibujo={DIBUJO_MONEDAS}
                  titulo="Todavía no hay ingresos"
                  cuerpo="Cuando te paguen, decímelo abajo o anotalo a mano."
                />
              )}

              {ingresos.length > 0 && (
              <BuscadorActividad
                funcion="ingresos"
                testIDBase="ingresos-busqueda"
                placeholder="Buscar un ingreso"
                rotuloLista="Últimos"
                sinEtiqueta
              >

              {/* Rediseño (Martin 15/11): una sola tarjeta blanca con una fila por cobro, el mismo molde que
                  Gastos. Antes cada ingreso era una fila de vidrio con el monto arriba y todo lo demás en una
                  sola línea gris. */}
              <View style={[styles.tarjetaLista, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
                {ingresos.map((i, n) => {
                  // El título es de QUIÉN vino la plata; sin cliente, por qué; sin nada, «Cobro».
                  const titulo = i.clienteNombre ?? i.concepto ?? 'Cobro';
                  const t = tema.color.tileFuncion;
                  return (
                    <View
                      key={i.id}
                      testID={`ingresos-fila-${i.id}`}
                      style={[styles.fila, n > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
                    >
                      <View accessible={false} style={[styles.tile, { backgroundColor: t.arena }]}>
                        {i.origen === 'mercadopago' ? (
                          // El logo de Mercado Pago, en línea y de un color como el resto de los íconos.
                          <Svg testID={`ingresos-fila-${i.id}-mp`} width={26} height={19} viewBox={GLIFO_MERCADO_PAGO.viewBox} fill="none">
                            <Path d={GLIFO_MERCADO_PAGO.ovalo} fill="none" stroke={t.tinta} strokeWidth={GLIFO_MERCADO_PAGO.anchoOvalo} />
                            <Path d={GLIFO_MERCADO_PAGO.lineas} fill={t.tinta} stroke="none" />
                          </Svg>
                        ) : (
                          <Glifo nombre={GLIFO_ORIGEN[i.origen]} size={20} color={t.tinta} />
                        )}
                      </View>
                      <View style={styles.textos}>
                        <Text numberOfLines={2} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}>
                          {titulo}
                        </Text>
                        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
                          {[
                            i.clienteNombre != null ? i.concepto : null,
                            i.comprobanteNro != null ? `Factura N° ${i.comprobanteNro}` : null,
                            i.medio,
                            // H-A4-6: `i.fecha` llega "YYYY-MM-DD" (sin hora) del backend — ISO crudo si
                            // se pinta tal cual. `null` (backend sin fecha) queda `null` y se filtra abajo.
                            i.fecha != null ? formatearFechaCorta(i.fecha) : null,
                            // La procedencia va SIEMPRE, incluso en las que el emprendedor anotó: es lo
                            // que permite, meses después, separar el dato duro del de memoria.
                            ETIQUETA_ORIGEN[i.origen],
                          ]
                            .filter((x): x is string => x != null && x !== '')
                            .join(' · ')}
                        </Text>
                        {/* 🔴 Sólo si el backend dijo que se puede. `null` es "no sé" y ahí NO se ofrece:
                            borrar el rastro de un cobro que el sistema vio sería inventar que esa factura
                            no se cobró — y el backend contestaría 404 sobre algo que está en pantalla. */}
                        {i.borrable === true && (
                          <Pressable
                            testID={`ingresos-borrar-${i.id}`}
                            accessibilityRole="button"
                            onPress={() => void borrar(i)}
                            hitSlop={10}
                            style={pressableStyle(styles.borrar, PRESS_FADE)}
                          >
                            <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                              Borrar
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}>
                        {i.monto != null ? formatearImporte(i.monto) : 'Sin monto'}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {error != null && (
                <Text testID="ingresos-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {error}
                </Text>
              )}
              </BuscadorActividad>
              )}

              {/* El error de borrar vive dentro de la lista; éste cubre el caso de que al borrar el último la
                  lista quede vacía y el aviso no tenga dónde mostrarse. */}
              {ingresos.length === 0 && error != null && (
                <Text testID="ingresos-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {error}
                </Text>
              )}
            </>
          )}
        </ScrollFormulario>
      )}

      {/* SM-J1: el dock de SM-I2 al pie, fuera del scroll. Escribir o dictar abren el formulario prellenado; nada se envía solo. */}
      {estado === 'ok' && vista === 'listado' && (
        <DockFuncion
          contexto="ingreso"
          placeholder={PLACEHOLDER_DOCK}
          onTexto={(t, via) => void alDictarIngreso(t, via)}
          onError={setErrorMic}
          disabled={dictado.ocupado}
        />
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  textos: { flex: 1, gap: 2 },
  tarjetaLista: { borderRadius: 22, paddingHorizontal: 20 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  borrar: { alignSelf: 'flex-start', paddingTop: 6 },
});
