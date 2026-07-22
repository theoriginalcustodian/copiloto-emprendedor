/**
 * `SeccionCobro` — **¿esta factura la cobré?**, dentro de la ficha del comprobante.
 *
 * Hito 3 del sprint de Inteligencia de Negocio (§4 del `dato_` de backend): *«botón Cobrar → POST
 * .../cobros con `idem_key`. Mostrar `estado_cobro` y `saldo`»*.
 *
 * 🔴 **Pregunta por su cuenta en vez de leer la fila que la ficha ya tenía.** `DetalleComprobante`
 * presume de no pedir datos, y para todo lo fiscal está bien: el listado los trae. Pero el listado
 * **no declaró** traer `estado_cobro`/`saldo`, y darlo por hecho no habría fallado ruidoso — los
 * campos llegarían `undefined`, el cliente los dejaría en `null`, y la sección simplemente no se
 * dibujaría. Un dato desapareciendo sin error, y encima atribuible al otro lado. Además el cobro es lo
 * único de esta ficha que **cambia después de emitida** (y desde otro dispositivo), así que la fila en
 * memoria es justo el dato que envejece.
 *
 * 🔴 **Sin cobro no hay estado inventado.** Mientras la consulta no responde, o si responde que no
 * está disponible, esto **no dice «impaga»**: dice que no lo sabe. «No sé si me pagaron» y «no me
 * pagaron» se ven idénticos en pantalla y sólo uno de los dos es cierto — y el falso empuja a
 * reclamarle a un cliente que ya pagó.
 *
 * 🔴 **El saldo NO se calcula acá.** Lo deriva el backend (`total − Σ cobros`) y esta pantalla lo
 * muestra tal cual. Restarlo del lado de la app daría dos fuentes para el mismo número, y el día que
 * difieran el emprendedor ve dos verdades y deja de creerle a las dos. Por la misma razón el botón se
 * ofrece según el `estado_cobro` **derivado por el backend**, no comparando el saldo con cero acá.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borrarCobro,
  formatearImporte,
  listarCobros,
  registrarCobro,
  type Cobro,
  type EstadoCobro,
  type EstadoDeCobro,
} from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { generarId } from '../../util/id';

/**
 * Cómo se le dice a cada estado **en castellano y desde la vereda del emprendedor**. `impaga` es la
 * palabra del contable; lo que él piensa es *«todavía no me pagaron»*.
 */
const ETIQUETA_COBRO: Record<EstadoCobro, string> = {
  impaga: 'Todavía no te la pagaron',
  parcial: 'Te la pagaron en parte',
  cobrada: 'Cobrada',
};

export interface SeccionCobroProps {
  comprobanteId: number;
  /**
   * Si este comprobante puede cobrarse. Lo decide quien la monta —la ficha— porque depende del tipo y
   * del estado fiscal, que ella tiene. Una nota de crédito o una factura anulada **no son una deuda**:
   * ofrecer «cobrar» sobre ellas contradice el documento.
   */
  cobrable: boolean;
  /**
   * Avisa que el cobro de este comprobante CAMBIÓ (se registró o se deshizo).
   *
   * 🔴 Existe porque *«Te deben»* vive en otra sección de la misma pantalla y **no tiene forma de
   * enterarse**: marcar una factura cobrada sin esto la dejaría figurando como deuda hasta el próximo
   * tirón-para-actualizar, y el emprendedor vería su acción sin efecto justo donde la esperaba.
   */
  onCambio?: () => void;
  testID?: string;
}

type Consulta = 'cargando' | 'ok' | 'sin_dato' | 'no_encontrado';

export function SeccionCobro({ comprobanteId, cobrable, onCambio, testID = 'cobro' }: SeccionCobroProps) {
  const tema = useTema();
  const [consulta, setConsulta] = useState<Consulta>('cargando');
  const [estado, setEstado] = useState<EstadoDeCobro | null>(null);
  const [cobros, setCobros] = useState<readonly Cobro[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  /**
   * 🔴 **La clave de idempotencia se guarda entre reintentos, y se tira sólo cuando el cobro entró.**
   *
   * Es el corazón de esto: si la red se corta después de que el backend registró el cobro, el usuario
   * ve un error y vuelve a tocar. Con una clave nueva por toque, eso deja **dos cobros**; con la misma
   * clave, el backend devuelve el que ya existe y reintentar es seguro — que es exactamente para lo
   * que la clave existe. Después de un cobro exitoso sí se descarta: un segundo cobro parcial del
   * mismo monto **es un caso real** y no debe deduplicarse.
   */
  const claveGesto = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    // ⚠️ El `return null` de abajo corta el RENDER, no el efecto: los hooks corren igual. Sin esta
    // guarda, abrir la ficha de una nota de crédito disparaba una consulta de cobro por un documento
    // que nunca se cobra — invisible en pantalla, pero un request por cada apertura.
    if (!cobrable) return;
    const res = await listarCobros(comprobanteId);
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setCobros(res.cobros);
      setEstado(res.comprobante);
      // `ok` con `comprobante` en null es una respuesta que no trajo el estado: no alcanza para
      // afirmar nada sobre el cobro, así que se trata como "no sé", no como "impaga".
      setConsulta(res.comprobante?.estadoCobro != null ? 'ok' : 'sin_dato');
      return;
    }
    setConsulta(res.status === 'no_encontrado' ? 'no_encontrado' : 'sin_dato');
  }, [comprobanteId, cobrable]);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  async function marcarCobrada() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    // Se reusa la clave si quedó una de un intento fallido: ver `claveGesto`.
    const clave = claveGesto.current ?? generarId();
    claveGesto.current = clave;
    try {
      // `monto` OMITIDO = el saldo pendiente completo. Es lo que permite un botón sin formulario, y
      // no exige del usuario un dato que el backend ya sabe.
      const res = await registrarCobro(comprobanteId, { idemKey: clave });
      if (!vivo.current) return;
      if (res.status === 'ok') {
        claveGesto.current = null;
        await cargar();
        onCambio?.();
        return;
      }
      if (res.status === 'rechazado') setError(res.motivo);
      else if (res.status === 'no_encontrado') setError('Ese comprobante ya no está.');
      else setError('No pudimos registrar el cobro. Probá de nuevo.');
    } catch {
      if (vivo.current) setError('No pudimos registrar el cobro. Probá de nuevo.');
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  async function deshacer(cobroId: number) {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await borrarCobro(comprobanteId, cobroId);
      if (!vivo.current) return;
      if (res.status === 'ok') {
        await cargar();
        onCambio?.();
      } else setError('No pudimos deshacer ese cobro.');
    } catch {
      if (vivo.current) setError('No pudimos deshacer ese cobro.');
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  if (!cobrable) return null;

  const estadoCobro = estado?.estadoCobro ?? null;
  const puedeCobrar = estadoCobro === 'impaga' || estadoCobro === 'parcial';

  return (
    <View testID={testID} style={styles.seccion}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        Cobro
      </Text>

      {consulta === 'cargando' && (
        <View style={styles.fila}>
          <ActivityIndicator testID={`${testID}-cargando`} color={tema.color.acento} size="small" />
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Consultando…</Text>
        </View>
      )}

      {/* Ni «impaga» ni «cobrada»: no lo sabemos, y decirlo es más útil que elegir uno. */}
      {(consulta === 'sin_dato' || consulta === 'no_encontrado') && (
        <Text
          testID={`${testID}-sin-dato`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          No pudimos consultar si esta factura está cobrada.
        </Text>
      )}

      {consulta === 'ok' && estadoCobro != null && (
        <Text
          testID={`${testID}-estado`}
          style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
        >
          {ETIQUETA_COBRO[estadoCobro]}
        </Text>
      )}

      {/* El saldo sólo tiene sentido mientras falte algo: sobre una cobrada diría «Falta $0,00». */}
      {consulta === 'ok' && puedeCobrar && estado?.saldo != null && (
        <Text
          testID={`${testID}-saldo`}
          style={{ color: tema.color.texto, fontSize: tema.tipo.base }}
        >
          Falta {formatearImporte(estado.saldo)}
        </Text>
      )}

      {cobros.length > 0 && (
        <View testID={`${testID}-lista`} style={styles.lista}>
          {cobros.map((c) => (
            <View key={c.id} testID={`${testID}-item-${c.id}`} style={styles.filaCobro}>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {formatearImporte(c.monto)}
                {c.fecha !== '' ? ` · ${c.fecha}` : ''}
                {c.medio != null ? ` · ${c.medio}` : ''}
              </Text>
              {/* Existe porque alguien se equivoca. Sin esto, el único arreglo sería tocar la base. */}
              <Pressable
                testID={`${testID}-deshacer-${c.id}`}
                onPress={() => void deshacer(c.id)}
                disabled={enviando}
                hitSlop={10}
                style={pressableStyle(undefined, PRESS_FADE)}
              >
                <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  Deshacer
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error != null && (
        <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
          {error}
        </Text>
      )}

      {consulta === 'ok' && puedeCobrar && (
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              etiqueta: enviando ? 'Registrando…' : 'Ya me la pagaron',
              onPress: () => void marcarCobrada(),
              variante: 'primario',
              testID: `${testID}-marcar`,
              deshabilitado: enviando,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seccion: { gap: 4 },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lista: { gap: 4, marginTop: 4 },
  filaCobro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
