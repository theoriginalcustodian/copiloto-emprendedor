import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EstadoFacturaResp, ReceptorInput } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CampoSelect, CampoTexto, FilaBotones } from '../../theme/glass/campos';
import { OPCIONES_CONDICION_IVA_RECEPTOR, OPCIONES_TIPO_DOC, TIPO_DOC_CONSUMIDOR_FINAL } from './catalogos';

/**
 * Paso 3 — Cliente (receptor). Se muestra tanto en `items_ok` como en `cliente_ok` -- ver el docstring
 * de `derivarPasoVisible` para el porqué de ese mapeo doble a UNA pantalla. Si `cargar_cliente` dejó un
 * `motivo` sin avanzar el estado (`afip.ts::ReceptorInput`: "el backend valida y, si el valor no matchea
 * el enum, deja `motivo` en el estado, no lanza 4xx"), esta MISMA pantalla lo muestra inline.
 */
export interface PasoClienteProps {
  estado: EstadoFacturaResp;
  onGuardar: (receptor: ReceptorInput) => Promise<void>;
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoCliente({
  estado,
  onGuardar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-cliente',
}: PasoClienteProps) {
  const tema = useTema();
  const [condicionIva, setCondicionIva] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [nroDoc, setNroDoc] = useState('');
  const [nombre, setNombre] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [enviando, setEnviando] = useState(false);

  /**
   * 🔴 **Sólo se exige lo que el backend exige. Ni un campo más.**
   *
   * Verificado en device el 2026-07-21 y contra `afip_rules.validar_receptor`: esta pantalla pedía
   * documento **Y** nombre **Y** domicilio siempre, y con eso el flujo quedaba **trabado** para el caso
   * más común de todos —una venta a consumidor final—, que el backend acepta sin ninguno de los tres.
   * El control por HTTP con los mismos datos pasó a `esperando_confirmacion` sin chistar, así que la
   * regla de más estaba acá, no allá.
   *
   * Y el modo de fallo era el peor posible: el botón quedaba **deshabilitado en silencio**. Sin error,
   * sin decir qué falta — indistinguible de una función rota, que es exactamente lo que este repo ya
   * documentó al cazar el tile de Métricas que no hacía nada.
   *
   * El contrato real (`validar_receptor`):
   *   - `tipo_doc = 99` (consumidor final) → **nada** obligatorio, salvo que el total supere el tope
   *     de venta sin identificar (y ESE límite lo decide el backend con el total real, no la app).
   *   - cualquier otro tipo de documento → `nro_doc` obligatorio (y CUIT bien formado si es CUIT).
   *   - `nombre` y `domicilio` → **nunca** obligatorios.
   *
   * Duplicar reglas fiscales en la app es además una trampa a futuro: el día que AFIP cambie un
   * mínimo, esta copia queda vieja y bloquea ventas legítimas sin que nadie sepa por qué. La app
   * anticipa lo evidente; el gate duro sigue siendo el backend, que ya devuelve `faltantes`.
   */
  const requiereDocumento = tipoDoc !== '' && tipoDoc !== String(TIPO_DOC_CONSUMIDOR_FINAL);
  const listoLocal =
    condicionIva !== '' && tipoDoc !== '' && (!requiereDocumento || nroDoc.trim() !== '');

  async function continuar() {
    setEnviando(true);
    try {
      await onGuardar({
        condicionIva: Number(condicionIva),
        tipoDoc: Number(tipoDoc),
        nroDoc,
        nombre,
        domicilio,
      });
    } finally {
      setEnviando(false);
    }
  }

  const hayMotivo = estado.motivo != null && estado.motivo !== '';

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        Cliente
      </Text>

      {hayMotivo && (
        <Text
          testID={`${testID}-motivo`}
          style={{ color: tema.color.peligro, fontSize: tema.tipo.chico, fontFamily: tema.fuente.mono }}
        >
          {estado.motivo}
        </Text>
      )}

      <CampoSelect
        etiqueta="Condición IVA"
        opciones={OPCIONES_CONDICION_IVA_RECEPTOR}
        valor={condicionIva}
        onChange={setCondicionIva}
        testID={`${testID}-condicion-iva`}
      />
      <CampoSelect
        etiqueta="Tipo de documento"
        opciones={OPCIONES_TIPO_DOC}
        valor={tipoDoc}
        onChange={setTipoDoc}
        testID={`${testID}-tipo-doc`}
      />
      <CampoTexto
        // La etiqueta dice la verdad según el tipo elegido, en vez de dejar al usuario adivinando
        // por qué el botón no se habilita. Es la otra mitad del arreglo: no alcanza con dejar de
        // exigir de más, hay que decir qué se exige.
        etiqueta={requiereDocumento ? 'Número de documento' : 'Número de documento (opcional)'}
        valor={nroDoc}
        onChange={setNroDoc}
        keyboardType="number-pad"
        testID={`${testID}-nro-doc`}
      />
      <CampoTexto etiqueta="Nombre / Razón social (opcional)" valor={nombre} onChange={setNombre} testID={`${testID}-nombre`} />
      <CampoTexto etiqueta="Domicilio (opcional)" valor={domicilio} onChange={setDomicilio} testID={`${testID}-domicilio`} />

      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: enviando ? 'Guardando…' : 'Continuar',
            onPress: continuar,
            variante: 'primario',
            deshabilitado: !listoLocal || enviando,
            testID: `${testID}-continuar`,
          },
          ...(modoEdicion && onVolverResumen
            ? [{ etiqueta: 'Volver al resumen', onPress: onVolverResumen, testID: `${testID}-volver` }]
            : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
