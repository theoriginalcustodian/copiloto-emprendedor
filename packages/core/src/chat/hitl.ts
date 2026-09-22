import { formatearImporte } from '../dinero/formatoDinero';
import type { ReplyChoice } from '../api/types';
import type { ChatMessage } from './chatMachine';

/**
 * Detección del gate de negocio (confirmar/cancelar) — adaptado del `hitlMapping.ts` de origen.
 * Mecanismo GENÉRICO heredado del copiloto de emprendedores original
 * (`isConfirmCancelPair`/`classifyChoices` allá, sin cambios de comportamiento acá): un reply con
 * EXACTAMENTE 2 choices, uno que matchea confirmar y otro cancelar, es un gate. En el proyecto de
 * origen (DocuMed) el ÚNICO gate que existía era el clínico; acá cualquier confirm/cancel de negocio
 * se mapea igual, nunca a una tarjeta de HITL genérica separada.
 *
 * **Cero React, cero DOM.** A diferencia del `hitlMapping.ts` original —que recibía un callback
 * `onChoice` y devolvía closures `onConfirm`/`onCancel` listos para pasarle a la vista— acá
 * `mapearGate` devuelve sólo DATOS (markdown + labels + los `value` de confirmar/cancelar). Armar el
 * callback que efectivamente dispara el envío (`send`/`dispatch` de cada plataforma) es
 * responsabilidad de la vista, no de esta capa: así `mapearGate` es reusable tal cual desde
 * cualquier UI, sin que el core conozca la firma de `onChoice` de ninguna de las dos apps.
 */

const CONFIRM_VALUE_RE = /confirm|aceptar|^si[_-]|^yes\b|^ok[_-]/i;
const CANCEL_VALUE_RE = /cancel|^no[_-]|reject/i;

export function esParConfirmarCancelar(choices?: ReplyChoice[] | null): boolean {
  if (!choices || choices.length !== 2) return false;
  const hasConfirm = choices.some((choice) => CONFIRM_VALUE_RE.test(choice.value));
  const hasCancel = choices.some((choice) => CANCEL_VALUE_RE.test(choice.value));
  return hasConfirm && hasCancel;
}

export type TipoMensaje = 'plain' | 'choices' | 'hitl';

export function clasificarChoices(choices?: ReplyChoice[] | null): TipoMensaje {
  if (!choices || choices.length === 0) return 'plain';
  return esParConfirmarCancelar(choices) ? 'hitl' : 'choices';
}

const CONFIRM_FALLBACK: ReplyChoice = { label: 'Confirmar', value: 'confirm' };
const CANCEL_FALLBACK: ReplyChoice = { label: 'Cancelar', value: 'cancel' };

export interface Gate {
  markdown: string;
  confirmLabel: string;
  cancelLabel: string;
  /** El `value` que hay que mandar (en `onChoice` / `ChatRequest`) para confirmar el gate. */
  confirmValue: string;
  /** El `value` que hay que mandar para cancelarlo. */
  cancelValue: string;
  /** Servicio que manda el backend en `card.service` (minúsculas); `''` si el gate no lo trae. */
  service: string;
  /** Nombre visible del servicio (`card.label`); nunca vacío — «Confirmación» si falta. */
  label: string;
  /** Destinatario: primer **negrita** del texto. */
  name?: string;
  /** Monto YA FORMATEADO (`formatearImporte`, separador de miles argentino), sin el signo `$` — el
   * consumidor lo agrega aparte con su propio token (ver `HitlCard`/`TarjetaConfirmacion`). Sólo
   * servicios que lo muestran, hoy Mercado Pago. */
  amount?: string;
  /** Riesgo intrínseco del servicio: etiqueta del badge y si no se puede deshacer. */
  riesgo?: { badge: string; tono: 'warning' | 'danger'; irreversible: boolean };
  /** H-A4-9 — si esta card ya fue respondida (`mensaje.hitlRespondido`). Presente => la vista debe
   * renderizar la card DESHABILITADA (sin `onPress`/`onClick` activo), nunca ocultarla. */
  respondido?: { value: string; label: string };
}

const BOLD_NAME_RE = /\*\*(.+?)\*\*/;
// Empieza y termina en dígito: no captura la puntuación de la oración ("$15.000, confirmá").
const AMOUNT_RE = /\$\s?(\d+(?:[.,]\d+)*)/;

/** Riesgo POR SERVICIO (intrínseco al servicio, no al texto). Sin entrada = tarjeta neutra. */
const SERVICE_RISK: Record<
  string,
  { badge: string; tono: 'warning' | 'danger'; irreversible: boolean; showAmount?: boolean }
> = {
  mercadopago: { badge: 'REVISAR', tono: 'warning', irreversible: false, showAmount: true },
  instagram: { badge: 'IRREVERSIBLE', tono: 'danger', irreversible: true },
};

/**
 * Convierte un `ChatMessage` en el gate de negocio a mostrar, o `null` si no lo es
 * (`clasificarChoices(mensaje.choices) !== 'hitl'`).
 *
 * El markdown a editar viaja PRIMARIO en `mensaje.text` (el motor manda el preview como texto del
 * reply en el gate de negocio; la card del gate es sólo `{kind:'confirm', service, label}`, NUNCA
 * lleva el MD). `mensaje.card?.markdown` es un fallback defensivo por si un reply futuro empieza a
 * incluirlo ahí — nunca la fuente hoy.
 */
export function mapearGate(mensaje: ChatMessage): Gate | null {
  if (clasificarChoices(mensaje.choices) !== 'hitl') return null;

  const choices = mensaje.choices ?? [];
  const confirmChoice =
    choices.find((choice) => CONFIRM_VALUE_RE.test(choice.value)) ?? choices[0] ?? CONFIRM_FALLBACK;
  const cancelChoice =
    choices.find((choice) => CANCEL_VALUE_RE.test(choice.value)) ?? choices[1] ?? CANCEL_FALLBACK;

  const service = (mensaje.card?.service ?? '').toLowerCase();
  const risk = SERVICE_RISK[service];
  const markdown = mensaje.card?.markdown ?? mensaje.text;
  // El backend manda el monto CRUDO dentro del texto (`f"...por ${amount}..."`, sin separador de
  // miles — ver `dispatcher_emprendedor.py`). `formatearImporte(raw, '')` lo formatea sin agregar el
  // signo `$` (ya lo pone el consumidor). H-A4-12.
  const amountRaw = risk?.showAmount ? markdown.match(AMOUNT_RE)?.[1] : undefined;

  return {
    service,
    label: mensaje.card?.label || 'Confirmación',
    name: markdown.match(BOLD_NAME_RE)?.[1],
    amount: amountRaw !== undefined ? formatearImporte(amountRaw, '') : undefined,
    riesgo: risk && { badge: risk.badge, tono: risk.tono, irreversible: risk.irreversible },
    markdown,
    confirmLabel: confirmChoice.label,
    cancelLabel: cancelChoice.label,
    confirmValue: confirmChoice.value,
    cancelValue: cancelChoice.value,
    respondido: mensaje.hitlRespondido,
  };
}

/** Token técnico LEGACY (pre-#624/BL-D4): antes de ese fix, la burbuja optimista del usuario pintaba
 * el `value` crudo del choice elegido (`cancel:<turn>:<step>` / `confirm:<turn>:<step>`) en vez del
 * label que vio y tocó. Sólo sirve para RECONOCER ese formato viejo al rehidratar — nunca se manda
 * al backend en ese formato "sanitizado", el value real sigue viajando tal cual estaba. */
const LEGACY_TOKEN_RE = /^(cancel|confirm):/i;

/**
 * H-A4-9 — migra un historial rehidratado (`localStorage`/`AsyncStorage`) para que una card HITL ya
 * respondida quede marcada `hitlRespondido` — sin esto, `HitlCard`/`TarjetaConfirmacion` la vuelven a
 * mostrar activa en cada reload/remount, y un click tardío reenvía confirm/cancel aunque el turno ya
 * se haya resuelto (incluso con un "Listo 👍" falso, ver hallazgo).
 *
 * Heurística: un mensaje `assistant` clasificado `'hitl'` (`clasificarChoices`) SIN `hitlRespondido`
 * cuyo mensaje INMEDIATO SIGUIENTE es de `role: 'user'` ya fue respondido — el gate bloquea el turno
 * (el composer no deja escribir libre hasta resolverlo), así que cualquier mensaje de usuario
 * inmediatamente después es, por construcción, su respuesta. El texto de esa respuesta llega en dos
 * formatos posibles, según cuándo se generó:
 *  - el LABEL que el usuario tocó (post-#624, ej. "Cancelar"/"Confirmar" o el label real del choice).
 *  - el token TÉCNICO crudo LEGACY (pre-#624, `cancel:2:0`/`confirm:2:0` — `LEGACY_TOKEN_RE`).
 * En los dos casos alcanza con saber QUE fue respondida para deshabilitar la card; el `label` se
 * normaliza a "Cancelar"/"Confirmar" cuando el formato es el token legacy — mostrar `cancel:2:0` en
 * cualquier lugar sería peor que no mostrar nada. Mensajes ya migrados (`hitlRespondido` presente,
 * escritos por esta misma fix) pasan de largo — la migración es idempotente.
 */
export function sanitizarHitlRespondido(mensajes: readonly ChatMessage[]): ChatMessage[] {
  return mensajes.map((mensaje, index) => {
    if (mensaje.role !== 'assistant') return mensaje;
    if (mensaje.hitlRespondido) return mensaje;
    if (clasificarChoices(mensaje.choices) !== 'hitl') return mensaje;

    const siguiente = mensajes[index + 1];
    if (!siguiente || siguiente.role !== 'user') return mensaje; // sin respuesta después -> sigue activa

    const legacyMatch = LEGACY_TOKEN_RE.exec(siguiente.text);
    const legacyKind = legacyMatch?.[1]?.toLowerCase();
    const label = legacyKind ? (legacyKind === 'cancel' ? 'Cancelar' : 'Confirmar') : siguiente.text;

    return { ...mensaje, hitlRespondido: { value: siguiente.text, label } };
  });
}
