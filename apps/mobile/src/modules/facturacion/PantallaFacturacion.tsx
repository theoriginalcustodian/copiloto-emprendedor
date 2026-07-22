import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

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
  obtenerComprobante,
  type Comprobante,
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
import { DetalleComprobante } from './DetalleComprobante';
import { SeccionMeDeben, type SeccionMeDebenHandle } from './SeccionMeDeben';
import { SeccionMisComprobantes, type SeccionMisComprobantesHandle } from './SeccionMisComprobantes';
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
export interface PantallaFacturacionProps {
  /**
   * Id de FILA de un comprobante que llegó desde la lista de actividad — abre su detalle al montar.
   *
   * 🔴 **No confundir con `facturaIdInicial`**, que es el id del **workflow de emisión** (`presu-12`).
   * Son dos espacios de ids y los dos son legítimos: aquél sirve MIENTRAS se emite, éste DESPUÉS.
   */
  comprobanteIdInicial?: number;
  /**
   * Un borrador de factura YA creado, del que esta pantalla tiene que hacerse cargo en vez de crear
   * uno nuevo.
   *
   * 🔴 **Es lo que hace que "Facturar" desde un presupuesto NO necesite una pantalla nueva.**
   * `POST /presupuestos/{id}/facturar` arma el borrador con el receptor y los ítems del presupuesto y
   * devuelve su id; el contrato es explícito en que **no emite** y en que hay que depositar al usuario
   * en el gate de confirmación que ya existe — este. Emitir es un acto fiscal y ese gate es el único
   * lugar donde se firma: duplicarlo sería tener dos implementaciones de la única cosa que no puede
   * tener dos.
   *
   * Sin esto, el efecto de más abajo crearía un borrador VACÍO y el usuario perdería los ítems que ya
   * había cargado en el presupuesto — silenciosamente, porque un borrador vacío se ve igual que el
   * arranque normal de la pantalla.
   */
  facturaIdInicial?: string;
}

export function PantallaFacturacion({ facturaIdInicial, comprobanteIdInicial }: PantallaFacturacionProps = {}) {

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
  /** La fila cuyo detalle se está mirando. Vive ACÁ y no en la sección — ver el porqué en el render. */
  const [detalleComprobante, setDetalleComprobante] = useState<Comprobante | null>(null);
  const refComprobantes = useRef<SeccionMisComprobantesHandle>(null);
  const refMeDeben = useRef<SeccionMeDebenHandle>(null);
  const [refrescandoLista, setRefrescandoLista] = useState(false);
  // Sembrado con el borrador que llega de afuera, si lo hay: el efecto de creación (más abajo) sale
  // temprano cuando `facturaId !== null`, así que esto es todo lo que hace falta para adoptarlo — el
  // polling de estado se encarga de traer sus datos, igual que con un borrador propio.
  const [facturaId, setFacturaId] = useState<string | null>(facturaIdInicial ?? null);
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

  /**
   * 2.bis Adoptar un borrador que llega de AFUERA (Facturar desde un presupuesto).
   *
   * 🔴 **Sin esto, la pantalla adopta el id y nunca carga sus datos.** El efecto 3 (crear) es el que
   * hace la primera lectura del estado —vía `esperarEstadoEstable`—, y sembrar `facturaId` lo saltea
   * a propósito para no crear un borrador de más. El polling del efecto 5 tampoco cubre el hueco:
   * arranca **sólo mientras se está emitiendo** (`emitiendo`/`emitida`), que es justo lo que un
   * borrador recién adoptado no es. Resultado: `estadoFacturaActual` se quedaba en `null` para
   * siempre y el usuario llegaba desde el presupuesto a una pantalla muerta.
   *
   * Lo cazó un test escrito para el camino del device antes de recorrerlo — no había síntoma en
   * ninguna otra suite, porque ninguna montaba esta pantalla con un borrador ajeno.
   *
   * `esperarEstadoEstable` y no `estadoFactura` a secas: el borrador se acaba de armar con signals
   * asíncronos (receptor + ítems), así que la primera lectura puede llegar antes de que estén
   * aplicados. Es la misma función y el mismo motivo que usa el camino de creación.
   */
  /**
   * Abrir un comprobante que llegó desde la lista de actividad. Se busca por id: quien navega acá
   * sólo trae un número, y "Mis comprobantes" puede no tenerlo cargado todavía.
   */
  useEffect(() => {
    if (comprobanteIdInicial == null) return;
    let cancelado = false;
    void obtenerComprobante(comprobanteIdInicial).then((res) => {
      if (cancelado || !vivo.current) return;
      if (res.status === 'ok') setDetalleComprobante(res.comprobante);
    });
    return () => { cancelado = true; };
  }, [comprobanteIdInicial]);

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

  /**
   * 6. La factura recién emitida entra en "Mis comprobantes".
   *
   * 🔴 **La lista NO se enteraba de nada.** Se cargaba una sola vez al montar y no volvía a
   * preguntar: emitir la factura de arriba dejaba la lista de abajo mostrando el mundo anterior, en
   * la misma pantalla y a centímetros de distancia. Reportado por el operador el 2026-07-21 ("no
   * tengo ninguna factura 18, solo veo hasta la 15"), y el control por HTTP confirmó que el backend
   * sí las tenía: las 24 filas estaban, la 18 primera.
   *
   * Corta por `terminado` y no por `estado === 'emitida'`, por la misma razón que el poll de arriba:
   * entre el CAE y el PDF hay una ventana, y releer en el medio trae el comprobante a medio hacer.
   * `terminado` cubre además `rechazada`/`cancelada` — releer ahí no agrega un comprobante, pero
   * tampoco molesta, y evita enumerar estados que el backend puede ampliar.
   */
  useEffect(() => {
    if (estadoFacturaActual?.terminado !== true) return;
    void refComprobantes.current?.recargar();
  }, [estadoFacturaActual?.terminado, estadoFacturaActual?.estado]);

  /**
   * El tirón-para-actualizar. Es el ÚNICO camino que cubre lo que cambió **fuera** de esta app —otro
   * dispositivo, la web, el agente por chat, un script— porque ahí no hay ninguna acción local que
   * pudiera disparar un refresco. Ningún "recargar después de X" sirve cuando la app nunca hizo X.
   */
  const refrescarLista = useCallback(async () => {
    setRefrescandoLista(true);
    try {
      // Las dos secciones, no sólo el listado: el tirón es el ÚNICO camino que cubre lo que cambió
      // AFUERA de esta app, y un cobro registrado desde el chat o desde otro dispositivo cambia
      // justamente «Te deben». Refrescar una sola dejaría media pantalla vieja al lado de la fresca.
      await Promise.all([refComprobantes.current?.recargar(), refMeDeben.current?.recargar()]);
    } finally {
      if (vivo.current) setRefrescandoLista(false);
    }
  }, []);

  /** Relectura simple, sin esperar nada. Para refrescos que NO siguen a un signal. */
  const actualizarEstado = useCallback(async () => {
    if (!facturaId) return;
    const nuevo = await consultarEstadoFactura(facturaId);
    if (vivo.current) setEstadoFacturaActual(nuevo);
  }, [facturaId]);

  /**
   * 🔴 **Relectura DESPUÉS DE UN SIGNAL — no alcanza con leer una vez.** Los `POST` de esta pantalla
   * no ejecutan nada: mandan un signal a Temporal y devuelven 200 al instante. Leer el estado
   * inmediatamente es una carrera contra el workflow, y perderla deja la pantalla congelada sobre un
   * backend que sí avanzó: el usuario toca "Continuar", no pasa nada, y no hay error que mirar.
   *
   * Cazado en device (2026-07-21): `POST /datos-venta` → 200, el backend en `datos_venta_ok`
   * verificado por HTTP, y la pantalla seguía en el paso 1. **Intermitente**, que es lo peor: cuando
   * el signal se procesa rápido parece andar. `esperarEcoDelSignal` repolea hasta que el estado
   * cambie, con corte honesto.
   */
  const actualizarEstadoTrasSignal = useCallback(async (previo: EstadoFacturaResp | null) => {
    if (!facturaId) return;
    const { estado } = await esperarEcoDelSignal(facturaId, previo);
    if (vivo.current) setEstadoFacturaActual(estado);
  }, [facturaId]);

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
    <MarcoGlass titulo="Facturación" icono="doc_search" testID="pantalla-facturacion">
      <ScrollFormulario
        style={styles.scroll}
        testID="facturacion-lista"
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.lg, gap: tema.espacio.lg }]}
        refreshControl={
          <RefreshControl
            testID="facturacion-refresco"
            refreshing={refrescandoLista}
            onRefresh={refrescarLista}
            tintColor={tema.color.acento}
            colors={[tema.color.acento]}
          />
        }
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

        {cuitConocido && (
          <>
            {/* «Te deben» ANTES del listado completo: es la pregunta que se hace primero al abrir
                Facturación. Sección de esta misma pantalla y no destino aparte — lo que se debe SON
                las facturas emitidas, y separarlas obligaría a preguntarse en cuál de los dos
                lugares está una factura concreta. */}
            <SeccionMeDeben ref={refMeDeben} />
            <SeccionMisComprobantes ref={refComprobantes} cuit={cuitConocido} onVerDetalle={setDetalleComprobante} />
          </>
        )}
      </ScrollFormulario>

      {/* 🔴 FUERA del `ScrollFormulario`, a propósito. Un overlay absoluto montado DENTRO del scroll
          se posiciona contra el contenido —miles de píxeles con 20 comprobantes— y aparece centrado
          lejos de la vista: existe, responde, y no se ve. Pasó exactamente eso en device
          (2026-07-21) y el `onPress` llegaba. Acá el padre es el marco, que mide la pantalla. */}
      {detalleComprobante != null && (
        <DetalleComprobante
          comprobante={detalleComprobante}
          onCerrar={() => setDetalleComprobante(null)}
          onCobroCambiado={() => void refMeDeben.current?.recargar()}
        />
      )}
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
