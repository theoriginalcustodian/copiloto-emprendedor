import { useCallback, useEffect, useRef, useState } from 'react';

import {
  agregarItem,
  cancelarFactura,
  confirmarConTokenFresco,
  crearFactura,
  estadoAfip,
  esperarEcoDelSignal,
  esperarEstadoEstable,
  estadoFactura as consultarEstadoFactura,
  quitarItem,
  setCliente,
  setDatosVenta,
  type AmbienteAfip,
  type Comprobante,
  type ConfirmarResultado,
  type DatosVentaInput,
  type EstadoFacturaResp,
  type NuevoItem,
  type ReceptorInput,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { DetalleComprobante } from './DetalleComprobante';
import { derivarPasoVisible, type PasoVisible } from './maquinaEstado';
import { PasoCliente } from './PasoCliente';
import { PasoDatosVenta } from './PasoDatosVenta';
import { PasoItems } from './PasoItems';
import { PasoResumen } from './PasoResumen';
import { SeccionMeDeben, type SeccionMeDebenHandle } from './SeccionMeDeben';
import { SeccionMisComprobantes, type SeccionMisComprobantesHandle } from './SeccionMisComprobantes';
import { TarjetaComprobante } from './TarjetaComprobante';
import './facturacion.css';

const INTERVALO_POLL_EMISION_MS = 1500;

type PasoEditable = Extract<PasoVisible, 'datos_venta' | 'items' | 'cliente'>;

type EstadoGate =
  | { tipo: 'verificando' }
  | { tipo: 'sin_cuit' }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' }
  | { tipo: 'bloqueado'; cuit: string }
  /**
   * 🔴 `ambiente` viaja hasta acá a propósito. Es el dato que decide si el botón del resumen dice
   * "Confirmar y emitir" o **"Emitir factura real"**. `null` = el backend no lo informó; la pantalla lo
   * DICE, no asume homologación (que sería la suposición "segura" y es justo la que causa el error caro).
   */
  | { tipo: 'listo'; cuit: string; ambiente: AmbienteAfip | null };

/**
 * `PantallaFacturacion` — port de `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx` a
 * `copiloto-web`. **PR1: el wizard de creación** (gate + los 4 pasos). **PR2: comprobante emitido +
 * cobro** (`TarjetaComprobante` + `SeccionCobro`). **PR3: "Mis comprobantes" + anulación**
 * (`SeccionMisComprobantes`) + `DetalleComprobante` como overlay. **PR4 (este): "Te deben"**
 * (`SeccionMeDeben`) montada como sección fija arriba del listado, y `DetalleComprobante` cableado como
 * overlay que abre `PantallaFacturacion` al tocar una fila de `SeccionMisComprobantes` — mismo patrón
 * que mobile: dos secciones fijas + el wizard/gate, no tabs separados.
 *
 * 🔴 **Sin el shell.** El wiring del tab de Facturación en el shell de `copiloto-web` (dónde vive esta
 * pantalla dentro de la navegación general) es explícitamente NO-alcance de este PR — lo hace la sesión
 * frontend por separado.
 *
 * 🔴 **El paso visible se DERIVA, nunca se cuenta.** `derivarPasoVisible` (`maquinaEstado.ts`) traduce
 * `EstadoFacturaResp.estado` a la pantalla correspondiente; esta pantalla NO mantiene un `useState` de
 * "paso actual" paralelo -- si lo hiciera, se desincronizaría apenas el usuario borrara un ítem estando
 * en el resumen (el backend recalcula `estado` a partir de los datos, así que la próxima lectura ya
 * retrocede sola). La ÚNICA excepción es `pasoEdicion`: un toggle LOCAL que sólo importa mientras el
 * backend ya está en `esperando_confirmacion` y el usuario pidió "Editar y confirmar" -- se limpia solo
 * apenas el backend deja de estar en resumen (ver el `useEffect` de `pasoBackend` más abajo).
 *
 * 🔴 **El gate es `puedeFacturar`, ANTES de crear un borrador.** Un tenant sin certificado hace que el
 * borrador nazca TERMINAL -- `{estado:'rechazada', terminado:true, motivo:'sin_certificado_afip'}` en el
 * primer poll, sin ventana de convergencia. Por eso el gate se resuelve ANTES de llamar `crearFactura` --
 * un usuario nuevo nunca ve la palabra "rechazada" por no haber configurado nada todavía. El caso queda
 * igual como red de seguridad en `maquinaEstado.ts` (`configurar_rechazo`).
 *
 * 🔴 **Sin caché de CUIT.** A diferencia de mobile (que cachea el CUIT en `AsyncStorage` como
 * optimización de primera pintura), esta pantalla le pregunta siempre al backend vía `estadoAfip()` sin
 * parámetro -- el backend ya resuelve el CUIT con `primer_cuit()` cuando la llamada va sin argumento
 * (confirmado contra `afip.ts::EstadoAfip.cuit`). No hay `cuitCache.ts` que portar en PR1.
 */
export interface PantallaFacturacionProps {
  /**
   * Un borrador de factura YA creado, del que esta pantalla tiene que hacerse cargo en vez de crear
   * uno nuevo (p. ej. "Facturar" desde un presupuesto, PR fuera de alcance de PR1 pero el prop se porta
   * igual porque el efecto de creación ya lo respeta).
   */
  facturaIdInicial?: string;
}

export function PantallaFacturacion({ facturaIdInicial }: PantallaFacturacionProps = {}) {
  const [gate, setGate] = useState<EstadoGate>({ tipo: 'verificando' });
  const [facturaId, setFacturaId] = useState<string | null>(facturaIdInicial ?? null);
  const [creandoBorrador, setCreandoBorrador] = useState(false);
  const [errorBorrador, setErrorBorrador] = useState(false);
  const [reintentoBorrador, setReintentoBorrador] = useState(0);
  const [estadoFacturaActual, setEstadoFacturaActual] = useState<EstadoFacturaResp | null>(null);
  // Eco LOCAL de lo que el usuario tipeó en los pasos 1 y 3 -- `FacturaWorkflow.estado()` no lo
  // devuelve. Sólo alimenta el resumen; nunca decide qué paso mostrar.
  const [datosVentaLocal, setDatosVentaLocal] = useState<DatosVentaInput | null>(null);
  const [clienteLocal, setClienteLocal] = useState<ReceptorInput | null>(null);
  const [pasoEdicion, setPasoEdicion] = useState<PasoEditable | null>(null);
  /** La fila cuyo detalle se está mirando -- vive acá porque el overlay se monta a nivel pantalla,
   *  no dentro de `SeccionMisComprobantes` (mismo motivo que mobile: un solo lugar decide qué overlay
   *  hay montado, y refrescar «Te deben» tras un cobro necesita llegar hasta acá de cualquier forma). */
  const [detalleComprobante, setDetalleComprobante] = useState<Comprobante | null>(null);
  const refComprobantes = useRef<SeccionMisComprobantesHandle>(null);
  const refMeDeben = useRef<SeccionMeDebenHandle>(null);

  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // 1. Chequear el gate `puedeFacturar` contra `/afip/estado`, sin caché de CUIT.
  useEffect(() => {
    if (gate.tipo !== 'verificando') return;
    let cancelado = false;
    estadoAfip()
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'no_disponible') {
          setGate({ tipo: 'no_disponible' });
          return;
        }
        const cuit = res.cuit ?? null;
        if (!cuit) {
          // Ni backend: el tenant todavía no vinculó nada. Es el estado inicial legítimo.
          setGate({ tipo: 'sin_cuit' });
          return;
        }
        setGate(
          res.puedeFacturar
            ? { tipo: 'listo', cuit, ambiente: res.ambiente ?? null }
            : { tipo: 'bloqueado', cuit },
        );
      })
      .catch(() => {
        if (!cancelado && vivo.current) setGate({ tipo: 'error' });
      });
    return () => {
      cancelado = true;
    };
  }, [gate]);

  // 2. Adoptar un borrador que llega de AFUERA (p. ej. facturar desde un presupuesto, fuera de PR1).
  useEffect(() => {
    if (facturaIdInicial == null) return;
    let cancelado = false;
    setCreandoBorrador(true);
    setErrorBorrador(false);
    (async () => {
      const { estado } = await esperarEstadoEstable(facturaIdInicial);
      if (cancelado || !vivo.current) return;
      setEstadoFacturaActual(estado);
      setCreandoBorrador(false);
    })().catch(() => {
      if (!cancelado && vivo.current) {
        setErrorBorrador(true);
        setCreandoBorrador(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [facturaIdInicial]);

  // 3. Gate pasado y sin factura activa -> crear el borrador y esperar a que el estado se estabilice.
  useEffect(() => {
    if (gate.tipo !== 'listo' || facturaId !== null) return;
    let cancelado = false;
    setCreandoBorrador(true);
    setErrorBorrador(false);
    const { cuit } = gate;
    (async () => {
      const res = await crearFactura(cuit);
      if (cancelado || !vivo.current) return;
      if (res.status === 'no_disponible') {
        setErrorBorrador(true);
        setCreandoBorrador(false);
        return;
      }
      const { estado } = await esperarEstadoEstable(res.facturaId);
      if (cancelado || !vivo.current) return;
      setFacturaId(res.facturaId);
      setEstadoFacturaActual(estado);
      setCreandoBorrador(false);
    })().catch(() => {
      if (!cancelado && vivo.current) {
        setErrorBorrador(true);
        setCreandoBorrador(false);
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reintentoBorrador` sólo existe para forzar un rearranque manual.
  }, [gate, facturaId, reintentoBorrador]);

  const pasoBackend = estadoFacturaActual ? derivarPasoVisible(estadoFacturaActual) : null;

  // 4. `pasoEdicion` sólo tiene sentido mientras el backend está en `resumen` -- apenas deja de estarlo,
  // se limpia solo. Ver el docstring del módulo.
  useEffect(() => {
    if (pasoBackend !== 'resumen') setPasoEdicion(null);
  }, [pasoBackend]);

  /**
   * 5. Repoleo mientras AFIP trabaja.
   *
   * 🔴 **No corta en `emitida`: sigue hasta `terminado`.** El PDF se genera DESPUÉS del CAE, así que
   * entre uno y otro hay una ventana de segundos en la que la factura ya tiene CAE y todavía no tiene
   * comprobante imprimible. `terminado` cubre además `rechazada`/`cancelada`, así que sirve de corte
   * único sin enumerar estados.
   */
  useEffect(() => {
    if (!facturaId) return;
    const emitiendo = estadoFacturaActual?.estado === 'emitiendo' || estadoFacturaActual?.estado === 'emitida';
    if (!emitiendo || estadoFacturaActual?.terminado === true) return;
    let detenido = false;
    const intervalo = setInterval(() => {
      consultarEstadoFactura(facturaId)
        .then((nuevo) => {
          if (detenido || !vivo.current) return;
          setEstadoFacturaActual(nuevo);
        })
        .catch(() => {
          // Un fallo de red puntual no aborta el polling -- el próximo tick reintenta.
        });
    }, INTERVALO_POLL_EMISION_MS);
    return () => {
      detenido = true;
      clearInterval(intervalo);
    };
  }, [facturaId, estadoFacturaActual?.estado, estadoFacturaActual?.terminado]);

  /**
   * 6. La factura recién emitida entra en "Mis comprobantes".
   *
   * Corta por `terminado` y no por `estado === 'emitida'`, por la misma razón que el poll de arriba:
   * entre el CAE y el PDF hay una ventana, y releer en el medio trae el comprobante a medio hacer.
   */
  useEffect(() => {
    if (estadoFacturaActual?.terminado !== true) return;
    void refComprobantes.current?.recargar();
  }, [estadoFacturaActual?.terminado, estadoFacturaActual?.estado]);

  /** Relectura simple, sin esperar nada. Para refrescos que NO siguen a un signal. */
  const actualizarEstado = useCallback(async () => {
    if (!facturaId) return;
    const nuevo = await consultarEstadoFactura(facturaId);
    if (vivo.current) setEstadoFacturaActual(nuevo);
  }, [facturaId]);

  /**
   * 🔴 **Relectura DESPUÉS DE UN SIGNAL — no alcanza con leer una vez.** Los `POST` de esta pantalla no
   * ejecutan nada: mandan un signal a Temporal y devuelven 200 al instante. Leer el estado inmediatamente
   * es una carrera contra el workflow, y perderla deja la pantalla congelada sobre un backend que sí
   * avanzó. `esperarEcoDelSignal` repolea hasta que el estado cambie, con corte honesto.
   */
  const actualizarEstadoTrasSignal = useCallback(
    async (previo: EstadoFacturaResp | null) => {
      if (!facturaId) return;
      const { estado } = await esperarEcoDelSignal(facturaId, previo);
      if (vivo.current) setEstadoFacturaActual(estado);
    },
    [facturaId],
  );

  const guardarDatosVenta = useCallback(
    async (datos: DatosVentaInput) => {
      if (!facturaId) return;
      const previo = estadoFacturaActual;
      await setDatosVenta(facturaId, datos);
      if (vivo.current) setDatosVentaLocal(datos);
      await actualizarEstadoTrasSignal(previo);
    },
    [facturaId, actualizarEstadoTrasSignal, estadoFacturaActual],
  );

  const agregarItemYActualizar = useCallback(
    async (item: NuevoItem) => {
      if (!facturaId) return;
      const previo = estadoFacturaActual;
      await agregarItem(facturaId, item);
      await actualizarEstadoTrasSignal(previo);
    },
    [facturaId, actualizarEstadoTrasSignal, estadoFacturaActual],
  );

  const quitarItemYActualizar = useCallback(
    async (indice: number) => {
      if (!facturaId) return;
      const previo = estadoFacturaActual;
      await quitarItem(facturaId, indice);
      await actualizarEstadoTrasSignal(previo);
    },
    [facturaId, actualizarEstadoTrasSignal, estadoFacturaActual],
  );

  const guardarClienteYActualizar = useCallback(
    async (receptor: ReceptorInput) => {
      if (!facturaId) return;
      const previo = estadoFacturaActual;
      await setCliente(facturaId, receptor);
      if (vivo.current) setClienteLocal(receptor);
      await actualizarEstadoTrasSignal(previo);
    },
    [facturaId, actualizarEstadoTrasSignal, estadoFacturaActual],
  );

  const confirmarYEmitir = useCallback(async (): Promise<ConfirmarResultado> => {
    if (!facturaId) return { emitida: false, motivo: 'no hay una factura activa' };
    const resultado = await confirmarConTokenFresco(facturaId);
    if (resultado.estado && vivo.current) setEstadoFacturaActual(resultado.estado);
    return resultado;
  }, [facturaId]);

  const cancelarYActualizar = useCallback(async () => {
    if (!facturaId) return;
    await cancelarFactura(facturaId);
    await actualizarEstado();
  }, [facturaId, actualizarEstado]);

  const nuevaFactura = useCallback(() => {
    setFacturaId(null);
    setEstadoFacturaActual(null);
    setDatosVentaLocal(null);
    setClienteLocal(null);
    setPasoEdicion(null);
    setErrorBorrador(false);
  }, []);

  const cuitConocido = gate.tipo === 'listo' || gate.tipo === 'bloqueado' ? gate.cuit : null;

  return (
    <div className="facturacion-screen" data-testid="pantalla-facturacion">
      <header className="facturacion-screen__header">
        <h1 className="facturacion-screen__title">Facturación</h1>
      </header>

      {gate.tipo === 'verificando' ? (
        <div className="facturacion-screen__loading" data-testid="facturacion-cargando">
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </div>
      ) : gate.tipo === 'sin_cuit' || gate.tipo === 'bloqueado' ? (
        <BloqueConfigurar />
      ) : gate.tipo === 'no_disponible' ? (
        <p className="facturacion-screen__empty" data-testid="facturacion-no-disponible">
          La facturación todavía no está disponible.
        </p>
      ) : gate.tipo === 'error' ? (
        <p className="facturacion-screen__empty" data-testid="facturacion-error-estado">
          No pudimos verificar tu estado de facturación. Probá de nuevo.
        </p>
      ) : errorBorrador ? (
        <div className="facturacion-screen__error-borrador" data-testid="facturacion-error-borrador">
          <p>No pudimos iniciar una factura nueva.</p>
          <Button onClick={() => setReintentoBorrador((t) => t + 1)} data-testid="facturacion-error-borrador-reintentar">
            Reintentar
          </Button>
        </div>
      ) : creandoBorrador || !facturaId || !estadoFacturaActual || pasoBackend == null ? (
        <div className="facturacion-screen__loading" data-testid="facturacion-cargando">
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </div>
      ) : (
        <PasoActivo
          pasoBackend={pasoBackend}
          pasoEdicion={pasoEdicion}
          estado={estadoFacturaActual}
          ambienteActivo={gate.tipo === 'listo' ? gate.ambiente : null}
          datosVentaLocal={datosVentaLocal}
          clienteLocal={clienteLocal}
          onGuardarDatosVenta={guardarDatosVenta}
          onAgregarItem={agregarItemYActualizar}
          onQuitarItem={quitarItemYActualizar}
          onGuardarCliente={guardarClienteYActualizar}
          onConfirmar={confirmarYEmitir}
          onCancelar={cancelarYActualizar}
          onEditar={setPasoEdicion}
          onVolverResumen={() => setPasoEdicion(null)}
          onNuevaFactura={nuevaFactura}
          onCobroRegistrado={() => {
            void refMeDeben.current?.recargar();
            void refComprobantes.current?.recargar();
          }}
        />
      )}

      {/* «Te deben» + «Mis comprobantes»: dos secciones FIJAS de la pantalla, junto con el wizard/gate
          de arriba -- mismo patrón que mobile, no tabs separados. «Te deben» ANTES del listado completo
          porque es la pregunta que se hace primero al abrir Facturación. Se ocultan sin CUIT conocido:
          preguntarle al backend por comprobantes de un tenant que ni siquiera pasó el gate no tiene
          sentido y generaría llamadas condenadas a `no_disponible`. */}
      {cuitConocido && (
        <>
          <SeccionMeDeben ref={refMeDeben} />
          <SeccionMisComprobantes ref={refComprobantes} cuit={cuitConocido} onVerDetalle={setDetalleComprobante} />
        </>
      )}

      {/* Overlay: se abre al tocar una fila de `SeccionMisComprobantes`. Estado LOCAL acá, no en la
          sección -- mismo motivo que mobile: un solo lugar decide qué overlay hay montado, y refrescar
          «Te deben» tras un cobro/anulación necesita llegar hasta acá de cualquier forma. */}
      {detalleComprobante != null && (
        <DetalleComprobante
          comprobante={detalleComprobante}
          onCerrar={() => setDetalleComprobante(null)}
          onCobroCambiado={() => void refMeDeben.current?.recargar()}
        />
      )}
    </div>
  );
}

/** El CTA que ofrece TODO camino a "todavía no configuraste tu facturación": sin CUIT, `puedeFacturar:
 *  false`, y el rechazo-red-de-seguridad de `maquinaEstado.ts`. Mismo componente, mismo copy, en los
 *  tres casos -- para el usuario es la misma situación.
 *
 *  El botón de mobile navega a `/ajustes-afip` vía `empujarUnaVez` (mecanismo propio de la navegación de
 *  RN). El wiring al shell de web (dónde vive Ajustes, cómo se navega) es explícitamente NO-alcance de
 *  PR1 — ver la nota en el prompt de la tarea; por ahora el CTA queda deshabilitado con el copy del
 *  destino, y se cablea cuando el shell lo resuelva. */
function BloqueConfigurar({ testID = 'facturacion-cta-configurar' }: { testID?: string }) {
  return (
    <div className="facturacion-screen__cta-configurar" data-testid={testID}>
      <p>Todavía no configuraste tu facturación AFIP. Vinculá tu cuenta para emitir comprobantes.</p>
      <Button disabled data-testid={`${testID}-boton`}>
        Configurar facturación
      </Button>
    </div>
  );
}

interface PasoActivoProps {
  pasoBackend: PasoVisible;
  pasoEdicion: PasoEditable | null;
  estado: EstadoFacturaResp;
  /** El ambiente de la credencial activa, o `null` si el backend no lo informó. Ver `EstadoGate`. */
  ambienteActivo: AmbienteAfip | null;
  datosVentaLocal: DatosVentaInput | null;
  clienteLocal: ReceptorInput | null;
  onGuardarDatosVenta: (datos: DatosVentaInput) => Promise<void>;
  onAgregarItem: (item: NuevoItem) => Promise<void>;
  onQuitarItem: (indice: number) => Promise<void>;
  onGuardarCliente: (receptor: ReceptorInput) => Promise<void>;
  onConfirmar: () => Promise<ConfirmarResultado>;
  onCancelar: () => Promise<void>;
  onEditar: (paso: PasoEditable) => void;
  onVolverResumen: () => void;
  onNuevaFactura: () => void;
  /** Se registró/deshizo un cobro desde la card de éxito (`TarjetaComprobante`). Refresca «Te deben»
   *  y «Mis comprobantes». */
  onCobroRegistrado: () => void;
}

/** El `switch` del paso VISIBLE (backend, salvo que `pasoEdicion` lo override estando en resumen -- ver
 *  el docstring de `PantallaFacturacion`). Aislado en su propio componente para que el `switch` no viva
 *  mezclado con los `useState`/`useEffect` de arriba.
 *
 *  `comprobante` renderiza `TarjetaComprobante` (con `SeccionCobro` embebida). `rechazada` y
 *  `cancelada` siguen con un placeholder simple. */
function PasoActivo({
  pasoBackend,
  pasoEdicion,
  estado,
  ambienteActivo,
  datosVentaLocal,
  clienteLocal,
  onGuardarDatosVenta,
  onAgregarItem,
  onQuitarItem,
  onGuardarCliente,
  onConfirmar,
  onCancelar,
  onEditar,
  onVolverResumen,
  onNuevaFactura,
  onCobroRegistrado,
}: PasoActivoProps) {
  const enEdicionDesdeResumen = pasoBackend === 'resumen' && pasoEdicion != null;
  const pasoMostrado = enEdicionDesdeResumen ? pasoEdicion : pasoBackend;

  switch (pasoMostrado) {
    case 'datos_venta':
      return (
        <PasoDatosVenta
          estado={estado}
          onGuardar={onGuardarDatosVenta}
          modoEdicion={enEdicionDesdeResumen}
          onVolverResumen={onVolverResumen}
        />
      );
    case 'items':
      return (
        <PasoItems
          estado={estado}
          onAgregar={onAgregarItem}
          onQuitar={onQuitarItem}
          modoEdicion={enEdicionDesdeResumen}
          onVolverResumen={onVolverResumen}
        />
      );
    case 'cliente':
      return (
        <PasoCliente
          estado={estado}
          onGuardar={onGuardarCliente}
          modoEdicion={enEdicionDesdeResumen}
          onVolverResumen={onVolverResumen}
        />
      );
    case 'resumen':
      return (
        <PasoResumen
          estado={estado}
          ambiente={ambienteActivo}
          datosVenta={datosVentaLocal}
          cliente={clienteLocal}
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
          onEditar={onEditar}
        />
      );
    case 'emitiendo':
      return (
        <div className="facturacion-screen__loading" data-testid="facturacion-paso-emitiendo">
          <Skeleton height={64} radius={16} />
        </div>
      );
    case 'comprobante':
      return (
        <TarjetaComprobante estado={estado} onNuevaFactura={onNuevaFactura} onCobroRegistrado={onCobroRegistrado} />
      );
    case 'configurar_rechazo':
      return <BloqueConfigurar />;
    case 'rechazada':
      return (
        <div className="facturacion-screen__placeholder" data-testid="facturacion-rechazada">
          <h2 className="facturacion-screen__placeholder-titulo facturacion-screen__placeholder-titulo--peligro">
            Tu factura fue rechazada
          </h2>
          <p data-testid="facturacion-rechazada-motivo">{estado.motivo}</p>
          <Button onClick={onNuevaFactura} data-testid="facturacion-rechazada-nueva">
            Nueva factura
          </Button>
        </div>
      );
    case 'cancelada':
      return (
        <div className="facturacion-screen__placeholder" data-testid="facturacion-cancelada">
          <h2 className="facturacion-screen__placeholder-titulo">Factura cancelada</h2>
          <Button onClick={onNuevaFactura} data-testid="facturacion-cancelada-nueva">
            Nueva factura
          </Button>
        </div>
      );
    default:
      // Unión abierta (`EstadoFactura`) -- un estado nuevo del backend no crashea, se admite sin mentir.
      return (
        <p className="facturacion-screen__empty" data-testid="facturacion-paso-desconocido">
          Estado no reconocido: {estado.estado}
        </p>
      );
  }
}
