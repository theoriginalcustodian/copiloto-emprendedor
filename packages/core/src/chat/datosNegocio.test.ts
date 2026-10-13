import { describe, expect, it } from 'vitest';

import { leerDatosNegocio } from './datosNegocio';

const card = (data: unknown, kind = 'datos_negocio') => ({ kind, data }) as never;

// Las tres formas son las que emite `apps/copiloto/datos_card.py` (medidas en vivo contra prod el
// 2026-10-13, ver el `pedido_` de backend `preg-datos`), no payloads armados a mano.
const ESTE_MES = {
  titulo: 'Este mes',
  cifras: [
    { k: 'Entró', v: '$0,00' },
    { k: 'Salió', v: '$0,00' },
    { k: 'Queda', v: '$0,00' },
    { k: 'Facturado', v: '$0,00' },
    { k: 'Cobrado', v: '$0,00' },
  ],
  chip: 'Al 13 de octubre',
  nota: 'Mercado Pago está desconectado: lo que entró puede estar incompleto. Reconectalo para ver el número real.',
};

const LO_QUE_TE_DEBEN = {
  titulo: 'Lo que te deben',
  cifras: [
    { k: 'Total', v: '$205.000,00' },
    { k: 'Vencido', v: '$120.000,00' },
  ],
  chip: null,
  nota: '«Vencido» es lo emitido hace más de 30 días y todavía impago.',
};

const SIN_NOTA = {
  titulo: 'Entró y salió por mes',
  cifras: [{ k: 'septiembre 2026', v: 'Entró $120.000,00 · Salió $50.000,00' }],
  chip: 'Últimos 6 meses',
  nota: null,
};

describe('leerDatosNegocio', () => {
  it('lee titulo, las N cifras, chip y nota de «Este mes»', () => {
    const r = leerDatosNegocio(card(ESTE_MES));
    expect(r?.titulo).toBe('Este mes');
    expect(r?.cifras).toHaveLength(5);
    expect(r?.cifras[0]).toEqual({ clave: 'Entró', valor: '$0,00' });
    expect(r?.chip).toBe('Al 13 de octubre');
    expect(r?.nota).toMatch(/Mercado Pago está desconectado/);
  });

  it('chip null: queda null, no una píldora vacía', () => {
    const r = leerDatosNegocio(card(LO_QUE_TE_DEBEN));
    expect(r?.chip).toBeNull();
    expect(r?.nota).toMatch(/Vencido/);
  });

  it('nota null: queda null y el resto se lee igual', () => {
    const r = leerDatosNegocio(card(SIN_NOTA));
    expect(r?.nota).toBeNull();
    expect(r?.chip).toBe('Últimos 6 meses');
    expect(r?.cifras).toEqual([{ clave: 'septiembre 2026', valor: 'Entró $120.000,00 · Salió $50.000,00' }]);
  });

  it('con más de una cifra conserva el orden del backend', () => {
    const r = leerDatosNegocio(card(LO_QUE_TE_DEBEN));
    expect(r?.cifras.map((c) => c.clave)).toEqual(['Total', 'Vencido']);
  });

  it('🔴 `v` pasa TAL CUAL: no se reformatea ni se convierte a número', () => {
    const r = leerDatosNegocio(card(LO_QUE_TE_DEBEN));
    expect(r?.cifras[0]?.valor).toBe('$205.000,00');
    expect(typeof r?.cifras[0]?.valor).toBe('string');
  });

  it('null para cualquier otro kind (el caso ajeno), con data bien formada', () => {
    expect(leerDatosNegocio(card(ESTE_MES, 'payment_link'))).toBeNull();
    expect(leerDatosNegocio(card(ESTE_MES, 'confirm'))).toBeNull();
    expect(leerDatosNegocio(card(ESTE_MES, 'gasto_propuesto'))).toBeNull();
    expect(leerDatosNegocio(card(ESTE_MES, 'datos_negocios'))).toBeNull();
  });

  it('null si no hay card, o data no es un objeto', () => {
    expect(leerDatosNegocio(undefined)).toBeNull();
    expect(leerDatosNegocio(card(null))).toBeNull();
    expect(leerDatosNegocio(card('Este mes'))).toBeNull();
  });

  it('null si falta titulo o cifras no es una lista, o no queda ninguna cifra legible', () => {
    expect(leerDatosNegocio(card({ ...ESTE_MES, titulo: undefined }))).toBeNull();
    expect(leerDatosNegocio(card({ ...ESTE_MES, titulo: '   ' }))).toBeNull();
    expect(leerDatosNegocio(card({ ...ESTE_MES, cifras: 'x' }))).toBeNull();
    expect(leerDatosNegocio(card({ ...ESTE_MES, cifras: [] }))).toBeNull();
    expect(leerDatosNegocio(card({ ...ESTE_MES, cifras: [{ k: 'Entró' }, { v: '$1,00' }, null, 7] }))).toBeNull();
  });

  it('descarta la cifra ilegible pero conserva las demás', () => {
    const r = leerDatosNegocio(card({ ...ESTE_MES, cifras: [{ k: 'Entró', v: '$1,00' }, { k: 'Salió' }, { k: 'Queda', v: '$1,00' }] }));
    expect(r?.cifras.map((c) => c.clave)).toEqual(['Entró', 'Queda']);
  });

  it('chip y nota vacíos o no-string valen null', () => {
    const r = leerDatosNegocio(card({ ...ESTE_MES, chip: '  ', nota: 42 }));
    expect(r?.chip).toBeNull();
    expect(r?.nota).toBeNull();
  });
});
