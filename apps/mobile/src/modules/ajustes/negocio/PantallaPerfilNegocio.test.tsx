import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Partial mock de `@copiloto/core`: sólo se reemplazan las 2 funciones de red de `perfilNegocio.ts`.
 *
 * 🔴 **`ApiError` se conserva REAL (`...actual`) y no es un detalle.** El componente hace
 * `e instanceof ApiError` para decidir si muestra el `detail` del backend o un mensaje genérico; una
 * clase falsa declarada en este archivo rompe ese chequeo con `TypeError: Right-hand side of
 * 'instanceof' is not an object` — la factory de `jest.mock` se ejecuta al primer `require`, antes
 * de que la `class` del test salga de su zona muerta temporal. Probado: así fallaba.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerPerfilNegocio: jest.fn(), guardarPerfilNegocio: jest.fn() };
});

import { ApiError, guardarPerfilNegocio, leerPerfilNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { PantallaPerfilNegocio } from './PantallaPerfilNegocio';

const mockLeer = leerPerfilNegocio as jest.MockedFunction<typeof leerPerfilNegocio>;
const mockGuardar = guardarPerfilNegocio as jest.MockedFunction<typeof guardarPerfilNegocio>;

const PERFIL = {
  queVende: 'Instalaciones eléctricas',
  aQuien: 'ambos' as const,
  nombreComercial: 'Electricidad Pérez',
  horarioAtencion: 'Lunes a viernes de 8 a 17',
  telefono: '341 590 6309',
  email: 'contacto@elgalpon.com.ar',
  formalidad: 'cercano' as const,
  largoRespuesta: 'breve' as const,
  nombreCopiloto: 'Copi',
  // El modo de ceremonia entró al perfil con el contrato de modos. `confirmacion` es el default y el
  // fail-closed: cualquier otra cosa que llegue del wire se lee así.
  modoCeremonia: 'confirmacion' as const,
  actualizadoEn: '2026-07-21T22:14:03.120Z',
};

// `async` + `await`: `render()` es una promesa con RNTL 14 + React 19 (ver `jest.config.js`).
async function montar() {
  return render(
    <ThemeProvider>
      <PantallaPerfilNegocio />
    </ThemeProvider>,
  );
}

/** Con perfil guardado la pantalla abre como ficha: el formulario está detrás de «Editar». */
async function abrirEdicion() {
  await fireEvent.press(await screen.findByTestId('perfil-negocio-editar'));
  await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
}

/** El modo y su explicación viven en una vista aparte, detrás de la fila «Antes de guardar». */
async function abrirModo() {
  await fireEvent.press(await screen.findByTestId('perfil-negocio-modo-fila'));
  await waitFor(() => expect(screen.getByTestId('pantalla-modo')).toBeTruthy());
}

describe('PantallaPerfilNegocio', () => {
  beforeEach(() => {
    mockLeer.mockReset();
    mockGuardar.mockReset();
    mockLeer.mockResolvedValue({ status: 'ok', perfil: PERFIL });
    mockGuardar.mockResolvedValue({ status: 'ok', perfil: PERFIL });
  });

  it('con perfil guardado abre como FICHA de lectura: los datos se leen y no hay ningún campo abierto', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-ficha')).toBeTruthy());
    expect(screen.getByTestId('perfil-negocio-ficha-que-vende')).toHaveTextContent('Instalaciones eléctricas');
    expect(screen.getByTestId('perfil-negocio-ficha-a-quien')).toHaveTextContent('Empresas y consumidor final');
    expect(screen.getByTestId('perfil-negocio-ficha-nombre-comercial')).toHaveTextContent('Electricidad Pérez');
    expect(screen.queryByTestId('perfil-negocio-que-vende-input')).toBeNull();
    expect(screen.queryByTestId('perfil-negocio-guardar-negocio')).toBeNull();
  });

  it('un dato sin cargar lo dice en la ficha, en vez de dejar el renglón en blanco', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, horarioAtencion: '' } });
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-ficha-horario')).toHaveTextContent('Sin cargar'));
  });

  it('«Cancelar» vuelve a la ficha con lo guardado, sin llamar al backend', async () => {
    await montar();
    await abrirEdicion();
    await fireEvent.changeText(screen.getByTestId('perfil-negocio-nombre-comercial-input'), 'Otro nombre');
    await fireEvent.press(screen.getByTestId('perfil-negocio-cancelar'));

    await waitFor(() => expect(screen.getByTestId('perfil-negocio-ficha-nombre-comercial')).toHaveTextContent('Electricidad Pérez'));
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('«Editar» abre el formulario precargado con el perfil guardado', async () => {
    await montar();
    await abrirEdicion();
    expect(screen.getByTestId('perfil-negocio-que-vende-input').props.value).toBe('Instalaciones eléctricas');
  });

  /**
   * 🔴 El caso MÁS común el primer día. Un cartel de error acá le diría al emprendedor que algo se
   * rompió cuando lo único que pasa es que todavía no completó nada — y lo mandaría a reintentar
   * algo que no tiene nada que reintentar.
   */
  it('perfil:null pinta el formulario vacío, NO un error', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: null });

    await montar();

    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    expect(screen.queryByTestId('perfil-negocio-error')).toBeNull();
    expect(screen.queryByTestId('perfil-negocio-no-disponible')).toBeNull();
    // Sin nada cargado no hay ficha que leer ni a la que volver: se entra directo a completar.
    expect(screen.getByTestId('perfil-negocio-que-vende-input')).toBeTruthy();
    expect(screen.queryByTestId('perfil-negocio-ficha')).toBeNull();
    expect(screen.queryByTestId('perfil-negocio-cancelar')).toBeNull();
  });

  it('cuando el endpoint no está desplegado lo dice, sin ofrecer reintentar', async () => {
    mockLeer.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('perfil-negocio-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('perfil-negocio-seccion-negocio')).toBeNull();
  });

  it('K-15: la fila-resumen refleja el valor guardado y abre «Cómo hablarle»; el editor ya no vive acá', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-tono-resumen')).toBeTruthy());
    expect(screen.getByTestId('perfil-negocio-tono-resumen')).toHaveTextContent(/Cercano · Breve · Copi/);
    expect(screen.queryByTestId('perfil-negocio-formalidad')).toBeNull();
    expect(screen.queryByTestId('perfil-negocio-largo')).toBeNull();

    await fireEvent.press(screen.getByTestId('perfil-negocio-tono-fila'));
    expect(await screen.findByTestId('pantalla-tono')).toBeTruthy();
  });

  it('el botón de Negocio manda sólo los campos del negocio', async () => {
    await montar();
    await abrirEdicion();

    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());

    const enviado = mockGuardar.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(enviado).sort()).toEqual([
      'aQuien',
      'email',
      'horarioAtencion',
      'nombreComercial',
      'queVende',
      'telefono',
    ]);
  });

  it('BL-J10: precarga teléfono y email y los manda al guardar', async () => {
    await montar();
    await abrirEdicion();
    expect(screen.getByTestId('perfil-negocio-telefono-input').props.value).toBe('341 590 6309');
    expect(screen.getByTestId('perfil-negocio-email-input').props.value).toBe('contacto@elgalpon.com.ar');

    await fireEvent.changeText(screen.getByTestId('perfil-negocio-telefono-input'), '011 4444 5555');
    await fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({ telefono: '011 4444 5555', email: 'contacto@elgalpon.com.ar' });
  });

  it('🔴 BL-J10: formato inválido avisa en el campo y NO llama al backend', async () => {
    await montar();
    await abrirEdicion();
    await fireEvent.changeText(screen.getByTestId('perfil-negocio-telefono-input'), '590 630');
    await fireEvent.changeText(screen.getByTestId('perfil-negocio-email-input'), 'sin-arroba');

    await fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() => expect(screen.getByText('Poné al menos 8 dígitos, con característica')).toBeTruthy());
    expect(screen.getByText(/Falta el @ o el dominio/)).toBeTruthy();
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('«Qué vendés» corto: al salir del campo AVISA, y Guardar sigue funcionando (aviso, no bloqueo)', async () => {
    await montar();
    await abrirEdicion();
    expect(screen.queryByTestId('perfil-negocio-que-vende-error')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('perfil-negocio-que-vende-input'), 'Pan');
    // A mitad de camino NO marca nada: se evalúa al salir del campo.
    expect(screen.queryByTestId('perfil-negocio-que-vende-error')).toBeNull();
    await fireEvent(screen.getByTestId('perfil-negocio-que-vende-input'), 'blur');

    expect(screen.getByTestId('perfil-negocio-que-vende-error')).toBeTruthy();
    expect(screen.getByText('Escribí al menos 10 caracteres para que Odobi entienda tu negocio')).toBeTruthy();

    // 🔴 No bloquea: el contrato de guardado no se toca y el corto viaja tal cual.
    await fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({ queVende: 'Pan' });
  });

  it('«Qué vendés»: volver a escribir limpia el aviso, y un perfil guardado con largo suficiente no avisa', async () => {
    await montar();
    await abrirEdicion();
    await fireEvent(screen.getByTestId('perfil-negocio-que-vende-input'), 'blur');
    expect(screen.queryByTestId('perfil-negocio-que-vende-error')).toBeNull(); // PERFIL.queVende ya tiene >= 10

    await fireEvent.changeText(screen.getByTestId('perfil-negocio-que-vende-input'), 'Pan');
    await fireEvent(screen.getByTestId('perfil-negocio-que-vende-input'), 'blur');
    expect(screen.getByTestId('perfil-negocio-que-vende-error')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('perfil-negocio-que-vende-input'), 'Panadería artesanal');
    expect(screen.queryByTestId('perfil-negocio-que-vende-error')).toBeNull();
  });

  it('muestra el detail del 400 en vez de un error genérico', async () => {
    // "No se pudo guardar" deja al usuario adivinando cuál de los siete campos toca corregir.
    mockGuardar.mockRejectedValue(new ApiError(400, 'que_vende supera los 500 caracteres', 'que_vende supera los 500 caracteres'));

    await montar();
    await abrirEdicion();
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() =>
      expect(screen.getByTestId('perfil-negocio-error-guardado')).toHaveTextContent('supera los 500', {
        exact: false,
      }),
    );
  });

  it('re-siembra los campos con el perfil que devuelve el POST', async () => {
    // El backend devuelve el perfil COMPLETO: si otro dispositivo cambió la otra sección, este es el
    // momento en que aparece. Dar por hecho que quedó lo que había en pantalla lo escondería.
    mockGuardar.mockResolvedValue({
      status: 'ok',
      perfil: { ...PERFIL, nombreComercial: 'Electricidad Pérez S.R.L.' },
    });

    await montar();
    await abrirEdicion();
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));

    // Al guardar se vuelve a la ficha, que muestra lo que devolvió el backend.
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-ficha-nombre-comercial')).toHaveTextContent(/S\.R\.L\./));
  });

  it('volver a editar borra el "Listo, lo guardamos" anterior', async () => {
    await montar();
    await abrirEdicion();
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-guardado')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('perfil-negocio-editar'));

    // Dejarlo en pantalla mientras se edita diría que lo que se está viendo ya está a salvo.
    await waitFor(() => expect(screen.queryByTestId('perfil-negocio-guardado')).toBeNull());
  });

  describe('cómo trabaja el copiloto', () => {
    it('muestra el modo VIGENTE y ninguna segunda opción', async () => {
      // Decisión B: el modo automático no se muestra gris. Una puerta que no se puede abrir le enseña
      // al emprendedor que la app tiene cosas apagadas.
      await montar();

      // En Mi negocio el modo es una fila con su estado; la explicación vive al entrar.
      await waitFor(() => expect(screen.getByTestId('perfil-negocio-estado-modo')).toBeTruthy());
      expect(screen.getByTestId('perfil-negocio-estado-modo').props.children).toBe('Te muestra una tarjeta para revisar');
      await abrirModo();
      expect(screen.getByTestId('perfil-negocio-modo').props.children).toBe('Pedir confirmación');
      expect(screen.queryByText(/Automático/)).toBeNull();
      // La pantalla habla de «una tarjeta»: la muestra, con lo dicho y los botones de confirmar.
      expect(screen.getByTestId('perfil-negocio-modo-ejemplo')).toBeTruthy();
      expect(screen.getByText('Cargué nafta, 42.000')).toBeTruthy();
      expect(screen.getByTestId('perfil-negocio-modo-ejemplo-guardar')).toBeTruthy();
    });

    it('🔴 en confirmación NO hay forma de ENCENDER el automático — eso lo ofrece el copiloto', async () => {
      await montar();
      await abrirModo();
      expect(screen.getByTestId('perfil-negocio-seccion-modo')).toBeTruthy();

      // El va-B: el automático se OFRECE, no se elige de una lista. Ni un select, ni un botón de
      // encender. Si mañana alguien agrega un toggle libre acá, este test lo frena: ofrecer «encender»
      // sin el mecanismo de oferta sería una promesa falsa.
      expect(screen.queryByTestId('perfil-negocio-modo-select')).toBeNull();
      expect(screen.queryByTestId('perfil-negocio-volver-confirmacion')).toBeNull();
    });

    it('un perfil que llega en `automatico` lo dice, con su explicación', async () => {
      mockLeer.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, modoCeremonia: 'automatico' } });

      await montar();

      await waitFor(() => expect(screen.getByTestId('perfil-negocio-estado-modo').props.children).toBe('Anota solo y te avisa después'));
      await abrirModo();
      expect(screen.getByTestId('perfil-negocio-modo').props.children).toBe('Automático');
      // Y la explicación NO promete que deja de preguntar todo: el piso sigue confirmando siempre.
      expect(screen.getByText(/te lo sigue preguntando siempre/)).toBeTruthy();
    });

    it('🔴 en automático SÍ se puede VOLVER a confirmación — «volver es un toque»', async () => {
      // La única dirección que la app dicta: apagar. Ahora tiene endpoint real (POST modo_ceremonia).
      mockLeer.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, modoCeremonia: 'automatico' } });
      mockGuardar.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, modoCeremonia: 'confirmacion' } });

      await montar();
      await abrirModo();

      await fireEvent.press(screen.getByTestId('perfil-negocio-volver-confirmacion'));

      await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith({ modoCeremonia: 'confirmacion' }));
      // Y la pantalla re-siembra desde la respuesta: pasa a mostrar «Pedir confirmación».
      await waitFor(() => expect(screen.getByTestId('perfil-negocio-modo').props.children).toBe('Pedir confirmación'));
    });

    it('🔴 volver escribe SÓLO el modo — no arrastra el resto del perfil', async () => {
      // El POST es parcial: mandar el perfil entero pisaría cambios que otra pantalla/dispositivo hizo.
      mockLeer.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, modoCeremonia: 'automatico' } });
      mockGuardar.mockResolvedValue({ status: 'ok', perfil: { ...PERFIL, modoCeremonia: 'confirmacion' } });

      await montar();
      await abrirModo();
      await fireEvent.press(screen.getByTestId('perfil-negocio-volver-confirmacion'));

      await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
      const enviado = mockGuardar.mock.calls[0][0];
      expect(Object.keys(enviado)).toEqual(['modoCeremonia']);
    });
  });
});
