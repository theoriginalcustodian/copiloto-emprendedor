import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AmbienteAfip, ConfirmarResultado, DatosVentaInput, EstadoFacturaResp, ReceptorInput } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { OPCIONES_CONCEPTO, OPCIONES_CONDICION_VENTA } from './catalogos';

type PasoEditable = 'datos_venta' | 'items' | 'cliente';

function etiquetaDe(opciones: { valor: string; etiqueta: string }[], valor: string): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/**
 * Paso 4 — Resumen + HITL. Todo lo que se va a emitir, con `[Confirmar] [Cancelar] [Editar y confirmar]`.
 *
 * 🔴 **`datosVenta`/`cliente` son un ECO LOCAL, no una relectura del backend.** `FacturaWorkflow.estado()`
 * devuelve 9 claves (`estado, faltantes, items, total, tokenConfirmacion, resultado, pdf, motivo,
 * terminado` -- verificado en el plan de UI §1) y NINGUNA de ellas trae de vuelta la fecha/concepto/
 * condición de venta ni los datos del receptor que se cargaron en los pasos 1 y 3. `items`/`total` SÍ
 * son del backend (siempre visibles acá, son la fuente fiscal); `datosVenta`/`cliente` los sostiene
 * `PantallaFacturacion` en memoria desde que el usuario los tipeó -- si son `null` (p.ej. la app se
 * cerró y se reabrió a mitad del flujo, perdiendo ese estado local), esta pantalla lo DICE en vez de
 * inventar un resumen a medias.
 *
 * 🔴 **El ambiente se muestra ACÁ, y cambia la etiqueta del botón.** Es un pedido explícito de la
 * sesión de backend (`coordinacion/2026-07-21_respuesta_backend-a-frontend-afip.md` §3): *"emitir un
 * comprobante fiscal real creyendo que se está probando es el error caro de este flujo, y el único
 * lugar donde se puede evitar es la pantalla donde el usuario aprieta Confirmar"*. Por eso en
 * producción el botón no dice "Confirmar y emitir" sino **"Emitir factura real"** — la etiqueta del
 * botón es lo último que se lee antes de apretarlo, y es lo único que se lee de verdad.
 *
 * 🔴 **Si el ambiente no se pudo confirmar, se DICE — no se asume homologación.** Asumir la opción
 * "segura" es exactamente lo que produce el error caro: alguien mirando un cartel que dice "prueba"
 * mientras emite un comprobante fiscal real.
 */
export interface PasoResumenProps {
  estado: EstadoFacturaResp;
  /** `null` = el backend no informó el ambiente. Ver el docstring de arriba: no se asume ninguno. */
  ambiente: AmbienteAfip | null;
  datosVenta: DatosVentaInput | null;
  cliente: ReceptorInput | null;
  onConfirmar: () => Promise<ConfirmarResultado>;
  onCancelar: () => Promise<void>;
  onEditar: (paso: PasoEditable) => void;
  testID?: string;
}

export function PasoResumen({
  estado,
  ambiente,
  datosVenta,
  cliente,
  onConfirmar,
  onCancelar,
  onEditar,
  testID = 'facturacion-paso-resumen',
}: PasoResumenProps) {
  const tema = useTema();
  const [enviando, setEnviando] = useState(false);
  const [avisoNoOp, setAvisoNoOp] = useState<string | null>(null);
  const [eligiendoPaso, setEligiendoPaso] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setAvisoNoOp(null);
    try {
      const resultado = await onConfirmar();
      if (!resultado.emitida) {
        setAvisoNoOp(resultado.motivo ?? 'los datos cambiaron, revisá el resumen antes de confirmar');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setEnviando(true);
    try {
      await onCancelar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        Resumen
      </Text>

      <View
        testID={`${testID}-aviso-ambiente`}
        style={[
          styles.avisoAmbiente,
          {
            backgroundColor: ambiente === 'prod' ? tema.color.peligroFondo : tema.color.superficieAlta,
            borderColor: ambiente === 'prod' ? tema.color.peligroBorde : tema.color.borde,
            borderWidth: 1,
            borderRadius: tema.radio.sm,
            padding: tema.espacio.sm,
          },
        ]}
      >
        <Text
          testID={`${testID}-ambiente-${ambiente ?? 'desconocido'}`}
          style={{ color: ambiente === 'prod' ? tema.color.peligro : tema.color.texto, fontSize: tema.tipo.chico }}
        >
          {ambiente === 'prod'
            ? 'Producción: esto emite un comprobante fiscal REAL a tu nombre. Anularlo requiere una nota de crédito.'
            : ambiente === 'dev'
              ? 'Homologación: es una factura de prueba, sin efecto fiscal.'
              : 'No pudimos confirmar si tu cuenta está en Homologación (prueba, sin efecto fiscal) o Producción (comprobante fiscal real). Revisá Ajustes antes de confirmar.'}
        </Text>
      </View>

      {datosVenta ? (
        <Row testID={`${testID}-datos-venta`}>
          <View style={styles.filaResumen}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Venta</Text>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
              {datosVenta.fecha} · {etiquetaDe(OPCIONES_CONCEPTO, String(datosVenta.concepto))} ·{' '}
              {etiquetaDe(OPCIONES_CONDICION_VENTA, datosVenta.condicionVenta)}
            </Text>
          </View>
        </Row>
      ) : (
        <Text testID={`${testID}-datos-venta-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          No tenemos en esta sesión el detalle de la venta -- los datos ya están guardados en el borrador.
        </Text>
      )}

      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Ítems ({estado.items.length})</Text>
      {estado.items.map((item, indice) => (
        <Row key={`${item.descripcion}-${indice}`} testID={`${testID}-item-${indice}`}>
          <View style={styles.filaResumen}>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{item.descripcion}</Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {item.cantidad} × {item.precioUnitario} = {item.subtotal}
            </Text>
          </View>
        </Row>
      ))}
      <Text testID={`${testID}-total`} style={{ color: tema.color.acento, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.grande }}>
        Total: {estado.total}
      </Text>

      {cliente ? (
        <Row testID={`${testID}-cliente`}>
          <View style={styles.filaResumen}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Cliente</Text>
            {/* 🔴 Nombre y domicilio son OPCIONALES (ver `PasoCliente`: el backend no los exige, y
                para consumidor final es lo normal no cargarlos). Sin este filtro, el resumen de una
                venta a consumidor final mostraba un " · " suelto — visto en device el 2026-07-21.
                Un separador huérfano parece un dato que no cargó, cuando en realidad no hacía falta. */}
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
              {[cliente.nombre, cliente.domicilio].filter((v) => (v ?? '').trim() !== '').join(' · ') ||
                'Consumidor final sin identificar'}
            </Text>
          </View>
        </Row>
      ) : (
        <Text testID={`${testID}-cliente-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          No tenemos en esta sesión el detalle del cliente -- los datos ya están guardados en el borrador.
        </Text>
      )}

      {avisoNoOp != null && (
        <Text testID={`${testID}-aviso-no-op`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
          {avisoNoOp}
        </Text>
      )}

      {eligiendoPaso ? (
        <FilaBotones
          testID={`${testID}-selector-edicion`}
          botones={[
            { etiqueta: 'Datos de venta', onPress: () => onEditar('datos_venta'), testID: `${testID}-editar-datos-venta` },
            { etiqueta: 'Ítems', onPress: () => onEditar('items'), testID: `${testID}-editar-items` },
            { etiqueta: 'Cliente', onPress: () => onEditar('cliente'), testID: `${testID}-editar-cliente` },
          ]}
        />
      ) : (
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              // 🔴 La etiqueta cambia con el ambiente. Ver el docstring del módulo: es el último
              // texto que el usuario lee antes de emitir, y en producción tiene que nombrar lo que
              // realmente va a pasar.
              etiqueta: enviando
                ? 'Emitiendo…'
                : ambiente === 'prod'
                  ? 'Emitir factura real'
                  : 'Confirmar y emitir',
              onPress: confirmar,
              variante: 'primario',
              deshabilitado: enviando,
              testID: `${testID}-confirmar`,
            },
            {
              etiqueta: 'Cancelar',
              onPress: cancelar,
              variante: 'peligro',
              deshabilitado: enviando,
              testID: `${testID}-cancelar`,
            },
            {
              etiqueta: 'Editar y confirmar',
              onPress: () => setEligiendoPaso(true),
              variante: 'secundario',
              deshabilitado: enviando,
              testID: `${testID}-editar`,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  avisoAmbiente: {},
  filaResumen: { gap: 2, flex: 1 },
});
