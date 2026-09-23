import { useEffect, useState } from 'react';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  errorDeEmail,
  errorDeTelefono,
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
import { OPCIONES_FORMALIDAD, OPCIONES_LARGO } from './PantallaTono';
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

interface Campos {
  queVende: string;
  aQuien: AQuienVende;
  nombreComercial: string;
  horarioAtencion: string;
  telefono: string;
  email: string;
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
  telefono: '',
  email: '',
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
    telefono: p.telefono,
    email: p.email,
    formalidad: p.formalidad,
    largoRespuesta: p.largoRespuesta,
    nombreCopiloto: p.nombreCopiloto,
    modoCeremonia: p.modoCeremonia,
  };
}

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';
type EstadoGuardado = 'idle' | 'enviando' | 'ok' | 'error';

/** Qué sección se está guardando — para que el "Guardando…" aparezca en SU botón y no en los dos. */
type Seccion = 'negocio' | 'modo';

/** Resumen de la fila que lleva a «Cómo hablarle»: «Cercano · Breve · Copi». */
function resumenDeTono(c: { formalidad: FormalidadCopiloto; largoRespuesta: LargoRespuesta; nombreCopiloto: string }): string {
  const f = OPCIONES_FORMALIDAD.find((o) => o.valor === c.formalidad)?.etiqueta ?? '';
  const l = OPCIONES_LARGO.find((o) => o.valor === c.largoRespuesta)?.etiqueta ?? '';
  return [f, l, c.nombreCopiloto.trim()].filter((x) => x !== '').join(' · ');
}

export function PantallaPerfilNegocio({ onAbrirTono }: { onAbrirTono?: () => void } = {}) {
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle');
  const [seccionEnCurso, setSeccionEnCurso] = useState<Seccion | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [erroresContacto, setErroresContacto] = useState<{ telefono: string | null; email: string | null }>({
    telefono: null,
    email: null,
  });

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    if (campo === 'telefono' || campo === 'email') {
      setErroresContacto((prev) => ({ ...prev, [campo]: null }));
    }
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
    // BL-J10: el formato del contacto se avisa EN el campo y no viaja nada si está mal. El backend
    // sigue siendo la fuente de verdad (su 400 igual se muestra abajo).
    if (seccion === 'negocio') {
      const errores = {
        telefono: errorDeTelefono(campos.telefono),
        email: errorDeEmail(campos.email),
      };
      setErroresContacto(errores);
      if (errores.telefono != null || errores.email != null) return;
    }
    const parcial: GuardarPerfilNegocioRequest = {
      queVende: campos.queVende,
      aQuien: campos.aQuien,
      nombreComercial: campos.nombreComercial,
      horarioAtencion: campos.horarioAtencion,
      telefono: campos.telefono,
      email: campos.email,
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
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Teléfono</span>
              <input
                data-testid="perfil-negocio-telefono"
                type="tel"
                inputMode="tel"
                value={campos.telefono}
                onChange={(e) => actualizar('telefono', e.target.value)}
                placeholder="ej.: 341 590 6309"
                maxLength={LIMITE_CAMPO_CORTO}
                aria-invalid={erroresContacto.telefono != null}
              />
              {erroresContacto.telefono != null && (
                <span className="perfil-negocio-seccion__error" role="alert" data-testid="perfil-negocio-telefono-error">
                  {erroresContacto.telefono}
                </span>
              )}
            </label>
            <label className="perfil-negocio-seccion__campo">
              <span className="perfil-negocio-seccion__etiqueta">Email</span>
              <input
                data-testid="perfil-negocio-email"
                type="email"
                inputMode="email"
                value={campos.email}
                onChange={(e) => actualizar('email', e.target.value)}
                placeholder="ej.: contacto@elgalpon.com.ar"
                maxLength={LIMITE_CAMPO_CORTO}
                aria-invalid={erroresContacto.email != null}
              />
              {erroresContacto.email != null && (
                <span className="perfil-negocio-seccion__error" role="alert" data-testid="perfil-negocio-email-error">
                  {erroresContacto.email}
                </span>
              )}
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

          {/* K-15 / BL-X7: el editor de tono vive en «Cómo hablarle» (PantallaTono); acá sólo el resumen. */}
          <button
            type="button"
            className="perfil-negocio-seccion perfil-negocio-seccion__fila-tono"
            data-testid="perfil-negocio-tono-fila"
            onClick={() => onAbrirTono?.()}
          >
            <span className="perfil-negocio-seccion__titulo">Cómo te habla el copiloto</span>
            <span className="perfil-negocio-seccion__resumen" data-testid="perfil-negocio-tono-resumen">
              {resumenDeTono(campos)} ›
            </span>
          </button>

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
            Tu CUIT, razón social y condición de IVA se cargan en Ajustes → Facturación ARCA.
          </p>
        </>
      )}
    </div>
  );
}
