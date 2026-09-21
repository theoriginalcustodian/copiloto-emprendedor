import { describe, expect, it } from 'vitest';

import { dejarPendiente, tomarPendiente } from './mensajePendiente';

describe('mensajePendiente (BL-W9)', () => {
  it('lo deja, lo toma UNA vez y vacía el buzón (nunca reenvía solo)', () => {
    dejarPendiente('  ¿Cómo cargo un gasto hablando?  ');
    expect(tomarPendiente()).toBe('¿Cómo cargo un gasto hablando?');
    expect(tomarPendiente()).toBeNull();
  });
  it('un texto vacío no deja nada, y el último gana', () => {
    dejarPendiente('   ');
    expect(tomarPendiente()).toBeNull();
    dejarPendiente('uno');
    dejarPendiente('dos');
    expect(tomarPendiente()).toBe('dos');
  });
});
