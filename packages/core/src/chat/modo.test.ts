import { describe, expect, it } from 'vitest';

import {
  impedimentoParaModo,
  modoEfectivo,
  modoPermitido,
  motivoDelImpedimento,
} from './modo';

describe('modo negocio (adaptado del "modo clínico" de origen)', () => {
  describe('🔴 el modo negocio exige cliente', () => {
    it('sin cliente NO se permite — no hay "modo negocio sin sujeto"', () => {
      expect(modoPermitido('negocio', null)).toBe(false);
      expect(impedimentoParaModo('negocio', null)).toBe('sin-cliente');
    });

    it('con cliente sí', () => {
      expect(modoPermitido('negocio', 'p1')).toBe(true);
      expect(impedimentoParaModo('negocio', 'p1')).toBeNull();
    });

    it('CONTROL: el modo copiloto NO exige cliente — la exigencia es sólo del negocio', () => {
      expect(modoPermitido('copiloto', null)).toBe(true);
      expect(impedimentoParaModo('copiloto', null)).toBeNull();
    });
  });

  describe('🔴 la degradación va hacia el modo SEGURO, nunca al revés', () => {
    it('si el cliente desaparece, el modo negocio CAE a copiloto', () => {
      // La degradacion insegura seria quedarse en negocio sin sujeto: el modelo seguiria respondiendo
      // *como si* hubiera un registro detras y el usuario no tendria como notarlo. Un modo que se
      // apaga se ve; uno que miente, no.
      expect(modoEfectivo('negocio', null)).toBe('copiloto');
    });

    it('con cliente, el modo elegido se respeta', () => {
      expect(modoEfectivo('negocio', 'p1')).toBe('negocio');
    });

    it('copiloto nunca se convierte en negocio solo — no hay escalada automática', () => {
      // Que haya cliente NO alcanza para entrar en modo negocio: lo activa el usuario, no el contexto.
      expect(modoEfectivo('copiloto', 'p1')).toBe('copiloto');
      expect(modoEfectivo('copiloto', null)).toBe('copiloto');
    });
  });

  describe('el impedimento se puede explicar, no sólo detectar', () => {
    it('el motivo dice qué hacer, no sólo que no se puede', () => {
      const motivo = motivoDelImpedimento('sin-cliente');

      // Un boton apagado sin explicacion es un callejon: el usuario no sabe si esta roto o si le
      // falta algo. El texto tiene que nombrar la ACCION que lo destraba.
      expect(motivo).toMatch(/client/i);
      expect(motivo.length).toBeGreaterThan(10);
    });
  });
});
