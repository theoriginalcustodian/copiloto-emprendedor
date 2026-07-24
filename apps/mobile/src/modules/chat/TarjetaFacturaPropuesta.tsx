import { useState } from 'react';
import { Text, View } from 'react-native';

import { confirmarConTokenFresco, type FacturaPropuesta } from '@copiloto/core';

import { empujarUnaVez } from '../../navegacion/empujarUnaVez';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaFacturaPropuesta` — lo que el copiloto entendió de una factura dictada (hito 9), de sólo
 * LECTURA + acción. Contrato `contrato_planificacion-a-todos_hito9-facturar-por-voz...` §2.2 + §5.
 *
 * 🔴 **No es una card editable como gasto/ingreso/presupuesto — es un gate + un handoff.** Emitir es
 * un acto fiscal irreversible: acá no hay `Formulario*` para completar a mano, porque completar A
 * MANO significa literalmente eso — `PantallaFacturacion`, que ya hace exactamente eso con 4 pasos
 * durables. Reimplementar esos 4 pasos dentro del chat sería la segunda copia del único lugar donde
 * se firma una emisión, que no puede tener dos implementaciones.
 *
 * 🔴 **`completa` se deriva de `faltantes.length === 0`, nunca viaja como bandera aparte** — misma
 * doctrina que `derivarPasoVisible` de `PantallaFacturacion`: el backend recalcula, el front deriva.
 *
 * 🔴 **`Emitir` confía en `confirmarConTokenFresco`**, que ya releva el token FRESCO y VERIFICA el
 * resultado releyendo el estado (disciplina de eco, §3.1 del contrato) — esta card no reimplementa
 * esa verificación, sólo confía en su `ConfirmarResultado.emitida`. Nunca dice "Factura emitida" si
 * ese booleano no vino en `true`.
 *
 * 🔴 **`Completar a mano` navega DE VERDAD** vía `empujarUnaVez` (mismo patrón que
 * `TarjetaClientePropuesto`/"Abrir ese cliente"): el chat vive en la pantalla lanzadora
 * (`PantallaPrincipal`), así que un `router.push` directo apilaría dos glass.
 */

type Estado = 'mostrando' | 'emitida';

export interface TarjetaFacturaPropuestaProps {
  propuesta: FacturaPropuesta;
  testID?: string;
}

export function TarjetaFacturaPropuesta({
  propuesta,
  testID = 'factura-propuesta',
}: TarjetaFacturaPropuestaProps) {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('mostrando');
  const [enviando, setEnviando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);

  const lista = propuesta.faltantes.length === 0;

  if (estado === 'emitida') {
    return <TarjetaPropuestaTerminal testID={`${testID}-emitida`} tono="exito" texto="Factura emitida." />;
  }

  async function emitir() {
    if (enviando) return;
    setEnviando(true);
    setMotivo(null);
    try {
      const res = await confirmarConTokenFresco(propuesta.facturaId);
      if (res.emitida) {
        setEstado('emitida');
      } else {
        setMotivo(res.motivo ?? 'No pudimos emitirla. Revisá el resumen antes de reintentar.');
      }
    } catch {
      setMotivo('No pudimos emitirla. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  function completarAMano() {
    empujarUnaVez({ pathname: '/facturacion', params: { facturaId: propuesta.facturaId } });
  }

  const nombreCliente =
    propuesta.cliente != null
      ? [propuesta.cliente.razonSocial, propuesta.cliente.cuit].filter((v) => (v ?? '').trim() !== '').join(' · ')
      : '';

  return (
    <TarjetaPropuestaShell
      testID={testID}
      aviso={
        lista
          ? 'Esto entendí. Revisalo y tocá Emitir — todavía no la mandé.'
          : 'Esto entendí, pero falta completar algo antes de emitirla.'
      }
    >
      <View style={{ gap: tema.espacio.xs }}>
        {nombreCliente !== '' && (
          <Row testID={`${testID}-cliente`}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Cliente</Text>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{nombreCliente}</Text>
            </View>
          </Row>
        )}

        {propuesta.items.map((item, indice) => (
          <Row key={`${item.descripcion}-${indice}`} testID={`${testID}-item-${indice}`}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{item.descripcion}</Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {item.cantidad} × {item.precioUnitario}
              </Text>
            </View>
          </Row>
        ))}

        <Text testID={`${testID}-total`} style={{ color: tema.color.acento, fontSize: tema.tipo.base, fontWeight: '700' }}>
          Total: {propuesta.total}
        </Text>

        {motivo != null && (
          <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
            {motivo}
          </Text>
        )}

        <FilaBotones
          testID={`${testID}-botones`}
          botones={
            lista
              ? [
                  {
                    etiqueta: enviando ? 'Emitiendo…' : 'Emitir',
                    onPress: () => void emitir(),
                    variante: 'primario',
                    deshabilitado: enviando,
                    testID: `${testID}-emitir`,
                  },
                ]
              : [
                  {
                    etiqueta: 'Completar a mano',
                    onPress: completarAMano,
                    variante: 'primario',
                    testID: `${testID}-completar`,
                  },
                ]
          }
        />
      </View>
    </TarjetaPropuestaShell>
  );
}
