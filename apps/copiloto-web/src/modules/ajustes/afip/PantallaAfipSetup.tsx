import { useCallback, useEffect, useState } from 'react';

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

import { Button } from '../../../design-system';
import '../ajustes.css';

/**
 * `PantallaAfipSetup` — port de `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.tsx`. Perfil
 * fiscal + alta ante ARCA + selector de ambiente — DISTINTO del wizard de emisión de facturas
 * (`modules/facturacion/`).
 *
 * 🔴 **Sin caché de CUIT**, a diferencia de mobile (`cuitCache.ts`, `AsyncStorage`) — mismo criterio
 * ya aplicado en `PantallaFacturacion` (M-WEB facturación PR1): el backend ya resuelve el CUIT con
 * `primer_cuit()` cuando `estadoAfip()` va sin parámetro. Se pregunta siempre al backend, nunca se
 * cachea localmente.
 *
 * El CUIT es UN solo estado, compartido por los tres bloques (perfil fiscal, alta ARCA, ambiente) —
 * ver docstring de la versión mobile para el porqué completo de cada decisión.
 */
const INTERVALO_POLL_MS = 3000;
const TOPE_ESPERA_MS = 10 * 60 * 1000;

const OPCIONES_CONDICION_IVA: ReadonlyArray<{ valor: CondicionIvaEmisor; etiqueta: string }> = [
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

function copyPaso(paso: string): string {
  return COPY_PASO_ONBOARDING[paso] ?? 'Procesando la vinculación con ARCA…';
}

function formatearCuit(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  if (d.length < 11) return d;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

const ETIQUETA_AMBIENTE: Record<AmbienteAfip, string> = {
  dev: 'Homologación',
  prod: 'Producción',
};

const OPCIONES_DRIVE: ReadonlyArray<{ valor: 'si' | 'no'; etiqueta: string }> = [
  { valor: 'si', etiqueta: 'Sí, guardar' },
  { valor: 'no', etiqueta: 'No' },
];

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
        setGuardarEnDrive(res.perfil.guardarEnDrive);
        setCuitBloqueado(true);
        setEstadoPerfil('ok');
      } else {
        // CUIT conocido pero sin perfil guardado todavía -- no hay nada que precargar.
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
  // Estado general (`GET /afip/estado`).
  // -------------------------------------------------------------------------------------------
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoAfip | null>(null);
  const [estadoGeneralNoDisponible, setEstadoGeneralNoDisponible] = useState(false);

  const refrescarEstadoGeneral = useCallback(
    async (cuitValor?: string): Promise<{ estado: EstadoAfip } | { estado: null; noDisponible: boolean }> => {
      try {
        const res = await estadoAfip(cuitValor || undefined);
        if (res.status === 'no_disponible') {
          setEstadoGeneralNoDisponible(true);
          return { estado: null, noDisponible: true };
        }
        setEstadoGeneralNoDisponible(false);
        setEstadoGeneral(res);
        if (res.cuit) setCuit((prev) => (prev === '' ? (res.cuit as string) : prev));
        return { estado: res };
      } catch {
        return { estado: null, noDisponible: false };
      }
    },
    [],
  );

  // -------------------------------------------------------------------------------------------
  // Precarga al montar -- sin caché de CUIT: `estadoAfip()` sin parámetro resuelve el CUIT del
  // backend (`primer_cuit()`), mismo criterio que `PantallaFacturacion`.
  // -------------------------------------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      const res = await refrescarEstadoGeneral();
      if (res.estado?.cuit) await precargarPerfil(res.estado.cuit);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo debe correr una vez al montar.
  }, []);

  // -------------------------------------------------------------------------------------------
  // Bloque 2 -- Conectar con ARCA.
  // -------------------------------------------------------------------------------------------
  const [mostrarFormularioArca, setMostrarFormularioArca] = useState(false);
  const [pasoArca, setPasoArca] = useState<1 | 2 | 3>(1);
  const [usuarioArca, setUsuarioArca] = useState('');
  const [claveArca, setClaveArca] = useState('');
  const [ambienteObjetivo, setAmbienteObjetivo] = useState<AmbienteAfip | null>(null);
  const [enviandoArca, setEnviandoArca] = useState(false);
  const [errorArca, setErrorArca] = useState<string | null>(null);

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
    setEstadoGeneral((prev) => (prev ? { ...prev, onboarding: null } : prev));
  }

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

  useEffect(() => {
    if (!poleando) return;
    let activo = true;
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
        return;
      }
      if (res.estado.onboarding?.terminado) {
        setPoleando(false);
        if (res.estado.onboarding.paso === 'habilitado') {
          setMostrarFormularioArca(false);
        }
      }
    };

    void consultar();
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
  const conectado = estadoGeneral?.conectado === true;

  // -------------------------------------------------------------------------------------------
  // Bloque 3 -- Ambiente.
  // -------------------------------------------------------------------------------------------
  const ambientesVinculados = estadoGeneral?.ambientesVinculados;

  // -------------------------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------------------------
  return (
    <div className="afip-setup-screen" data-testid="pantalla-afip-setup">
      <h1 className="afip-setup-screen__title">Facturación AFIP</h1>

      {/* ---------------------------- Bloque 1 -- Perfil fiscal ---------------------------- */}
      <section className="afip-setup-bloque" data-testid="afip-bloque-perfil">
        <h2 className="afip-setup-bloque__titulo">1. Perfil fiscal</h2>

        {cuitBloqueado ? (
          <div className="afip-setup-cuit-fijo">
            <span className="afip-setup-cuit-fijo__valor" data-testid="afip-perfil-cuit-fijo">
              CUIT {formatearCuit(cuit)}
            </span>
            <button
              type="button"
              className="afip-setup-cuit-fijo__cambiar"
              data-testid="afip-perfil-cuit-cambiar"
              onClick={() => setCuitBloqueado(false)}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <label className="afip-setup-bloque__campo">
            <span className="afip-setup-bloque__etiqueta">CUIT</span>
            <input
              data-testid="afip-perfil-cuit"
              type="text"
              inputMode="numeric"
              value={cuit}
              onChange={(e) => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
              maxLength={11}
            />
            {erroresPerfil.cuit && <p className="afip-setup-bloque__error">{erroresPerfil.cuit}</p>}
          </label>
        )}

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Razón social</span>
          <input
            data-testid="afip-perfil-razon-social"
            type="text"
            value={camposPerfil.razonSocial}
            onChange={(e) => actualizarCampoPerfil('razonSocial', e.target.value)}
          />
          {erroresPerfil.razon_social && <p className="afip-setup-bloque__error">{erroresPerfil.razon_social}</p>}
        </label>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Domicilio comercial</span>
          <input
            data-testid="afip-perfil-domicilio"
            type="text"
            value={camposPerfil.domicilioComercial}
            onChange={(e) => actualizarCampoPerfil('domicilioComercial', e.target.value)}
          />
          {erroresPerfil.domicilio_comercial && (
            <p className="afip-setup-bloque__error">{erroresPerfil.domicilio_comercial}</p>
          )}
        </label>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Condición IVA</span>
          <select
            data-testid="afip-perfil-condicion-iva"
            value={camposPerfil.condicionIva}
            onChange={(e) => actualizarCampoPerfil('condicionIva', e.target.value as CondicionIvaEmisor)}
          >
            {OPCIONES_CONDICION_IVA.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
          {erroresPerfil.condicion_iva && <p className="afip-setup-bloque__error">{erroresPerfil.condicion_iva}</p>}
        </label>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Ingresos brutos</span>
          <input
            data-testid="afip-perfil-ingresos-brutos"
            type="text"
            inputMode="numeric"
            value={camposPerfil.ingresosBrutos}
            onChange={(e) => actualizarCampoPerfil('ingresosBrutos', e.target.value)}
          />
          {erroresPerfil.ingresos_brutos && <p className="afip-setup-bloque__error">{erroresPerfil.ingresos_brutos}</p>}
        </label>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Inicio de actividades</span>
          <input
            data-testid="afip-perfil-inicio-actividades"
            type="date"
            value={camposPerfil.inicioActividades}
            onChange={(e) => actualizarCampoPerfil('inicioActividades', e.target.value)}
          />
          {erroresPerfil.inicio_actividades && (
            <p className="afip-setup-bloque__error">{erroresPerfil.inicio_actividades}</p>
          )}
        </label>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Punto de venta</span>
          <input
            data-testid="afip-perfil-punto-venta"
            type="text"
            inputMode="numeric"
            value={camposPerfil.puntoVenta}
            onChange={(e) => actualizarCampoPerfil('puntoVenta', e.target.value)}
          />
          {erroresPerfil.punto_venta && <p className="afip-setup-bloque__error">{erroresPerfil.punto_venta}</p>}
        </label>

        {estadoPerfil === 'cargando' && (
          <p className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue" data-testid="afip-perfil-cargando">
            Cargando tu perfil…
          </p>
        )}
        {estadoPerfil === 'no_disponible' && (
          <p
            className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue"
            data-testid="afip-perfil-no-disponible"
          >
            La configuración fiscal todavía no está disponible.
          </p>
        )}
        {estadoPerfil === 'error' && (
          <p className="afip-setup-bloque__error" data-testid="afip-perfil-error">
            No pudimos guardar tu perfil. Revisá los datos e intentá de nuevo.
          </p>
        )}

        <div className="afip-setup-bloque__acciones" data-testid="afip-perfil-botones">
          <Button
            onClick={() => void guardarPerfilHandler()}
            disabled={estadoPerfil === 'enviando' || cuit.length !== 11}
            data-testid="afip-perfil-guardar"
          >
            {estadoPerfil === 'enviando' ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>
      </section>

      {/* ---------------------------- Bloque 2 -- Conectar con ARCA ---------------------------- */}
      <section className="afip-setup-bloque" data-testid="afip-bloque-arca">
        <h2 className="afip-setup-bloque__titulo">2. Conectar con ARCA</h2>

        {poleando || pollTardando || (onboardingActual?.paso === 'fallido' && !conectado) ? (
          <div data-testid="afip-arca-progreso">
            {pollTardando ? (
              <>
                <p className="afip-setup-bloque__texto" data-testid="afip-arca-progreso-tardando">
                  Está tardando más de lo normal. El alta ante ARCA puede demorar varios minutos,
                  pero esto ya superó los 10 minutos habituales.
                </p>
                <div className="afip-setup-bloque__acciones" data-testid="afip-arca-progreso-botones">
                  <Button
                    data-testid="afip-arca-reintentar"
                    onClick={() => {
                      setPollTardando(false);
                      setPoleando(true);
                      setIntentoPoll((n) => n + 1);
                    }}
                  >
                    Reintentar
                  </Button>
                </div>
              </>
            ) : onboardingActual?.paso === 'fallido' ? (
              <>
                <p
                  className="afip-setup-bloque__texto afip-setup-bloque__texto--peligro"
                  data-testid="afip-arca-progreso-fallido"
                >
                  {COPY_PASO_ONBOARDING.fallido}
                  {onboardingActual.motivo ? ` ${onboardingActual.motivo}` : ''}
                </p>
                <div className="afip-setup-bloque__acciones" data-testid="afip-arca-progreso-botones">
                  <Button data-testid="afip-arca-rehacer" onClick={() => iniciarAltaPara(ambienteObjetivo)}>
                    Rehacer
                  </Button>
                </div>
              </>
            ) : (
              <p className="afip-setup-bloque__texto" data-testid="afip-arca-progreso-paso">
                {copyPaso(onboardingActual?.paso ?? 'iniciado')}
              </p>
            )}
          </div>
        ) : !mostrarFormularioArca && conectado ? (
          <div data-testid="afip-arca-conectado">
            <p className="afip-setup-bloque__texto afip-setup-bloque__texto--exito">
              Tu cuenta ya está vinculada con ARCA
              {estadoGeneral?.ambiente ? ` en ${ETIQUETA_AMBIENTE[estadoGeneral.ambiente]}` : ''}.
            </p>
            {onboardingActual?.paso === 'fallido' && (
              <p
                className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue"
                data-testid="afip-arca-conectado-aviso-fallo"
              >
                Tu último intento de vincular no se completó, pero la vinculación que ya tenías
                sigue funcionando.
              </p>
            )}
            <div className="afip-setup-bloque__acciones" data-testid="afip-arca-conectado-botones">
              <Button variant="cancel" data-testid="afip-arca-reconectar" onClick={() => iniciarAltaPara(null)}>
                Vincular otro ambiente
              </Button>
            </div>
          </div>
        ) : (
          <>
            {pasoArca === 1 && (
              <div data-testid="afip-arca-paso-1">
                <label className="afip-setup-bloque__campo">
                  <span className="afip-setup-bloque__etiqueta">CUIT</span>
                  <input
                    data-testid="afip-arca-cuit"
                    type="text"
                    inputMode="numeric"
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    maxLength={11}
                  />
                </label>
                <div className="afip-setup-bloque__acciones" data-testid="afip-arca-paso-1-botones">
                  <Button
                    data-testid="afip-arca-paso-1-continuar"
                    disabled={cuit.length !== 11}
                    onClick={() => setPasoArca(2)}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {pasoArca === 2 && (
              <div data-testid="afip-arca-paso-2">
                <p className="afip-setup-bloque__texto">
                  Vas a vincular el CUIT {formatearCuit(cuit)} con ARCA.
                </p>
                <div className="afip-setup-bloque__acciones" data-testid="afip-arca-paso-2-botones">
                  <Button variant="cancel" data-testid="afip-arca-paso-2-cancelar" onClick={() => setPasoArca(1)}>
                    Cancelar
                  </Button>
                  <Button data-testid="afip-arca-paso-2-confirmar" onClick={() => setPasoArca(3)}>
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {pasoArca === 3 && (
              <div data-testid="afip-arca-paso-3">
                <label className="afip-setup-bloque__campo">
                  <span className="afip-setup-bloque__etiqueta">Usuario de ARCA</span>
                  <input
                    data-testid="afip-arca-usuario"
                    type="text"
                    autoCapitalize="none"
                    value={usuarioArca}
                    onChange={(e) => setUsuarioArca(e.target.value)}
                  />
                </label>
                <label className="afip-setup-bloque__campo">
                  <span className="afip-setup-bloque__etiqueta">Clave fiscal</span>
                  <input
                    data-testid="afip-arca-clave"
                    type="password"
                    value={claveArca}
                    onChange={(e) => setClaveArca(e.target.value)}
                  />
                  <p className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue">
                    Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA
                    y se descarta.
                  </p>
                </label>
                {errorArca && (
                  <p className="afip-setup-bloque__error" data-testid="afip-arca-error">
                    {errorArca}
                  </p>
                )}
                <div className="afip-setup-bloque__acciones" data-testid="afip-arca-paso-3-botones">
                  <Button
                    variant="cancel"
                    data-testid="afip-arca-paso-3-atras"
                    disabled={enviandoArca}
                    onClick={() => setPasoArca(2)}
                  >
                    Atrás
                  </Button>
                  <Button
                    data-testid="afip-arca-vincular"
                    disabled={enviandoArca || usuarioArca.trim() === '' || claveArca === ''}
                    onClick={() => void vincularArcaHandler()}
                  >
                    {enviandoArca ? 'Vinculando…' : 'Vincular'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------------------------------- Bloque 3 -- Ambiente ---------------------------- */}
      <section className="afip-setup-bloque" data-testid="afip-bloque-ambiente">
        <h2 className="afip-setup-bloque__titulo">3. Ambiente</h2>
        <p className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue">
          Homologación — facturas de prueba, sin efecto fiscal. Producción — comprobantes fiscales
          reales.
        </p>

        {ambientesVinculados == null ? (
          <p
            className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue"
            data-testid="afip-ambiente-no-disponible"
          >
            {estadoGeneralNoDisponible
              ? 'La configuración de AFIP todavía no está disponible.'
              : 'Todavía no sabemos qué ambientes tenés vinculados. Vinculá tu cuenta con ARCA arriba y volvé acá.'}
          </p>
        ) : (
          <div className="afip-setup-ambiente-lista" data-testid="afip-ambiente-lista">
            {(['dev', 'prod'] as const).map((env) => {
              const vinculado = ambientesVinculados.includes(env);
              const activo = estadoGeneral?.ambiente === env;
              return (
                <div
                  key={env}
                  data-testid={`afip-ambiente-${env}`}
                  className={
                    'afip-setup-ambiente-chip' + (activo ? ' afip-setup-ambiente-chip--activo' : '')
                  }
                >
                  <span className="afip-setup-ambiente-chip__nombre">{ETIQUETA_AMBIENTE[env]}</span>
                  {vinculado ? (
                    activo ? (
                      <span className="afip-setup-ambiente-chip__estado">Activo</span>
                    ) : (
                      <button
                        type="button"
                        className="afip-setup-ambiente-chip__accion"
                        data-testid={`afip-ambiente-${env}-usar`}
                        disabled={cambiandoAmbiente !== null}
                        onClick={() => void usarAmbiente(env)}
                      >
                        {cambiandoAmbiente === env ? 'Cambiando…' : 'Usar este'}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="afip-setup-ambiente-chip__accion"
                      data-testid={`afip-ambiente-${env}-vincular`}
                      onClick={() => iniciarAltaPara(env)}
                    >
                      Vincular
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {errorAmbiente != null && (
          <p className="afip-setup-bloque__error" data-testid="afip-ambiente-error">
            {errorAmbiente}
          </p>
        )}
      </section>

      {/* ------------------------- Bloque 4 -- Copia en Drive ---------------------------------- */}
      <section className="afip-setup-bloque" data-testid="afip-bloque-drive">
        <h2 className="afip-setup-bloque__titulo">4. Copia en tu Drive</h2>
        <p className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue">
          Guardá una copia de cada factura en tu Google Drive. El link de AFIP vence a las 24 horas;
          el de tu Drive no.
        </p>

        <label className="afip-setup-bloque__campo">
          <span className="afip-setup-bloque__etiqueta">Guardar mis facturas en Drive</span>
          <select
            data-testid="afip-drive-toggle"
            value={guardarEnDrive ? 'si' : 'no'}
            onChange={(e) => void cambiarGuardadoEnDrive(e.target.value === 'si')}
          >
            {OPCIONES_DRIVE.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>

        {guardandoAjuste && (
          <p
            className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue"
            data-testid="afip-drive-guardando"
          >
            Guardando…
          </p>
        )}

        {errorAjuste === 'sin_perfil' && (
          <p className="afip-setup-bloque__texto" data-testid="afip-drive-sin-perfil">
            Primero completá tus datos fiscales acá arriba y guardá el perfil. Después vas a poder
            activar la copia en Drive.
          </p>
        )}
        {errorAjuste === 'error' && (
          <p className="afip-setup-bloque__error" data-testid="afip-drive-error">
            No pudimos guardar el ajuste. Probá de nuevo.
          </p>
        )}

        {guardarEnDrive && estadoGeneral?.driveConectado === true && (
          <p
            className="afip-setup-bloque__texto afip-setup-bloque__texto--exito"
            data-testid="afip-drive-conectado"
          >
            Google Drive está conectado. Cada factura nueva va a quedar guardada ahí.
          </p>
        )}
        {guardarEnDrive && estadoGeneral?.driveConectado === false && (
          <p className="afip-setup-bloque__texto" data-testid="afip-drive-desconectado">
            Google Drive no está conectado. Conectalo en Apps para que tus facturas se guarden —
            mientras tanto se emiten igual, pero sin copia.
          </p>
        )}
        {guardarEnDrive && estadoGeneral?.driveConectado == null && (
          <p
            className="afip-setup-bloque__texto afip-setup-bloque__texto--tenue"
            data-testid="afip-drive-requiere-conexion"
          >
            Necesitás tener Google Drive conectado en Apps. Si no lo está, la factura se emite igual
            y te avisamos que quedó sin copia.
          </p>
        )}
      </section>
    </div>
  );
}
