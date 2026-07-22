import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatearImporte,
  obtenerCliente,
  type Cliente,
  type FichaCliente as Ficha,
  type OperacionCliente,
} from '@copiloto/core';

import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `FichaCliente` — el overlay con los datos del cliente y **qué compró**.
 *
 * 🔴 **Se monta FUERA del scroll de la lista**, como el detalle de presupuestos. Un overlay
 * `position:absolute` montado dentro del área scrolleable se posiciona contra el CONTENIDO del
 * scroll —que con veinte cards mide miles de píxeles— y queda centrado lejísimos de lo que el usuario
 * está viendo: se monta, existe, responde, y está fuera de cuadro. Verificado en device el
 * 2026-07-21 con el detalle de comprobantes.
 *
 * 🔴 **Las secciones vacías se dicen, no se esconden.** `presupuestos: []` y `facturas: []` llegan
 * vacías hasta el hito 3 del backend; ocultar la sección haría que la ficha se vea "completa" y que
 * el emprendedor concluya que nunca le compró nada. Un "todavía no vemos operaciones" es feo y
 * cierto; una sección ausente es prolija y mentirosa.
 *

 * 🔴 **El overlay tapa la barra de estado si no se le suma el inset.** `absoluteFill` cubre la
 * pantalla ENTERA —reloj y batería incluidos—, a diferencia de una pantalla normal, donde el hueco
 * de arriba lo pone `MarcoGlass` con `insets.top`. Un overlay se monta por fuera de ese marco, así
 * que hereda el borde de la pantalla, no el del contenido.
 *
 * Visto en device el 2026-07-22: el nombre del cliente se superponía con el reloj. Afecta a los
 * overlays que arrancan pegados arriba (éste y el detalle del gasto), NO a los que centran su
 * contenido con un scrim, como el del comprobante — por eso el bug aparecía en unos y no en otros, y
 * parecía cosa de una pantalla.
 *
 * 🔴 **La ficha se pide SIEMPRE al abrir**, aunque el listado ya traiga el cliente: el listado no
 * trae el historial, y reusar el objeto de la lista dejaría una ficha sin operaciones que se ve
 * idéntica a una con cero.
 */

type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

export interface FichaClienteProps {
  cliente: Cliente;
  onCerrar: () => void;
  /**
   * Editar desde acá, con los datos FRESCOS de la ficha y no con los del listado.
   *
   * 🔴 El listado puede estar viejo, y editar sobre él haría que el diff parcial calcule los cambios
   * contra un original desactualizado: un campo que otro dispositivo ya cambió se "revertiría" sin
   * que nadie lo pidiera, porque para este formulario sería un cambio legítimo del usuario.
   */
  onEditar?: (cliente: Cliente) => void;
}

function Seccion({ titulo, items, testID }: { titulo: string; items: OperacionCliente[]; testID: string }) {
  const tema = useTema();
  return (
    <View style={{ gap: tema.espacio.sm }} testID={testID}>
      <Text style={{ color: tema.color.acento, fontSize: tema.tipo.chico, fontWeight: '700' }}>
        {titulo.toUpperCase()}
      </Text>
      {items.length === 0 ? (
        <Text
          testID={`${testID}-vacio`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Todavía no vemos operaciones acá.
        </Text>
      ) : (
        items.map((o) => (
          <View key={o.id} style={styles.filaOperacion} testID={`${testID}-${o.id}`}>
            <Text numberOfLines={1} style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flex: 1 }}>
              {o.detalle}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {formatearImporte(o.total)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export function FichaCliente({ cliente, onCerrar, onEditar }: FichaClienteProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerCliente(cliente.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') {
          setFicha(res.ficha);
          setEstado('ok');
          return;
        }
        setEstado(res.status === 'no_encontrado' ? 'no_encontrado' : 'no_disponible');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [cliente.id]);

  const datos = ficha?.cliente ?? cliente;

  return (
    <View style={[styles.overlay, { backgroundColor: tema.color.fondo + 'F2' }]} testID="ficha-cliente">
      <ScrollFormulario
        testID="ficha-cliente-scroll"
        contentContainerStyle={{
          padding: tema.espacio.md,
          gap: tema.espacio.md,
          paddingBottom: 80,
          // Ver el comentario de `overlay` abajo: el inset lo pone el overlay, no el marco.
          paddingTop: tema.espacio.md + insets.top,
        }}
      >
        <Text
          style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontWeight: '700' }}
          testID="ficha-cliente-nombre"
        >
          {datos.nombre}
        </Text>

        {estado === 'cargando' && <ActivityIndicator testID="ficha-cliente-cargando" color={tema.color.acento} />}

        {estado === 'no_encontrado' && (
          <Text testID="ficha-cliente-no-encontrado" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            No encontramos ese cliente.
          </Text>
        )}

        {estado === 'no_disponible' && (
          <Text testID="ficha-cliente-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            La ficha todavía no está disponible en tu copiloto.
          </Text>
        )}

        {estado === 'error' && (
          <Text testID="ficha-cliente-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar la ficha.
          </Text>
        )}

        {estado === 'ok' && ficha != null && (
          <>
            {(datos.docNro != null || datos.domicilio != null || datos.contacto != null) && (
              <View style={{ gap: 2 }} testID="ficha-cliente-datos">
                {datos.docNro != null && (
                  <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                    {datos.docTipo === 80 ? 'CUIT' : datos.docTipo === 96 ? 'DNI' : 'Doc'} {datos.docNro}
                  </Text>
                )}
                {datos.domicilio != null && (
                  <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{datos.domicilio}</Text>
                )}
                {datos.contacto != null && (
                  <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{datos.contacto}</Text>
                )}
              </View>
            )}

            {datos.notas != null && datos.notas !== '' && (
              <Text testID="ficha-cliente-notas" style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}>
                {datos.notas}
              </Text>
            )}

            <Seccion titulo="Presupuestos" items={ficha.presupuestos} testID="ficha-presupuestos" />
            <Seccion titulo="Facturas" items={ficha.facturas} testID="ficha-facturas" />
          </>
        )}

        <FilaBotones
          testID="ficha-cliente-acciones"
          botones={[
            // Editar sólo cuando la ficha CARGÓ: con `datos` cayendo al cliente del listado, el diff
            // parcial se calcularía contra un original incompleto.
            ...(onEditar != null && estado === 'ok'
              ? [
                  {
                    etiqueta: 'Editar',
                    onPress: () => onEditar(datos),
                    variante: 'primario' as const,
                    testID: 'ficha-cliente-editar',
                  },
                ]
              : []),
            { etiqueta: 'Cerrar', onPress: onCerrar, testID: 'ficha-cliente-cerrar' },
          ]}
        />
      </ScrollFormulario>
    </View>
  );
}

const styles = StyleSheet.create({
  // `absoluteFill` (el registrado), no `absoluteFillObject`: es el idiom del repo y el único que
  // existe en los tipos de esta versión de RN — ver `DetallePresupuesto.tsx:343`.
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  filaOperacion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
