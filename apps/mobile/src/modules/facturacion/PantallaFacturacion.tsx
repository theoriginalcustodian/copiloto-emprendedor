import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  agregarItem,
  cancelarFactura,
  confirmarConTokenFresco,
  crearFactura,
  estadoAfip,
  esperarEstadoEstable,
  estadoFactura as consultarEstadoFactura,
  quitarItem,
  setCliente,
  setDatosVenta,
  type AmbienteAfip,
  type ConfirmarResultado,
  type DatosVentaInput,
  type EstadoFacturaResp,
  type NuevoItem,
  type ReceptorInput,
} from '@copiloto/core';

import { empujarUnaVez, reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { useTema } from '../../theme/ThemeProvider';
// `ScrollFormulario` (y no un `ScrollView`) porque los cuatro pasos son formularios: revela el campo
// que recibe el foco en vez de dejarlo tapado por el teclado. Ver su docstring y el de `MarcoGlass`.
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { guardarCuitCacheado, leerCuitCacheado } from '../afip/cuitCache';
import { derivarPasoVisible, type PasoVisible } from './maquinaEstado';
import { PasoCliente } from './PasoCliente';
import { PasoDatosVenta } from './PasoDatosVenta';
import { PasoItems } from './PasoItems';
import { PasoResumen } from './PasoResumen';
import { SeccionMisComprobantes } from './SeccionMisComprobantes';
import { TarjetaComprobante } from './TarjetaComprobante';

const INTERVALO_POLL_EMISION_MS = 1500;

type PasoEditable = Extract<PasoVisible, 'datos_venta' | 'items' | 'cliente'>;

type EstadoGate =
  | { tipo: 'resolviendo_cuit' }
  | { tipo: 'sin_cuit' }
  /** `cuit: null` = no había caché local; se le pregunta al backend, que lo resuelve con `primer_cuit()`. */
  | { tipo: 'verificando'; cuit: string | null }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' }
  | { tipo: 'bloqueado'; cuit: string }
  /**
   * 🔴 `ambiente` viaja hasta acá a propósito. Es el dato que decide si el botón del resumen dice
   * "Confirmar y emitir" o **"Emitir factura real"**, y el pedido de la sesión de backend fue
   * explícito: *"emitir un comprobante fiscal real creyendo que se está probando es el error caro de
   * este flujo, y el único lugar donde se puede evitar es la pantalla donde el usuario aprieta
   * Confirmar"*. `undefined`/`null` = el backend no lo informó; la pantalla lo DICE, no asume
   * homologación (que sería la suposición "segura" y es justo la que causa el error caro).
   */
  | { tipo: 'listo'; cuit: string; ambiente: AmbienteAfip | null };

/**
 * `PantallaFacturacion` — F6: emisión + comprobante + "Mis comprobantes", en UN solo `MarcoGlass`.
 *
 * 🔴 **Por qué un solo glass y no una ruta por paso.** El plan de UI (§6) y el prompt de esta sesión lo
 * marcan como el motivo raíz de un bug ya pagado: *"apilar 5 modales para un formulario es justo lo que
 * rompió la app hoy"* (`empujarUnaVez`, commit `8bec58b`). Todo el flujo -- gate, los 4 pasos, el
 * comprobante y "Mis comprobantes" -- vive en sub-componentes de ESTA carpeta, montados uno a la vez
 * dentro del mismo `ScrollView`.
 *
 * 🔴 **El paso visible se DERIVA, nunca se cuenta.** `derivarPasoVisible` (`maquinaEstado.ts`) traduce
 * `EstadoFacturaResp.estado` a la pantalla correspondiente; esta pantalla NO mantiene un `useState` de
 * "paso actual" paralelo -- si lo hiciera, se desincronizaría apenas el usuario borrara un ítem estando
 * en el resumen (el backend recalcula `estado` a partir de los datos, así que la próxima lectura ya
 * retrocede sola). La ÚNICA excepción es `pasoEdicion`: un toggle LOCAL que sólo importa mientras el
 * backend ya está en `esperando_confirmacion` (todos los datos son válidos) y el usuario pidió "Editar y
 * confirmar" -- no compite con la verdad del backend, la complementa (qué SUB-vista mostrar del MISMO
 * paso backend), y se limpia solo apenas el backend deja de estar en resumen (ver el `useEffect` de
 * `pasoBackend` más abajo).
 *
 * 🔴 **El gate es `puedeFacturar`, ANTES de crear un borrador.** Medido contra el backend vivo con un
 * tenant sin certificado (`coordinacion/2026-07-21_hallazgo_frontend-estado-rechazada-sin-certificado.md`):
 * el borrador nace TERMINAL -- `{estado:'rechazada', terminado:true, motivo:'sin_certificado_afip'}` en
 * el primer poll, sin ventana de convergencia. Por eso el gate se resuelve ANTES de llamar `crearFactura`
 * -- un usuario nuevo nunca ve la palabra "rechazada" por no haber configurado nada todavía. El caso
 * queda igual como red de seguridad en `maquinaEstado.ts` (`configurar_rechazo`), por si esta pantalla
 * llegara a crear un borrador con un gate ya vencido (p.ej. el certificado se revocó mientras la app
 * estaba abierta).
 *
 * 🔴 **El CUIT es una caché local, no un dato garantizado.** Ver `cuitCache.ts` -- a la fecha de esta
 * implementación no hay forma de descubrirlo desde el backend (el pedido está hecho, sin confirmar
 * shippeado) ni `packages/core` (NO-TOCAR de esta sesión) lo expone aunque el backend ya lo mande. Sin
 * CUIT cacheado, esta pantalla se comporta EXACTAMENTE como `puedeFacturar:false`: mismo CTA, mismo
 * copy -- porque, para el usuario, el resultado es el mismo ("todavía no configuraste tu facturación").
 */
export function PantallaFacturacion() {

  /**
   * 🔴 **Esta pantalla también es LANZADORA, y sin esto su único CTA no hace nada.**
   *
   * `empujarUnaVez` mantiene la invariante "un solo glass a la vez" con una puerta que se cierra al
   * lanzar y que sólo reabre la pantalla lanzadora al recuperar el foco. El escritorio cerró la puerta
   * cuando lanzó `/facturacion`; si Facturación no la reabre, su botón "Configurar facturación" es un
   * no-op silencioso: el toque llega, `empujarUnaVez` ve la puerta cerrada y vuelve sin navegar.
   *
   * **Verificado en device el 2026-07-21**, y el control fue lo que lo aisló: "Volver" (que usa
   * `router.back`, no la puerta) SÍ respondía en la misma pantalla, así que los toques llegaban bien y
   * lo roto no era el botón sino la puerta. Sin ese control, el sospechoso obvio habría sido el
   * `Pressable` o el layout.
   *
   * La regla general, que vale para cualquier pantalla futura: **si una pantalla lanza otra, tiene que
   * reabrir la puerta al ganar foco** — no alcanza con que lo haga el escritorio. Es exactamente lo
   * que hace `app/ajustes.tsx`, que también es destino y lanzadora a la vez.
   */
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );
  const tema = useTema();
  const [gate, setGate] = useState<EstadoGate>({ tipo: 'resolviendo_cuit' });
  const [facturaId, setFacturaId] = useState<string | null>(null);
  const [creandoBorrador, setCreandoBorrador] = useState(false);
  const [errorBorrador, setErrorBorrador] = useState(false);
  const [reintentoBorrador, setReintentoBorrador] = useState(0);
  const [estadoFacturaActual, setEstadoFacturaActual] = useState<EstadoFacturaResp | null>(null);
  // Eco LOCAL de lo que el usuario tipeó en los pasos 1 y 3 -- `FacturaWorkflow.estado()` no lo
  // devuelve (ver el docstring de `PasoResumen` para las 9 claves reales). Sólo alimenta el resumen;
  // nunca decide qué paso mostrar.
  const [datosVentaLocal, setDatosVentaLocal] = useState<DatosVentaInput | null>(null);
  const [clienteLocal, setClienteLocal] = useState<ReceptorInput | null>(null);
  const [pasoEdicion, setPasoEdicion] = useState<PasoEditable | null>(null);

  const vivo = useRef(true);
  useEffect(() => () => {
    vivo.current = false;
  }, []);

  // 1. Resolver el CUIT cacheado, una vez al montar.
  useEffect(() => {
    let cancelado = false;
    leerCuitCacheado().then((cuit) => {
      if (cancelado || !vivo.current) return;
      // Sin caché NO se corta: se le pregunta igual al backend, que desde el 2026-07-21 resuelve el
      // CUIT con `primer_cuit()` cuando la llamada va sin parámetro. Cortar acá era el defecto que el
      // pedido §2 vino a arreglar — quien cambia de teléfono no tiene caché y vería "configurá tu
      // facturación" sobre un perfil que existe.
      setGate({ tipo: 'verificando', cuit });
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // 2. Con CUIT resuelto, chequear el gate `puedeFacturar` contra `/afip/estado`.
  useEffect(() => {
    if (gate.tipo !== 'verificando') return;
    let cancelado = false;
    const { cuit } = gate;
    estadoAfip(cuit ?? undefined)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'no_disponible') {
          setGate({ tipo: 'no_disponible' });
          return;
        }
        // El CUIT que manda el backend GANA sobre el cacheado (la caché es sólo primera pintura).
        const cuitReal = res.cuit ?? cuit;
        if (!cuitReal) {
          // Ni caché ni backend: el tenant todavía no vinculó nada. Es el estado inicial legítimo.
          setGate({ tipo: 'sin_cuit' });
          return;
        }
        void guardarCuitCacheado(cuitReal);
        setGate(
          res.puedeFacturar
            ? { tipo: 'listo', cuit: cuitReal, ambiente: res.ambiente ?? null }
            : { tipo: 'bloqueado', cuit: cuitReal },
        );
      })
      .catch(() => {
        if (!cancelado && vivo.current) setGate({ tipo: 'error' });
      });
    return () => {
      cancelado = true;
    };
  }, [gate]);

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

  // 4. `pasoEdicion` sólo tiene sentido mientras el backend está en `resumen` -- apenas deja de estarlo
  // (p.ej. el usuario editó datos y ahora falta algo), se limpia solo. Ver el docstring del módulo.
  useEffect(() => {
    if (pasoBackend !== 'resumen') setPasoEdicion(null);
  }, [pasoBackend]);

  /**
   * 5. Repoleo mientras AFIP trabaja.
   *
   * 🔴 **No corta en `emitida`: sigue hasta `terminado`.** El PDF se genera DESPUÉS del CAE, así que
   * entre uno y otro hay una ventana de segundos en la que la factura ya tiene CAE y todavía no tiene
   * comprobante imprimible. Cortar en `emitida` cae justo ahí.
   *
   * Medido en device el 2026-07-21 con la factura N° 7 (CAE 86290619845862): la app mostró *"el PDF no
   * está disponible"* y el control contra `GET /afip/comprobantes`, un minuto después, devolvió
   * `pdf_url` presente. O sea el PDF existía y la pantalla decía que no — mentira por leer temprano,
   * no por un fallo del backend.
   *
   * `emitida` y `entregada` son estados distintos justamente por esto: `entregada` es el que ya tiene
   * el PDF. `terminado` cubre además `rechazada`/`cancelada`, así que sirve de corte único sin
   * enumerar estados — si mañana el backend agrega uno terminal, este loop no queda girando.
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

  const actualizarEstado = useCallback(async () => {
    if (!facturaId) return;
    const nuevo = await consultarEstadoFactura(facturaId);
    if (vivo.current) setEstadoFacturaActual(nuevo);
  }, [facturaId]);

  const guardarDatosVenta = useCallback(
    async (datos: DatosVentaInput) => {
      if (!facturaId) return;
      await setDatosVenta(facturaId, datos);
      if (vivo.current) setDatosVentaLocal(datos);
      await actualizarEstado();
    },
    [facturaId, actualizarEstado],
  );

  const agregarItemYActualizar = useCallback(
    async (item: NuevoItem) => {
      if (!facturaId) return;
      await agregarItem(facturaId, item);
      await actualizarEstado();
    },
    [facturaId, actualizarEstado],
  );

  const quitarItemYActualizar = useCallback(
    async (indice: number) => {
      if (!facturaId) return;
      await quitarItem(facturaId, indice);
      await actualizarEstado();
    },
    [facturaId, actualizarEstado],
  );

  const guardarClienteYActualizar = useCallback(
    async (receptor: ReceptorInput) => {
      if (!facturaId) return;
      await setCliente(facturaId, receptor);
      if (vivo.current) setClienteLocal(receptor);
      await actualizarEstado();
    },
    [facturaId, actualizarEstado],
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
    <MarcoGlass titulo="Facturación" icono="doc_search" testID="pantalla-facturacion">
      <ScrollFormulario
        style={styles.scroll}
        testID="facturacion-lista"
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.lg, gap: tema.espacio.lg }]}
      >
        {gate.tipo === 'resolviendo_cuit' || gate.tipo === 'verificando' ? (
          <ActivityIndicator testID="facturacion-cargando" color={tema.color.acento} />
        ) : gate.tipo === 'sin_cuit' || gate.tipo === 'bloqueado' ? (
          <BloqueConfigurar />
        ) : gate.tipo === 'no_disponible' ? (
          <Text testID="facturacion-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            La facturación todavía no está disponible.
          </Text>
        ) : gate.tipo === 'error' ? (
          <Text testID="facturacion-error-estado" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos verificar tu estado de facturación. Probá de nuevo.
          </Text>
        ) : errorBorrador ? (
          <View testID="facturacion-error-borrador" style={{ gap: tema.espacio.sm }}>
            <Text style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              No pudimos iniciar una factura nueva.
            </Text>
            <FilaBotones
              testID="facturacion-error-borrador-botones"
              botones={[
                {
                  etiqueta: 'Reintentar',
                  onPress: () => setReintentoBorrador((t) => t + 1),
                  testID: 'facturacion-error-borrador-reintentar',
                },
              ]}
            />
          </View>
        ) : creandoBorrador || !facturaId || !estadoFacturaActual || pasoBackend == null ? (
          <ActivityIndicator testID="facturacion-cargando" color={tema.color.acento} />
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
          />
        )}

        {cuitConocido && <SeccionMisComprobantes cuit={cuitConocido} />}
      </ScrollFormulario>
    </MarcoGlass>
  );
}

/** El CTA que ofrece TODO camino a "todavía no configuraste tu facturación": sin CUIT cacheado,
 *  `puedeFacturar:false`, y el rechazo-red-de-seguridad de `maquinaEstado.ts`. Mismo componente, mismo
 *  copy, en los tres casos -- para el usuario es la misma situación. */
function BloqueConfigurar({ testID = 'facturacion-cta-configurar' }: { testID?: string }) {
  const tema = useTema();
  return (
    <View testID={testID} style={{ gap: tema.espacio.sm }}>
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
        Todavía no configuraste tu facturación AFIP. Vinculá tu cuenta para emitir comprobantes.
      </Text>
      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: 'Configurar facturación',
            onPress: () => empujarUnaVez('/ajustes-afip'),
            variante: 'primario',
            testID: `${testID}-boton`,
          },
        ]}
      />
    </View>
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
}

/** El `switch` del paso VISIBLE (backend, salvo que `pasoEdicion` lo override estando en resumen -- ver
 *  el docstring de `PantallaFacturacion`). Aislado en su propio componente para que el `switch` no viva
 *  mezclado con los ~10 `useState`/`useEffect` de arriba. */
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
}: PasoActivoProps) {
  const tema = useTema();
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
      return <ActivityIndicator testID="facturacion-paso-emitiendo" color={tema.color.acento} />;
    case 'comprobante':
      return <TarjetaComprobante estado={estado} onNuevaFactura={onNuevaFactura} />;
    case 'configurar_rechazo':
      return <BloqueConfigurar />;
    case 'rechazada':
      return (
        <View testID="facturacion-rechazada" style={{ gap: tema.espacio.md }}>
          <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
            Tu factura fue rechazada
          </Text>
          <Text testID="facturacion-rechazada-motivo" style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            {estado.motivo}
          </Text>
          <FilaBotones
            testID="facturacion-rechazada-botones"
            botones={[{ etiqueta: 'Nueva factura', onPress: onNuevaFactura, testID: 'facturacion-rechazada-nueva' }]}
          />
        </View>
      );
    case 'cancelada':
      return (
        <View testID="facturacion-cancelada" style={{ gap: tema.espacio.md }}>
          <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
            Factura cancelada
          </Text>
          <FilaBotones
            testID="facturacion-cancelada-botones"
            botones={[{ etiqueta: 'Nueva factura', onPress: onNuevaFactura, testID: 'facturacion-cancelada-nueva' }]}
          />
        </View>
      );
    default:
      // Unión abierta (`EstadoFactura`) -- un estado nuevo del backend no crashea, se admite sin mentir.
      return (
        <Text testID="facturacion-paso-desconocido" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Estado no reconocido: {estado.estado}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenido: { flexGrow: 1 },
});
