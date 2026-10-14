import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ReplyCard } from '../api/types';
import { etiquetaCondicion, leerRequiereConexion } from './requiereConexion';

/**
 * COSTURA `alcance` — test de PAR, no de mitad.
 *
 * Los dos lados estuvieron verdes con la costura MUERTA: el parser leía `alcance` con objetos (test con
 * objetos escritos a mano) y el backend emitía `alcance_items` aparte (test contra su propia clave).
 * Ninguno ejercitaba el par, y el modo de falla no era un error sino la AUSENCIA de la insignia.
 *
 * Por eso la entrada de este test NO se escribe con la forma que el parser espera: es el payload que emite
 * `apps/copiloto/catalog.py:requiere_conexion_card` (fixture generado corriendo esa función, no tipeado).
 * Regenerarlo — mismo comando, desde la raíz del repo:
 *
 *   python -I -c "import sys,json; sys.path.insert(0,'apps/copiloto'); import catalog; \
 *     print(json.dumps([catalog.requiere_conexion_card(s,l) for s,l in [('mercadopago','MercadoPago'),\
 *     ('gmail','Gmail'),('servicio_sin_ficha','Servicio sin ficha')]],ensure_ascii=False,indent=2))"
 *
 * Contrato D1 (planificación, 2026-10-13): la card lleva los objetos `{texto, condicion}` en `alcance`.
 * Si la card vuelve a `string[]` (o los objetos se van a otra clave), la insignia desaparece y el test
 * del par se pone rojo. El lado backend ata el fixture con su propia aserción de igualdad.
 */
const RUTA = fileURLToPath(new URL('./__fixtures__/requiere_conexion.cards.json', import.meta.url));

type Cards = ReplyCard[];
const leer = (): Cards => JSON.parse(readFileSync(RUTA, 'utf8')) as Cards;

/** Las insignias que la hoja pintaría, por card: `null` = ítem sin insignia. */
function insignias(card: ReplyCard): (string | null)[] | null {
  const c = leerRequiereConexion(card);
  return c == null ? null : c.alcance.map((a) => etiquetaCondicion(a.condicion));
}

const ESPERADAS: Record<string, (string | null)[]> = {
  mercadopago: ['Solo lectura', 'Nunca sin tu OK'],
  // SM-E2: Gmail sólo anuncia lo que cablea (`gmail_send`); «Leer mails» y «Buscar» se podaron.
  gmail: ['Nunca sin tu OK'],
  servicio_sin_ficha: [],
};

/** Lo que emitía el backend ANTES de D1: `alcance` plano. */
const aStrings = (card: ReplyCard): ReplyCard =>
  ({ ...card, alcance: (card as unknown as { alcance: { texto: string }[] }).alcance.map((a) => a.texto) }) as ReplyCard;

describe('costura alcance: payload que emite el backend → parser del core → insignia', () => {
  it('el control no es vacío: el fixture trae las cards y al menos una insignia (denominador impreso)', () => {
    const cards = leer();
    const total = cards.flatMap((c) => insignias(c) ?? []).filter((i) => i != null).length;
    console.log(`PAR alcance: ${cards.length} cards, ${total} insignias pintadas`);
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it('cada card del backend produce las insignias de su alcance', () => {
    for (const card of leer()) {
      const servicio = (card as { service: string }).service;
      expect(insignias(card), `insignias de ${servicio}`).toEqual(ESPERADAS[servicio]);
    }
  });

  it('CONTROL DE CEGERA: la misma card con `alcance: string[]` NO produce insignia', () => {
    // Si esto pasara igual que arriba, el test del par mediría otra cosa. Es la forma que emite el backend
    // antes de D1: el parser la tolera (no revienta) pero la hoja queda sin insignia — sin error.
    for (const card of leer().filter((c) => (ESPERADAS[(c as { service: string }).service] ?? []).length > 0)) {
      const servicio = (card as { service: string }).service;
      const plana = insignias(aStrings(card));
      expect(plana, `${servicio} con string[]`).not.toEqual(ESPERADAS[servicio]);
      expect(plana?.every((i) => i === null), `${servicio} con string[] sin insignias`).toBe(true);
    }
  });

  it('CONTROL DE CEGERA: los objetos en otra clave (`alcance_items`) tampoco pintan insignia', () => {
    const card = leer()[0] as Record<string, unknown>;
    const { alcance, ...resto } = card;
    const conOtraClave = { ...resto, alcance: (alcance as { texto: string }[]).map((a) => a.texto), alcance_items: alcance } as ReplyCard;
    expect(insignias(conOtraClave)?.every((i) => i === null)).toBe(true);
  });
});
