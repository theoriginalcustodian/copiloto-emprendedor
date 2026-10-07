import { SERVICE_RISK } from '@copiloto/core';
import { describe, expect, it } from 'vitest';

// `?raw` (igual que `catalog.contrato.paridad.test.ts`): el .py se lee como texto de build-time, y
// el JSON de excepciones también -- así no dependemos de `resolveJsonModule` en tsconfig, que este
// proyecto no declara.
import pySource from '../../../../../apps/copiloto/service_risk_contrato.py?raw';
import excepcionesRaw from './service-risk-excepciones.json?raw';

/**
 * RIESGOPROMESAWEB: el backend se prohibió nombrar una capacidad sin tool viva detrás
 * (`apps/copiloto/system_prompt.py:28-32`). `SERVICE_RISK` (`packages/core/src/chat/hitl.ts`) es la
 * web prometiendo un riesgo por SERVICIO -- y la promesa es tan vacía como la del prompt si el
 * servicio no tiene ninguna tool real que pueda generar esa card. Este test exige que cada clave de
 * `SERVICE_RISK` esté en el universo real (`service_risk_contrato.py`, re-derivado del código por
 * `test_service_risk_contrato.py`) o declarada como excepción explícita y fechada
 * (`service-risk-excepciones.json`) -- nunca silenciosa.
 */

function leerPython(): string {
  return (pySource as string).replace(/\r\n/g, '\n');
}

function serviciosPython(fuente: string): string[] {
  const bloque = /SERVICIOS_CON_TOOL_VIVA\s*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(fuente);
  if (!bloque) {
    throw new Error('no encontré `SERVICIOS_CON_TOOL_VIVA = frozenset({...})` en apps/copiloto/service_risk_contrato.py');
  }
  return [...(bloque[1] ?? '').matchAll(/"([a-z_]+)"/g)].map((m) => m[1] ?? '');
}

interface Excepciones {
  excepciones: Record<string, { motivo: string; fecha: string }>;
}

function leerExcepciones(): Excepciones {
  return JSON.parse(excepcionesRaw as string) as Excepciones;
}

/** Claves de `SERVICE_RISK` sin tool viva Y sin excepción declarada -- lo que el test no tolera. */
function huerfanos(declarados: readonly string[], universo: readonly string[], excepciones: Excepciones): string[] {
  const enUniverso = new Set(universo);
  const conExcepcion = new Set(Object.keys(excepciones.excepciones));
  return declarados.filter((s) => !enUniverso.has(s) && !conExcepcion.has(s));
}

const PY_REAL = serviciosPython(leerPython());
const EXCEPCIONES = leerExcepciones();
const DECLARADOS = Object.keys(SERVICE_RISK);

describe('RIESGOPROMESAWEB: SERVICE_RISK (TS) sólo nombra servicios con tool viva o con excepción', () => {
  it('ningún servicio de SERVICE_RISK queda huérfano de tool viva y sin excepción', () => {
    expect(PY_REAL.length, 'el parser no encontró servicios en service_risk_contrato.py').toBeGreaterThan(0);
    const orfandad = huerfanos(DECLARADOS, PY_REAL, EXCEPCIONES);
    expect(orfandad, `${orfandad.join(', ')} está en SERVICE_RISK, no tiene tool viva, y no está en service-risk-excepciones.json`).toEqual([]);
  });

  // 🐤 Canario: una clave inventada en SERVICE_RISK (simulado -- no se muta el import real) tiene
  // que detectarse como huérfana. Sin este control, un `huerfanos([], [], {excepciones:{}})` que
  // siempre devolviera `[]` pasaría igual el test de arriba.
  it('🐤 canario: una clave inventada sin tool viva ni excepción se detecta', () => {
    const simulado = { ...SERVICE_RISK, telepatia: SERVICE_RISK.mercadopago };
    const orfandad = huerfanos(Object.keys(simulado), PY_REAL, EXCEPCIONES);
    expect(orfandad).toEqual(['telepatia']);
  });

  // 🎯 Control negativo: mercadopago SÍ tiene tool viva (1ra clase, `tool_catalog.py:626`) y NO
  // debe aparecer como huérfano, aunque no viva en `services/*.py`.
  it('🎯 control negativo: mercadopago (1ra clase, no en services/) nunca es huérfano', () => {
    expect(PY_REAL).toContain('mercadopago');
    expect(huerfanos(['mercadopago'], PY_REAL, EXCEPCIONES)).toEqual([]);
  });

  // 🎯 Control negativo: instagram SIGUE sin tool viva (si esto se pone rojo, alguien le agregó una
  // tool real y la excepción de abajo quedó obsoleta -- sacarla, no silenciarla).
  it('🎯 control negativo: instagram sigue sin tool viva en el universo real', () => {
    expect(PY_REAL).not.toContain('instagram');
  });

  it('instagram está en SERVICE_RISK sólo porque hay una excepción fechada y con dueño, no porque tenga tool', () => {
    expect(DECLARADOS).toContain('instagram');
    expect(EXCEPCIONES.excepciones.instagram).toBeDefined();
    expect(EXCEPCIONES.excepciones.instagram?.motivo.length ?? 0).toBeGreaterThan(0);
    expect(EXCEPCIONES.excepciones.instagram?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Control: una clave de mentira en el lado Python se detecta (asegura que el parser mira).
  it('control: una clave agregada del lado Python amplía el universo reconocido', () => {
    const original = leerPython();
    const fuenteAmpliada = original.replace('"googlecalendar",', '"googlecalendar",\n    "telepatia_py",');
    expect(fuenteAmpliada, 'el mutante no cambió la fuente: el control no mira').not.toBe(original);
    expect(serviciosPython(fuenteAmpliada)).toContain('telepatia_py');
  });
});
