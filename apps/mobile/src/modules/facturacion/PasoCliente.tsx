import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EstadoFacturaResp, ReceptorInput } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CampoSelect, CampoTexto, FilaBotones } from '../../theme/glass/campos';
import { OPCIONES_CONDICION_IVA_RECEPTOR, OPCIONES_TIPO_DOC } from './catalogos';

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

  const listoLocal = condicionIva !== '' && tipoDoc !== '' && nroDoc.trim() !== '' && nombre.trim() !== '' && domicilio.trim() !== '';

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
        etiqueta="Número de documento"
        valor={nroDoc}
        onChange={setNroDoc}
        keyboardType="number-pad"
        testID={`${testID}-nro-doc`}
      />
      <CampoTexto etiqueta="Nombre / Razón social" valor={nombre} onChange={setNombre} testID={`${testID}-nombre`} />
      <CampoTexto etiqueta="Domicilio" valor={domicilio} onChange={setDomicilio} testID={`${testID}-domicilio`} />

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
