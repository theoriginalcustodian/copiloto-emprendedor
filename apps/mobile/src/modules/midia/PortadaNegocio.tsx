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
 * ⚠️ **Dos cosas del prototipo NO están, y no se fabrican:**
 *
 * 1. **El delta «−18% vs julio».** El contrato no trae la variación del saldo contra el mes
 *    anterior: `CajaPortada` es {saldo, moneda} y `serieMensual` sólo tiene ingresos/gastos por mes,
 *    no el saldo de caja. Se podría calcular algo parecido con esos dos, pero sería **otra cosa
 *    llamada igual** — y un porcentaje inventado sobre el dinero de alguien es exactamente el tipo
 *    de mentira que el sistema prohíbe.
 * 2. **La línea que admite estar incompleto** («faltan los cobros de hoy — Mercado Pago está
 *    caído»). Necesita una señal de salud por conexión que hoy no existe en ningún lado. Es la
 *    regla dura del repo: el dato que falta se DICE, no se disfraza de cero. Mientras no exista la
 *    señal, la portada **no puede saber** que está incompleta — y callarlo es el default menos malo
 *    sólo porque la alternativa es avisar siempre, que es ruido.
 *
 * Las dos son pedidos a backend, anotados en la spec `mobile-coherencia.md` Parte 2.
 */
import { formatearImporte, type Portada } from '@copiloto/core';
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
    <BloqueCifra testID="midia-portada" rotulo="En caja" cifra={importe(portada.caja.saldo)}>
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
