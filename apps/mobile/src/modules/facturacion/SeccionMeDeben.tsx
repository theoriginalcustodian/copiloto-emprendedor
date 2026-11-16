/**
 * `SeccionMeDeben` — **la plata que facturaste y todavía no entró.**
 *
 * 🔴 **Sección de Facturación, no pantalla aparte.** Misma decisión que «Mis comprobantes» (plan §0):
 * lo que se debe *son* las facturas emitidas, y separarlo en otro destino obligaría a preguntarse en
 * cuál de los dos lugares está una factura concreta. Acá se ve arriba del listado completo porque es
 * la pregunta que se hace primero al abrir Facturación.
 *
 * 🔴 **El total lo suma el BACKEND (`total_adeudado`) y se muestra tal cual.** Sumar acá daría un
 * segundo número para la misma pregunta; el día que difieran —un redondeo, una página que no llegó— el
 * emprendedor ve dos verdades y deja de creerle a las dos. Y es plata: los importes viajan como string
 * decimal y no pasan por `Number` en ningún punto de este archivo.
 *
 * 🔴 **Vacío y "no pudimos consultar" NO son la misma pantalla.** «No te debe nadie» es la frase más
 * tranquilizadora que puede decir esta app, y dicha sobre la ausencia total del dato es una mentira
 * que nadie va a cuestionar. El cliente distingue los dos casos (`no_disponible` vs `[]`) y acá se
 * pintan distinto.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { formatearImporte, listarImpagos, type ComprobanteImpago } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { elevacion } from '../../theme/BloqueCifra';
import { conAlfa } from '../../theme/glass/conAlfa';

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

export interface SeccionMeDebenHandle {
  /** Vuelve a preguntar. La usa la pantalla después de un cobro y en el tirón-para-actualizar. */
  recargar: () => Promise<void>;
}

export interface SeccionMeDebenProps {
  testID?: string;
}

/**
 * Cuánto hace que está impaga, **dicho como lo diría alguien**. `dias` puede ser `null` —el backend no
 * lo calculó— y ahí no se escribe nada: «hace 0 días» sobre una factura de marzo es peor que el
 * silencio.
 */
function antiguedad(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias <= 0) return 'de hoy';
  if (dias === 1) return 'de ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace más de un mes' : `hace más de ${meses} meses`;
}

export const SeccionMeDeben = forwardRef<SeccionMeDebenHandle, SeccionMeDebenProps>(
  function SeccionMeDeben({ testID = 'facturacion-me-deben' }, ref) {
    const tema = useTema();
    const [estado, setEstado] = useState<EstadoLista>('cargando');
    const [filas, setFilas] = useState<readonly ComprobanteImpago[]>([]);
    const [total, setTotal] = useState<string | null>(null);
    const vivo = useRef(true);

    const cargar = useCallback(async () => {
      try {
        const res = await listarImpagos();
        if (!vivo.current) return;
        if (res.status === 'ok') {
          setFilas(res.comprobantes);
          setTotal(res.totalAdeudado);
          setEstado('ok');
          return;
        }
        setEstado('no_disponible');
      } catch {
        if (vivo.current) setEstado('no_disponible');
      }
    }, []);

    useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

    useEffect(() => {
      vivo.current = true;
      void cargar();
      return () => {
        vivo.current = false;
      };
    }, [cargar]);

    return (
      <View testID={testID} style={styles.seccion}>
        {/* El total va en el mismo renglón que el rótulo, a la derecha y en tinta: es un dato, no un botón
            (antes iba en terracota, que en Odobi marca lo que se toca). */}
        <View style={styles.rotulo}>
          <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
            Te deben
          </Text>
          {estado === 'ok' && filas.length > 0 && total != null && (
            <Text testID={`${testID}-total`} style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
              {formatearImporte(total)}
            </Text>
          )}
        </View>

        {estado === 'cargando' && <ActivityIndicator testID={`${testID}-cargando`} color={tema.color.acento} />}

        {estado === 'no_disponible' && (
          // No «no te debe nadie»: eso sería afirmar sobre un dato que no tenemos.
          <Text
            testID={`${testID}-no-disponible`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          >
            No pudimos consultar las facturas impagas.
          </Text>
        )}

        {estado === 'ok' && filas.length === 0 && (
          <Text testID={`${testID}-vacia`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            No tenés facturas impagas.
          </Text>
        )}

        {estado === 'ok' && filas.length > 0 && (
          <>
            {/* Una tarjeta blanca con una fila por factura impaga, como el resto de las listas (Martin 15/11). */}
            <View style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
              {filas.map((f, n) => {
                const bajo = [f.nro != null && f.receptorNombre != null ? `N° ${f.nro}` : null, antiguedad(f.dias)]
                  .filter((x): x is string => x != null)
                  .join(' · ');
                return (
                  <View
                    key={f.id}
                    testID={`${testID}-fila-${f.id}`}
                    style={[styles.fila, n > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
                  >
                    <View style={styles.textos}>
                      <Text numberOfLines={2} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}>
                        {/* Sin nombre de receptor no se inventa «Cliente»: los comprobantes anteriores
                            al 2026-07-21 no lo tienen, y el número identifica igual. */}
                        {f.receptorNombre ?? (f.nro != null ? `N° ${f.nro}` : 'Sin datos del cliente')}
                      </Text>
                      {bajo !== '' && (
                        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>{bajo}</Text>
                      )}
                    </View>
                    {/* El SALDO, no el total: si le pagaron la mitad, lo que le deben es la otra mitad. */}
                    {f.saldo != null && (
                      <Text
                        testID={`${testID}-saldo-${f.id}`}
                        style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}
                      >
                        {formatearImporte(f.saldo)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  seccion: { gap: 12 },
  rotulo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
  tarjeta: { borderRadius: 22, paddingHorizontal: 20 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  // `flex: 1` para que el saldo quede pegado al borde derecho y los textos cedan ancho, no al revés:
  // el importe empujado fuera de la fila es justo el dato que la sección existe para mostrar.
  textos: { flex: 1, gap: 2 },
});
