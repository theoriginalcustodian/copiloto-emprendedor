import { type FormEvent, useEffect, useState } from 'react';

import {
  ApiError,
  crearPresupuesto,
  formatearImporte,
  listarConceptos,
  type Concepto,
  type NuevoItemPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import { Button, Chip } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/presupuestos/FormularioPresupuesto.tsx` — MISMA lógica de negocio:
 *
 * 🔴 **No hay edición, sólo alta con `reemplazaA`.** Corregir un presupuesto es crear otro que apunta
 * al anterior (`reemplazaA: corrige.id`) — no existe `PUT`/`PATCH`. El reemplazo consume un número
 * correlativo nuevo (backend), así que se avisa antes de guardar.
 *
 * 🔴 **El total NO se calcula acá.** Lo calcula el backend (`Σ cantidad × precio_unitario`). El
 * "aproximado" de abajo es sólo ayuda visual, con aritmética decimal exacta vía `BigInt` (mismo
 * criterio que mobile — nunca `Number()` sobre plata).
 *
 * 🔴 **El catálogo de conceptos es un ACELERADOR, no un requisito.** Si `listarConceptos` falla o
 * vuelve vacío, no se muestra nada — ni error, ni vacío explicado. El formulario sigue funcionando
 * exactamente igual sin catálogo.
 */
const OPCIONES_DOC: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  { valor: '99', etiqueta: 'Sin identificar' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '80', etiqueta: 'CUIT' },
];

interface FilaItem {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

const FILA_VACIA: FilaItem = { descripcion: '', cantidad: '1', precioUnitario: '' };

/** Normaliza lo tipeado a un decimal que el backend acepta: coma → punto, sin espacios. */
function aDecimal(texto: string): string {
  return texto.trim().replace(/\s/g, '').replace(',', '.');
}

/** Multiplica dos decimales string SIN float, para el aproximado. */
function multiplicarDecimal(a: string, b: string): string | null {
  const na = aDecimal(a);
  const nb = aDecimal(b);
  if (!/^\d+(\.\d+)?$/.test(na) || !/^\d+(\.\d+)?$/.test(nb)) return null;
  const decimales = (na.split('.')[1]?.length ?? 0) + (nb.split('.')[1]?.length ?? 0);
  const producto = BigInt(na.replace('.', '')) * BigInt(nb.replace('.', ''));
  const s = producto.toString().padStart(decimales + 1, '0');
  const corte = s.length - decimales;
  return decimales === 0 ? s : `${s.slice(0, corte)}.${s.slice(corte)}`;
}

function sumarDecimal(a: string, b: string): string {
  const decimales = Math.max(a.split('.')[1]?.length ?? 0, b.split('.')[1]?.length ?? 0);
  const escala = (v: string) => {
    const [ent, dec = ''] = v.split('.');
    return BigInt(ent + dec.padEnd(decimales, '0'));
  };
  const suma = (escala(a) + escala(b)).toString().padStart(decimales + 1, '0');
  const corte = suma.length - decimales;
  return decimales === 0 ? suma : `${suma.slice(0, corte)}.${suma.slice(corte)}`;
}

/** El aproximado del total, o `null` si alguna fila todavía no es un número. */
export function totalAproximado(items: readonly FilaItem[]): string | null {
  let acumulado = '0';
  for (const it of items) {
    if (it.descripcion.trim() === '' && it.precioUnitario.trim() === '') continue;
    const parcial = multiplicarDecimal(it.cantidad, it.precioUnitario);
    if (parcial == null) return null;
    acumulado = sumarDecimal(acumulado, parcial);
  }
  return acumulado;
}

export interface FormularioPresupuestoProps {
  /** Si viene, el alta lleva `reemplazaA` — es una corrección. */
  corrige?: Presupuesto | null;
  onCreado: (presupuesto: Presupuesto) => void;
  onCancelar: () => void;
}

export function FormularioPresupuesto({ corrige = null, onCreado, onCancelar }: FormularioPresupuestoProps) {
  const [concepto, setConcepto] = useState(corrige?.concepto ?? '');
  const [nombre, setNombre] = useState(corrige?.receptor.nombre ?? '');
  const [docTipo, setDocTipo] = useState(String(corrige?.receptor.docTipo ?? 99));
  const [docNro, setDocNro] = useState(corrige?.receptor.docNro ?? '');
  const [contacto, setContacto] = useState(corrige?.receptor.contacto ?? '');
  const [items, setItems] = useState<FilaItem[]>(() =>
    corrige != null && corrige.items.length > 0
      ? corrige.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precioUnitario: i.precioUnitario }))
      : [{ ...FILA_VACIA }],
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conceptos, setConceptos] = useState<readonly Concepto[]>([]);

  useEffect(() => {
    let vivo = true;
    listarConceptos()
      .then((res) => {
        if (vivo && res.status === 'ok') setConceptos(res.conceptos);
      })
      .catch(() => {
        // Silencio deliberado: ver el docstring del módulo.
      });
    return () => {
      vivo = false;
    };
  }, []);

  /** Rellena la última fila si está vacía; si no, agrega una — así tocar varios conceptos no pisa. */
  function agregarDelCatalogo(c: Concepto) {
    const fila: FilaItem = {
      descripcion: c.nombre,
      cantidad: '1',
      // Sin precio de referencia queda VACÍO, no en "0": un cero es un precio.
      precioUnitario: c.precioReferencia ?? '',
    };
    setItems((prev) => {
      const ultima = prev[prev.length - 1];
      const ultimaVacia = ultima != null && ultima.descripcion.trim() === '' && ultima.precioUnitario.trim() === '';
      return ultimaVacia ? [...prev.slice(0, -1), fila] : [...prev, fila];
    });
  }

  function actualizarItem(indice: number, campo: keyof FilaItem, valor: string) {
    setItems((prev) => prev.map((it, i) => (i === indice ? { ...it, [campo]: valor } : it)));
  }

  function agregarFila() {
    setItems((prev) => [...prev, { ...FILA_VACIA }]);
  }

  function quitarFila(indice: number) {
    // Nunca se queda sin filas: sin ninguna línea no hay qué enviar.
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== indice)));
  }

  const itemsValidos: NuevoItemPresupuesto[] = items
    .filter((it) => it.descripcion.trim() !== '')
    .map((it) => ({
      descripcion: it.descripcion.trim(),
      cantidad: aDecimal(it.cantidad) || '1',
      precioUnitario: aDecimal(it.precioUnitario) || '0',
    }));

  const puedeGuardar = concepto.trim() !== '' && nombre.trim() !== '' && itemsValidos.length > 0 && !enviando;

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await crearPresupuesto({
        concepto: concepto.trim(),
        receptor: {
          nombre: nombre.trim(),
          docTipo: Number(docTipo),
          docNro: docNro.trim(),
          contacto: contacto.trim(),
        },
        items: itemsValidos,
        ...(corrige != null ? { reemplazaA: corrige.id } : {}),
      });
      if (res.status === 'no_disponible') {
        setError('Los presupuestos todavía no están disponibles en tu copiloto.');
        return;
      }
      onCreado(res.presupuesto);
    } catch (e) {
      setError(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar el presupuesto.');
    } finally {
      setEnviando(false);
    }
  }

  function alSubmit(event: FormEvent) {
    event.preventDefault();
    if (!puedeGuardar) return;
    void guardar();
  }

  const aproximado = totalAproximado(items);

  return (
    <form className="formulario-presupuesto" data-testid="formulario-presupuesto" onSubmit={alSubmit}>
      <h2 className="formulario-presupuesto__titulo" data-testid="formulario-presupuesto-titulo">
        {corrige != null ? `Corregir el N° ${corrige.numero}` : 'Nuevo presupuesto'}
      </h2>

      {corrige != null && (
        <p className="formulario-presupuesto__aviso" data-testid="presupuesto-aviso-correccion">
          Se va a crear un presupuesto nuevo con número propio que reemplaza al N° {corrige.numero}. El
          anterior queda en el historial.
        </p>
      )}

      <label className="formulario-presupuesto__campo">
        <span className="formulario-presupuesto__etiqueta">Concepto</span>
        <input
          data-testid="presupuesto-concepto"
          type="text"
          maxLength={120}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Instalación eléctrica"
          disabled={enviando}
        />
      </label>

      <label className="formulario-presupuesto__campo">
        <span className="formulario-presupuesto__etiqueta">Cliente</span>
        <input
          data-testid="presupuesto-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Juan Pérez"
          disabled={enviando}
        />
      </label>

      <label className="formulario-presupuesto__campo">
        <span className="formulario-presupuesto__etiqueta">Tipo de documento</span>
        <select
          data-testid="presupuesto-doc-tipo"
          value={docTipo}
          onChange={(e) => setDocTipo(e.target.value)}
          disabled={enviando}
        >
          {OPCIONES_DOC.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {docTipo !== '99' && (
        <label className="formulario-presupuesto__campo">
          <span className="formulario-presupuesto__etiqueta">Número de documento</span>
          <input
            data-testid="presupuesto-doc-nro"
            type="text"
            inputMode="numeric"
            value={docNro}
            onChange={(e) => setDocNro(e.target.value)}
            disabled={enviando}
          />
        </label>
      )}

      <label className="formulario-presupuesto__campo">
        <span className="formulario-presupuesto__etiqueta">Contacto (mail o teléfono)</span>
        <input
          data-testid="presupuesto-contacto"
          type="text"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="juan@mail.com"
          autoCapitalize="none"
          disabled={enviando}
        />
      </label>

      <p className="formulario-presupuesto__subtitulo">Ítems</p>

      {/* La tira del catálogo. NO se dibuja si no hay conceptos — ver el docstring del módulo. */}
      {conceptos.length > 0 && (
        <div className="formulario-presupuesto__catalogo" data-testid="presupuesto-catalogo">
          <span className="formulario-presupuesto__catalogo-etiqueta">De tu lista:</span>
          <div className="formulario-presupuesto__catalogo-chips">
            {conceptos.map((c) => (
              <Chip
                key={c.id}
                data-testid={`presupuesto-catalogo-${c.id}`}
                onClick={() => agregarDelCatalogo(c)}
              >
                {c.nombre}
                {c.precioReferencia != null ? ` · ${formatearImporte(c.precioReferencia)}` : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="formulario-presupuesto__items">
        {items.map((it, i) => (
          <div key={i} className="formulario-presupuesto__item" data-testid={`presupuesto-item-${i}`}>
            <label className="formulario-presupuesto__campo">
              <span className="formulario-presupuesto__etiqueta">Descripción</span>
              <input
                data-testid={`presupuesto-item-${i}-descripcion`}
                type="text"
                value={it.descripcion}
                onChange={(e) => actualizarItem(i, 'descripcion', e.target.value)}
                placeholder="Mano de obra"
                disabled={enviando}
              />
            </label>
            <div className="formulario-presupuesto__item-numeros">
              <label className="formulario-presupuesto__campo">
                <span className="formulario-presupuesto__etiqueta">Cantidad</span>
                <input
                  data-testid={`presupuesto-item-${i}-cantidad`}
                  type="text"
                  inputMode="decimal"
                  value={it.cantidad}
                  onChange={(e) => actualizarItem(i, 'cantidad', e.target.value)}
                  disabled={enviando}
                />
              </label>
              <label className="formulario-presupuesto__campo">
                <span className="formulario-presupuesto__etiqueta">Precio unitario</span>
                <input
                  data-testid={`presupuesto-item-${i}-precio`}
                  type="text"
                  inputMode="decimal"
                  value={it.precioUnitario}
                  onChange={(e) => actualizarItem(i, 'precioUnitario', e.target.value)}
                  disabled={enviando}
                />
              </label>
            </div>
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => quitarFila(i)}
                data-testid={`presupuesto-item-${i}-quitar`}
              >
                Quitar ítem
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="cancel" onClick={agregarFila} data-testid="presupuesto-agregar-item">
        Agregar ítem
      </Button>

      {/* "aproximado" en el texto, no decorativo: el total definitivo lo calcula el backend. */}
      {aproximado != null && (
        <p className="formulario-presupuesto__aproximado" data-testid="presupuesto-total-aproximado">
          Total aproximado: {formatearImporte(aproximado)} — el definitivo lo calcula el sistema al
          guardar.
        </p>
      )}

      {error != null && (
        <p className="formulario-presupuesto__error" data-testid="presupuesto-error" role="alert">
          {error}
        </p>
      )}

      <div className="formulario-presupuesto__acciones" data-testid="presupuesto-acciones">
        <Button type="button" variant="cancel" onClick={onCancelar} data-testid="presupuesto-cancelar">
          Cancelar
        </Button>
        <Button type="submit" disabled={!puedeGuardar} data-testid="presupuesto-guardar">
          {enviando ? 'Guardando…' : 'Guardar presupuesto'}
        </Button>
      </div>
    </form>
  );
}
