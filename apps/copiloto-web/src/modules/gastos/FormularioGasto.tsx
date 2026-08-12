import { type FormEvent, useState } from 'react';

import {
  ApiError,
  CATEGORIAS_GASTO,
  crearGasto,
  ETIQUETA_CATEGORIA,
  esDecimalPositivo,
  normalizarDecimal,
  type CategoriaGasto,
  type Gasto,
  type OrigenGasto,
} from '@copiloto/core';

import { Button } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/gastos/FormularioGasto.tsx` — MISMA validación (sólo el monto es
 * obligatorio, la condición de habilitado replica la del backend a propósito, ver ese archivo) y
 * MISMO body armado (opcionales vacíos no se mandan). Sólo cambia la capa de presentación:
 * `<input>`/`<select>` nativos de HTML en vez de los primitivos glass de RN.
 *
 * `iniciales` (contrato `cards-propuesto-web`, 2026-08-12): precarga desde `gasto_propuesto` —
 * mismo mecanismo que `ValoresInicialesPresupuesto` de `FormularioPresupuesto`. `montoSugerido` es
 * la lectura del OCR (origen `'foto'`): se muestra como cita tocable, NUNCA precarga sola el campo
 * `monto` — ver el docstring del mobile para el porqué (no prestarle autoridad a un número alucinado).
 */
export interface ValoresInicialesGasto {
  monto?: string;
  categoria?: CategoriaGasto;
  proveedor?: string;
  medioPago?: string;
  descripcion?: string;
  fecha?: string;
  montoSugerido?: string;
}

export interface FormularioGastoProps {
  origen: OrigenGasto;
  iniciales?: ValoresInicialesGasto;
  onCreado: (gasto: Gasto) => void;
  onCancelar: () => void;
}

export function FormularioGasto({ origen, iniciales, onCreado, onCancelar }: FormularioGastoProps) {
  const [monto, setMonto] = useState(iniciales?.monto ?? '');
  const [categoria, setCategoria] = useState<CategoriaGasto>(iniciales?.categoria ?? 'otros');
  const [proveedor, setProveedor] = useState(iniciales?.proveedor ?? '');
  const [medioPago, setMedioPago] = useState(iniciales?.medioPago ?? '');
  const [descripcion, setDescripcion] = useState(iniciales?.descripcion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeGuardar = esDecimalPositivo(monto) && !guardando;

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await crearGasto({
        monto: normalizarDecimal(monto),
        origen,
        categoria,
        ...(proveedor.trim() !== '' ? { proveedor: proveedor.trim() } : {}),
        ...(medioPago.trim() !== '' ? { medioPago: medioPago.trim() } : {}),
        ...(descripcion.trim() !== '' ? { descripcion: descripcion.trim() } : {}),
        ...(iniciales?.fecha !== undefined ? { fecha: iniciales.fecha } : {}),
        ...(iniciales?.montoSugerido !== undefined ? { montoSugerido: iniciales.montoSugerido } : {}),
      });
      if (res.status === 'no_disponible') {
        setError('Los gastos todavía no están disponibles en tu copiloto.');
        setGuardando(false);
        return;
      }
      onCreado(res.gasto);
    } catch (err) {
      const detalle = err instanceof ApiError ? err.detail : null;
      setError(detalle != null && detalle !== '' ? detalle : 'No pudimos guardar el gasto.');
      setGuardando(false);
    }
  }

  return (
    <form className="formulario-gasto" data-testid="formulario-gasto" onSubmit={(e) => void guardar(e)}>
      <label className="formulario-gasto__campo">
        <span className="formulario-gasto__etiqueta">Cuánto gastaste</span>
        <input
          data-testid="gasto-monto"
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="15000,50"
          disabled={guardando}
        />
      </label>

      {/* La sugerencia del OCR (origen 'foto') se muestra como CITA del ticket, sin tratamiento que
          sugiera validación — ver el docstring de arriba y el de `apps/mobile/.../FormularioGasto.tsx`.
          Es TOCABLE: llena el campo, no lo precarga sola. */}
      {iniciales?.montoSugerido != null && (
        <button
          type="button"
          className="formulario-gasto__sugerido"
          data-testid="gasto-monto-sugerido"
          onClick={() => setMonto(iniciales.montoSugerido as string)}
          disabled={guardando}
        >
          Del ticket leímos: {iniciales.montoSugerido} — tocá para usarlo
        </button>
      )}

      <label className="formulario-gasto__campo">
        <span className="formulario-gasto__etiqueta">Categoría</span>
        <select
          data-testid="gasto-categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
          disabled={guardando}
        >
          {CATEGORIAS_GASTO.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="formulario-gasto__campo">
        <span className="formulario-gasto__etiqueta">Proveedor (opcional)</span>
        <input
          data-testid="gasto-proveedor"
          type="text"
          maxLength={120}
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          disabled={guardando}
        />
      </label>

      <label className="formulario-gasto__campo">
        <span className="formulario-gasto__etiqueta">Cómo lo pagaste (opcional)</span>
        <input
          data-testid="gasto-medio-pago"
          type="text"
          maxLength={40}
          placeholder="efectivo, transferencia…"
          value={medioPago}
          onChange={(e) => setMedioPago(e.target.value)}
          disabled={guardando}
        />
      </label>

      <label className="formulario-gasto__campo">
        <span className="formulario-gasto__etiqueta">Detalle (opcional)</span>
        <textarea
          data-testid="gasto-descripcion"
          maxLength={500}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={guardando}
        />
      </label>

      {error != null && (
        <p className="formulario-gasto__error" data-testid="gasto-error" role="alert">
          {error}
        </p>
      )}

      <div className="formulario-gasto__acciones" data-testid="gasto-acciones">
        <Button type="button" variant="cancel" onClick={onCancelar} data-testid="gasto-cancelar">
          Cancelar
        </Button>
        <Button type="submit" disabled={!puedeGuardar} data-testid="gasto-guardar">
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
