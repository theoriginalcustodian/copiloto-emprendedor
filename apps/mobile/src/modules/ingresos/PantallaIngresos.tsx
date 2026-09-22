import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  borrarIngreso,
  formatearImporte,
  listarIngresos,
  obtenerResumenIngresos,
  type Ingreso,
  type OrigenIngreso,
  type ResumenIngresos as ResumenIngresosDato,
} from '@copiloto/core';

import { FormularioIngreso, type ValoresInicialesIngreso } from './FormularioIngreso';
import { ResumenIngresos } from './ResumenIngresos';
import { BuscadorActividad } from '../actividad/BuscadorActividad';
import { MicFuncion } from '../voz';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

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

  function alDictarIngreso(texto: string) {
    setErrorMic(null);
    setInicialesDictado({ concepto: texto });
    setVista('formulario');
  }

  return (
    <MarcoGlass titulo="Ingresos" icono="ingresos" testID="pantalla-ingresos">
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
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
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
          {vista === 'formulario' ? (
            <FormularioIngreso
              iniciales={inicialesDictado}
              onGuardado={() => { setInicialesDictado(undefined); void cargar(); }}
              onCancelar={() => {
                setVista('listado');
                setInicialesDictado(undefined);
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
              <View style={styles.filaConMic}>
                <MicFuncion contexto="ingreso" onTranscripcion={alDictarIngreso} onError={setErrorMic} />
                <View style={styles.botonesFlex}>
                  <FilaBotones
                    testID="ingresos-acciones"
                    botones={[
                      {
                        etiqueta: 'Anotar que me pagaron',
                        onPress: () => { setInicialesDictado(undefined); setVista('formulario'); },
                        variante: 'primario',
                        testID: 'ingresos-nuevo',
                      },
                    ]}
                  />
                </View>
              </View>

              {errorMic != null && (
                <Text testID="ingresos-mic-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {errorMic}
                </Text>
              )}

              {/* 🔴 Decisión C: la lista rica de ingresos (con `origen`, `borrable`) NO se toca — la
                  envuelve el buscador. Sin query, se muestra intacta; con query, pega a
                  `/actividad?funcion=ingresos&q=` y muestra el card uniforme. */}
              <BuscadorActividad funcion="ingresos" testIDBase="ingresos-busqueda" placeholder="Buscar un ingreso">
              {ingresos.length === 0 && (
                <Text testID="ingresos-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                  Todavía no entró nada. Cuando cobres, anotalo acá — o decíselo al copiloto hablando.
                </Text>
              )}

              {ingresos.map((i) => (
                <Row key={i.id} testID={`ingresos-fila-${i.id}`}>
                  <View style={styles.textos}>
                    <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                      {i.monto != null ? formatearImporte(i.monto) : 'Sin monto'}
                    </Text>
                    <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                      {[
                        i.clienteNombre,
                        i.concepto,
                        i.comprobanteNro != null ? `Factura N° ${i.comprobanteNro}` : null,
                        i.medio,
                        i.fecha,
                        // La procedencia va SIEMPRE, incluso en las que el emprendedor anotó: es lo
                        // que permite, meses después, separar el dato duro del de memoria.
                        ETIQUETA_ORIGEN[i.origen],
                      ]
                        .filter((x): x is string => x != null && x !== '')
                        .join(' · ')}
                    </Text>
                  </View>
                  {/* 🔴 Sólo si el backend dijo que se puede. `null` es "no sé" y ahí NO se ofrece:
                      borrar el rastro de un cobro que el sistema vio sería inventar que esa factura
                      no se cobró — y el backend contestaría 404 sobre algo que está en pantalla. */}
                  {i.borrable === true && (
                    <Pressable
                      testID={`ingresos-borrar-${i.id}`}
                      onPress={() => void borrar(i)}
                      hitSlop={10}
                      style={pressableStyle(undefined, PRESS_FADE)}
                    >
                      <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                        Borrar
                      </Text>
                    </Pressable>
                  )}
                </Row>
              ))}

              {error != null && (
                <Text testID="ingresos-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {error}
                </Text>
              )}
              </BuscadorActividad>
            </>
          )}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  textos: { flex: 1, gap: 2 },
  // BL-J7/K-10 — ver el mismo comentario en `PantallaGastos.tsx`.
  filaConMic: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonesFlex: { flex: 1 },
});
