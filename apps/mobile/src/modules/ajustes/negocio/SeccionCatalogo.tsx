/**
 * `SeccionCatalogo` — **lo que vendo**, con su precio de referencia. Ajustes → Mi negocio.
 *
 * Contrato: `contrato_planificacion-a-todos_los-dos-huecos-y-el-catalogo` §2.3/§3. Es la lista desde
 * la que se arman los presupuestos sin volver a tipear el mismo trabajo cada vez.
 *
 * 🔴 **No reemplaza a «qué vendés» de arriba, y no es un descuido tener las dos.** Aquél es la
 * descripción del negocio que lee el copiloto para conversar (*«arreglo bicicletas en Villa Crespo»*);
 * esto es una lista de ítems con precio. Fundirlos obligaría a que un texto libre sirviera de
 * catálogo, y el día que se quiera sugerir un precio habría que adivinarlo de una oración.
 *
 * 🔴 **Pide los desactivados explícitamente** (`incluirInactivos: true`). El backend los filtra por
 * defecto, y ésta es la ÚNICA pantalla desde donde se puede volver a ofrecer uno: si no los pidiera,
 * un concepto retirado quedaría irrecuperable sin que nadie notara nada — porque ver sólo los activos
 * es exactamente lo que uno espera ver.
 *
 * 🔴 **Quitar es DESACTIVAR, y el copy lo dice.** Borrar de verdad dejaría los presupuestos viejos
 * apuntando a la nada. Por eso el botón dice «Ya no lo ofrezco» y no «Borrar»: prometer un borrado que
 * no ocurre es peor que no ofrecerlo.
 *
 * 🔴 **El precio es de REFERENCIA y no toca lo ya emitido.** Se dice en pantalla porque es la primera
 * duda de cualquiera que edite un precio — y la respuesta silenciosa («¿me acaba de cambiar los
 * presupuestos que mandé?») es la que hace que no se anime a tocarlo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  crearConcepto,
  desactivarConcepto,
  editarConcepto,
  formatearImporte,
  listarConceptos,
  type Concepto,
} from '@copiloto/core';

import { CampoTexto, FilaBotones } from '../../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../../theme/glass/presion';
import { Row } from '../../../theme/glass/Row';
import { useTema } from '../../../theme/ThemeProvider';

type EstadoCarga = 'cargando' | 'ok' | 'no_disponible';

export interface SeccionCatalogoProps {
  testID?: string;
}

export function SeccionCatalogo({ testID = 'catalogo' }: SeccionCatalogoProps) {
  const tema = useTema();
  const [carga, setCarga] = useState<EstadoCarga>('cargando');
  const [conceptos, setConceptos] = useState<readonly Concepto[]>([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  /** `null` = el formulario está en modo alta. Un id = se está editando ese concepto. */
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await listarConceptos({ incluirInactivos: true });
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setConceptos(res.conceptos);
      setCarga('ok');
      return;
    }
    setCarga('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  function limpiar() {
    setNombre('');
    setPrecio('');
    setEditando(null);
  }

  /**
   * El precio va **tal cual lo tipeó**, sin `Number()` ni redondeo.
   *
   * Vacío = `null` explícito en la edición ("sacale el precio") y ausente en el alta ("no le puse").
   * Son cosas distintas y por eso no se colapsan: mandar `null` al crear diría que decidió no tener
   * precio, cuando simplemente no lo escribió.
   */
  function precioParaGuardar(): string | null | undefined {
    const t = precio.trim();
    if (t !== '') return t;
    return editando != null ? null : undefined;
  }

  async function guardar() {
    if (guardando) return;
    const limpio = nombre.trim();
    // La ÚNICA validación, y es la misma que el backend: sin nombre no hay concepto. Exigir precio
    // sería pedir más que el otro lado y trabar el caso común.
    if (limpio === '') {
      setAviso('Poné un nombre para poder guardarlo.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      const p = precioParaGuardar();
      const res =
        editando != null
          ? await editarConcepto(editando, { nombre: limpio, ...(p !== undefined ? { precioReferencia: p } : {}) })
          : await crearConcepto({ nombre: limpio, ...(p !== undefined ? { precioReferencia: p } : {}) });
      if (!vivo.current) return;
      if (res.status === 'ok') {
        limpiar();
        await cargar();
        return;
      }
      if (res.status === 'duplicado') {
        // No es un error en rojo: ese concepto YA lo tiene. Se nombra para que no busque a ciegas.
        const ya = res.existente;
        setAviso(
          ya != null && ya.nombre !== ''
            ? `Ya tenés «${ya.nombre}» en tu lista${ya.activo ? '.' : ', aunque está guardado como que ya no lo ofrecés.'}`
            : 'Ya tenés un concepto con ese nombre.',
        );
        return;
      }
      setAviso('No pudimos guardarlo. Probá de nuevo.');
    } catch (err) {
      // El backend explica el 400 mejor de lo que podríamos acá (nombre vacío, precio inválido).
      if (vivo.current) setAviso(mensajeDeError(err));
    } finally {
      if (vivo.current) setGuardando(false);
    }
  }

  async function alternarActivo(c: Concepto) {
    if (guardando) return;
    setGuardando(true);
    setAviso(null);
    try {
      const res = c.activo ? await desactivarConcepto(c.id) : await editarConcepto(c.id, { activo: true });
      if (!vivo.current) return;
      // 🔴 Se relee siempre, incluso con respuesta `ok`: el `DELETE` puede no devolver el concepto, y
      // pintar «desactivado» sin verlo sería mostrar un efecto que nadie confirmó.
      if (res.status === 'ok') await cargar();
      else setAviso('No pudimos cambiarlo. Probá de nuevo.');
    } catch {
      if (vivo.current) setAviso('No pudimos cambiarlo. Probá de nuevo.');
    } finally {
      if (vivo.current) setGuardando(false);
    }
  }

  function editar(c: Concepto) {
    setEditando(c.id);
    setNombre(c.nombre);
    setPrecio(c.precioReferencia ?? '');
    setAviso(null);
  }

  return (
    <View testID={testID} style={styles.seccion}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.grande }}>
        Lo que vendo
      </Text>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
        Tu lista de trabajos con su precio de referencia, para armar presupuestos sin escribir lo mismo
        cada vez. Cambiar un precio acá no cambia los presupuestos que ya mandaste.
      </Text>

      {carga === 'cargando' && <ActivityIndicator testID={`${testID}-cargando`} color={tema.color.acento} />}

      {carga === 'no_disponible' && (
        <Text testID={`${testID}-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Tu lista de trabajos todavía no está disponible en tu copiloto.
        </Text>
      )}

      {carga === 'ok' && conceptos.length === 0 && (
        <Text testID={`${testID}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Todavía no cargaste ninguno. Agregá el primero acá abajo.
        </Text>
      )}

      {carga === 'ok' &&
        conceptos.map((c) => (
          <Row key={c.id} testID={`${testID}-fila-${c.id}`}>
            <Pressable
              testID={`${testID}-editar-${c.id}`}
              onPress={() => editar(c)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${c.nombre}`}
              style={pressableStyle(styles.textos)}
            >
              <Text
                style={{
                  color: c.activo ? tema.color.texto : tema.color.textoTenue,
                  fontFamily: tema.fuente.uiMedium,
                  fontSize: tema.tipo.base,
                }}
              >
                {c.nombre}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {/* Sin precio no se escribe «$0»: no ponerle precio es una decisión, no un cero. */}
                {c.precioReferencia != null ? formatearImporte(c.precioReferencia) : 'Sin precio de referencia'}
                {c.activo ? '' : ' · ya no lo ofrecés'}
              </Text>
            </Pressable>
            <Pressable
              testID={`${testID}-alternar-${c.id}`}
              onPress={() => void alternarActivo(c)}
              disabled={guardando}
              hitSlop={10}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                {c.activo ? 'Ya no lo ofrezco' : 'Volver a ofrecerlo'}
              </Text>
            </Pressable>
          </Row>
        ))}

      {carga !== 'no_disponible' && (
        <>
          <CampoTexto
            etiqueta={editando != null ? 'Editando' : 'Agregar un trabajo'}
            valor={nombre}
            onChange={setNombre}
            placeholder="ej.: Corte de pelo"
            testID={`${testID}-nombre`}
          />
          <CampoTexto
            etiqueta="Precio de referencia (opcional)"
            valor={precio}
            onChange={setPrecio}
            placeholder="ej.: 8000"
            keyboardType="decimal-pad"
            testID={`${testID}-precio`}
          />
          <FilaBotones
            testID={`${testID}-botones`}
            botones={[
              {
                etiqueta: guardando ? 'Guardando…' : editando != null ? 'Guardar cambios' : 'Agregar',
                onPress: () => void guardar(),
                variante: 'primario',
                deshabilitado: guardando,
                testID: `${testID}-guardar`,
              },
              ...(editando != null
                ? [
                    {
                      etiqueta: 'Cancelar',
                      onPress: limpiar,
                      variante: 'secundario' as const,
                      testID: `${testID}-cancelar`,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      {aviso != null && (
        <Text testID={`${testID}-aviso`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          {aviso}
        </Text>
      )}
    </View>
  );
}

/** El texto del backend si lo hay; si no, uno genérico. Nunca se traga la causa en silencio. */
function mensajeDeError(err: unknown): string {
  const detalle = (err as { detail?: unknown })?.detail;
  return typeof detalle === 'string' && detalle.trim() !== '' ? detalle : 'No pudimos guardarlo. Probá de nuevo.';
}

const styles = StyleSheet.create({
  seccion: { gap: 10 },
  textos: { flex: 1, gap: 2 },
});
