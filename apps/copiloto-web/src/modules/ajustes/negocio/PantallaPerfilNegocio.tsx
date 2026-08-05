import { useEffect, useState } from 'react';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  guardarPerfilNegocio,
  leerPerfilNegocio,
  type AQuienVende,
  type FormalidadCopiloto,
  type GuardarPerfilNegocioRequest,
  type LargoRespuesta,
  type ModoCeremonia,
  type PerfilNegocio,
} from '@copiloto/core';

import { Button, Skeleton } from '../../../design-system';
import { SeccionCatalogo } from './SeccionCatalogo';
import '../ajustes.css';

/**
 * `PantallaPerfilNegocio` — port de
 * `apps/mobile/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx`. Ajustes → "Mi negocio": qué
 * vende el emprendedor, a quién, y cómo quiere que le hable el copiloto.
 *
 * Dos secciones que se guardan POR SEPARADO ("Mi negocio" y "Cómo te habla el copiloto"): cada
 * botón manda sólo sus claves, las ausentes el backend no las toca. `perfil: null` no es un error —
 * es el caso más común el primer día, y se pinta el formulario vacío. Acá NO se piden CUIT, razón
 * social, domicilio ni condición IVA: ya viven en el perfil fiscal (Ajustes → Facturación AFIP). Ver
 * el docstring de la versión mobile para el detalle completo de cada decisión.
 */
const OPCIONES_A_QUIEN: ReadonlyArray<{ valor: AQuienVende; etiqueta: string }> = [
  { valor: 'empresas', etiqueta: 'Empresas' },
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'ambos', etiqueta: 'Ambos' },
];

const OPCIONES_FORMALIDAD: ReadonlyArray<{ valor: FormalidadCopiloto; etiqueta: string }> = [
  { valor: 'formal', etiqueta: 'Formal' },
  { valor: 'cercano', etiqueta: 'Cercano' },
];

const OPCIONES_LARGO: ReadonlyArray<{ valor: LargoRespuesta; etiqueta: string }> = [
  { valor: 'breve', etiqueta: 'Breve' },
  { valor: 'detallado', etiqueta: 'Detallado' },
];

interface Campos {
  queVende: string;
  aQuien: AQuienVende;
  nombreComercial: string;
  horarioAtencion: string;
  formalidad: FormalidadCopiloto;
  largoRespuesta: LargoRespuesta;
  nombreCopiloto: string;
  /** Sólo se LEE. No hay control para cambiarlo: el modo lo decide el backend. */
  modoCeremonia: ModoCeremonia;
}

const CAMPOS_VACIOS: Campos = {
  queVende: '',
  aQuien: 'ambos',
  nombreComercial: '',
  horarioAtencion: '',
  formalidad: 'cercano',
  largoRespuesta: 'breve',
  nombreCopiloto: '',
  // Fail-closed también en el estado inicial: el tenant que todavía no configuró nada trabaja en
  // el modo que PREGUNTA.
  modoCeremonia: 'confirmacion',
};

function aCampos(p: PerfilNegocio): Campos {
  return {
    queVende: p.queVende,
    aQuien: p.aQuien,
    nombreComercial: p.nombreComercial,
    horarioAtencion: p.horarioAtencion,
    formalidad: p.formalidad,
    largoRespuesta: p.largoRespuesta,
    nombreCopiloto: p.nombreCopiloto,
    modoCeremonia: p.modoCeremonia,
  };
}

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';
type EstadoGuardado = 'idle' | 'enviando' | 'ok' | 'error';

/** Qué sección se está guardando — para que el "Guardando…" aparezca en SU botón y no en los dos. */
type Seccion = 'negocio' | 'personalidad' | 'modo';

export function PantallaPerfilNegocio() {
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle');
  const [seccionEnCurso, setSeccionEnCurso] = useState<Seccion | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    setEstadoGuardado('idle');
    setErrorGuardado(null);
  }

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await leerPerfilNegocio();
        if (!vivo) return;
        if (res.status === 'no_disponible') {
          setEstadoCarga('no_disponible');
          return;
        }
        if (res.perfil) setCampos(aCampos(res.perfil));
        setEstadoCarga('ok');
      } catch {
        if (vivo) setEstadoCarga('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(seccion: Seccion) {
    const parcial: GuardarPerfilNegocioRequest =
      seccion === 'negocio'
        ? {
            queVende: campos.queVende,
            aQuien: campos.aQuien,
            nombreComercial: campos.nombreComercial,
            horarioAtencion: campos.horarioAtencion,
          }
        : {
            formalidad: campos.formalidad,
            largoRespuesta: campos.largoRespuesta,
            nombreCopiloto: campos.nombreCopiloto,
          };

    setSeccionEnCurso(seccion);
    setEstadoGuardado('enviando');
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio(parcial);
      if (res.status === 'no_disponible') {
        setEstadoCarga('no_disponible');
        setEstadoGuardado('idle');
        return;
      }
      if (res.status === 'modo_no_disponible') {
        setErrorGuardado(res.mensaje);
        setEstadoGuardado('error');
        return;
      }
      setCampos(aCampos(res.perfil));
      setEstadoGuardado('ok');
    } catch (e) {
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : null);
      setEstadoGuardado('error');
    } finally {
      setSeccionEnCurso(null);
    }
  }

  async function volverAConfirmacion() {
    setSeccionEnCurso('modo');
    setEstadoGuardado('enviando');
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio({ modoCeremonia: 'confirmacion' });
      if (res.status === 'no_disponible') {
        setEstadoCarga('no_disponible');
        setEstadoGuardado('idle');
        return;
      }
      if (res.status === 'modo_no_disponible') {
        setErrorGuardado(res.mensaje);
        setEstadoGuardado('error');
        return;
      }
      setCampos(aCampos(res.perfil));
      setEstadoGuardado('ok');
    } catch (e) {
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : null);
      setEstadoGuardado('error');
    } finally {
      setSeccionEnCurso(null);
    }
  }

  const enviando = estadoGuardado === 'enviando';

  return (
    <div className="perfil-negocio-screen" data-testid="pantalla-perfil-negocio">
      <h1 className="perfil-negocio-screen__title">Mi negocio</h1>

      {estadoCarga === 'cargando' && (
        <div className="perfil-negocio-screen__loading" data-testid="perfil-negocio-cargando">
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
        </div>
      )}

      {estadoCarga === 'error' && (
        <p className="perfil-negocio-screen__error" data-testid="perfil-negocio-error">
          No pudimos cargar tu perfil. Probá de nuevo.
        </p>
      )}

      {estadoCarga === 'no_disponible' && (
        <p className="perfil-negocio-screen__empty" data-testid="perfil-negocio-no-disponible">
          Esta función todavía no está disponible en tu copiloto.
        </p>
      )}

      {estadoCarga === 'ok' && (
        <>
          <section className="perfil-negocio-seccion" data-testid="perfil-negocio-seccion-negocio">
            <h2 className="perfil-negocio-seccion__titulo">Mi negocio</h2>
            <p className="perfil-negocio-seccion__ayuda">
              Con esto el copiloto entiende de qué se trata tu trabajo y puede responderte mejor.
            </p>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">¿Qué vendés o qué servicio ofrecés?</span>
              <textarea
                data-testid="perfil-negocio-que-vende"
                value={campos.queVende}
                onChange={(e) => actualizar('queVende', e.target.value)}
                placeholder="ej.: Instalaciones eléctricas domiciliarias y pequeñas obras"
                maxLength={LIMITE_QUE_VENDE}
              />
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">¿A quién le vendés?</span>
              <select
                data-testid="perfil-negocio-a-quien"
                value={campos.aQuien}
                onChange={(e) => actualizar('aQuien', e.target.value as AQuienVende)}
              >
                {OPCIONES_A_QUIEN.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Nombre comercial</span>
              <input
                data-testid="perfil-negocio-nombre-comercial"
                type="text"
                value={campos.nombreComercial}
                onChange={(e) => actualizar('nombreComercial', e.target.value)}
                placeholder="ej.: Electricidad Pérez"
                maxLength={LIMITE_CAMPO_CORTO}
              />
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Horario de atención</span>
              <input
                data-testid="perfil-negocio-horario"
                type="text"
                value={campos.horarioAtencion}
                onChange={(e) => actualizar('horarioAtencion', e.target.value)}
                placeholder="ej.: Lunes a viernes de 8 a 17"
                maxLength={LIMITE_CAMPO_CORTO}
              />
            </label>
            <div className="perfil-negocio-screen__acciones" data-testid="perfil-negocio-guardar-negocio-botones">
              <Button
                onClick={() => void guardar('negocio')}
                disabled={enviando}
                data-testid="perfil-negocio-guardar-negocio"
              >
                {enviando && seccionEnCurso === 'negocio' ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </section>

          <section className="perfil-negocio-seccion" data-testid="perfil-negocio-seccion-modo">
            <h2 className="perfil-negocio-seccion__titulo">Cómo trabaja tu copiloto</h2>
            <p className="perfil-negocio-seccion__modo" data-testid="perfil-negocio-modo">
              {campos.modoCeremonia === 'automatico' ? 'Automático' : 'Pedir confirmación'}
            </p>
            <p className="perfil-negocio-seccion__modo-detalle">
              {campos.modoCeremonia === 'automatico'
                ? 'Anota lo que le dictás y te avisa después. Lo que sale de tu teléfono —facturar, mandar algo a un cliente, cobrar de verdad— te lo sigue preguntando siempre.'
                : 'Cuando le dictás algo, te muestra una tarjeta para que la revises antes de guardarla. Así ves qué entendió y lo corregís ahí mismo.'}
            </p>
            {campos.modoCeremonia === 'automatico' && (
              <div className="perfil-negocio-screen__acciones" data-testid="perfil-negocio-modo-acciones">
                <Button
                  variant="cancel"
                  onClick={() => void volverAConfirmacion()}
                  disabled={enviando}
                  data-testid="perfil-negocio-volver-confirmacion"
                >
                  {seccionEnCurso === 'modo' && enviando ? 'Volviendo…' : 'Volver a pedir confirmación'}
                </Button>
              </div>
            )}
          </section>

          <section className="perfil-negocio-seccion" data-testid="perfil-negocio-seccion-personalidad">
            <h2 className="perfil-negocio-seccion__titulo">Cómo te habla el copiloto</h2>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Tono</span>
              <select
                data-testid="perfil-negocio-formalidad"
                value={campos.formalidad}
                onChange={(e) => actualizar('formalidad', e.target.value as FormalidadCopiloto)}
              >
                {OPCIONES_FORMALIDAD.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Largo de las respuestas</span>
              <select
                data-testid="perfil-negocio-largo"
                value={campos.largoRespuesta}
                onChange={(e) => actualizar('largoRespuesta', e.target.value as LargoRespuesta)}
              >
                {OPCIONES_LARGO.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">¿Cómo querés llamarlo?</span>
              <input
                data-testid="perfil-negocio-nombre-copiloto"
                type="text"
                value={campos.nombreCopiloto}
                onChange={(e) => actualizar('nombreCopiloto', e.target.value)}
                placeholder="ej.: Copi"
                maxLength={LIMITE_CAMPO_CORTO}
              />
            </label>
            <div className="perfil-negocio-screen__acciones" data-testid="perfil-negocio-guardar-personalidad-botones">
              <Button
                onClick={() => void guardar('personalidad')}
                disabled={enviando}
                data-testid="perfil-negocio-guardar-personalidad"
              >
                {enviando && seccionEnCurso === 'personalidad' ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </section>

          {estadoGuardado === 'ok' && (
            <p className="perfil-negocio-screen__guardado" data-testid="perfil-negocio-guardado">
              Listo, lo guardamos.
            </p>
          )}

          {estadoGuardado === 'error' && (
            <p className="perfil-negocio-screen__error-guardado" data-testid="perfil-negocio-error-guardado">
              {errorGuardado ?? 'No pudimos guardar los cambios. Probá de nuevo.'}
            </p>
          )}

          <SeccionCatalogo testID="perfil-negocio-catalogo" />

          <p className="perfil-negocio-screen__nota">
            Tu CUIT, razón social y condición de IVA se cargan en Ajustes → Facturación AFIP.
          </p>
        </>
      )}
    </div>
  );
}
