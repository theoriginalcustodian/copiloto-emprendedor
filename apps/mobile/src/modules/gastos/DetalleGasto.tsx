import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ETIQUETA_CATEGORIA,
  formatearImporte,
  obtenerGasto,
  type Gasto,
} from '@copiloto/core';

import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `DetalleGasto` — un gasto completo, con lo que la card de la lista no muestra.
 *
 * 🔴 **Se monta FUERA del scroll de la lista.** Un overlay `position:absolute` montado dentro del área
 * scrolleable se posiciona contra el CONTENIDO del scroll —que con veinte cards mide miles de
 * píxeles— y queda centrado lejísimos de lo que el usuario está viendo: se monta, existe, responde, y
 * está fuera de cuadro. Verificado en device el 2026-07-21 con el detalle de comprobantes.
 *
 * 🔴 **Se RE-PIDE por id aunque la lista ya tenga el objeto.** El listado puede estar viejo —el
 * copiloto pudo registrar algo por voz mientras la pantalla estaba abierta—, y un detalle es
 * justamente donde uno va a mirar el número con atención. Pintar el objeto de la lista mostraría un
 * dato de hace rato con cara de recién traído.
 *
 * 🔴 **Sin editar ni borrar, y es decisión escrita del contrato (§12), no un olvido.** Un gasto se
 * corrige **antes** de guardarlo, en la card editable de la voz. No hay `PATCH` ni `DELETE` en Fase 1,
 * así que esta pantalla no promete acciones que el backend no tiene.
 */

type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

/** Cómo se dice de dónde vino, cuando no fue tipeado a mano. */
const ETIQUETA_ORIGEN: Record<string, string> = {
  voz: 'Lo dictaste',
  foto: 'Salió de una foto',
};

export interface DetalleGastoProps {
  /** El de la lista — se usa para pintar de entrada mientras llega el fresco. */
  gasto: Gasto;
  onCerrar: () => void;
}

function Dato({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID: string }) {
  const tema = useTema();
  return (
    <View style={styles.filaDato} testID={testID}>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, flex: 1 }}>{etiqueta}</Text>
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}>{valor}</Text>
    </View>
  );
}

export function DetalleGasto({ gasto, onCerrar }: DetalleGastoProps) {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [fresco, setFresco] = useState<Gasto | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerGasto(gasto.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') {
          setFresco(res.gasto);
          setEstado('ok');
          return;
        }
        setEstado(res.status === 'no_encontrado' ? 'no_encontrado' : 'no_disponible');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [gasto.id]);

  // Mientras llega el fresco se muestra el de la lista: es el mismo gasto y evita un salto en blanco.
  // Cuando llega, gana el del servidor.
  const g = fresco ?? gasto;
  const origen = ETIQUETA_ORIGEN[g.origen];

  return (
    <View style={[styles.overlay, { backgroundColor: tema.color.fondo + 'F2' }]} testID="detalle-gasto">
      <ScrollFormulario
        testID="detalle-gasto-scroll"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 80 }}
      >
        <Text
          style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontWeight: '700' }}
          testID="detalle-gasto-monto"
        >
          {formatearImporte(g.monto)}
        </Text>

        {estado === 'cargando' && <ActivityIndicator testID="detalle-gasto-cargando" color={tema.color.acento} />}

        {estado === 'no_encontrado' && (
          <Text testID="detalle-gasto-no-encontrado" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            No encontramos ese gasto.
          </Text>
        )}

        {estado === 'no_disponible' && (
          <Text testID="detalle-gasto-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            El detalle todavía no está disponible en tu copiloto.
          </Text>
        )}

        {estado === 'error' && (
          <Text testID="detalle-gasto-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar el detalle.
          </Text>
        )}

        <View style={{ gap: tema.espacio.sm }}>
          <Dato etiqueta="Categoría" valor={ETIQUETA_CATEGORIA[g.categoria]} testID="detalle-gasto-categoria" />
          <Dato etiqueta="Fecha" valor={g.fecha} testID="detalle-gasto-fecha" />
          {g.proveedor != null && (
            <Dato etiqueta="Proveedor" valor={g.proveedor} testID="detalle-gasto-proveedor" />
          )}
          {g.medioPago != null && (
            <Dato etiqueta="Cómo lo pagaste" valor={g.medioPago} testID="detalle-gasto-medio-pago" />
          )}
          {origen != null && <Dato etiqueta="Origen" valor={origen} testID="detalle-gasto-origen" />}
        </View>

        {/* Lo que dictó, textual. Es el registro de lo que dijo antes de corregir, así que un monto
            editado en la card queda contrastable contra su dictado — sin esto, la corrección humana
            deja de ser auditable. */}
        {g.descripcion != null && g.descripcion !== '' && (
          <Text
            testID="detalle-gasto-descripcion"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontStyle: 'italic' }}
          >
            «{g.descripcion}»
          </Text>
        )}

        {/* Sólo si el OCR sugirió algo: permite ver de un vistazo si el emprendedor lo corrigió. */}
        {g.montoSugerido != null && (
          <Text
            testID="detalle-gasto-monto-sugerido"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          >
            Del ticket leímos: {formatearImporte(g.montoSugerido)}
          </Text>
        )}

        <FilaBotones
          testID="detalle-gasto-acciones"
          botones={[{ etiqueta: 'Cerrar', onPress: onCerrar, testID: 'detalle-gasto-cerrar' }]}
        />
      </ScrollFormulario>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  filaDato: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
