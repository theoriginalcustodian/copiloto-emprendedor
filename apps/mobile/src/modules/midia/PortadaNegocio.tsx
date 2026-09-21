/**
 * `PortadaNegocio` — el bloque de arriba de Mi día: **cómo viene el negocio, en un vistazo**.
 *
 * Es lo que el mapa de pantallas llama la portada: *«La base. Portada del negocio y los avisos del
 * detector»*, con la nota *«el bloque negro es EL golpe de color de la pantalla»*. Mi día ya existía
 * en el código con las solapas, la lista de avisos y el calendario — le faltaba esto.
 *
 * **Por qué el trío va adentro del bloque y no como tres cards.** Entró, Salió y Por cobrar no son
 * tres datos sueltos: son la lectura del saldo. Sacarlos afuera los vuelve KPIs y el saldo pierde
 * el contexto que lo hace entendible.
 *
 * La fecha de corte y la variación contra el mes anterior (BL-J2/BL-J3, K-03) las calcula el BACKEND;
 * acá sólo se dibujan, y cada una se omite entera si no vino (nunca «0%» ni «—»).
 *
 * ⚠️ **Una cosa del prototipo NO está, y no se fabrica:** la línea que admite estar incompleto
 * («faltan los cobros de hoy — Mercado Pago está caído»). Necesita una señal de salud por conexión
 * (K-09 / BL-J4). Regla dura del repo: el dato que falta se DICE, no se disfraza de cero.
 */
import { chipDeCaja, formatearImporte, type Portada } from '@copiloto/core';
import { StyleSheet, Text, View } from 'react-native';

import { BloqueCifra } from '../../theme/BloqueCifra';
import { useTema } from '../../theme/ThemeProvider';

export interface PortadaNegocioProps {
  portada: Portada;
}

export function PortadaNegocio({ portada }: PortadaNegocioProps) {
  const tema = useTema();

  /** Un importe de la portada: «—» si no vino, NUNCA «$0». Mostrar cero cuando falta un dato es
   *  mentirle al usuario sobre su negocio — regla dura del repo, la misma que usa Inteligencia. */
  const importe = (v: string | null) => (v != null ? formatearImporte(v) : '—');

  return (
    <BloqueCifra testID="midia-portada" rotulo="En caja" cifra={importe(portada.caja.saldo)} chip={chipDeCaja(portada.caja) ?? undefined}>
      <View style={styles.trio}>
        {(
          [
            ['Entró', portada.mes.ingresos],
            ['Salió', portada.mes.gastos],
            ['Por cobrar', portada.porCobrar.total],
          ] as const
        ).map(([etiqueta, valor]) => (
          <View
            key={etiqueta}
            style={[styles.celda, { backgroundColor: tema.color.bloqueChip, borderRadius: tema.radio.sm }]}
            testID={`midia-portada-${etiqueta.toLowerCase().replace(' ', '-')}`}
          >
            <Text style={{ color: tema.color.bloqueApoyo, fontSize: tema.tipo.chico }}>{etiqueta}</Text>
            <Text
              style={{ color: tema.color.bloqueTexto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}
            >
              {importe(valor)}
            </Text>
          </View>
        ))}
      </View>
    </BloqueCifra>
  );
}

const styles = StyleSheet.create({
  trio: { flexDirection: 'row', gap: 8 },
  celda: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 12 },
});
