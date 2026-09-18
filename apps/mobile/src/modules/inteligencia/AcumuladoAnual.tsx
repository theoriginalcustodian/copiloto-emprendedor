/**
 * `AcumuladoAnual` — **«Acumulado del año»**: los últimos 12 meses facturados y qué porcentaje del
 * tope de monotributo representan.
 *
 * 🔴 **Viene de `PantallaContabilidad`, que dejó de existir (Ola 4, 2026-09-18).** Contabilidad e
 * Inteligencia eran dos pantallas leyendo el mismo negocio: caja, en qué se va la plata, mejores
 * clientes — todo duplicado, cada una con su propio endpoint y su propia forma de decirlo. Lo único
 * que Contabilidad tenía y acá faltaba es esto, así que esto es lo que se mudó. **Se movió, no se
 * construyó**: el contrato, el fail-soft y el semáforo son los de allá, palabra por palabra.
 *
 * 🔴 **Sigue leyendo de `GET /contabilidad/resumen`, no de la portada.** El endpoint no se fusionó —
 * se fusionó la PANTALLA. Mezclar las dos lecturas en una sola pediría un cambio de contrato que
 * nadie pidió, y este bloque puede degradar solo sin arrastrar a la portada: si Contabilidad no
 * está, **no se dibuja nada** en vez de contagiarle un error a una pantalla que cargó bien.
 *
 * 🔴 **Fail-soft del tope (§4.3 del contrato):** sin escala vigente, `tope` viene `null` y se muestra
 * SÓLO el acumulado. Nunca un tope viejo presentado como vigente — un porcentaje de monotributo
 * calculado contra una escala del año pasado es un dato falso sobre una obligación fiscal.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatearImporte, obtenerResumenContabilidad, type ResumenContabilidad } from '@copiloto/core';

import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

export function AcumuladoAnual({ testID = 'inteligencia-acumulado' }: { testID?: string }) {
  const tema = useTema();
  const [facturado, setFacturado] = useState<ResumenContabilidad['facturado'] | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    void obtenerResumenContabilidad()
      .then((res) => {
        if (!vivo.current || res.status === 'no_disponible') return;
        setFacturado(res.resumen.facturado);
      })
      .catch(() => {
        // Silencio deliberado: este bloque es un agregado al resumen, no el resumen. Un cartel de
        // error acá le diría al emprendedor que su Inteligencia falló cuando lo que falló es un
        // endpoint secundario que ya cargó todo lo demás.
      });
    return () => {
      vivo.current = false;
    };
  }, []);

  if (facturado == null) return null;

  // Sin token de "advertencia" en la paleta (sólo `exito`/`peligro`): `amarillo` cae en `acento`, el
  // único color que llama la atención sin afirmar ni éxito ni peligro que no le constan a este bloque.
  const colorSemaforo: Record<string, string> = {
    verde: tema.color.exito,
    amarillo: tema.color.acento,
    rojo: tema.color.peligro,
  };

  return (
    <Row testID={testID}>
      <View style={styles.cuerpo}>
        <View style={styles.fila}>
          <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
            Acumulado del año
          </Text>
          <Text
            testID={`${testID}-doce-meses`}
            style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
          >
            {formatearImporte(facturado.doceMeses)}
          </Text>
        </View>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Últimos 12 meses facturados</Text>

        {facturado.tope != null && (
          <View style={styles.medidor} testID={`${testID}-tope`}>
            <View style={[styles.medidorFondo, { backgroundColor: tema.color.borde }]}>
              <View
                style={[
                  styles.medidorBarra,
                  {
                    backgroundColor: colorSemaforo[facturado.tope.semaforo] ?? tema.color.textoTenue,
                    // Topeado al 100%: pasado el tope la barra no crece más, y el número de al lado
                    // sigue diciendo la verdad. Una barra que se desborda del riel se lee como un
                    // error de dibujo, no como «te pasaste».
                    width: `${Math.min(facturado.tope.porcentaje, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text
              style={{
                color: colorSemaforo[facturado.tope.semaforo] ?? tema.color.textoTenue,
                fontSize: tema.tipo.chico,
              }}
            >
              {facturado.tope.porcentaje}% del tope de monotributo
            </Text>
          </View>
        )}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flex: 1, gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  medidor: { gap: 6, marginTop: 8 },
  medidorFondo: { height: 8, borderRadius: 4, overflow: 'hidden' },
  medidorBarra: { height: 8, borderRadius: 4 },
});
