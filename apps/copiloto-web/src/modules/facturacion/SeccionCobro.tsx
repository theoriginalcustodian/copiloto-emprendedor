import { useCallback, useEffect, useRef, useState } from 'react';

import {
  borrarCobro,
  formatearImporte,
  listarCobros,
  registrarCobro,
  type Cobro,
  type EstadoCobro,
  type EstadoDeCobro,
} from '@copiloto/core';

import { Button } from '../../design-system';

/**
 * `SeccionCobro` — **¿esta factura la cobré?**, dentro de la card de comprobante emitido.
 *
 * Port de `apps/mobile/src/modules/facturacion/SeccionCobro.tsx`. Misma lógica y contrato; sólo
 * cambia el sustrato (`div`/`button` en vez de `View`/`Pressable`, `Skeleton` en vez de
 * `ActivityIndicator`).
 *
 * 🔴 **Pregunta por su cuenta en vez de leer la fila que la card ya tenía.** El listado de
 * comprobantes no declaró traer `estado_cobro`/`saldo`, y darlo por hecho no habría fallado ruidoso —
 * los campos llegarían `undefined`, el cliente los dejaría en `null`, y la sección simplemente no se
 * dibujaría. Un dato desapareciendo sin error, y encima atribuible al otro lado.
 *
 * 🔴 **Sin cobro no hay estado inventado.** Mientras la consulta no responde, o si responde que no
 * está disponible, esto **no dice «impaga»**: dice que no lo sabe. «No sé si me pagaron» y «no me
 * pagaron» se ven idénticos en pantalla y sólo uno de los dos es cierto — y el falso empuja a
 * reclamarle a un cliente que ya pagó.
 *
 * 🔴 **El saldo NO se calcula acá.** Lo deriva el backend (`total − Σ cobros`) y esta pantalla lo
 * muestra tal cual. Restarlo del lado de la app daría dos fuentes para el mismo número, y el día que
 * difieran el emprendedor ve dos verdades y deja de creerle a las dos. Por la misma razón el botón se
 * ofrece según el `estado_cobro` **derivado por el backend**, no comparando el saldo con cero acá.
 */

/**
 * Cómo se le dice a cada estado **en castellano y desde la vereda del emprendedor**. `impaga` es la
 * palabra del contable; lo que él piensa es *«todavía no me pagaron»*.
 */
const ETIQUETA_COBRO: Record<EstadoCobro, string> = {
  impaga: 'Todavía no te la pagaron',
  parcial: 'Te la pagaron en parte',
  cobrada: 'Cobrada',
};

export interface SeccionCobroProps {
  comprobanteId: number;
  /**
   * Si este comprobante puede cobrarse. Lo decide quien la monta —la card— porque depende del tipo y
   * del estado fiscal, que ella tiene. Una nota de crédito o una factura anulada **no son una deuda**:
   * ofrecer «cobrar» sobre ellas contradice el documento.
   */
  cobrable: boolean;
  /**
   * Avisa que el cobro de este comprobante CAMBIÓ (se registró o se deshizo).
   *
   * 🔴 Existe porque *«Te deben»* / *«Mis comprobantes»* viven en otras secciones y **no tienen forma
   * de enterarse**: marcar una factura cobrada sin esto la dejaría figurando como deuda hasta el
   * próximo refresco, y el emprendedor vería su acción sin efecto justo donde la esperaba.
   */
  onCambio?: () => void;
  testID?: string;
}

type Consulta = 'cargando' | 'ok' | 'sin_dato' | 'no_encontrado';

/** Clave de idempotencia por gesto — `crypto.randomUUID()` es equivalente web del `generarId()` de
 *  mobile: un id opaco, único por intento, no un dato de negocio. */
function generarId(): string {
  return crypto.randomUUID();
}

export function SeccionCobro({ comprobanteId, cobrable, onCambio, testID = 'cobro' }: SeccionCobroProps) {
  const [consulta, setConsulta] = useState<Consulta>('cargando');
  const [estado, setEstado] = useState<EstadoDeCobro | null>(null);
  const [cobros, setCobros] = useState<readonly Cobro[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  /**
   * 🔴 **La clave de idempotencia se guarda entre reintentos, y se tira sólo cuando el cobro entró.**
   *
   * Es el corazón de esto: si la red se corta después de que el backend registró el cobro, el usuario
   * ve un error y vuelve a tocar. Con una clave nueva por toque, eso deja **dos cobros**; con la misma
   * clave, el backend devuelve el que ya existe y reintentar es seguro — que es exactamente para lo
   * que la clave existe. Después de un cobro exitoso sí se descarta: un segundo cobro parcial del
   * mismo monto **es un caso real** y no debe deduplicarse.
   */
  const claveGesto = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    if (!cobrable) return;
    const res = await listarCobros(comprobanteId);
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setCobros(res.cobros);
      setEstado(res.comprobante);
      // `ok` con `comprobante` en null es una respuesta que no trajo el estado: no alcanza para
      // afirmar nada sobre el cobro, así que se trata como "no sé", no como "impaga".
      setConsulta(res.comprobante?.estadoCobro != null ? 'ok' : 'sin_dato');
      return;
    }
    setConsulta(res.status === 'no_encontrado' ? 'no_encontrado' : 'sin_dato');
  }, [comprobanteId, cobrable]);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  async function marcarCobrada() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    // Se reusa la clave si quedó una de un intento fallido: ver `claveGesto`.
    const clave = claveGesto.current ?? generarId();
    claveGesto.current = clave;
    try {
      // `monto` OMITIDO = el saldo pendiente completo. Es lo que permite un botón sin formulario, y
      // no exige del usuario un dato que el backend ya sabe.
      const res = await registrarCobro(comprobanteId, { idemKey: clave });
      if (!vivo.current) return;
      if (res.status === 'ok') {
        claveGesto.current = null;
        await cargar();
        onCambio?.();
        return;
      }
      if (res.status === 'rechazado') setError(res.motivo);
      else if (res.status === 'no_encontrado') setError('Ese comprobante ya no está.');
      else setError('No pudimos registrar el cobro. Probá de nuevo.');
    } catch {
      if (vivo.current) setError('No pudimos registrar el cobro. Probá de nuevo.');
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  async function deshacer(cobroId: number) {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await borrarCobro(comprobanteId, cobroId);
      if (!vivo.current) return;
      if (res.status === 'ok') {
        await cargar();
        onCambio?.();
      } else setError('No pudimos deshacer ese cobro.');
    } catch {
      if (vivo.current) setError('No pudimos deshacer ese cobro.');
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  if (!cobrable) return null;

  const estadoCobro = estado?.estadoCobro ?? null;
  const puedeCobrar = estadoCobro === 'impaga' || estadoCobro === 'parcial';

  return (
    <div className="seccion-cobro" data-testid={testID}>
      <span className="seccion-cobro__etiqueta">Cobro</span>

      {consulta === 'cargando' && (
        <div className="seccion-cobro__fila" data-testid={`${testID}-cargando`}>
          <span className="seccion-cobro__spinner" aria-hidden="true" />
          <span className="seccion-cobro__texto-tenue">Consultando…</span>
        </div>
      )}

      {/* Ni «impaga» ni «cobrada»: no lo sabemos, y decirlo es más útil que elegir uno. */}
      {(consulta === 'sin_dato' || consulta === 'no_encontrado') && (
        <p className="seccion-cobro__texto-tenue" data-testid={`${testID}-sin-dato`}>
          No pudimos consultar si esta factura está cobrada.
        </p>
      )}

      {consulta === 'ok' && estadoCobro != null && (
        <p className="seccion-cobro__estado" data-testid={`${testID}-estado`}>
          {ETIQUETA_COBRO[estadoCobro]}
        </p>
      )}

      {/* El saldo sólo tiene sentido mientras falte algo: sobre una cobrada diría «Falta $0,00». */}
      {consulta === 'ok' && puedeCobrar && estado?.saldo != null && (
        <p className="seccion-cobro__saldo" data-testid={`${testID}-saldo`}>
          Falta {formatearImporte(estado.saldo)}
        </p>
      )}

      {cobros.length > 0 && (
        <div className="seccion-cobro__lista" data-testid={`${testID}-lista`}>
          {cobros.map((c) => (
            <div key={c.id} className="seccion-cobro__fila-cobro" data-testid={`${testID}-item-${c.id}`}>
              <span className="seccion-cobro__texto-tenue">
                {formatearImporte(c.monto)}
                {c.fecha !== '' ? ` · ${c.fecha}` : ''}
                {c.medio != null ? ` · ${c.medio}` : ''}
              </span>
              {/* Existe porque alguien se equivoca. Sin esto, el único arreglo sería tocar la base. */}
              <button
                type="button"
                className="seccion-cobro__deshacer"
                data-testid={`${testID}-deshacer-${c.id}`}
                onClick={() => void deshacer(c.id)}
                disabled={enviando}
              >
                Deshacer
              </button>
            </div>
          ))}
        </div>
      )}

      {error != null && (
        <p className="seccion-cobro__error" data-testid={`${testID}-error`} role="alert">
          {error}
        </p>
      )}

      {consulta === 'ok' && puedeCobrar && (
        <div className="seccion-cobro__botones" data-testid={`${testID}-botones`}>
          <Button onClick={() => void marcarCobrada()} disabled={enviando} data-testid={`${testID}-marcar`}>
            {enviando ? 'Registrando…' : 'Ya me la pagaron'}
          </Button>
        </div>
      )}
    </div>
  );
}
