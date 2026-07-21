import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import {
  ErrorValidacionFiscal,
  cambiarAmbiente,
  conectarArca,
  estadoAfip,
  guardarAjustesAfip,
  guardarPerfil,
  leerPerfil,
  type AmbienteAfip,
  type CondicionIvaEmisor,
  type EstadoAfip,
} from '@copiloto/core';

import { guardarCuitCacheado, leerCuitCacheado } from '../../afip/cuitCache';
import {
  CampoFecha,
  CampoNumero,
  CampoSecreto,
  CampoSelect,
  CampoTexto,
  FilaBotones,
  ScrollFormulario,
  type OpcionSelect,
} from '../../../theme/glass/campos';
import { MarcoGlass } from '../../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../../theme/glass/presion';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * `PantallaAfipSetup` — F5: perfil fiscal + alta ante ARCA + selector de ambiente.
 *
 * Molde: `docs/copiloto-emprendedor/2026-07-21-plan-ui-facturacion-afip.md` §5 (la especificación) y
 * `coordinacion/2026-07-21_respuesta_backend-a-frontend-afip.md` §3 (el modelo de ambiente). Todo lo
 * que esta pantalla sabe del backend sale de `@copiloto/core` (`api/afip.ts`) -- ningún `fetch`, ningún
 * código HTTP, ninguna URL acá (regla del plan §2).
 *
 * **Tres bloques, un solo `ScrollFormulario`** -- que por dentro es el `ScrollView` de
 * `react-native-gesture-handler`, no el de `react-native`: esta pantalla vive DENTRO del
 * `GestureDetector` de `MarcoGlass` (el Pan que cierra el vidrio), y un `ScrollView` nativo compite
 * por el mismo dedo (ver el docstring de `PantallaApps.tsx`, que documenta el bug ya cazado en
 * device: *"el glass de apps no se puede deslizar hacia abajo"*).
 *
 * 🔴 `ScrollFormulario` y no un `ScrollView` pelado **porque el teclado tapaba los campos** y no había
 * cómo llegar a ellos (reportado en device por el operador, 2026-07-21, justo al intentar el alta de
 * ARCA: el campo de clave está cerca del fondo). Revela el campo que recibe el foco; la otra mitad
 * —hacer que el área se achique cuando entra el teclado— vive en `MarcoGlass`.
 *
 * 🔴 **El CUIT es UN solo estado, compartido por los tres bloques.** El perfil fiscal, el alta ARCA y
 * el ambiente son todos atributos del MISMO CUIT -- no hay "un CUIT del perfil" y "otro CUIT de ARCA".
 * Se cachea vía `modules/afip/cuitCache` -- el MISMO módulo que lee `PantallaFacturacion`, a propósito:
 * esta pantalla lo escribe al guardar el perfil o completar el alta, y Facturación lo lee para su
 * primera pintura. Nació duplicado en las dos pantallas (se construyeron en paralelo) y se unificó
 * apenas se detectó: dos copias de la misma clave de almacenamiento divergen solas, y el día que una
 * cambie el string la otra deja de encontrar el dato **sin ningún error**.
 *
 * La caché es sólo una OPTIMIZACIÓN de primera pintura. La fuente de verdad es `estadoAfip()`, que
 * desde el 2026-07-21 devuelve `cuit` resuelto por el backend con `primer_cuit()` -- si la caché y el
 * backend difieren, gana el backend.
 */

/** Ritmo del polling de `estadoAfip` durante el alta ARCA -- ver §5 del plan ("cada 3 s"). */
const INTERVALO_POLL_MS = 3000;

/** Corte honesto del polling -- el alta es un RPA entrando al portal de ARCA, "típicamente" minutos,
 *  nunca infinito. Pasado esto, se avisa y se ofrece reintentar en vez de girar para siempre. */
const TOPE_ESPERA_MS = 10 * 60 * 1000;

const OPCIONES_CONDICION_IVA: OpcionSelect[] = [
  { valor: 'monotributo', etiqueta: 'Monotributo' },
  { valor: 'responsable_inscripto', etiqueta: 'Responsable inscripto' },
  { valor: 'exento', etiqueta: 'Exento' },
];

const COPY_PASO_ONBOARDING: Record<string, string> = {
  iniciado: 'Iniciando la vinculación con ARCA…',
  dando_de_alta: 'Dando de alta tu cuenta en el portal de ARCA. Esto puede tardar varios minutos.',
  verificando: 'Verificando que el alta se haya completado…',
  habilitado: 'Tu cuenta quedó vinculada con ARCA.',
  fallido: 'No pudimos completar la vinculación.',
};

/** Unión ABIERTA del lado del core (`PasoOnboarding`) -- un paso desconocido no puede dejar a la UI
 *  sin texto: cae acá en vez de romper o mostrar un string crudo del backend. */
function copyPaso(paso: string): string {
  return COPY_PASO_ONBOARDING[paso] ?? 'Procesando la vinculación con ARCA…';
}

/** `20123456786` -> `20-12345678-6`. Sólo cosmético (confirmación del paso 2) -- lo que se manda al
 *  backend son los dígitos crudos, tal cual los tipeó el usuario. */
function formatearCuit(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  if (d.length < 11) return d;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/**
 * Los dos ambientes, con su copy humano.
 *
 * 🔴 **La clave es el valor del CONTRATO (`dev`/`prod`), no el nombre lindo.** Al construir esta
 * pantalla se detectaron dos defectos reales en `@copiloto/core` que hicieron falta arreglar antes de
 * poder escribir este bloque sin workarounds, y vale dejarlos anotados porque los dos eran silenciosos:
 *
 *   1. `ConectarArcaRequest.ambiente` estaba tipado `'homologacion'|'produccion'`. El backend usa
 *      `'dev'`/`'prod'`, y pydantic ignora las claves que no entiende: la app habría mandado un valor
 *      que el backend descarta **sin error**, dejando el alta en el ambiente equivocado.
 *   2. `estadoAfip` armaba un objeto literal de 5 claves y descartaba `ambiente`/`ambientes_vinculados`
 *      antes de que esta pantalla los viera — o sea el bloque habría quedado degradado para siempre,
 *      incluso con el backend ya arreglado.
 *
 * Ambos corregidos en `packages/core/src/api/afip.ts` con tests de regresión. Por eso acá no hay
 * traductor ni `as`: se lee el contrato directo.
 */
const ETIQUETA_AMBIENTE: Record<AmbienteAfip, string> = {
  dev: 'Homologación',
  prod: 'Producción',
};

/** Chips en vez de un `Switch` nativo: misma razón que `CampoSelect` con el picker — una superficie
 *  del sistema corta el vidrio en seco. Y un sí/no explícito se lee mejor que un interruptor mudo. */
const OPCIONES_DRIVE: OpcionSelect[] = [
  { valor: 'si', etiqueta: 'Sí, guardar' },
  { valor: 'no', etiqueta: 'No' },
];

interface SeccionProps {
  titulo: string;
  testID: string;
  children: React.ReactNode;
}

/** Encabezado de bloque -- mismo tratamiento tipográfico en los tres, y el `testID` estable que pide
 *  el sprint ("testID estable ... en cada bloque"). */
function Seccion({ titulo, testID, children }: SeccionProps) {
  const tema = useTema();
  return (
    <View testID={testID} style={{ gap: tema.espacio.sm }}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

interface CamposPerfil {
  razonSocial: string;
  domicilioComercial: string;
  condicionIva: CondicionIvaEmisor;
  ingresosBrutos: string;
  inicioActividades: string;
  puntoVenta: string;
}

const CAMPOS_PERFIL_VACIOS: CamposPerfil = {
  razonSocial: '',
  domicilioComercial: '',
  condicionIva: 'monotributo',
  ingresosBrutos: '',
  inicioActividades: '',
  puntoVenta: '1',
};

type EstadoOperacion = 'idle' | 'cargando' | 'enviando' | 'ok' | 'error' | 'no_disponible';

export function PantallaAfipSetup() {
  const tema = useTema();

  // -------------------------------------------------------------------------------------------
  // CUIT compartido (ver docstring del módulo).
  // -------------------------------------------------------------------------------------------
  const [cuit, setCuit] = useState('');
  const [cuitBloqueado, setCuitBloqueado] = useState(false);

  // -------------------------------------------------------------------------------------------
  // Bloque 1 -- Perfil fiscal.
  // -------------------------------------------------------------------------------------------
  const [camposPerfil, setCamposPerfil] = useState<CamposPerfil>(CAMPOS_PERFIL_VACIOS);
  const [erroresPerfil, setErroresPerfil] = useState<Record<string, string>>({});
  const [estadoPerfil, setEstadoPerfil] = useState<EstadoOperacion>('idle');
  /** Sube cada vez que el perfil llega del backend: es la `key` que resiembra los campos que sostienen
   *  estado propio (`CampoFecha`). Un contador y no el propio valor -- si fuera el valor, el campo se
   *  remontaría en medio del tipeo cada vez que la fecha queda incompleta y pasa por `''`. */
  const [semillaPerfil, setSemillaPerfil] = useState(0);

  // -- Bloque 4: copia en Drive. El valor vive en el perfil fiscal (`guardar_en_drive`).
  const [guardarEnDrive, setGuardarEnDrive] = useState(false);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState<'sin_perfil' | 'error' | null>(null);

  function actualizarCampoPerfil<K extends keyof CamposPerfil>(campo: K, valor: CamposPerfil[K]) {
    setCamposPerfil((prev) => ({ ...prev, [campo]: valor }));
  }

  async function precargarPerfil(cuitConocido: string) {
    setEstadoPerfil('cargando');
    try {
      const res = await leerPerfil(cuitConocido);
      if (res.status === 'no_disponible') {
        setEstadoPerfil('no_disponible');
        return;
      }
      if (res.perfil) {
        setCamposPerfil({
          razonSocial: res.perfil.razonSocial,
          domicilioComercial: res.perfil.domicilioComercial,
          condicionIva: res.perfil.condicionIva,
          ingresosBrutos: res.perfil.ingresosBrutos,
          inicioActividades: res.perfil.inicioActividades,
          puntoVenta: String(res.perfil.puntoVenta),
        });
        // 🔴 Remonta `CampoFecha`. Es semi-controlado a propósito (sostiene sus 3 segmentos en estado
        // local y los siembra UNA vez al montar), así que su propio docstring pide una `key` nueva
        // para resembrarlo. Sin esto el campo se monta ANTES de que llegue el perfil y muestra
        // DD/MM/AAAA vacío sobre una fecha que existe: si el usuario guarda, el perfil pierde su
        // inicio de actividades sin que nadie haya tocado ese campo. Visto en device (2026-07-21).
        setSemillaPerfil((n) => n + 1);
        setGuardarEnDrive(res.perfil.guardarEnDrive);
        setCuitBloqueado(true);
        setEstadoPerfil('ok');
      } else {
        // CUIT cacheado pero sin perfil guardado todavía -- no hay nada que precargar, y el CUIT
        // sigue editable (no hay dato real detrás para "bloquear").
        setEstadoPerfil('idle');
      }
    } catch {
      setEstadoPerfil('error');
    }
  }

  async function guardarPerfilHandler() {
    setErroresPerfil({});
    setEstadoPerfil('enviando');
    const puntoVenta = Math.trunc(Number(camposPerfil.puntoVenta.replace(',', '.'))) || 0;
    try {
      const res = await guardarPerfil({
        cuit,
        razonSocial: camposPerfil.razonSocial,
        domicilioComercial: camposPerfil.domicilioComercial,
        condicionIva: camposPerfil.condicionIva,
        ingresosBrutos: camposPerfil.ingresosBrutos,
        inicioActividades: camposPerfil.inicioActividades,
        puntoVenta,
      });
      if (res.status === 'no_disponible') {
        setEstadoPerfil('no_disponible');
        return;
      }
      setEstadoPerfil('ok');
      setCuitBloqueado(true);
      void guardarCuitCacheado(cuit);
      void refrescarEstadoGeneral(cuit);
    } catch (e) {
      if (e instanceof ErrorValidacionFiscal) {
        const mapa: Record<string, string> = {};
        for (const f of e.faltantes) {
          if (f.campo) mapa[f.campo] = f.mensaje;
        }
        setErroresPerfil(mapa);
      }
      setEstadoPerfil('error');
    }
  }

  // -------------------------------------------------------------------------------------------
  // Estado general (`GET /afip/estado`) -- alimenta el resumen "ya conectado" del bloque 2 y el
  // bloque 3 (ambiente). Se refresca al montar (si hay CUIT cacheado), tras guardar el perfil, y en
  // cada tick del polling de la alta (ver más abajo) -- un solo lugar que lo actualiza.
  // -------------------------------------------------------------------------------------------
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoAfip | null>(null);
  const [estadoGeneralNoDisponible, setEstadoGeneralNoDisponible] = useState(false);

  /**
   * Resultado DISCRIMINADO (no `EstadoAfip | null`) a propósito: el caller de este helper (el
   * polling de la alta, más abajo) necesita distinguir "no disponible" (dejar de pollear, avisar)
   * de "falló esta consulta puntual, transitorio" (seguir reintentando en el próximo tick) -- un
   * `null` único para ambos casos obligaría a leer el estado `estadoGeneralNoDisponible` DESPUÉS del
   * `await`, y ese `useState` cerrado sobre el closure del efecto puede estar STALE (el efecto no lo
   * lista en deps a propósito, ver más abajo). Devolver la razón en el propio resultado evita la
   * carrera por completo.
   */
  const refrescarEstadoGeneral = useCallback(
    async (cuitValor: string): Promise<{ estado: EstadoAfip } | { estado: null; noDisponible: boolean }> => {
      try {
        const res = await estadoAfip(cuitValor);
        if (res.status === 'no_disponible') {
          setEstadoGeneralNoDisponible(true);
          return { estado: null, noDisponible: true };
        }
        setEstadoGeneralNoDisponible(false);
        setEstadoGeneral(res);
        return { estado: res };
      } catch {
        // Best-effort: una consulta de estado que falla no puede tumbar el resto de la pantalla --
        // el usuario sigue pudiendo cargar el perfil o reintentar la alta.
        return { estado: null, noDisponible: false };
      }
    },
    [],
  );

  // -------------------------------------------------------------------------------------------
  // Precarga al montar -- CUIT cacheado (ver docstring del módulo).
  // -------------------------------------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      const cacheado = await leerCuitCacheado();
      if (!cacheado) return;
      setCuit(cacheado);
      await precargarPerfil(cacheado);
      void refrescarEstadoGeneral(cacheado);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo debe correr una vez al montar.
  }, []);

  // -------------------------------------------------------------------------------------------
  // Bloque 2 -- Conectar con ARCA. 3 pasos de INPUT (cuit -> confirmar -> credenciales) + una fase
  // de POLLING post-envío, que son cosas visualmente distintas: los pasos son un formulario que el
  // usuario completa, el polling es el backend trabajando. `pasoArca` sólo gobierna los 3 primeros;
  // `poleando` es la fase 4.
  // -------------------------------------------------------------------------------------------
  const [mostrarFormularioArca, setMostrarFormularioArca] = useState(false);
  const [pasoArca, setPasoArca] = useState<1 | 2 | 3>(1);
  const [usuarioArca, setUsuarioArca] = useState('');
  const [claveArca, setClaveArca] = useState('');
  const [ambienteObjetivo, setAmbienteObjetivo] = useState<AmbienteAfip | null>(null);
  const [enviandoArca, setEnviandoArca] = useState(false);
  const [errorArca, setErrorArca] = useState<string | null>(null);

  // Cambio de ambiente entre credenciales YA vinculadas. Es instantáneo (no es un re-alta): el backend
  // guarda una credencial POR ambiente y las dos conviven para el mismo CUIT.
  const [cambiandoAmbiente, setCambiandoAmbiente] = useState<AmbienteAfip | null>(null);
  const [errorAmbiente, setErrorAmbiente] = useState<string | null>(null);

  const [poleando, setPoleando] = useState(false);
  const [pollTardando, setPollTardando] = useState(false);
  const [intentoPoll, setIntentoPoll] = useState(0);

  function reiniciarFormularioArca() {
    setPasoArca(1);
    setUsuarioArca('');
    setClaveArca('');
    setErrorArca(null);
    setPoleando(false);
    setPollTardando(false);
    // 🔴 Limpia el `onboarding` VIEJO -- sin esto, "Rehacer" tras un `fallido` reabre el formulario
    // pero el `onboardingActual.paso === 'fallido'` de la última consulta sigue siendo verdad (nadie
    // volvió a preguntarle al backend todavía), así que la rama de arriba seguiría mostrando el
    // aviso de fallo en vez del paso 1 recién reiniciado. El resto de `estadoGeneral` (conectado,
    // perfil, etc.) se conserva -- sólo el intento anterior se descarta.
    setEstadoGeneral((prev) => (prev ? { ...prev, onboarding: null } : prev));
  }

  /**
   * Cambia el ambiente activo. El 409 `ambiente_no_vinculado` NO se muestra como falla: vuelve como
   * valor desde el core y acá se traduce a la única acción útil — ofrecer el alta para ESE ambiente.
   * Un cartel de error dejaría al usuario sin saber que la salida existe y está a un toque.
   */
  async function usarAmbiente(env: AmbienteAfip) {
    if (!cuit) return;
    setCambiandoAmbiente(env);
    setErrorAmbiente(null);
    try {
      const r = await cambiarAmbiente(cuit, env);
      if (r.ok) {
        await refrescarEstadoGeneral(cuit);
      } else {
        setErrorAmbiente(r.mensaje);
        iniciarAltaPara(env);
      }
    } catch {
      setErrorAmbiente('No pudimos cambiar el ambiente. Probá de nuevo.');
    } finally {
      setCambiandoAmbiente(null);
    }
  }

  /**
   * 🔴 **No hay actualización optimista.** El toggle se pinta con lo que el backend confirmó, no con
   * lo que el usuario tocó: si el CUIT no tiene perfil, el 409 vuelve como valor y el control queda
   * donde estaba. Adelantar el estado visual acá reproduciría exactamente el bug contra el que el
   * backend puso ese 409 — el usuario viendo "Sí, guardar" sobre una base que no guardó nada.
   */
  async function cambiarGuardadoEnDrive(nuevo: boolean) {
    if (guardandoAjuste || cuit.length !== 11) return;
    setGuardandoAjuste(true);
    setErrorAjuste(null);
    try {
      const res = await guardarAjustesAfip(cuit, nuevo);
      if (res.ok) {
        setGuardarEnDrive(res.guardarEnDrive);
      } else {
        setErrorAjuste('sin_perfil');
      }
    } catch {
      setErrorAjuste('error');
    } finally {
      setGuardandoAjuste(false);
    }
  }

  function iniciarAltaPara(ambiente: AmbienteAfip | null) {
    setAmbienteObjetivo(ambiente);
    reiniciarFormularioArca();
    setMostrarFormularioArca(true);
  }

  async function vincularArcaHandler() {
    // 🔴 La clave se copia a una constante local ANTES de tocar el estado -- lo que sale por
    // `conectarArca` es ESTA copia, y el estado del componente queda vacío de inmediato, no recién
    // cuando la request (async) resuelva. Ver el docstring de `conectarArca`/`CampoSecreto`: la
    // clave fiscal nunca puede sobrevivir al submit en ningún estado que un re-render exponga.
    const claveEnviada = claveArca;
    setClaveArca('');
    setErrorArca(null);
    setEnviandoArca(true);
    try {
      const res = await conectarArca({
        cuit,
        usuario: usuarioArca,
        claveFiscal: claveEnviada,
        ambiente: ambienteObjetivo ?? undefined,
      });
      if (res.status === 'no_disponible') {
        setErrorArca('La vinculación con ARCA todavía no está disponible. Probá más tarde.');
        return;
      }
      void guardarCuitCacheado(cuit);
      setPoleando(true);
      setPollTardando(false);
    } catch (e) {
      if (e instanceof ErrorValidacionFiscal) {
        setErrorArca(e.faltantes[0]?.mensaje ?? 'Revisá el CUIT y la clave fiscal.');
      } else {
        setErrorArca('No pudimos iniciar la vinculación. Probá de nuevo.');
      }
    } finally {
      setEnviandoArca(false);
    }
  }

  // Polling de `estadoAfip` mientras dura la alta -- ver §5 del plan: cada 3s, corte honesto a los
  // 10 min, se limpia SIEMPRE al desmontar o al dejar de "poleando" (terminado, error, o el usuario
  // se fue del bloque). `intentoPoll` es la palanca de "Reintentar" tras el corte: cambiarlo reinicia
  // el efecto entero, con un cronómetro nuevo.
  useEffect(() => {
    if (!poleando) return;
    let activo = true;
    // 🔴 Cuenta TICKS de `setInterval`, no `Date.now()` -- bajo fake timers (test del corte a los
    // 10 min) `jest.advanceTimersByTime` avanza el reloj virtual del intervalo con precisión exacta,
    // mientras que depender de `Date.now()` ataría el corte a que Jest también mockee `Date` (un
    // detalle de configuración de timers que no es parte del contrato de este efecto). Contar ticks
    // hace del corte una propiedad DETERMINISTA del propio `setInterval`, sin ese supuesto extra.
    let ticks = 0;
    const TOPE_TICKS = Math.ceil(TOPE_ESPERA_MS / INTERVALO_POLL_MS);

    const consultar = async () => {
      const res = await refrescarEstadoGeneral(cuit);
      if (!activo) return;
      if (res.estado === null) {
        if (res.noDisponible) {
          setErrorArca('La vinculación con ARCA todavía no está disponible. Probá más tarde.');
          setPoleando(false);
        }
        // Si NO es "no disponible" (falla transitoria de red), no se corta el polling -- el
        // próximo tick reintenta, mismo criterio que `useChat.poll`.
        return;
      }
      if (res.estado.onboarding?.terminado) {
        setPoleando(false);
        if (res.estado.onboarding.paso === 'habilitado') {
          // Éxito: sale del modo "formulario" para que el bloque vuelva a mostrar el resumen
          // "ya conectado" en vez de reaparecer con el paso 3 (usuario/clave vacíos) tal como
          // había quedado antes del envío -- ver la rama `!mostrarFormularioArca && conectado`.
          setMostrarFormularioArca(false);
        }
        // `fallido` NO toca `mostrarFormularioArca`: esa rama se renderiza aparte (ver el `||` del
        // nivel superior) y "Rehacer" es quien decide cuándo volver a mostrar el formulario.
      }
    };

    void consultar(); // primer chequeo inmediato -- no esperar un intervalo completo.
    const intervalo = setInterval(() => {
      ticks += 1;
      if (ticks >= TOPE_TICKS) {
        setPollTardando(true);
        setPoleando(false);
        return;
      }
      void consultar();
    }, INTERVALO_POLL_MS);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [poleando, cuit, intentoPoll, refrescarEstadoGeneral]);

  const onboardingActual = estadoGeneral?.onboarding ?? null;

  /**
   * 🔴 El HECHO de estar vinculado: sale de que exista la credencial, no de cómo terminó el último
   * alta. Son cosas distintas y confundirlas fue un bug real -- un tenant vinculado por script nunca
   * tuvo un onboarding `habilitado`, así que derivarlo del rastro lo mostraba como desconectado.
   */
  const conectado = estadoGeneral?.conectado === true;

  // -------------------------------------------------------------------------------------------
  // Bloque 3 -- Ambiente. `ambientesVinculados` es OPCIONAL en el contrato: `undefined` significa
  // "el backend todavía no lo manda", no "no hay ninguno vinculado". La diferencia es la que decide
  // si el selector se muestra o si la pantalla admite que no sabe -- ver el render de abajo.
  // -------------------------------------------------------------------------------------------
  const ambientesVinculados = estadoGeneral?.ambientesVinculados;

  // -------------------------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------------------------
  return (
    <MarcoGlass titulo="Facturación AFIP" icono="doc_search" testID="pantalla-afip-setup">
      <ScrollFormulario
        style={styles.scroll}
        testID="afip-setup-scroll"
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.lg, gap: tema.espacio.xl }]}
      >
        {/* ---------------------------- Bloque 1 -- Perfil fiscal ---------------------------- */}
        <Seccion titulo="1. Perfil fiscal" testID="afip-bloque-perfil">
          <View style={{ gap: tema.espacio.md }}>
            {cuitBloqueado ? (
              <View style={{ gap: 4 }}>
                <Text
                  style={[
                    styles.etiquetaCuit,
                    { color: tema.color.textoTenue, fontFamily: tema.fuente.mono },
                  ]}
                >
                  CUIT
                </Text>
                <View style={styles.filaCuitBloqueado}>
                  <Text
                    testID="afip-perfil-cuit-fijo"
                    style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiMedium }}
                  >
                    {formatearCuit(cuit)}
                  </Text>
                  <Pressable
                    testID="afip-perfil-cuit-cambiar"
                    onPress={() => setCuitBloqueado(false)}
                    style={pressableStyle(undefined)}
                  >
                    <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Cambiar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <CampoTexto
                testID="afip-perfil-cuit"
                etiqueta="CUIT"
                valor={cuit}
                onChange={(t) => setCuit(t.replace(/\D/g, '').slice(0, 11))}
                keyboardType="number-pad"
                maxLength={11}
                error={erroresPerfil.cuit}
              />
            )}

            <CampoTexto
              testID="afip-perfil-razon-social"
              etiqueta="Razón social"
              valor={camposPerfil.razonSocial}
              onChange={(v) => actualizarCampoPerfil('razonSocial', v)}
              error={erroresPerfil.razon_social}
            />
            <CampoTexto
              testID="afip-perfil-domicilio"
              etiqueta="Domicilio comercial"
              valor={camposPerfil.domicilioComercial}
              onChange={(v) => actualizarCampoPerfil('domicilioComercial', v)}
              error={erroresPerfil.domicilio_comercial}
            />
            <CampoSelect
              testID="afip-perfil-condicion-iva"
              etiqueta="Condición IVA"
              opciones={OPCIONES_CONDICION_IVA}
              valor={camposPerfil.condicionIva}
              onChange={(v) => actualizarCampoPerfil('condicionIva', v as CondicionIvaEmisor)}
              error={erroresPerfil.condicion_iva}
            />
            <CampoNumero
              testID="afip-perfil-ingresos-brutos"
              etiqueta="Ingresos brutos"
              valor={camposPerfil.ingresosBrutos}
              onChange={(v) => actualizarCampoPerfil('ingresosBrutos', v)}
              error={erroresPerfil.ingresos_brutos}
            />
            <CampoFecha
              key={`inicio-actividades-${semillaPerfil}`}
              testID="afip-perfil-inicio-actividades"
              etiqueta="Inicio de actividades"
              valor={camposPerfil.inicioActividades}
              onChange={(v) => actualizarCampoPerfil('inicioActividades', v)}
              error={erroresPerfil.inicio_actividades}
            />
            <CampoNumero
              testID="afip-perfil-punto-venta"
              etiqueta="Punto de venta"
              valor={camposPerfil.puntoVenta}
              onChange={(v) => actualizarCampoPerfil('puntoVenta', v)}
              error={erroresPerfil.punto_venta}
            />

            {estadoPerfil === 'cargando' && (
              <Text testID="afip-perfil-cargando" style={{ color: tema.color.textoTenue }}>
                Cargando tu perfil…
              </Text>
            )}
            {estadoPerfil === 'no_disponible' && (
              <Text testID="afip-perfil-no-disponible" style={{ color: tema.color.textoTenue }}>
                La configuración fiscal todavía no está disponible.
              </Text>
            )}
            {estadoPerfil === 'error' && (
              <Text testID="afip-perfil-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                No pudimos guardar tu perfil. Revisá los datos e intentá de nuevo.
              </Text>
            )}

            <FilaBotones
              testID="afip-perfil-botones"
              botones={[
                {
                  etiqueta: estadoPerfil === 'enviando' ? 'Guardando…' : 'Guardar perfil',
                  variante: 'primario',
                  deshabilitado: estadoPerfil === 'enviando' || cuit.length !== 11,
                  onPress: () => void guardarPerfilHandler(),
                  testID: 'afip-perfil-guardar',
                },
              ]}
            />
          </View>
        </Seccion>

        {/* ---------------------------- Bloque 2 -- Conectar con ARCA ------------------------
            🔴 **El HECHO gana sobre el RASTRO.** `conectado` sale de la credencial que existe en la
            base; `onboarding.paso` es sólo cómo terminó el último intento. Antes el `fallido` se
            evaluaba PRIMERO, así que a un usuario ya vinculado un re-alta fallido le tapaba el
            estado entero y la pantalla se leía como "no estás conectado" -- el operador lo reportó
            con esas palabras (2026-07-21) teniendo el certificado activo desde hacía dos horas.
            Peor todavía: lo empuja a reintentar un alta que no necesita, y cada intento fallido
            gasta uno de los que ARCA tolera antes de bloquear la clave.
            El fallo no se esconde: baja a aviso secundario, que es su jerarquía real. */}
        <Seccion titulo="2. Conectar con ARCA" testID="afip-bloque-arca">
          <View style={{ gap: tema.espacio.md }}>
            {poleando || pollTardando || (onboardingActual?.paso === 'fallido' && !conectado) ? (
              <View style={{ gap: tema.espacio.sm }} testID="afip-arca-progreso">
                {pollTardando ? (
                  <>
                    <Text testID="afip-arca-progreso-tardando" style={{ color: tema.color.texto }}>
                      Está tardando más de lo normal. El alta ante ARCA puede demorar varios minutos,
                      pero esto ya superó los 10 minutos habituales.
                    </Text>
                    <FilaBotones
                      testID="afip-arca-progreso-botones"
                      botones={[
                        {
                          etiqueta: 'Reintentar',
                          variante: 'primario',
                          testID: 'afip-arca-reintentar',
                          onPress: () => {
                            setPollTardando(false);
                            setPoleando(true);
                            setIntentoPoll((n) => n + 1);
                          },
                        },
                      ]}
                    />
                  </>
                ) : onboardingActual?.paso === 'fallido' ? (
                  <>
                    <Text testID="afip-arca-progreso-fallido" style={{ color: tema.color.peligro }}>
                      {COPY_PASO_ONBOARDING.fallido}
                      {onboardingActual.motivo ? ` ${onboardingActual.motivo}` : ''}
                    </Text>
                    <FilaBotones
                      testID="afip-arca-progreso-botones"
                      botones={[
                        {
                          etiqueta: 'Rehacer',
                          variante: 'primario',
                          testID: 'afip-arca-rehacer',
                          onPress: () => iniciarAltaPara(ambienteObjetivo),
                        },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Text testID="afip-arca-progreso-paso" style={{ color: tema.color.texto }}>
                      {copyPaso(onboardingActual?.paso ?? 'iniciado')}
                    </Text>
                  </>
                )}
              </View>
            ) : !mostrarFormularioArca && conectado ? (
              <View style={{ gap: tema.espacio.sm }} testID="afip-arca-conectado">
                <Text style={{ color: tema.color.exito }}>
                  Tu cuenta ya está vinculada con ARCA
                  {estadoGeneral?.ambiente ? ` en ${ETIQUETA_AMBIENTE[estadoGeneral.ambiente]}` : ''}.
                </Text>
                {/* El intento que falló se informa, pero como nota al pie: lo que el usuario necesita
                    saber primero es que puede facturar. Sin esta línea el fallo desaparecería sin
                    dejar rastro, y quien acaba de tipear su clave merece saber que no prendió. */}
                {onboardingActual?.paso === 'fallido' && (
                  <Text testID="afip-arca-conectado-aviso-fallo" style={{ color: tema.color.textoTenue }}>
                    Tu último intento de vincular no se completó, pero la vinculación que ya tenías
                    sigue funcionando.
                  </Text>
                )}
                <FilaBotones
                  testID="afip-arca-conectado-botones"
                  botones={[
                    {
                      etiqueta: 'Vincular otro ambiente',
                      testID: 'afip-arca-reconectar',
                      onPress: () => iniciarAltaPara(null),
                    },
                  ]}
                />
              </View>
            ) : (
              <>
                {pasoArca === 1 && (
                  <View testID="afip-arca-paso-1" style={{ gap: tema.espacio.sm }}>
                    <CampoTexto
                      testID="afip-arca-cuit"
                      etiqueta="CUIT"
                      valor={cuit}
                      onChange={(t) => setCuit(t.replace(/\D/g, '').slice(0, 11))}
                      keyboardType="number-pad"
                      maxLength={11}
                    />
                    <FilaBotones
                      testID="afip-arca-paso-1-botones"
                      botones={[
                        {
                          etiqueta: 'Continuar',
                          variante: 'primario',
                          deshabilitado: cuit.length !== 11,
                          testID: 'afip-arca-paso-1-continuar',
                          onPress: () => setPasoArca(2),
                        },
                      ]}
                    />
                  </View>
                )}

                {pasoArca === 2 && (
                  <View testID="afip-arca-paso-2" style={{ gap: tema.espacio.sm }}>
                    <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                      Vas a vincular el CUIT {formatearCuit(cuit)} con ARCA.
                    </Text>
                    <FilaBotones
                      testID="afip-arca-paso-2-botones"
                      botones={[
                        {
                          etiqueta: 'Cancelar',
                          testID: 'afip-arca-paso-2-cancelar',
                          onPress: () => setPasoArca(1),
                        },
                        {
                          etiqueta: 'Confirmar',
                          variante: 'primario',
                          testID: 'afip-arca-paso-2-confirmar',
                          onPress: () => setPasoArca(3),
                        },
                      ]}
                    />
                  </View>
                )}

                {pasoArca === 3 && (
                  <View testID="afip-arca-paso-3" style={{ gap: tema.espacio.sm }}>
                    <CampoTexto
                      testID="afip-arca-usuario"
                      etiqueta="Usuario de ARCA"
                      valor={usuarioArca}
                      onChange={setUsuarioArca}
                      autoCapitalize="none"
                    />
                    <CampoSecreto
                      testID="afip-arca-clave"
                      etiqueta="Clave fiscal"
                      valor={claveArca}
                      onChange={setClaveArca}
                      aviso="Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta."
                    />
                    {errorArca && (
                      <Text testID="afip-arca-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                        {errorArca}
                      </Text>
                    )}
                    <FilaBotones
                      testID="afip-arca-paso-3-botones"
                      botones={[
                        {
                          etiqueta: 'Atrás',
                          testID: 'afip-arca-paso-3-atras',
                          deshabilitado: enviandoArca,
                          onPress: () => setPasoArca(2),
                        },
                        {
                          etiqueta: enviandoArca ? 'Vinculando…' : 'Vincular',
                          variante: 'primario',
                          testID: 'afip-arca-vincular',
                          deshabilitado: enviandoArca || usuarioArca.trim() === '' || claveArca === '',
                          onPress: () => void vincularArcaHandler(),
                        },
                      ]}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </Seccion>

        {/* ---------------------------------- Bloque 3 -- Ambiente ---------------------------- */}
        <Seccion titulo="3. Ambiente" testID="afip-bloque-ambiente">
          <View style={{ gap: tema.espacio.sm }}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Homologación — facturas de prueba, sin efecto fiscal. Producción — comprobantes fiscales
              reales.
            </Text>

            {ambientesVinculados == null ? (
              <Text testID="afip-ambiente-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                {estadoGeneralNoDisponible
                  ? // Distinto del caso general de abajo: acá `GET /afip/estado` respondió 404/501 --
                    // la app de AFIP no está desplegada, no que el campo todavía no exista.
                    'La configuración de AFIP todavía no está disponible.'
                  : // `ambientes_vinculados` ausente = todavía no sabemos cuáles hay. NO se asume
                    // ninguno: mostrar un selector con ambientes inventados llevaría al usuario a
                    // tocar un switch que después falla.
                    'Todavía no sabemos qué ambientes tenés vinculados. Vinculá tu cuenta con ARCA arriba y volvé acá.'}
              </Text>
            ) : (
              <View testID="afip-ambiente-lista" style={styles.chipsAmbiente}>
                {(['dev', 'prod'] as const).map((env) => {
                  const vinculado = ambientesVinculados.includes(env);
                  const activo = estadoGeneral?.ambiente === env;
                  return (
                    <View
                      key={env}
                      testID={`afip-ambiente-${env}`}
                      style={[
                        styles.chipAmbiente,
                        { borderColor: activo ? tema.color.acento : tema.color.borde },
                      ]}
                    >
                      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium }}>
                        {ETIQUETA_AMBIENTE[env]}
                      </Text>
                      {vinculado ? (
                        activo ? (
                          <Text style={{ color: tema.color.acento, fontSize: tema.tipo.chico }}>Activo</Text>
                        ) : (
                          // 🔴 Vinculado-pero-no-activo es TOCABLE. Dejarlo como una etiqueta muerta
                          // ("Vinculado") es indistinguible de una función rota: el usuario ve que su
                          // otro ambiente existe y no encuentra cómo pasarse a él.
                          <Pressable
                            testID={`afip-ambiente-${env}-usar`}
                            disabled={cambiandoAmbiente !== null}
                            onPress={() => void usarAmbiente(env)}
                            style={pressableStyle(undefined)}
                          >
                            <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                              {cambiandoAmbiente === env ? 'Cambiando…' : 'Usar este'}
                            </Text>
                          </Pressable>
                        )
                      ) : (
                        <Pressable
                          testID={`afip-ambiente-${env}-vincular`}
                          onPress={() => iniciarAltaPara(env)}
                          style={pressableStyle(undefined)}
                        >
                          <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Vincular</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {errorAmbiente != null && (
              <Text testID="afip-ambiente-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                {errorAmbiente}
              </Text>
            )}
          </View>
        </Seccion>

        {/* ------------------------- Bloque 4 -- Copia en Drive ---------------------------------
            🔴 **El estado se toma de lo que CONFIRMÓ el backend, nunca del toque del usuario.** El
            409 de `POST /afip/ajustes` existe porque un `UPDATE` sobre cero filas "funciona" en SQL:
            si el CUIT no tiene perfil, pintar el toggle prendido dejaría al usuario creyendo que sus
            facturas se archivan mientras la base no guardó nada. Por eso `guardarAjustesAfip`
            devuelve el valor del servidor y ESE es el que se pinta. */}
        <Seccion titulo="4. Copia en tu Drive" testID="afip-bloque-drive">
          <View style={{ gap: tema.espacio.md }}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
              Guardá una copia de cada factura en tu Google Drive. El link de AFIP vence a las 24
              horas; el de tu Drive no.
            </Text>

            <CampoSelect
              testID="afip-drive-toggle"
              etiqueta="Guardar mis facturas en Drive"
              opciones={OPCIONES_DRIVE}
              valor={guardarEnDrive ? 'si' : 'no'}
              onChange={(v) => void cambiarGuardadoEnDrive(v === 'si')}
            />

            {guardandoAjuste && (
              <Text testID="afip-drive-guardando" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                Guardando…
              </Text>
            )}

            {/* El 409 es una INSTRUCCIÓN, no una falla: falta un paso que sólo el usuario puede dar. */}
            {errorAjuste === 'sin_perfil' && (
              <Text testID="afip-drive-sin-perfil" style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}>
                Primero completá tus datos fiscales acá arriba y guardá el perfil. Después vas a poder
                activar la copia en Drive.
              </Text>
            )}
            {errorAjuste === 'error' && (
              <Text testID="afip-drive-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                No pudimos guardar el ajuste. Probá de nuevo.
              </Text>
            )}

            {/* 🔴 **Avisa, NO bloquea — y desde el 2026-07-21 dice el HECHO, no una sospecha.**
                `drive_conectado` (`GET /afip/estado`) tiene TRES valores y el `null` no se colapsa a
                `false`: significa "el backend no pudo averiguarlo" (Composio no respondió). Tratarlo
                como desconectado le diría "conectá tu Drive" a alguien que lo tiene hace meses —
                la misma forma del bug del alta fallida, un rastro pisando el hecho. Con `null` (o
                con un backend viejo que no manda el campo) se mantiene el condicional genérico.

                Nunca deshabilita el toggle: el archivado no rompe la emisión, la factura sale igual
                y el comprobante avisa con evidencia (`drive.motivo`) si quedó sin copia. */}
            {guardarEnDrive && estadoGeneral?.driveConectado === true && (
              <Text testID="afip-drive-conectado" style={{ color: tema.color.exito, fontSize: tema.tipo.chico }}>
                Google Drive está conectado. Cada factura nueva va a quedar guardada ahí.
              </Text>
            )}
            {guardarEnDrive && estadoGeneral?.driveConectado === false && (
              <Text testID="afip-drive-desconectado" style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}>
                Google Drive no está conectado. Conectalo en Apps para que tus facturas se guarden —
                mientras tanto se emiten igual, pero sin copia.
              </Text>
            )}
            {guardarEnDrive && estadoGeneral?.driveConectado == null && (
              <Text testID="afip-drive-requiere-conexion" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                Necesitás tener Google Drive conectado en Apps. Si no lo está, la factura se emite
                igual y te avisamos que quedó sin copia.
              </Text>
            )}
          </View>
        </Seccion>
      </ScrollFormulario>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenido: { flexGrow: 1 },
  etiquetaCuit: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  filaCuitBloqueado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipsAmbiente: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipAmbiente: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    minWidth: 140,
  },
});
