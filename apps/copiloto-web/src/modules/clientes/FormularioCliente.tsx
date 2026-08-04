import { type FormEvent, useRef, useState } from 'react';

import {
  ApiError,
  cambiosDeCliente,
  crearCliente,
  editarCliente,
  type Cliente,
  type DatosCliente,
  type DuplicadoCliente,
} from '@copiloto/core';

import { Button } from '../../design-system';
import { generarId } from '../../util/id';

/**
 * Port de `apps/mobile/src/modules/clientes/FormularioCliente.tsx` — MISMA validación (sólo
 * `nombre` obligatorio), MISMO body armado (`loTipeado`, opcionales vacíos → `null`, nunca `''`),
 * MISMA lógica de duplicados (409 por documento = redirige, por nombre = pregunta, `forzar`) e
 * idem-key de alta (`generarId`, se conserva a través del paso "forzar"). Ver ese archivo para el
 * porqué de cada regla — acá sólo cambia `<input>`/`<select>` nativos por los primitivos glass.
 */
const OPCIONES_DOC: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  { valor: '', etiqueta: 'Sin documento' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '80', etiqueta: 'CUIT' },
];

export interface FormularioClienteProps {
  edita?: Cliente | null;
  onGuardado: (cliente: Cliente) => void;
  onDuplicado: (duplicado: DuplicadoCliente) => void;
  onAbrirCliente: (cliente: Cliente) => void;
  onCancelar: () => void;
}

export function FormularioCliente({
  edita = null,
  onGuardado,
  onDuplicado,
  onAbrirCliente,
  onCancelar,
}: FormularioClienteProps) {
  const [nombre, setNombre] = useState(edita?.nombre ?? '');
  const [docTipo, setDocTipo] = useState(edita?.docTipo != null ? String(edita.docTipo) : '');
  const [docNro, setDocNro] = useState(edita?.docNro ?? '');
  const [domicilio, setDomicilio] = useState(edita?.domicilio ?? '');
  const [email, setEmail] = useState(edita?.email ?? '');
  const [telefono, setTelefono] = useState(edita?.telefono ?? '');
  const [notas, setNotas] = useState(edita?.notas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homonimo, setHomonimo] = useState<DuplicadoCliente | null>(null);

  /** Se conserva entre reintentos y a través del paso "forzar" — mismo criterio que
   * `FormularioGasto`/`SeccionCobro`, ver el docstring de la versión mobile. */
  const claveAlta = useRef<string | null>(null);

  function loTipeado(): DatosCliente {
    const limpio = (v: string) => (v.trim() === '' ? null : v.trim());
    return {
      nombre: nombre.trim(),
      docTipo: docTipo === '' ? null : Number(docTipo),
      docNro: docTipo === '' ? null : limpio(docNro),
      domicilio: limpio(domicilio),
      email: limpio(email),
      telefono: limpio(telefono),
      notas: limpio(notas),
    };
  }

  function textoHomonimo(d: DuplicadoCliente): string {
    const quien = d.dueno?.nombre;
    const tieneNombre = quien != null && quien !== '';
    if (d.por === 'nombre') {
      return tieneNombre ? `Ya tenés un cliente que se llama ${quien}.` : 'Ya tenés un cliente con ese nombre.';
    }
    return tieneNombre ? `Ya tenés un cliente parecido: ${quien}.` : 'Ya tenés un cliente parecido en la cartera.';
  }

  const quedaraIndistinguible =
    homonimo != null && [docNro, domicilio, email, telefono, notas].every((v) => v.trim() === '');

  const puedeGuardar = nombre.trim() !== '' && !guardando;

  async function guardar(forzar = false) {
    setGuardando(true);
    setError(null);
    try {
      const datos = loTipeado();
      let res;
      if (edita != null) {
        res = await editarCliente(edita.id, cambiosDeCliente(edita, datos), forzar ? { forzar: true } : undefined);
      } else {
        if (claveAlta.current === null) claveAlta.current = generarId();
        res = await crearCliente(datos, { ...(forzar ? { forzar: true } : {}), idemKey: claveAlta.current });
      }

      if (res.status === 'no_disponible') {
        setError(
          edita != null
            ? 'Todavía no podemos guardar cambios de clientes en tu copiloto.'
            : 'Todavía no podemos dar de alta clientes en tu copiloto.',
        );
        return;
      }
      if (res.status === 'duplicado') {
        if (res.duplicado.por !== 'documento') {
          setHomonimo(res.duplicado);
          return;
        }
        claveAlta.current = null;
        onDuplicado(res.duplicado);
        return;
      }
      claveAlta.current = null;
      setHomonimo(null);
      onGuardado(res.cliente);
    } catch (e) {
      setError(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  function alSubmit(event: FormEvent) {
    event.preventDefault();
    if (!puedeGuardar) return;
    void guardar();
  }

  return (
    <form className="formulario-cliente" data-testid="formulario-cliente" onSubmit={alSubmit}>
      <h2 className="formulario-cliente__titulo" data-testid="formulario-cliente-titulo">
        {edita != null ? `Editar ${edita.nombre}` : 'Nuevo cliente'}
      </h2>

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Nombre</span>
        <input
          data-testid="cliente-nombre"
          type="text"
          maxLength={200}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="ej.: Panadería Los Tilos"
          disabled={guardando}
        />
      </label>

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Tipo de documento</span>
        <select
          data-testid="cliente-doc-tipo"
          value={docTipo}
          onChange={(e) => setDocTipo(e.target.value)}
          disabled={guardando}
        >
          {OPCIONES_DOC.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {/* También se muestra SIN tipo si hay un número cargado — ver el docstring de la versión
          mobile (llega dictado con doc_tipo null a propósito). */}
      {(docTipo !== '' || docNro.trim() !== '') && (
        <label className="formulario-cliente__campo">
          <span className="formulario-cliente__etiqueta">Número</span>
          <input
            data-testid="cliente-doc-nro"
            type="text"
            inputMode="numeric"
            value={docNro}
            onChange={(e) => setDocNro(e.target.value)}
            placeholder="ej.: 30712345678"
            disabled={guardando}
          />
        </label>
      )}
      {docTipo === '' && docNro.trim() !== '' && (
        <p className="formulario-cliente__aviso" data-testid="cliente-doc-sin-tipo">
          Elegí si ese número es DNI o CUIT — si no, no lo vamos a poder guardar.
        </p>
      )}

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Domicilio</span>
        <input
          data-testid="cliente-domicilio"
          type="text"
          maxLength={200}
          value={domicilio}
          onChange={(e) => setDomicilio(e.target.value)}
          placeholder="ej.: Av. Mitre 1234"
          disabled={guardando}
        />
      </label>

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Email</span>
        <input
          data-testid="cliente-email"
          type="email"
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ej.: panaderia@gmail.com"
          disabled={guardando}
        />
      </label>

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Teléfono</span>
        <input
          data-testid="cliente-telefono"
          type="tel"
          maxLength={60}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="ej.: 11-5555-4444"
          disabled={guardando}
        />
      </label>

      <label className="formulario-cliente__campo">
        <span className="formulario-cliente__etiqueta">Notas</span>
        <textarea
          data-testid="cliente-notas"
          maxLength={500}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Lo que quieras recordar de este cliente"
          disabled={guardando}
        />
      </label>

      {error != null && (
        <p className="formulario-cliente__error" data-testid="cliente-error" role="alert">
          {error}
        </p>
      )}

      {homonimo != null && (
        <div className="formulario-cliente__homonimo" data-testid="cliente-homonimo">
          <p className="formulario-cliente__homonimo-texto" data-testid="cliente-homonimo-texto">
            {textoHomonimo(homonimo)}
          </p>
          {quedaraIndistinguible && (
            <p className="formulario-cliente__aviso" data-testid="cliente-homonimo-sin-datos">
              Si lo creás así, van a quedar dos clientes iguales en tu cartera. Agregale un
              teléfono, un domicilio o una nota y los vas a poder distinguir.
            </p>
          )}
          <div className="formulario-cliente__homonimo-acciones" data-testid="cliente-homonimo-acciones">
            <Button
              type="button"
              onClick={() => void guardar(true)}
              disabled={guardando}
              data-testid="cliente-homonimo-forzar"
            >
              Es otro, crearlo igual
            </Button>
            {homonimo.dueno != null && (
              <Button
                type="button"
                variant="cancel"
                onClick={() => onAbrirCliente(homonimo.dueno as Cliente)}
                data-testid="cliente-homonimo-abrir"
              >
                Abrir ese
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="formulario-cliente__acciones" data-testid="cliente-acciones">
        <Button type="button" variant="cancel" onClick={onCancelar} data-testid="cliente-cancelar">
          Cancelar
        </Button>
        <Button type="submit" disabled={!puedeGuardar} data-testid="cliente-guardar">
          {guardando ? 'Guardando…' : edita != null ? 'Guardar cambios' : 'Dar de alta'}
        </Button>
      </div>
    </form>
  );
}
