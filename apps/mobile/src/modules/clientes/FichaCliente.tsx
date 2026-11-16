import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  facturacionDeCliente,
  formatearFechaCorta,
  formatearImporte,
  obtenerCliente,
  textoComprobantes,
  type Cliente,
  type FichaCliente as Ficha,
  type OperacionCliente,
} from '@copiloto/core';

import { BloqueCifra, elevacion } from '../../theme/BloqueCifra';
import { Glifo } from '../../theme/glass/Glifo';
import { ScrollFormulario } from '../../theme/glass/campos';
import { conAlfa } from '../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { inicialesDe } from './TarjetaCliente';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `FichaCliente` — el overlay con los datos del cliente y **qué compró**. Rediseño (Martin 15/11), mismo molde
 * que el detalle de un presupuesto: «← Clientes» y «Editar» arriba, el nombre en grande con sus iniciales, los
 * datos en una tarjeta de pares rótulo–valor, y cada historial con su rótulo y su tarjeta de filas.
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `2026-03-14T…` → «marzo de 2026». Sin fecha legible, nada. */
function mesDeAlta(iso: string | null | undefined): string | null {
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${mes} de ${m[1]}` : null;
}

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

type Movimiento = OperacionCliente & { tipo: 'presupuesto' | 'factura' };

/**
 * El `detalle` suele venir «Factura C 0001-00000044 · Urgencia por cortocircuito»: número y concepto en una
 * línea, que en el celular se corta justo donde empieza lo que importa. Se parte en el primer « · »: el
 * concepto va de título y el número baja al pie, junto a la fecha. Sin « · », el detalle entero es el título.
 */
function partes(m: Movimiento): { titulo: string; pie: string } {
  const fecha = m.fecha !== '' ? formatearFechaCorta(m.fecha) : null;
  const corte = m.detalle.indexOf(' · ');
  const numero = corte > 0 ? m.detalle.slice(0, corte) : m.tipo === 'factura' ? 'Factura' : 'Presupuesto';
  const titulo = corte > 0 ? m.detalle.slice(corte + 3) : m.detalle;
  // La fecha primero: si el pie no entra, lo que se corta es el final del número, no el día.
  return { titulo, pie: fecha != null ? `${fecha} · ${numero}` : numero };
}

/**
 * El historial con el cliente, en UNA lista ordenada por fecha (Martin 15/11). Antes eran dos secciones —
 * «Presupuestos» y «Facturas»— y la que no tenía nada mostraba su propio cartel de vacío: en un cliente con una
 * sola factura, media ficha era un aviso de que no había presupuestos. Cada renglón dice qué es con su ícono.
 */
function Historial({ presupuestos, facturas }: { presupuestos: OperacionCliente[]; facturas: OperacionCliente[] }) {
  const tema = useTema();
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };
  const movimientos: Movimiento[] = [
    ...presupuestos.map((o) => ({ ...o, tipo: 'presupuesto' as const })),
    ...facturas.map((o) => ({ ...o, tipo: 'factura' as const })),
    // Fechas ISO: el orden alfabético es el cronológico. Lo más nuevo arriba.
  ].sort((x, y) => y.fecha.localeCompare(x.fecha));

  return (
    <View style={styles.seccion} testID="ficha-historial">
      <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
        Historial
      </Text>
      {movimientos.length === 0 ? (
        <Text testID="ficha-historial-vacio" style={[tenue, { fontSize: tema.tipo.base, lineHeight: 22 }]}>
          Todavía no le hiciste presupuestos ni facturas.
        </Text>
      ) : (
        <View style={[styles.tarjetaFilas, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
          {movimientos.map((m, i) => (
            <View key={`${m.tipo}-${m.id}`} testID={`ficha-${m.tipo === 'factura' ? 'facturas' : 'presupuestos'}-${m.id}`} style={styles.movimiento}>
              <View accessible={false} style={[styles.casillaChica, { backgroundColor: tema.color.tileFuncion.arena }]}>
                <Glifo nombre={m.tipo === 'factura' ? 'receipt' : 'file-text'} size={20} color={tema.color.tileFuncion.tinta} decorativo />
              </View>
              <View style={[styles.movimientoCuerpo, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}>
                <View style={styles.textos}>
                  <Text numberOfLines={2} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}>
                    {partes(m).titulo}
                  </Text>
                  <Text numberOfLines={1} style={tenue}>
                    {partes(m).pie}
                  </Text>
                </View>
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}>
                  {formatearImporte(m.total)}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
  const facturacion = facturacionDeCliente(cliente);
  const desde = mesDeAlta(datos.creadoEn);

  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };
  const linea = conAlfa(tema.color.texto, 0.12);
  const pares: { rotulo: string; valor: string }[] = [];
  if (datos.docNro != null) {
    pares.push({ rotulo: datos.docTipo === 80 ? 'CUIT' : datos.docTipo === 96 ? 'DNI' : 'Documento', valor: datos.docNro });
  }
  if (datos.telefono != null) pares.push({ rotulo: 'Teléfono', valor: datos.telefono });
  if (datos.email != null) pares.push({ rotulo: 'Mail', valor: datos.email });
  if (datos.domicilio != null) pares.push({ rotulo: 'Domicilio', valor: datos.domicilio });

  return (
    <View style={[styles.overlay, { backgroundColor: tema.color.fondo }]} testID="ficha-cliente">
      {/* Ver el comentario de `overlay` abajo: el inset lo pone el overlay, no el marco. */}
      <View testID="ficha-cliente-acciones" style={[styles.barra, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="ficha-cliente-cerrar"
          onPress={onCerrar}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver a Clientes"
          style={pressableStyle(styles.volver, PRESS_FADE)}
        >
          <Glifo nombre="arrow-left" size={20} color={tema.color.acentoTinta} decorativo />
          <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>Clientes</Text>
        </Pressable>
        {/* Editar sólo cuando la ficha CARGÓ: con `datos` cayendo al cliente del listado, el diff
            parcial se calcularía contra un original incompleto. */}
        {onEditar != null && estado === 'ok' && (
          <Pressable
            testID="ficha-cliente-editar"
            onPress={() => onEditar(datos)}
            hitSlop={12}
            accessibilityRole="button"
            style={pressableStyle(undefined, PRESS_FADE)}
          >
            <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>Editar</Text>
          </Pressable>
        )}
      </View>
      <ScrollFormulario
        testID="ficha-cliente-scroll"
        contentContainerStyle={{ paddingHorizontal: tema.espacio.md, paddingTop: 8, gap: 24, paddingBottom: 80 }}
      >
        <View style={styles.cabecera}>
          <View accessible={false} style={[styles.casilla, { backgroundColor: tema.color.tileFuncion.arena }]}>
            <Text style={{ color: tema.color.tileFuncion.tinta, fontFamily: tema.fuente.display, fontSize: 20 }}>
              {inicialesDe(datos.nombre)}
            </Text>
          </View>
          <View style={styles.textos}>
            <Text
              style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 26, lineHeight: 31 }}
              testID="ficha-cliente-nombre"
            >
              {datos.nombre}
            </Text>
            {desde != null && (
              <Text testID="ficha-cliente-desde" style={tenue}>
                Cliente desde {desde}
              </Text>
            )}
          </View>
        </View>

        {/* Lo que le facturaste: la cifra de la ficha. Sale del LISTADO (`cliente`), que es el único que trae el
            par declarado por el backend; si no vino —se llegó por otro camino— el bloque no se dibuja. */}
        {(facturacion.tipo === 'con_monto' || facturacion.tipo === 'sin_compras') && (
          <BloqueCifra
            testID="ficha-cliente-facturado"
            rotulo="Le facturaste"
            cifra={facturacion.importe}
            chip={cliente.comprobantesCantidad != null ? textoComprobantes(cliente.comprobantesCantidad) : undefined}
          />
        )}

        {/* Contacto directo: lo que más se hace desde la ficha de un cliente es llamarlo o escribirle. */}
        {(datos.telefono != null || datos.email != null) && (
          <View style={styles.contacto} testID="ficha-cliente-contacto">
            {datos.telefono != null && (
              <Pressable
                testID="ficha-cliente-llamar"
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${datos.nombre}`}
                onPress={() => void Linking.openURL(`tel:${datos.telefono?.replace(/[^0-9+]/g, '')}`).catch(() => {})}
                style={pressableStyle([styles.botonContacto, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }], PRESS_FADE)}
              >
                <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>Llamar</Text>
              </Pressable>
            )}
            {datos.email != null && (
              <Pressable
                testID="ficha-cliente-mail"
                accessibilityRole="button"
                accessibilityLabel={`Escribirle un mail a ${datos.nombre}`}
                onPress={() => void Linking.openURL(`mailto:${datos.email}`).catch(() => {})}
                style={pressableStyle([styles.botonContacto, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }], PRESS_FADE)}
              >
                <Glifo nombre="envelope-simple" size={18} color={tema.color.acentoTinta} decorativo />
                <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>Mandar mail</Text>
              </Pressable>
            )}
          </View>
        )}

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
            {pares.length > 0 && (
              <View style={styles.seccion}>
              <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
                Sus datos
              </Text>
              <View
                testID="ficha-cliente-datos"
                style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}
              >
                {pares.map((par, i) => (
                  <View key={par.rotulo} style={[styles.fila, i > 0 && { borderTopWidth: 1, borderTopColor: linea }]}>
                    <Text style={tenue}>{par.rotulo}</Text>
                    <Text
                      selectable
                      // Un mail largo no se parte ni se sale de la tarjeta: se achica hasta entrar.
                      numberOfLines={par.rotulo === 'Domicilio' ? 2 : 1}
                      adjustsFontSizeToFit={par.rotulo !== 'Domicilio'}
                      minimumFontScale={0.7}
                      ellipsizeMode="middle"
                      style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 21, flex: 1, minWidth: 0, textAlign: 'right' }}
                    >
                      {par.valor}
                    </Text>
                  </View>
                ))}
              </View>
              </View>
            )}

            {datos.notas != null && datos.notas !== '' && (
              <View style={styles.seccion}>
                <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
                  Notas
                </Text>
                <View style={[styles.tarjeta, styles.notas, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
                  <Text testID="ficha-cliente-notas" selectable style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 22 }}>
                    {datos.notas}
                  </Text>
                </View>
              </View>
            )}

            <Historial presupuestos={ficha.presupuestos} facturas={ficha.facturas} />
          </>
        )}
      </ScrollFormulario>
    </View>
  );
}

const styles = StyleSheet.create({
  // `absoluteFill` (el registrado), no `absoluteFillObject`: es el idiom del repo y el único que
  // existe en los tipos de esta versión de RN — ver `DetallePresupuesto.tsx:343`.
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  barra: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  casilla: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  seccion: { gap: 10 },
  textos: { flex: 1, gap: 2 },
  contacto: { flexDirection: 'row', gap: 12 },
  botonContacto: { flex: 1, minHeight: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  notas: { paddingVertical: 16 },
  tarjetaFilas: { borderRadius: 22, paddingLeft: 16 },
  movimiento: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  casillaChica: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movimientoCuerpo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, paddingRight: 16 },
  tarjeta: { borderRadius: 22, paddingHorizontal: 20 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
});
