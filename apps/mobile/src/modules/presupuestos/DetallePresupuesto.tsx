/**
 * `DetallePresupuesto` — lo que se abre al tocar un presupuesto. Rediseño (Martin 15/11): pantalla completa con
 * scroll. Arriba quién y qué; una tarjeta con el total, el estado y los ítems; las acciones de cada tanto en una
 * tarjeta de filas; y abajo la hoja, el presupuesto como documento. Las dos acciones que importan quedan fijas al
 * pie: «Enviar al cliente» (la única llena) y «Facturar».
 *
 * Clonado del patrón de `facturacion/DetalleComprobante.tsx`, que ya pagó los errores de esta forma:
 *
 * 🔴 **Es un overlay LOCAL, no una ruta.** El bug más caro de esta cáscara fue apilar dos glass y
 * dejar la app muerta al toque (ver `navegacion/empujarUnaVez.ts`). Acá ya estamos DENTRO de una
 * función: el detalle de una fila no es un destino, es un acercamiento. Un overlay no toca el stack.
 *
 * 🔴 **El vidrio va DETRÁS con `absoluteFill`, no envolviendo al contenido.** `CristalVidrio` tiene
 * `flex: 1` en su capa interna, y dentro de un padre de altura automática eso colapsa a 1px — visto
 * en device el 2026-07-21. Con el vidrio de fondo, el contenido manda la altura.
 *
 * 🔴 **Sí pide datos, y ahí se aparta del molde.** A diferencia del detalle de un comprobante, el del
 * presupuesto necesita los `items`, que **el listado no trae** (los omite a propósito). Por eso hay
 * un estado de carga: mostrar el detalle sin ítems sería mostrar un presupuesto sin lo presupuestado.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  cambiarEstadoPresupuesto,
  facturarPresupuesto,
  formatearFechaLarga,
  formatearImporte,
  mailtoMandarPresupuesto,
  obtenerPresupuesto,
  type EstadoPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import { elevacion } from '../../theme/BloqueCifra';
import { compartirLink } from '../../util/abrirYCompartir';
import { AVISO_CONECTAR_GOOGLE, CLAVE_AVISO_CONECTAR_GOOGLE, useAvisoUnaVez } from '../../util/avisoUnaVez';
import { compartirPresupuesto } from './compartirPresupuesto';
import { useTema } from '../../theme/ThemeProvider';
import { Glifo } from '../../theme/glass/Glifo';
import { conAlfa } from '../../theme/glass/conAlfa';
import { useNombreComercial } from '../ajustes/negocio/useNombreComercial';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';

const ETIQUETA_DOC: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor final',
};

export interface DetallePresupuestoProps {
  /** El presupuesto de la card — sin `items`. El detalle completo se pide al montar. */
  presupuesto: Presupuesto;
  onCerrar: () => void;
  /** Lleva al gate de confirmación de factura con el borrador ya armado. */
  onFacturar: (facturaId: string) => void;
  /** El usuario quiere corregirlo: se abre el formulario en modo "reemplaza a este". */
  onCorregir: (presupuesto: Presupuesto) => void;
  /** Cambió el estado acá adentro. La lista de atrás lo usa para no quedar mostrando el anterior. */
  onEstadoCambiado?: (presupuesto: Presupuesto) => void;
  /**
   * K-07: el backend sugirió «Mandalo por mail» al guardar (sólo con Doc). Ofrece abrir el correo del
   * usuario con el link; NO envía nada. Ausente = sin sugerencia (abrir un presupuesto viejo).
   */
  sugerenciaMandarPorMail?: { docLink: string } | null;
  testID?: string;
}

type EstadoFacturar =
  | 'idle'
  | 'enviando'
  | 'ya_facturado'
  | 'falta_perfil'
  | 'estado_incompatible'
  | 'error'
  | 'no_disponible';

/**
 * Las **tres categorías**, tal como las nombra el emprendedor. No son cuatro: `sin_respuesta` es un
 * matiz de «pendiente» y se dice aparte.
 *
 * 🔴 **No se mezclan, y ésa es toda la razón de que exista este bloque.** Quien cuenta los no-marcados
 * como rechazos miente sobre su tasa de conversión — y una vez que el número miente, el emprendedor
 * deja de mirar la pantalla para siempre.
 */
const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: 'Todavía sin respuesta',
  aprobado: 'Te lo aprobaron',
  desestimado: 'No te lo tomaron',
};

export function DetallePresupuesto({
  presupuesto: inicial,
  onCerrar,
  onFacturar,
  onCorregir,
  onEstadoCambiado,
  sugerenciaMandarPorMail = null,
  testID = 'detalle-presupuesto',
}: DetallePresupuestoProps) {
  const tema = useTema();
  // Arranca con lo que la card ya tenía (todo menos los ítems) para que la hoja aparezca llena en
  // vez de en blanco, y se completa cuando llega el detalle. Sin esto habría un salto visual sobre
  // datos que ya estaban en memoria.
  const [p, setP] = useState<Presupuesto>(inicial);
  const avisarGoogle = useAvisoUnaVez(CLAVE_AVISO_CONECTAR_GOOGLE, p.docLink == null);
  const [cargandoItems, setCargandoItems] = useState(true);
  const [estadoFacturar, setEstadoFacturar] = useState<EstadoFacturar>('idle');
  const [facturaIdPrevia, setFacturaIdPrevia] = useState<string | null>(null);
  const [motivoEstado, setMotivoEstado] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await obtenerPresupuesto(inicial.id);
        if (!vivo) return;
        if (res.status === 'ok') setP(res.presupuesto);
        // `no_encontrado`/`no_disponible`: se deja lo que trajo la card. Es real —vino del listado—,
        // sólo que sin ítems; vaciar la hoja por no poder ampliarla sería perder información que sí
        // tenemos.
      } finally {
        if (vivo) setCargandoItems(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [inicial.id]);

  async function facturar() {
    setEstadoFacturar('enviando');
    try {
      const res = await facturarPresupuesto(p.id);
      switch (res.status) {
        case 'ok':
          // 🔴 No se marca nada como facturado acá: esto abrió un BORRADOR. `facturado` pasa a true
          // solo cuando la emisión se confirma en el gate, y la lista lo relee al volver.
          onFacturar(res.facturaId);
          return;
        case 'ya_facturado':
          setFacturaIdPrevia(res.facturaId);
          setEstadoFacturar('ya_facturado');
          return;
        case 'falta_perfil_fiscal':
          setEstadoFacturar('falta_perfil');
          return;
        case 'estado_incompatible':
          // El backend no revive un desestimado en silencio. Su explicación es mejor que cualquier
          // texto que escribamos acá: dice en qué estado está y qué hacer.
          setMotivoEstado(res.motivo);
          setEstadoFacturar('estado_incompatible');
          return;
        case 'no_encontrado':
        case 'no_disponible':
          setEstadoFacturar('no_disponible');
          return;
        default: {
          // 🔴 Guarda de exhaustividad. Sin esto, un `status` nuevo del cliente caía por el hueco del
          // `switch` y el botón quedaba en «Preparando…» PARA SIEMPRE — la app colgada sin ningún
          // error, que es como se ve un caso no contemplado. Justo lo que pasó al agregar el tercer
          // 409. Ahora no compila.
          const _exhaustivo: never = res;
          void _exhaustivo;
          setEstadoFacturar('error');
        }
      }
    } catch {
      setEstadoFacturar('error');
    }
  }

  /**
   * *«No me lo tomaron»* → `PATCH .../estado {desestimado}`.
   *
   * 🔴 **No hay botón para «me lo aprobaron», y es a propósito** (contrato §1): aprobado sale gratis de
   * *Facturar*, que es una acción que el emprendedor iba a hacer igual. Un estado que hay que acordarse
   * de marcar envejece hasta que miente; uno que cae de una acción real se sostiene solo.
   *
   * 🔴 **Y tampoco hay «volver a pendiente»**: volver a *«no sé»* borra el hecho de que alguien ya
   * respondió. El backend lo rechaza con 409 y acá directamente no se ofrece.
   */
  async function marcarDesestimado() {
    if (marcando) return;
    setMarcando(true);
    setMotivoEstado(null);
    try {
      const res = await cambiarEstadoPresupuesto(p.id, 'desestimado');
      if (res.status === 'ok') {
        // Se pisa con lo que devolvió el backend, no con un `{...p, estado:'desestimado'}` armado acá:
        // `sin_respuesta` y `estado_actualizado_en` los deriva él, y adivinarlos sería mostrar en
        // pantalla un estado que nadie confirmó.
        setP(res.presupuesto);
        onEstadoCambiado?.(res.presupuesto);
        return;
      }
      if (res.status === 'transicion_invalida') setMotivoEstado(res.motivo);
      else setMotivoEstado('No pudimos marcar el presupuesto. Probá de nuevo.');
    } catch {
      setMotivoEstado('No pudimos marcar el presupuesto. Probá de nuevo.');
    } finally {
      setMarcando(false);
    }
  }

  async function abrirDoc() {
    if (p.docLink == null) return;
    try {
      await Linking.openURL(p.docLink);
    } catch {
      // 🔴 El Doc vive en el Drive del USUARIO: lo puede borrar, mover o renombrar, y el link queda
      // apuntando a nada. Avisar en vez de dejar la pantalla muda — un botón que no hace nada se lee
      // como que la app se colgó.
      setEstadoFacturar('error');
    }
  }

  async function mandarPorMail() {
    if (sugerenciaMandarPorMail == null) return;
    try {
      await Linking.openURL(mailtoMandarPresupuesto({ numero: p.numero, contacto: p.receptor.contacto }, sugerenciaMandarPorMail.docLink));
    } catch {
      // Sin app de correo el `openURL` rechaza: el botón «Compartir» de al lado cubre ese caso.
    }
  }

  async function compartir() {
    if (p.docLink == null) return;
    // `Share.share` rechaza (link roto, hoja de compartir que la plataforma no puede abrir) y nadie
    // lo escuchaba: quedaba como unhandled rejection y el botón simplemente no hacía nada.
    await compartirLink(p.docLink, 'el presupuesto');
  }

  /**
   * 🔴 **Ya hay un borrador de factura sin emitir para este presupuesto.**
   *
   * Cuando pasa, el botón lleva al borrador que YA existe en vez de pedir otro — y no es un lujo de
   * UX: **medido contra el servicio vivo el 2026-07-21, un segundo `POST .../facturar` devuelve 200
   * con un `factura_id` NUEVO, no el 409 que el contrato declara.** O sea que cada toque crea otro
   * borrador, y el emprendedor puede terminar con dos borradores del mismo trabajo y emitir la misma
   * factura dos veces. Eso es plata, no un detalle.
   *
   * La defensa no depende del código de error —que no llega— sino del dato que ya está en la mano:
   * `facturaId != null && !facturado` significa exactamente "hay un borrador y nadie lo emitió".
   * Emitido `hallazgo_` al backend; esto vale igual si lo arregla, porque continuar el borrador
   * existente es lo correcto en los dos casos.
   */
  const hayBorradorPendiente = p.facturaId != null && !p.facturado;

  const insets = useSafeAreaInsets();
  const nombreComercial = useNombreComercial();
  const linea = conAlfa(tema.color.texto, 0.12);
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };
  const fechaLarga = formatearFechaLarga(p.fecha);
  const conCliente = p.receptor.nombre !== '';
  const documento =
    p.receptor.docTipo != null && p.receptor.docNro !== ''
      ? `${ETIQUETA_DOC[p.receptor.docTipo] ?? `Tipo ${p.receptor.docTipo}`} ${p.receptor.docNro}`
      : null;
  const contacto = p.receptor.contacto !== '' ? p.receptor.contacto : null;

  /** Con documento de Google sale su link; sin él, el presupuesto como texto. Las dos abren la hoja de compartir. */
  function enviarAlCliente() {
    if (p.docLink != null) void compartir();
    else void compartirPresupuesto(p);
  }

  // La segunda acción, al lado de «Enviar al cliente»: convertirlo en factura (o seguir la que ya se empezó).
  let segunda: { etiqueta: string; onPress: () => void; deshabilitado?: boolean; testID: string } | null = null;
  if (hayBorradorPendiente && p.facturaId != null) {
    const idBorrador = p.facturaId;
    segunda = { etiqueta: 'Continuar la factura', onPress: () => onFacturar(idBorrador), testID: `${testID}-continuar-factura` };
  } else if (!p.facturado && estadoFacturar !== 'ya_facturado') {
    segunda = {
      etiqueta: estadoFacturar === 'enviando' ? 'Preparando…' : 'Facturar',
      onPress: () => void facturar(),
      deshabilitado: estadoFacturar === 'enviando',
      testID: `${testID}-facturar`,
    };
  }

  // Lo demás va callado, en una tarjeta de filas: son cosas que se hacen cada tanto.
  const otras: { etiqueta: string; onPress: () => void; deshabilitado?: boolean; testID: string }[] = [];
  if (p.docLink != null && sugerenciaMandarPorMail != null) {
    otras.push({ etiqueta: 'Mandalo por mail', onPress: () => void mandarPorMail(), testID: `${testID}-mandar-por-mail` });
  }
  if (p.docLink != null) {
    // «Ver en Google Docs», no «Ver» a secas: manda al navegador, y un «Ver» pelado hace esperar que abra adentro.
    otras.push({ etiqueta: 'Ver en Google Docs', onPress: () => void abrirDoc(), testID: `${testID}-ver-doc` });
  }
  otras.push({ etiqueta: 'Corregir', onPress: () => onCorregir(p), testID: `${testID}-corregir` });
  if (p.estado !== 'desestimado') {
    otras.push({
      etiqueta: marcando ? 'Marcando…' : 'No me lo tomaron',
      onPress: () => void marcarDesestimado(),
      deshabilitado: marcando,
      testID: `${testID}-desestimar`,
    });
  }

  return (
    <View testID={`${testID}-scrim`} style={[styles.pantalla, { backgroundColor: tema.color.fondo }]}>
      <View testID={testID} style={styles.columna}>
        <View style={[styles.barra, { paddingTop: insets.top + 8 }]}>
          <Pressable
            testID={`${testID}-cerrar`}
            onPress={onCerrar}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver a Presupuestos"
            style={pressableStyle(styles.volver, PRESS_FADE)}
          >
            <Glifo nombre="arrow-left" size={20} color={tema.color.acentoTinta} decorativo />
            <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
              Presupuestos
            </Text>
          </Pressable>
        </View>

        <ScrollView
          testID={`${testID}-scroll`}
          contentContainerStyle={{ paddingHorizontal: tema.espacio.md, paddingTop: 8, paddingBottom: 32, gap: 24 }}
        >
          {/* Quién y qué, antes que cualquier dato: es lo que el emprendedor reconoce de un vistazo. */}
          <View style={styles.cabecera}>
            <Text style={tenue}>
              <Text testID={`${testID}-titulo`}>Presupuesto N° {p.numero}</Text>
              {fechaLarga !== '' && (
                <>
                  {' · '}
                  <Text testID={`${testID}-fecha`}>{fechaLarga}</Text>
                </>
              )}
            </Text>
            <Text
              testID={conCliente ? `${testID}-receptor` : `${testID}-concepto`}
              style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 28, lineHeight: 34 }}
            >
              {conCliente ? p.receptor.nombre : p.concepto}
            </Text>
            {conCliente && (
              <Text
                testID={`${testID}-concepto`}
                style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 22 }}
              >
                {p.concepto}
              </Text>
            )}
          </View>

          <View style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
            <View style={styles.filaTotal}>
              <View style={styles.total}>
                <Text style={tenue}>Total</Text>
                {/* 🔴 El total sale del backend TAL CUAL, sin recomputarlo desde los ítems. Recalcularlo acá
                    sería una segunda aritmética del dinero, con float, y el día que difiera del backend el
                    usuario vería un número distinto del que se va a facturar. */}
                <Text
                  testID={`${testID}-total`}
                  style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 30, lineHeight: 36 }}
                >
                  {formatearImporte(p.total)}
                </Text>
              </View>
              {/* 🔴 El estado se ve SIEMPRE, no sólo cuando alguien lo tocó. Un presupuesto sin marca es
                  «todavía sin respuesta», que es información. `null` es otra cosa: el backend no lo mandó,
                  y ahí no se inventa un «pendiente» que nadie declaró. */}
              {p.estado != null && (
                <View style={[styles.pastilla, { backgroundColor: conAlfa(tema.color.texto, 0.06) }]}>
                  {p.estado === 'aprobado' && <Glifo nombre="check" size={14} color={tema.color.exito} decorativo />}
                  <Text
                    testID={`${testID}-estado`}
                    style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
                  >
                    {ETIQUETA_ESTADO[p.estado]}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.bloque, { borderTopColor: linea }]}>
              {cargandoItems && p.items.length === 0 && (
                <ActivityIndicator testID={`${testID}-items-cargando`} color={tema.color.acento} />
              )}
              {p.items.map((item) => (
                <View key={item.orden} style={styles.filaItem} testID={`${testID}-item-${item.orden}`}>
                  <Text numberOfLines={2} style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 21, flex: 1 }}>
                    {item.descripcion}
                  </Text>
                  <Text style={[tenue, styles.cifras]}>
                    {item.cantidad} × {formatearImporte(item.precioUnitario)}
                  </Text>
                </View>
              ))}
            </View>

            {(documento != null || contacto != null) && (
              <View style={[styles.bloque, { borderTopColor: linea }]}>
                {documento != null && (
                  <View style={styles.filaItem}>
                    <Text style={tenue}>Documento</Text>
                    <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, lineHeight: 18 }}>{documento}</Text>
                  </View>
                )}
                {contacto != null && (
                  <View style={styles.filaItem}>
                    <Text style={tenue}>Contacto</Text>
                    <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, lineHeight: 18 }}>{contacto}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Lo que hay que saber de este presupuesto y no es un dato de la tarjeta. */}
          {(p.estado == null || p.sinRespuesta === true || motivoEstado != null || p.reemplazaA != null || p.reemplazadoPor != null || p.facturado) && (
            <View style={styles.notas}>
              {p.estado == null && (
                <Text testID={`${testID}-estado-desconocido`} style={tenue}>
                  No pudimos leer el estado de este presupuesto.
                </Text>
              )}
              {/* «Hace mucho que nadie contesta» es un MATIZ de pendiente, no una cuarta categoría. */}
              {p.sinRespuesta === true && (
                <View style={[styles.aviso, { backgroundColor: conAlfa(tema.color.texto, 0.05) }]}>
                  <Glifo nombre="clock" size={18} color={tema.color.texto} decorativo />
                  <Text
                    testID={`${testID}-sin-respuesta`}
                    style={{ color: tema.color.texto, fontSize: tema.tipo.chico, lineHeight: 18, flex: 1 }}
                  >
                    Hace más de un mes que no tenés respuesta. Quizá valga la pena preguntar.
                  </Text>
                </View>
              )}
              {motivoEstado != null && estadoFacturar !== 'estado_incompatible' && (
                <Text testID={`${testID}-motivo-estado`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                  {motivoEstado}
                </Text>
              )}
              {p.reemplazaA != null && (
                <Text testID={`${testID}-reemplaza-a`} style={tenue}>
                  Reemplaza al presupuesto anterior (N° {p.reemplazaA}).
                </Text>
              )}
              {p.reemplazadoPor != null && (
                <Text testID={`${testID}-reemplazado-por`} style={tenue}>
                  Este presupuesto fue reemplazado por otro más nuevo (N° {p.reemplazadoPor}). Ya no es el vigente.
                </Text>
              )}
              {p.facturado && (
                <View style={styles.notaConGlifo}>
                  {/* En tinta, no en verde: el verde sobre el fondo crema no llega al contraste que pide el control. */}
                  <Glifo nombre="check" size={16} color={tema.color.texto} decorativo />
                  <Text testID={`${testID}-facturado`} style={{ color: tema.color.texto, fontSize: tema.tipo.chico, lineHeight: 18, flex: 1 }}>
                    Ya se emitió la factura de este presupuesto.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View
            testID={`${testID}-botones`}
            style={[styles.tarjeta, styles.tarjetaFilas, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}
          >
            {otras.map((o, i) => (
              <Pressable
                key={o.testID}
                testID={o.testID}
                onPress={o.onPress}
                disabled={o.deshabilitado}
                accessibilityRole="button"
                style={pressableStyle([styles.filaAccion, i > 0 && { borderTopWidth: 1, borderTopColor: linea }])}
              >
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, flex: 1 }}>
                  {o.etiqueta}
                </Text>
                <Glifo nombre="caret-right" size={14} color={tema.color.textoTenue} decorativo />
              </Pressable>
            ))}
          </View>
          {p.docLink == null && avisarGoogle && (
            <Text testID={`${testID}-sin-doc`} style={tenue}>
              {AVISO_CONECTAR_GOOGLE}
            </Text>
          )}

          {/* La hoja: el presupuesto como documento, con los mismos datos de arriba. No calcula nada. */}
          <View style={styles.vistaPrevia}>
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
              Vista previa
            </Text>
            <HojaPresupuesto presupuesto={p} nombreComercial={nombreComercial} documento={documento} testID={`${testID}-hoja`} />
          </View>
        </ScrollView>

        <View
          style={[
            styles.pie,
            { paddingBottom: insets.bottom + 12, backgroundColor: tema.color.fondo, borderTopColor: linea },
          ]}
        >
          {estadoFacturar === 'ya_facturado' && (
            <Text testID={`${testID}-ya-facturado`} style={tenue}>
              Este presupuesto ya se facturó
              {facturaIdPrevia != null ? ' (la factura ya existe).' : '.'}
            </Text>
          )}
          {estadoFacturar === 'estado_incompatible' && (
            <Text testID={`${testID}-estado-incompatible`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
              {motivoEstado ?? 'Ese presupuesto no se puede facturar como está.'} Si al final te lo
              aceptaron, hacé un presupuesto nuevo.
            </Text>
          )}
          {estadoFacturar === 'falta_perfil' && (
            <Text testID={`${testID}-falta-perfil`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
              Antes de facturar tenés que cargar tu CUIT en Ajustes → Facturación ARCA.
            </Text>
          )}
          {estadoFacturar === 'error' && (
            <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
              No pudimos completar la acción. Probá de nuevo.
            </Text>
          )}
          {estadoFacturar === 'no_disponible' && (
            <Text testID={`${testID}-no-disponible`} style={tenue}>
              Facturar desde un presupuesto todavía no está disponible.
            </Text>
          )}
          <View style={styles.botonesPie}>
            {segunda != null && (
              <Pressable
                testID={segunda.testID}
                onPress={segunda.onPress}
                disabled={segunda.deshabilitado}
                accessibilityRole="button"
                style={pressableStyle([styles.boton, styles.botonSegundo, { backgroundColor: tema.color.superficie, borderColor: linea }])}
              >
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                  {segunda.etiqueta}
                </Text>
              </Pressable>
            )}
            <Pressable
              testID={`${testID}-compartir`}
              onPress={enviarAlCliente}
              accessibilityRole="button"
              style={pressableStyle([styles.boton, styles.botonPrincipal, { backgroundColor: tema.color.acentoSuperficie }])}
            >
              <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                Enviar al cliente
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * El presupuesto como hoja (Martin 15/11): lo que se le manda al cliente, dibujado con los datos guardados.
 * 🔴 No calcula nada: cantidad y precio van como vinieron y el total es el del backend.
 * Del cliente lleva sólo el nombre y el documento (Martin 15/11): el teléfono o el mail no van en el presupuesto.
 */
function HojaPresupuesto({
  presupuesto: p,
  nombreComercial,
  documento,
  testID,
}: {
  presupuesto: Presupuesto;
  nombreComercial: string | undefined;
  documento: string | null;
  testID: string;
}) {
  const tema = useTema();
  const linea = conAlfa(tema.color.texto, 0.14);
  const rotulo = { color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: 9, letterSpacing: 0.8 };
  const chico = { color: tema.color.textoTenue, fontSize: 11, lineHeight: 15 };
  const fecha = formatearFechaLarga(p.fecha);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Vista previa del presupuesto N° ${p.numero}`}
      style={[styles.hoja, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie, borderTopColor: tema.color.acento }]}
    >
      <View style={styles.hojaCabecera}>
        <Text numberOfLines={2} style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 17, lineHeight: 21, flex: 1 }}>
          {nombreComercial ?? ''}
        </Text>
        <View style={styles.hojaNumero}>
          <Text style={rotulo}>PRESUPUESTO</Text>
          <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 15, lineHeight: 19 }}>N° {p.numero}</Text>
          {fecha !== '' && <Text style={chico}>{fecha}</Text>}
        </View>
      </View>

      <View style={[styles.hojaBloque, { borderTopColor: linea }]}>
        <Text style={rotulo}>PARA</Text>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: 13, lineHeight: 18 }}>
          {p.receptor.nombre !== '' ? p.receptor.nombre : '—'}
        </Text>
        {documento != null && <Text style={chico}>{documento}</Text>}
      </View>

      <View style={[styles.hojaBloque, { borderTopColor: linea }]}>
        <Text style={rotulo}>TRABAJO</Text>
        <Text style={{ color: tema.color.texto, fontSize: 13, lineHeight: 18 }}>{p.concepto}</Text>
      </View>

      {p.items.length > 0 && (
        <View style={[styles.hojaBloque, { borderTopColor: linea }]}>
          <View style={styles.hojaFila}>
            <Text style={[rotulo, styles.hojaDescripcion]}>DETALLE</Text>
            <Text style={[rotulo, styles.hojaCantidad]}>CANT.</Text>
            <Text style={[rotulo, styles.hojaPrecio]}>PRECIO</Text>
          </View>
          {p.items.map((item) => (
            <View key={item.orden} style={styles.hojaFila}>
              <Text style={[styles.hojaDescripcion, { color: tema.color.texto, fontSize: 12, lineHeight: 17 }]}>{item.descripcion}</Text>
              <Text style={[styles.hojaCantidad, styles.cifras, { color: tema.color.texto, fontSize: 12, lineHeight: 17 }]}>{item.cantidad}</Text>
              <Text style={[styles.hojaPrecio, styles.cifras, { color: tema.color.texto, fontSize: 12, lineHeight: 17 }]}>
                {formatearImporte(item.precioUnitario)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.hojaTotal, { borderTopColor: tema.color.texto }]}>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: 13 }}>Total</Text>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 20, lineHeight: 26 }}>
          {formatearImporte(p.total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { ...StyleSheet.absoluteFill },
  columna: { flex: 1 },
  barra: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row' },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cabecera: { gap: 4 },
  tarjeta: { borderRadius: 22, paddingHorizontal: 20, paddingVertical: 4 },
  tarjetaFilas: { paddingVertical: 0 },
  filaTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingVertical: 16 },
  total: { gap: 2, flexShrink: 1 },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4 },
  notaConGlifo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bloque: { borderTopWidth: 1, paddingVertical: 14, gap: 10 },
  filaItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cifras: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  notas: { gap: 8 },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 12 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  vistaPrevia: { gap: 12 },
  pie: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  botonesPie: { flexDirection: 'row', gap: 10 },
  boton: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botonSegundo: { flex: 1, borderWidth: 1 },
  botonPrincipal: { flex: 1.4 },
  hoja: { borderRadius: 6, borderTopWidth: 4, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 },
  hojaCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 18 },
  hojaNumero: { alignItems: 'flex-end', gap: 1 },
  hojaBloque: { borderTopWidth: 1, paddingVertical: 12, gap: 3 },
  hojaFila: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  hojaDescripcion: { flex: 1 },
  hojaCantidad: { width: 38, textAlign: 'right' },
  hojaPrecio: { width: 92, textAlign: 'right' },
  hojaTotal: { borderTopWidth: 1.5, marginTop: 4, paddingTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
