/**
 * `DetallePresupuesto` — el glass chico que se abre al tocar una card, con las acciones.
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
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  facturarPresupuesto,
  formatearFechaLarga,
  formatearImporte,
  obtenerPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { FilaBotones } from '../../theme/glass/campos';
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
  testID?: string;
}

function Dato({
  etiqueta,
  valor,
  testID,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  testID?: string;
  destacado?: boolean;
}) {
  const tema = useTema();
  return (
    <View style={styles.dato}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <Text
        testID={testID}
        style={{
          color: destacado ? tema.color.acento : tema.color.texto,
          fontFamily: destacado ? tema.fuente.uiBold : tema.fuente.ui,
          fontSize: destacado ? tema.tipo.grande : tema.tipo.base,
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

type EstadoFacturar = 'idle' | 'enviando' | 'ya_facturado' | 'falta_perfil' | 'error' | 'no_disponible';

export function DetallePresupuesto({
  presupuesto: inicial,
  onCerrar,
  onFacturar,
  onCorregir,
  testID = 'detalle-presupuesto',
}: DetallePresupuestoProps) {
  const tema = useTema();
  // Arranca con lo que la card ya tenía (todo menos los ítems) para que la hoja aparezca llena en
  // vez de en blanco, y se completa cuando llega el detalle. Sin esto habría un salto visual sobre
  // datos que ya estaban en memoria.
  const [p, setP] = useState<Presupuesto>(inicial);
  const [cargandoItems, setCargandoItems] = useState(true);
  const [estadoFacturar, setEstadoFacturar] = useState<EstadoFacturar>('idle');
  const [facturaIdPrevia, setFacturaIdPrevia] = useState<string | null>(null);

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
        case 'no_encontrado':
        case 'no_disponible':
          setEstadoFacturar('no_disponible');
          return;
      }
    } catch {
      setEstadoFacturar('error');
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

  async function compartir() {
    if (p.docLink == null) return;
    await Share.share({ message: p.docLink, url: p.docLink });
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

  const acciones = [];
  if (hayBorradorPendiente && p.facturaId != null) {
    const idBorrador = p.facturaId;
    acciones.push({
      etiqueta: 'Continuar la factura',
      onPress: () => onFacturar(idBorrador),
      variante: 'primario' as const,
      testID: `${testID}-continuar-factura`,
    });
  } else if (!p.facturado && estadoFacturar !== 'ya_facturado') {
    acciones.push({
      etiqueta: estadoFacturar === 'enviando' ? 'Preparando…' : 'Facturar',
      onPress: () => void facturar(),
      variante: 'primario' as const,
      deshabilitado: estadoFacturar === 'enviando',
      testID: `${testID}-facturar`,
    });
  }
  acciones.push({
    etiqueta: 'Corregir',
    onPress: () => onCorregir(p),
    variante: 'secundario' as const,
    testID: `${testID}-corregir`,
  });

  return (
    <Pressable
      testID={`${testID}-scrim`}
      onPress={onCerrar}
      style={[styles.scrim, { backgroundColor: tema.color.superficieAlta }]}
    >
      {/* `onPress` vacío: sin esto, un toque DENTRO del panel burbujea al scrim y cierra la hoja
          justo cuando el usuario está leyéndola. */}
      <Pressable testID={testID} onPress={() => {}} style={styles.contenedorPanel}>
        <CristalVidrio nivel="informe" style={styles.panel} />
        <View style={{ padding: tema.espacio.lg, gap: tema.espacio.md }}>
          <View style={styles.encabezado}>
            <Text
              testID={`${testID}-titulo`}
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.titulo }}
            >
              Presupuesto N° {p.numero}
            </Text>
            <Pressable
              testID={`${testID}-cerrar`}
              onPress={onCerrar}
              hitSlop={12}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Cerrar</Text>
            </Pressable>
          </View>

          <Dato etiqueta="Concepto" valor={p.concepto} testID={`${testID}-concepto`} />
          {p.receptor.nombre !== '' && (
            <Dato etiqueta="Cliente" valor={p.receptor.nombre} testID={`${testID}-receptor`} />
          )}
          {p.receptor.docTipo != null && p.receptor.docNro !== '' && (
            <Dato
              etiqueta="Documento"
              valor={`${ETIQUETA_DOC[p.receptor.docTipo] ?? `Tipo ${p.receptor.docTipo}`} ${p.receptor.docNro}`}
            />
          )}
          {p.receptor.contacto !== '' && <Dato etiqueta="Contacto" valor={p.receptor.contacto} />}
          {formatearFechaLarga(p.fecha) !== '' && (
            <Dato etiqueta="Fecha" valor={formatearFechaLarga(p.fecha)} testID={`${testID}-fecha`} />
          )}

          <View style={{ gap: tema.espacio.sm }}>
            <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
              Ítems
            </Text>
            {cargandoItems && p.items.length === 0 && (
              <ActivityIndicator testID={`${testID}-items-cargando`} color={tema.color.acento} />
            )}
            {p.items.map((item) => (
              <View key={item.orden} style={styles.filaItem} testID={`${testID}-item-${item.orden}`}>
                <Text
                  numberOfLines={2}
                  style={{ color: tema.color.texto, fontSize: tema.tipo.base, flexShrink: 1 }}
                >
                  {item.descripcion}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}>
                  {item.cantidad} × {formatearImporte(item.precioUnitario)}
                </Text>
              </View>
            ))}
          </View>

          {/* 🔴 El total sale del backend TAL CUAL, sin recomputarlo desde los ítems. Recalcularlo acá
              sería una segunda aritmética del dinero, con float, y el día que difiera del backend el
              usuario vería un número distinto del que se va a facturar. */}
          <Dato etiqueta="Total" valor={formatearImporte(p.total)} destacado testID={`${testID}-total`} />

          {p.reemplazaA != null && (
            <Text testID={`${testID}-reemplaza-a`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Reemplaza al presupuesto anterior (N° {p.reemplazaA}).
            </Text>
          )}
          {p.reemplazadoPor != null && (
            <Text
              testID={`${testID}-reemplazado-por`}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            >
              Este presupuesto fue reemplazado por otro más nuevo (N° {p.reemplazadoPor}). Ya no es el
              vigente.
            </Text>
          )}
          {p.facturado && (
            <Text testID={`${testID}-facturado`} style={{ color: tema.color.exito, fontSize: tema.tipo.chico }}>
              Ya se emitió la factura de este presupuesto.
            </Text>
          )}

          {/* 🔴 "Ver en Google Docs", no "Ver" a secas: manda al navegador, y un "Ver" pelado hace
              esperar que abra adentro. Sólo si hay link — puede no haberlo y NO es un error: el
              presupuesto se crea igual si el emprendedor no tiene Google Docs conectado. */}
          {p.docLink != null ? (
            <FilaBotones
              testID={`${testID}-botones-doc`}
              botones={[
                { etiqueta: 'Ver en Google Docs', onPress: () => void abrirDoc(), variante: 'secundario', testID: `${testID}-ver-doc` },
                { etiqueta: 'Compartir', onPress: () => void compartir(), variante: 'secundario', testID: `${testID}-compartir` },
              ]}
            />
          ) : (
            <Text testID={`${testID}-sin-doc`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Este presupuesto no tiene documento de Google. Conectá Google Docs desde Apps para que
              los próximos se generen solos — el presupuesto funciona igual sin él.
            </Text>
          )}

          <FilaBotones testID={`${testID}-botones`} botones={acciones} />

          {estadoFacturar === 'ya_facturado' && (
            <Text testID={`${testID}-ya-facturado`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Este presupuesto ya se facturó
              {facturaIdPrevia != null ? ' (la factura ya existe).' : '.'}
            </Text>
          )}
          {estadoFacturar === 'falta_perfil' && (
            <Text testID={`${testID}-falta-perfil`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
              Antes de facturar tenés que cargar tu CUIT en Ajustes → Facturación AFIP.
            </Text>
          )}
          {estadoFacturar === 'error' && (
            <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
              No pudimos completar la acción. Probá de nuevo.
            </Text>
          )}
          {estadoFacturar === 'no_disponible' && (
            <Text testID={`${testID}-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Facturar desde un presupuesto todavía no está disponible.
            </Text>
          )}
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  contenedorPanel: { width: '100%', maxWidth: 460 },
  panel: { ...StyleSheet.absoluteFill },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dato: { gap: 2 },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  filaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
