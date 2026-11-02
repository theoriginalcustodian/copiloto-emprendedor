import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import {
  agregarItem,
  ApiError,
  AVISO_FACTURA_ANULACION,
  cancelarFactura,
  confirmarConTokenFresco,
  esperarEcoDelSignal,
  estadoFactura as consultarEstadoFactura,
  etiquetaCondicionIva,
  firmaDeEstado,
  quitarItem,
  setCliente,
  setDatosVenta,
  type ChatMessage,
  type DatosVentaInput,
  type EstadoFacturaResp,
  type FacturaPropuesta,
  type NuevoItem,
  type ReceptorInput,
} from '@copiloto/core';

import {
  OPCIONES_CONDICION_IVA_RECEPTOR,
  TIPO_DOC_CONSUMIDOR_FINAL,
} from '../facturacion/catalogos';
import { AccionesComprobante, DatosComprobante } from '../facturacion/comprobante';
import { nombreTipoComprobante } from '../facturacion/etiquetasComprobante';
import { derivarPasoVisible } from '../facturacion/maquinaEstado';
import { PasoCliente } from '../facturacion/PasoCliente';
import { PasoDatosVenta } from '../facturacion/PasoDatosVenta';
import { PasoItems } from '../facturacion/PasoItems';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';
import { Recibo } from './Recibo';
import { TarjetaPropuestaShell } from './TarjetaPropuestaShell';

/**
 * `TarjetaFacturaPropuesta` — lo que el copiloto entendió de una factura dictada (hito 9), con
 * **Editar · Cancelar · Emitir la factura** (SM-H1, decisión D7, ADR-007).
 *
 * 🔴 **Se edita dentro de la card, y con los mismos pasos de `PantallaFacturacion`.** Hasta el 2026-11-02
 * esto era gate + handoff: «Completar a mano» sacaba del hilo. Lo que aquel docstring cuidaba sigue en
 * pie: no hay una segunda implementación de la carga ni de la firma. `PasoDatosVenta`, `PasoItems` y
 * `PasoCliente` son los mismos, las señales son las mismas y emitir sigue teniendo una sola puerta.
 *
 * 🔴 **Lo que se muestra sale del workflow, no del mensaje.** El artifact es la foto del momento en que
 * el agente armó la propuesta, y el borrador puede cambiar después: desde esta card, por chat o por voz.
 * La card lo relee al montar y cada `INTERVALO_RELECTURA_MS`, y sólo usa el artifact hasta tener la
 * primera lectura o si esa lectura falla. Por eso una factura cancelada por chat se apaga sola.
 *
 * 🔴 **Emitir compara antes de emitir.** Si el borrador no coincide con la última lectura, repinta y pide
 * revisar: lo que está en pantalla es lo que se emite. `FacturaWorkflow._token()` no alcanza para esto,
 * porque no ve descripciones ni nombres.
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
 */

type Estado = 'mostrando' | 'emitida';
type PasoEditable = 'datos_venta' | 'items' | 'cliente';

/** Igual que el de `PantallaFacturacion`: la ventana entre el CAE y el PDF se mide en segundos. */
const INTERVALO_POLL_EMISION_MS = 1500;
/** Cada cuánto se entera la card de lo que pasó por chat o por voz. Se apaga en cuanto hay un estado final. */
const INTERVALO_RELECTURA_MS = 5000;
const ESTADOS_EMITIDOS: readonly string[] = ['emitida', 'entregada'];
const PASOS_EDITABLES: readonly string[] = ['datos_venta', 'items', 'cliente'];

export interface TarjetaFacturaPropuestaProps {
  propuesta: FacturaPropuesta;
  /** GUARDM parte 2 — `mensaje.facturaResuelta`: ya se emitió. Cancelada no se persiste acá: lo dice el
   * workflow en cada lectura. */
  resuelto?: ChatMessage['facturaResuelta'];
  /** Persiste `facturaResuelta: true` en el mensaje (atada a `mensaje.id` por `ListaMensajes.tsx`).
   * Opcional: los tests que no verifican persistencia lo omiten sin romper nada. */
  onResolver?: () => void;
  testID?: string;
}

export function TarjetaFacturaPropuesta({
  propuesta,
  resuelto,
  onResolver,
  testID = 'factura-propuesta',
}: TarjetaFacturaPropuestaProps) {
  const tema = useTema();
  const facturaId = propuesta.facturaId;
  // GUARDM parte 2 — guard cross-remount: siembra sincrónicamente desde `resuelto` (patrón B), mismo
  // mecanismo que las otras 3 cards de propuesta. Sin esto, un remount tras emitir volvía a mostrar
  // el formulario de Emitir sobre una factura que YA se mandó.
  const [estado, setEstado] = useState<Estado>(resuelto ? 'emitida' : 'mostrando');
  const [ocupado, setOcupado] = useState(false);
  // `ocupado` también lo prenden Editar y Cancelar: el rótulo «Emitiendo…» no puede salir de ahí.
  const [enviando, setEnviando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [lectura, setLectura] = useState<EstadoFacturaResp | null>(null);
  // Hasta la primera lectura los botones no se pueden tocar: una card cancelada no muestra un Emitir activo.
  const [leyo, setLeyo] = useState(false);
  const [noDisponible, setNoDisponible] = useState(false);
  const [edicion, setEdicion] = useState<'menu' | PasoEditable | null>(null);
  const vivo = useRef(true);
  const resolvio = useRef(resuelto === true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  function marcarEmitida() {
    setEstado('emitida');
    if (!resolvio.current) {
      resolvio.current = true;
      onResolver?.();
    }
  }

  function aplicar(nueva: EstadoFacturaResp) {
    if (!vivo.current) return;
    setLectura(nueva);
    if (ESTADOS_EMITIDOS.includes(nueva.estado)) marcarEmitida();
  }

  /** Un fallo de red no cambia nada: la próxima lectura reintenta. Un 404 es que ya no existe. */
  async function releer(): Promise<EstadoFacturaResp | null> {
    try {
      const nueva = await consultarEstadoFactura(facturaId);
      aplicar(nueva);
      return nueva;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && vivo.current) setNoDisponible(true);
      return null;
    }
  }

  // Al montar, también para poblar el comprobante al rehidratar ya emitida (CAE y PDF no viajan en el
  // mensaje). `propuesta.facturaId` no cambia entre renders de la MISMA card.
  useEffect(() => {
    void releer().finally(() => {
      if (vivo.current) setLeyo(true);
    });
  }, []);

  const terminada = lectura?.terminado === true;
  useEffect(() => {
    if (estado !== 'mostrando' || noDisponible || terminada) return;
    const intervalo = setInterval(() => void releer(), INTERVALO_RELECTURA_MS);
    return () => clearInterval(intervalo);
  }, [estado, noDisponible, terminada]);

  // Sigue leyendo hasta `terminado` — ver el docstring: el PDF llega después del CAE. Un fallo de red
  // puntual no aborta el loop; el próximo tick reintenta.
  useEffect(() => {
    if (estado !== 'emitida' || lectura == null || lectura.terminado) return;
    const intervalo = setInterval(() => void releer(), INTERVALO_POLL_EMISION_MS);
    return () => clearInterval(intervalo);
  }, [estado, lectura]);

  // Antes que «emitida»: `confirmarConTokenFresco` da `emitida:true` apenas el workflow toma la
  // confirmación, y ARCA todavía puede rechazarla.
  if (lectura?.estado === 'rechazada') {
    return (
      <Recibo
        testID={`${testID}-rechazada`}
        tono="tenue"
        titulo="ARCA rechazó la factura."
        nota={lectura.motivo != null ? { texto: lectura.motivo } : undefined}
      />
    );
  }

  if (lectura?.estado === 'cancelada') {
    return (
      <Recibo
        testID={`${testID}-cancelada`}
        tono="tenue"
        titulo="Factura cancelada."
        nota={{ texto: 'No se mandó nada a ARCA.' }}
      />
    );
  }

  if (estado === 'emitida') {
    return (
      <Recibo
        testID={`${testID}-emitida`}
        tono="exito"
        titulo={`${lectura?.resultado != null ? nombreTipoComprobante(lectura.resultado.tipoCbte) : 'Factura'} emitida.`}
        nota={
          lectura == null || !lectura.terminado
            ? {
                texto: 'Estamos preparando el PDF. En unos segundos lo vas a poder abrir o compartir desde acá.',
                testID: `${testID}-preparando-pdf`,
              }
            : undefined
        }
      >
        {lectura != null && <DatosComprobante estado={lectura} testID={`${testID}-emitida`} />}
        {lectura != null && lectura.terminado && (
          <AccionesComprobante estado={lectura} testID={`${testID}-emitida`} />
        )}
      </Recibo>
    );
  }

  if (noDisponible) {
    return <Recibo testID={`${testID}-no-disponible`} tono="tenue" titulo="Esta factura ya no está disponible." />;
  }

  async function emitir() {
    if (ocupado) return;
    setOcupado(true);
    setEnviando(true);
    setMotivo(null);
    try {
      const fresca = await consultarEstadoFactura(facturaId);
      const cambio = lectura == null || firmaDeEstado(fresca) !== firmaDeEstado(lectura);
      aplicar(fresca);
      if (cambio) {
        setMotivo('Esta factura cambió. Revisala y volvé a tocar Emitir la factura.');
        return;
      }
      const res = await confirmarConTokenFresco(facturaId);
      if (res.estado) aplicar(res.estado);
      if (res.emitida) {
        marcarEmitida();
      } else {
        setMotivo(res.motivo ?? 'No pudimos emitirla. Revisá el resumen antes de reintentar.');
      }
    } catch {
      setMotivo('No pudimos emitirla. Probá de nuevo.');
    } finally {
      if (vivo.current) {
        setOcupado(false);
        setEnviando(false);
      }
    }
  }

  async function cancelar() {
    if (ocupado) return;
    setOcupado(true);
    setMotivo(null);
    try {
      await cancelarFactura(facturaId);
      await releer();
    } catch {
      // 409: ya se emitió. Lo que mande es lo que diga el workflow, no el error.
      const nueva = await releer();
      if (nueva == null || !nueva.terminado) setMotivo('No pudimos cancelarla. Probá de nuevo.');
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }

  async function abrirEdicion() {
    if (ocupado) return;
    setOcupado(true);
    setMotivo(null);
    const nueva = await releer();
    if (vivo.current) {
      setOcupado(false);
      if (nueva == null) {
        setMotivo('No pudimos abrir la factura. Probá de nuevo.');
      } else {
        const paso = derivarPasoVisible(nueva);
        // Con algo faltante va directo a ese dato; si no, elige qué cambiar.
        setEdicion(nueva.faltantes.length > 0 && PASOS_EDITABLES.includes(paso) ? (paso as PasoEditable) : 'menu');
      }
    }
  }

  /** Manda el cambio y espera su eco. `false` si falló: el paso sigue abierto y lo dice. */
  async function guardar(mandar: () => Promise<unknown>, previo = lectura): Promise<EstadoFacturaResp | null> {
    setMotivo(null);
    try {
      await mandar();
      const { estado: nueva } = await esperarEcoDelSignal(facturaId, previo);
      aplicar(nueva);
      return nueva;
    } catch {
      if (vivo.current) setMotivo('No pudimos guardar el cambio. Probá de nuevo.');
      await releer();
      return null;
    }
  }

  /** Un dato de una vez: al guardar se vuelve a la card, salvo que el backend lo haya rechazado. */
  async function guardarYVolver(mandar: () => Promise<unknown>) {
    const previo = lectura;
    const nueva = await guardar(mandar);
    if (nueva != null && vivo.current && (nueva.motivo == null || nueva.motivo === previo?.motivo)) {
      setEdicion(null);
    }
  }

  /**
   * No hay señal de editar un ítem: se agrega el nuevo y se quita el viejo, en ese orden, para que el
   * borrador nunca quede sin ítems. Si lo segundo falla quedan los dos a la vista, nunca ninguno. El
   * nuevo se agrega al final, así que `indice` sigue siendo el del viejo.
   */
  async function reemplazarItem(indice: number, item: NuevoItem) {
    const conLosDos = await guardar(() => agregarItem(facturaId, item));
    if (conLosDos != null) await guardar(() => quitarItem(facturaId, indice), conLosDos);
  }

  const textoMotivo = motivo != null && (
    <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
      {motivo}
    </Text>
  );

  if (edicion != null && edicion !== 'menu' && lectura != null) {
    const volver = () => setEdicion(null);
    return (
      <TarjetaPropuestaShell testID={testID} aviso="Cambiá lo que haga falta. Todavía no la mandé.">
        <View style={{ gap: tema.espacio.md }}>
          {textoMotivo}
          {edicion === 'datos_venta' && (
            <PasoDatosVenta
              estado={lectura}
              onGuardar={(datos: DatosVentaInput) => guardarYVolver(() => setDatosVenta(facturaId, datos))}
              modoEdicion
              onVolverResumen={volver}
              testID={`${testID}-editar-datos-venta`}
            />
          )}
          {edicion === 'items' && (
            <PasoItems
              estado={lectura}
              onAgregar={async (item) => {
                await guardar(() => agregarItem(facturaId, item));
              }}
              onQuitar={async (indice) => {
                await guardar(() => quitarItem(facturaId, indice));
              }}
              onReemplazar={reemplazarItem}
              modoEdicion
              onVolverResumen={volver}
              testID={`${testID}-editar-items`}
            />
          )}
          {edicion === 'cliente' && (
            <PasoCliente
              estado={lectura}
              onGuardar={(receptor: ReceptorInput) => guardarYVolver(() => setCliente(facturaId, receptor))}
              modoEdicion
              onVolverResumen={volver}
              testID={`${testID}-editar-cliente`}
            />
          )}
        </View>
      </TarjetaPropuestaShell>
    );
  }

  const receptor = lectura?.receptor ?? null;
  const items = lectura?.items ?? propuesta.items;
  const total = lectura?.total ?? propuesta.total;
  const lista = (lectura?.faltantes ?? propuesta.faltantes).length === 0;
  const emitiendo = lectura?.estado === 'emitiendo';
  const apagados = ocupado || !leyo || emitiendo;

  const documento = receptor != null && receptor.tipoDoc !== TIPO_DOC_CONSUMIDOR_FINAL ? receptor.nroDoc : null;
  const nombreCliente = (
    receptor != null
      ? [receptor.nombre, documento]
      : [propuesta.cliente?.razonSocial, propuesta.cliente?.cuit]
  )
    .filter((v) => (v ?? '').trim() !== '')
    .join(' · ');
  // La condición de IVA y la marca «del registro» salen de lo que mandó el backend (D7), no se infieren
  // acá: la precarga trae la condición del REGISTRO, y de ella depende la letra A/B/C del encabezado.
  const condicionIva =
    receptor != null
      ? (OPCIONES_CONDICION_IVA_RECEPTOR.find((o) => o.valor === String(receptor.condicionIva))?.etiqueta ?? null)
      : etiquetaCondicionIva(propuesta.cliente?.condicionIva ?? null);
  // Cambiado el documento, ese dato ya no salió del registro: la marca diría algo falso.
  const delRegistro =
    propuesta.cliente?.delRegistro === true && (receptor == null || documento === propuesta.cliente.cuit);

  return (
    <TarjetaPropuestaShell
      testID={testID}
      aviso={
        lista
          ? 'Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.'
          : 'Esto entendí, pero falta completar algo antes de emitirla.'
      }
    >
      <View style={{ gap: tema.espacio.xs }}>
        {/* `fact-hitl` (mapeo 2026-10-12): el encabezado «Factura C · ARCA» del prototipo. El tipo es el
            que manda el backend en la propuesta (`tipo_comprobante`) — no se escribe «C» a mano: según la
            condición fiscal del emisor puede ser otro. Sin tipo, sin encabezado. */}
        {propuesta.tipoComprobante != null && (
          <Text
            testID={`${testID}-tipo`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontWeight: '600' }}
          >
            {`Factura ${propuesta.tipoComprobante} · ARCA`}
          </Text>
        )}
        {nombreCliente !== '' && (
          <Row testID={`${testID}-cliente`}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Cliente</Text>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{nombreCliente}</Text>
              {condicionIva != null && (
                <Text
                  testID={`${testID}-cliente-condicion`}
                  style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
                >
                  {condicionIva}
                </Text>
              )}
              {/* 🔴 Lo único que le dice a quien va a emitir que está confirmando un CUIT/condición que no
                  tipeó: salieron de su registro de clientes. Sin la marca, el dato ajeno parece dictado. */}
              {delRegistro && (
                <Text
                  testID={`${testID}-cliente-registro`}
                  style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontWeight: '600' }}
                >
                  De tu registro de clientes
                </Text>
              )}
            </View>
          </Row>
        )}

        {items.map((item, indice) => (
          <Row key={`${item.descripcion}-${indice}`} testID={`${testID}-item-${indice}`}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{item.descripcion}</Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {item.cantidad} × {item.precioUnitario}
              </Text>
            </View>
          </Row>
        ))}

        <Text testID={`${testID}-total`} style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.base, fontWeight: '600' }}>
          Total: {total}
        </Text>

        {lectura != null && lectura.faltantes.length > 0 && (
          <Text testID={`${testID}-faltantes`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {/* El backend manda un faltante por CAMPO, y varios comparten la misma frase. */}
            {[...new Set(lectura.faltantes.map((f) => f.mensaje))].join(' · ')}
          </Text>
        )}

        {textoMotivo}

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
            edicion === 'menu'
              ? [
                  { etiqueta: 'Datos de venta', onPress: () => setEdicion('datos_venta'), testID: `${testID}-menu-datos-venta` },
                  { etiqueta: 'Ítems', onPress: () => setEdicion('items'), testID: `${testID}-menu-items` },
                  { etiqueta: 'Cliente', onPress: () => setEdicion('cliente'), testID: `${testID}-menu-cliente` },
                  { etiqueta: 'Volver', onPress: () => setEdicion(null), testID: `${testID}-menu-volver` },
                ]
              : [
                  {
                    etiqueta: 'Editar',
                    onPress: () => void abrirEdicion(),
                    variante: lista ? 'secundario' : 'primario',
                    deshabilitado: apagados,
                    testID: `${testID}-editar`,
                  },
                  {
                    etiqueta: 'Cancelar',
                    onPress: () => void cancelar(),
                    variante: 'peligro',
                    deshabilitado: apagados,
                    testID: `${testID}-cancelar`,
                  },
                  ...(lista
                    ? [
                        {
                          etiqueta: enviando || emitiendo ? 'Emitiendo…' : 'Emitir la factura',
                          onPress: () => void emitir(),
                          variante: 'primario' as const,
                          deshabilitado: apagados,
                          testID: `${testID}-emitir`,
                        },
                      ]
                    : []),
                ]
          }
        />
      </View>
    </TarjetaPropuestaShell>
  );
}
