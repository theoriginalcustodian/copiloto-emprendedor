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

import { Tarjeta } from '../../theme/Tarjeta';
import { conAlfa } from '../../theme/glass/conAlfa';
import { useTema } from '../../theme/ThemeProvider';
import { MedidorTope } from './graficos/MedidorTope';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `2027-03` → «marzo de 2027». */
function mesLargo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1] ?? mes} de ${anio}`;
}

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

  const tope = facturado.tope;
  // Cuánto falta para el tope: la resta de los dos números que ya están en pantalla.
  const resto = tope != null ? Number(tope.valor) - Number(facturado.doceMeses) : null;

  // SM-N45 DoD 2 (prototipo `index.html:1996-1998`): «Acumulado del año» es la etiqueta de SECCIÓN
  // (`.lista-lbl`) y va FUERA de la card; el `h4` de la card es «Facturado en los últimos 12 meses».
  return (
    <View style={styles.seccion}>
      <Text
        testID={`${testID}-etiqueta`}
        accessibilityRole="header"
        style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}
      >
        Acumulado del año
      </Text>
      <Tarjeta testID={testID} rotulo="Facturado en los últimos 12 meses" rotuloAdentro>
      <View style={styles.cuerpo}>
        <Text
          testID={`${testID}-doce-meses`}
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 28, lineHeight: 34 }}
        >
          {formatearImporte(facturado.doceMeses)}
        </Text>

        {tope != null && (
          <View style={styles.medidor} testID={`${testID}-tope`}>
            <MedidorTope testID={`${testID}-medidor`} porcentaje={tope.porcentaje} semaforo={tope.semaforo} proyectado={tope.proyeccion?.porcentaje} />
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, textAlign: 'center' }}>
              del tope de monotributo
            </Text>
            {resto != null && Number.isFinite(resto) && (
              <Text testID={`${testID}-resto`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18, textAlign: 'center' }}>
                {resto >= 0
                  ? `Te quedan ${formatearImporte((resto).toFixed(2))} antes de pasarte.`
                  : `Te pasaste por ${formatearImporte((-resto).toFixed(2))}.`}
              </Text>
            )}
            {/* 🟡 La proyección es un PEDIDO al backend (`ProyeccionTope`): si no llega, esta línea no existe. */}
            {tope.proyeccion != null && (
              <View style={[styles.proyeccion, { borderTopColor: conAlfa(tema.color.texto, 0.12) }]}>
                <Text testID={`${testID}-proyeccion`} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 22 }}>
                  {tope.proyeccion.mesAlcance != null
                    ? `A este ritmo llegás al tope en ${mesLargo(tope.proyeccion.mesAlcance)}.`
                    : `A este ritmo no llegás al tope: en un año vas a estar en el ${tope.proyeccion.porcentaje}%.`}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
                  La línea punteada es lo que te falta recorrer si seguís facturando como este mes.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      </Tarjeta>
    </View>
  );
}

const styles = StyleSheet.create({
  seccion: { gap: 10 },
  cuerpo: { gap: 4 },
  medidor: { gap: 6, marginTop: 16 },
  proyeccion: { gap: 4, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
});
