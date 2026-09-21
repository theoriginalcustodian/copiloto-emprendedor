import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import {
  AVISO_FACTURA_ANULACION,
  confirmarConTokenFresco,
  estadoFactura as consultarEstadoFactura,
  type EstadoFacturaResp,
  type FacturaPropuesta,
} from '@copiloto/core';

import { empujarUnaVez } from '../../navegacion/empujarUnaVez';
import { AccionesComprobante, DatosComprobante } from '../facturacion/comprobante';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';
import { Recibo } from './Recibo';
import { TarjetaPropuestaShell } from './TarjetaPropuestaShell';

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
 * 🔴 **Emitida, la card muestra el COMPROBANTE, no un cartelito.** `ConfirmarResultado.estado` ya
 * trae el CAE, el número y el PDF; hasta el 2026-09-18 esta card los descartaba y decía sólo
 * *"Factura emitida."*, dejando al emprendedor sin el único dato que le sirve cuando el link vence.
 * `DatosComprobante`/`AccionesComprobante` son las MISMAS piezas de la pantalla de Facturación
 * (`../facturacion/comprobante`) — no una segunda presentación que puede divergir.
 *
 * 🔴 **Después de emitir se SIGUE poleando hasta `terminado`, y no es opcional.** El CAE existe unos
 * segundos antes que el PDF: el estado que devuelve `confirmarConTokenFresco` es el de justo después
 * del CAE, así que mostrar `AccionesComprobante` con eso pinta *"el PDF no está disponible"* sobre una
 * factura cuyo PDF aparece dos segundos más tarde. Es el bug medido en device con la factura N° 7
 * (CAE 86290619845862) y la razón por la que `PantallaFacturacion` corta por `terminado` y no por
 * `estado === 'emitida'`. Mientras no está terminado, la card lo DICE.
 *
 * 🔴 **`Completar a mano` navega DE VERDAD** vía `empujarUnaVez` (mismo patrón que
 * `TarjetaClientePropuesto`/"Abrir ese cliente"): el chat vive en la pantalla lanzadora
 * (`PantallaPrincipal`), así que un `router.push` directo apilaría dos glass.
 */

type Estado = 'mostrando' | 'emitida';

/** Igual que el de `PantallaFacturacion`: la ventana entre el CAE y el PDF se mide en segundos. */
const INTERVALO_POLL_EMISION_MS = 1500;

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
  const [comprobante, setComprobante] = useState<EstadoFacturaResp | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Sigue leyendo hasta `terminado` — ver el docstring: el PDF llega después del CAE. Un fallo de red
  // puntual no aborta el loop; el próximo tick reintenta.
  useEffect(() => {
    if (estado !== 'emitida' || comprobante == null || comprobante.terminado) return;
    const intervalo = setInterval(() => {
      void consultarEstadoFactura(propuesta.facturaId)
        .then((nuevo) => {
          if (vivo.current) setComprobante(nuevo);
        })
        .catch(() => {});
    }, INTERVALO_POLL_EMISION_MS);
    return () => clearInterval(intervalo);
  }, [estado, comprobante, propuesta.facturaId]);

  const lista = propuesta.faltantes.length === 0;

  if (estado === 'emitida') {
    return (
      <Recibo
        testID={`${testID}-emitida`}
        tono="exito"
        titulo="Factura emitida."
        nota={
          comprobante == null || !comprobante.terminado
            ? {
                texto: 'Estamos preparando el PDF. En unos segundos lo vas a poder abrir o compartir desde acá.',
                testID: `${testID}-preparando-pdf`,
              }
            : undefined
        }
      >
        {comprobante != null && <DatosComprobante estado={comprobante} testID={`${testID}-emitida`} />}
        {comprobante != null && comprobante.terminado && (
          <AccionesComprobante estado={comprobante} testID={`${testID}-emitida`} />
        )}
      </Recibo>
    );
  }

  async function emitir() {
    if (enviando) return;
    setEnviando(true);
    setMotivo(null);
    try {
      const res = await confirmarConTokenFresco(propuesta.facturaId);
      if (res.emitida) {
        setComprobante(res.estado ?? null);
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

        <Text testID={`${testID}-total`} style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.base, fontWeight: '700' }}>
          Total: {propuesta.total}
        </Text>

        {motivo != null && (
          <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
            {motivo}
          </Text>
        )}

        {lista && (
          <Text
            testID={`${testID}-aviso-anulacion`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          >
            {AVISO_FACTURA_ANULACION}
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
