/**
 * `EstadoVacio` — el vacío con estructura: **ilustración + título + cuerpo**.
 *
 * Hasta ahora los vacíos de mobile eran una línea de texto suelta. El sistema pide otra cosa, y la
 * diferencia no es cosmética: un vacío sin explicación se lee como que algo falló.
 *
 * 🔴 **La taza va SÓLO en el vacío bueno de una pantalla entera.** Cuando el vacío significa «no
 * pasó nada malo, no tenés nada urgente», la ilustración celebra. Cuando significa «todavía no
 * vendiste» —el vacío de una sección— va SIN ilustración: celebrar ahí sería raro. Es la regla que
 * separa `vacio` de `bi-vacio` en el mapa de pantallas, y por eso `ilustracion` es opt-in.
 *
 * ⚠️ **El retiro progresivo.** La explicación larga sirve las primeras veces y después estorba: el
 * que ya entendió no necesita que se lo expliquen todos los días. A partir de
 * `DIAS_PARA_RETIRAR_EXPLICACION` días DISTINTOS con la pantalla vacía, el cuerpo deja de
 * mostrarse y queda sólo el título con la ilustración. Se cuentan días distintos, no visitas: diez
 * entradas en una mañana son un día, no diez.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import {
  CLAVE_DIAS_CALMA,
  DIAS_PARA_RETIRAR_EXPLICACION,
  TAZA,
  VIEWBOX_TAZA,
  fechaLocalISO,
  mostrarExplicacion,
  parsearDiasVistos,
  registrarDiaVisto,
  type RolTaza,
} from '@copiloto/core';

import { almacenClave } from '../adapters/almacen';
import { useTema } from './ThemeProvider';

/** La constante vive en `@copiloto/core` (BL-W5: UNA sola N para web y mobile); se reexporta acá
 *  porque el test de este componente la importa desde el componente. */
export { DIAS_PARA_RETIRAR_EXPLICACION };

export interface EstadoVacioProps {
  titulo: string;
  /** La explicación. Se retira sola con el uso — ver el docstring. */
  cuerpo?: string;
  /** `true` sólo en el vacío bueno de una pantalla entera. */
  ilustracion?: boolean;
  testID?: string;
}

export function EstadoVacio({ titulo, cuerpo, ilustracion = false, testID }: EstadoVacioProps) {
  const tema = useTema();
  const [mostrarCuerpo, setMostrarCuerpo] = useState(true);

  useEffect(() => {
    if (cuerpo == null) return;
    let vivo = true;
    void (async () => {
      try {
        // Día LOCAL, no UTC (`fechaLocalISO`): con `toISOString()` el «día» cambiaba a las 21:00 ART.
        const hoy = fechaLocalISO(new Date());
        const dias = parsearDiasVistos(await almacenClave.leer(CLAVE_DIAS_CALMA));
        const conHoy = registrarDiaVisto(dias, hoy);
        if (conHoy !== dias) await almacenClave.guardar(CLAVE_DIAS_CALMA, JSON.stringify(conHoy));
        if (vivo) setMostrarCuerpo(mostrarExplicacion(conHoy));
      } catch {
        // Sin almacenamiento la explicación se muestra: el default menos malo es explicar de más.
        // ⚠️ El try/catch va ADENTRO y no como `.catch()` colgado del IIFE: con el `.catch()` afuera,
        // el rechazo igual viaja por la cola de `act` de React y jest lo reporta como fallo del test.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cuerpo]);

  const color = (rol: RolTaza): string =>
    rol === 'acento' ? tema.color.acento : rol === 'lienzo' ? tema.color.fondo : tema.color.texto;

  return (
    <View style={styles.raiz} testID={testID}>
      {ilustracion && (
        <Svg width={168} height={168} viewBox={VIEWBOX_TAZA} testID={testID ? `${testID}-taza` : undefined}>
          {TAZA.map((el, i) =>
            el.tipo === 'path' ? (
              <Path key={i} d={el.d} fill={color(el.rol)} />
            ) : (
              <Ellipse key={i} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={color(el.rol)} />
            ),
          )}
        </Svg>
      )}

      <Text
        testID={testID ? `${testID}-titulo` : undefined}
        style={[styles.titulo, { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }]}
      >
        {titulo}
      </Text>

      {cuerpo != null && mostrarCuerpo && (
        <Text
          testID={testID ? `${testID}-cuerpo` : undefined}
          style={[styles.cuerpo, { color: tema.color.textoTenue, fontSize: tema.tipo.base }]}
        >
          {cuerpo}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 },
  titulo: { textAlign: 'center' },
  cuerpo: { textAlign: 'center', lineHeight: 22, maxWidth: 320 },
});
