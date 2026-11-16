import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import {
  estadoFacturacionCliente,
  facturacionDeCliente,
  subtituloDeCliente,
  textoMontoCliente,
  type Cliente,
} from '@copiloto/core';

import { Glifo } from '../../theme/glass/Glifo';
import { conAlfa } from '../../theme/glass/conAlfa';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaCliente` — una fila de la cartera. Rediseño (Martin 15/11): casilla arena con las iniciales, nombre,
 * subtítulo, y a la derecha lo facturado en dos renglones (importe arriba, comprobantes abajo).
 *
 * 🔴 **El documento se muestra sólo si existe**, y nunca se inventa una etiqueta para su ausencia.
 * Un cliente sin documento es el caso NORMAL de esta cartera —se derivó de un presupuesto, donde el
 * documento es opcional—, así que un "sin CUIT" en rojo marcaría como incompleta a la mitad de las
 * fichas. Lo que falta se ve porque no está, no porque se lo señale. (Una excepción MEDIDA, C-D1: la columna
 * del monto —que sin documento no puede atribuir facturas— dice «Sin CUIT cargado» en tono tenue, porque ahí
 * un «—» sin explicación se leería como «no compró». El subtítulo sigue sin marcar nada.)
 *
 * 🔴 **El subtítulo cae al PRIMER dato que identifique**: documento, teléfono, mail, domicilio o notas. No
 * es adorno — desde que existe `forzar` (el alta de un homónimo legítimo), la cartera puede tener dos
 * clientes con el mismo nombre, y sin esto quedan **dos filas idénticas**: el emprendedor no puede
 * elegir a cuál facturarle. Se muestra uno solo, el más identificatorio disponible, para no convertir
 * la lista en una ficha.
 *
 * ⚠️ **Y no alcanza solo.** Dos homónimos recién creados a mano pueden no tener ningún dato: eso se
 * ataja en el ALTA, avisando antes de forzar (ver `FormularioCliente`), que es el único momento en que
 * alguien sabe en qué se diferencian.
 *
 * 🔴 **La columna derecha dice lo que el listado MIDIÓ, con la regla del core** (`textoMontoCliente` +
 * `estadoFacturacionCliente`, las mismas que usa la web — no se reimplementan acá). Con el par
 * `monto_facturado` + `facturas_atribuibles`: «$importe · N comprobantes»; con `facturas_atribuibles: false`
 * «—» y «Sin CUIT cargado» (NUNCA un número: el `"0.00"` ahí es «no se puede saber», y pintarlo como
 * «Todavía sin comprar» afirmaría lo que no se midió). Si el backend no declaró el par, cae al conteo de
 * comprobantes y, sin él, a «—»: nunca un cero inventado. (Hasta el 2026-10-13 esta tarjeta NO pintaba el
 * monto y el cierre #1079 lo atribuía a «una decisión documentada en su docstring»: **no estaba escrita acá**.
 * Esto cierra esa deuda pintándolo, no enmendándola.)
 *
 * 🔴 **El subtítulo trae la condición IVA con documento** («CUIT 20-12345678-9 · Resp. Inscripto», el formato
 * del prototipo `index.html:2213`) y, sin documento, cae al primer dato identificatorio: es
 * `subtituloDeCliente`, del core, la misma regla que la web.
 *
 * 🔴 **«Se agregó solo» tampoco se pinta en la columna derecha** (el prototipo lo muestra como chip
 * `.estado.auto`): es la misma decisión de abajo aplicada al chip — ver la nota sobre `origen`.
 *
 * 🔴 **`origen: 'derivado'` no se marca.** Es el default de una cartera que se armó sola; etiquetar
 * el caso mayoritario es ruido. Se marca lo que el emprendedor cargó a mano, que es la excepción y
 * además es el dato con el que vamos a saber si la cartera se armó sola o la cargaron.
 */

export interface TarjetaClienteProps {
  cliente: Cliente;
  onPress?: (cliente: Cliente) => void;
  /** Línea arriba: todas las filas menos la primera. Las filas van juntas en una tarjeta que pone la pantalla. */
  conDivisor?: boolean;
}

export function TarjetaCliente({ cliente, onPress, conDivisor = false }: TarjetaClienteProps) {
  const tema = useTema();
  // El subtítulo y el slot de facturación son reglas del CORE (una sola para web y mobile).
  const subtitulo = subtituloDeCliente(cliente);
  const montoTexto = textoMontoCliente(cliente);
  // 📝 «Se agregó solo» NO se pinta (enmienda de la divergencia 1 de `clientes`, con motivo): el derivado es
  // el DEFAULT de la cartera y etiquetar el caso mayoritario es ruido; lo cuenta el BloqueCifra («N se
  // agregaron solos este mes», `PantallaClientes`). Se pasa `esAuto = true` y se descarta el chip `auto`:
  // así sólo sobreviven los estados MEDIDOS («Sin CUIT cargado», «Todavía sin comprar») y un listado sin el
  // par declarado NO cae a un «Todavía sin comprar» deducido.
  const medido = estadoFacturacionCliente(facturacionDeCliente(cliente), true);
  const estado = medido != null && !medido.auto ? medido : null;

  // «$importe · N comprobantes» viene armado del core; acá sólo se reparte en dos renglones.
  const corte = montoTexto.indexOf(' · ');
  const importe = corte >= 0 ? montoTexto.slice(0, corte) : montoTexto;
  const comprobantes = corte >= 0 ? montoTexto.slice(corte + 3) : null;
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };
  const t = tema.color.tileFuncion;

  const fila = (
    <>
      {/* La inicial en la casilla arena: en una lista de nombres es lo que el ojo usa para ubicarse. */}
      <View accessible={false} style={[styles.casilla, { backgroundColor: t.arena }]}>
        <Text style={{ color: t.tinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.base }}>
          {inicialesDe(cliente.nombre)}
        </Text>
      </View>
      <View style={styles.izquierda}>
        <View style={styles.nombre}>
          <Text
            numberOfLines={1}
            style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21, flexShrink: 1 }}
            testID={`cliente-${cliente.id}-nombre`}
          >
            {cliente.nombre}
          </Text>
          {cliente.origen !== 'derivado' && (
            <View testID={`cliente-${cliente.id}-origen`} accessible accessibilityLabel={cliente.origen === 'voz' ? 'Cargado por voz' : 'Cargado a mano'}>
              <Glifo nombre={cliente.origen === 'voz' ? 'microphone' : 'pen'} size={13} color={tema.color.textoTenue} decorativo />
            </View>
          )}
        </View>
        {subtitulo != null && (
          <Text numberOfLines={1} style={tenue} testID={`cliente-${cliente.id}-sub`}>
            {subtitulo}
          </Text>
        )}
      </View>
      <View style={styles.derecha}>
        <Text
          numberOfLines={1}
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}
          testID={`cliente-${cliente.id}-monto`}
        >
          {importe}
        </Text>
        {comprobantes != null && (
          <Text numberOfLines={1} style={tenue} testID={`cliente-${cliente.id}-comprobantes`}>
            {comprobantes}
          </Text>
        )}
        {estado != null && (
          <Text numberOfLines={1} style={tenue} testID={`cliente-${cliente.id}-estado`}>
            {estado.texto}
          </Text>
        )}
      </View>
    </>
  );

  const estilo = [styles.fila, conDivisor && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }];
  if (onPress == null) {
    return (
      <View testID={`cliente-${cliente.id}`} style={estilo}>
        {fila}
      </View>
    );
  }
  return (
    <Pressable
      testID={`cliente-${cliente.id}`}
      onPress={() => onPress(cliente)}
      accessibilityRole="button"
      accessibilityLabel={`Ver la ficha de ${cliente.nombre}`}
      style={pressableStyle(estilo)}
    >
      {fila}
    </Pressable>
  );
}

/** Hasta dos iniciales: la primera palabra y la última («Tomás Ledesma» → «TL», «Panadería La Espiga» → «PE»). */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter((x) => x !== '');
  if (palabras.length === 0) return '';
  const primera = palabras[0]!.slice(0, 1);
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1]!.slice(0, 1) : '';
  return (primera + ultima).toUpperCase();
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  casilla: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  izquierda: { flex: 1, gap: 2 },
  nombre: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  derecha: { alignItems: 'flex-end', gap: 2, maxWidth: '45%' },
});
