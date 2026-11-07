import { act, renderHook } from '@testing-library/react-native';

import {
  hayCapturaEnCurso,
  registrarCaptura,
  reiniciarCapturasParaTest,
  useHayCapturaEnCurso,
} from './capturaEnCurso';

describe('capturaEnCurso — un audio sin resolver bloquea al resto de la app', () => {
  beforeEach(() => reiniciarCapturasParaTest());

  it('sin capturas registradas no hay bloqueo', () => {
    expect(hayCapturaEnCurso()).toBe(false);
  });

  it('registrar marca la captura y liberar la quita (idempotente)', () => {
    const liberar = registrarCaptura();
    expect(hayCapturaEnCurso()).toBe(true);
    liberar();
    expect(hayCapturaEnCurso()).toBe(false);
    liberar(); // segunda vez: no rompe ni resta de más
    expect(hayCapturaEnCurso()).toBe(false);
  });

  it('con dos docks grabando, el bloqueo dura hasta que se libera el ÚLTIMO', () => {
    const a = registrarCaptura();
    const b = registrarCaptura();
    a();
    expect(hayCapturaEnCurso()).toBe(true);
    b();
    expect(hayCapturaEnCurso()).toBe(false);
  });

  it('el hook re-renderiza al aparecer y al resolverse la captura', async () => {
    const { result } = await renderHook(() => useHayCapturaEnCurso());
    expect(result.current).toBe(false);
    let liberar = () => {};
    await act(async () => {
      liberar = registrarCaptura();
    });
    expect(result.current).toBe(true);
    await act(async () => liberar());
    expect(result.current).toBe(false);
  });
});
