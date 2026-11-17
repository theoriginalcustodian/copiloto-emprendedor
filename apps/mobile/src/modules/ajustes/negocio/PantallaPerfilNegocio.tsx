import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  avisoDeQueVende,
  errorDeEmail,
  errorDeTelefono,
  guardarPerfilNegocio,
  leerPerfilNegocio,
  type AQuienVende,
  type FormalidadCopiloto,
  type GuardarPerfilNegocioRequest,
  type LargoRespuesta,
  type ModoCeremonia,
  type PerfilNegocio,
} from '@copiloto/core';

import {
  CampoSelect,
  CampoTexto,
  FilaBotones,
  ScrollFormulario,
  type OpcionSelect,
} from '../../../theme/glass/campos';
import { elevacion } from '../../../theme/BloqueCifra';
import { CifraResumen, FilaResumen, FranjaDatos, FranjaPrincipal, ResumenTarjeta } from '../../../theme/ResumenTarjeta';
import { Chevron } from '../Chevron';
import { FilaGrupo, GrupoFilas } from '../GrupoFilas';
import { MarcoGlass } from '../../../theme/glass/MarcoGlass';
import { OPCIONES_FORMALIDAD, OPCIONES_LARGO, PantallaTono } from './PantallaTono';
import { SeccionCatalogo } from './SeccionCatalogo';
import { PRESS_FADE, pressableStyle } from '../../../theme/glass/presion';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * `PantallaPerfilNegocio` — Ajustes → "Mi negocio": qué vende el emprendedor, a quién, y cómo quiere
 * que le hable el copiloto.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md` §1.
 * Todo lo que esta pantalla sabe del backend sale de `@copiloto/core` (`api/perfilNegocio.ts`) —
 * ningún `fetch`, ningún código HTTP, ninguna URL acá.
 *
 * 🔴 **Dos secciones que se guardan POR SEPARADO, y ese es el punto del POST parcial.** "Mi negocio"
 * (qué vende, a quién, nombre, horario) y "Cómo te habla el copiloto" (formalidad, largo, nombre) son
 * decisiones de distinto momento: el emprendedor puede querer cambiarle el tono al copiloto sin
 * volver a mirar lo que escribió sobre su negocio. Cada botón manda **sólo sus claves**; las ausentes
 * el backend no las toca. Un guardado que mandara el objeto entero haría que la sección que no se
 * está editando pise con lo que tenga en pantalla —que puede ser viejo— la que el usuario acaba de
 * cambiar en otro dispositivo.
 *
 * 🔴 **`perfil: null` NO es un error y es el caso MÁS común el primer día.** Todo tenant nuevo llega
 * así. Se pinta el formulario vacío, sin cartel de error y sin botón de reintentar: no hay nada que
 * reintentar, hay algo que completar.
 *
 * 🔴 **Acá NO se piden CUIT, razón social, domicilio ni condición IVA.** Ya viven en el perfil fiscal
 * (Ajustes → Facturación AFIP). Pedirlos otra vez sería la segunda copia de un dato que ya tenemos, y
 * las dos copias divergen solas — el usuario corrige una y la otra queda mintiendo sin avisar.
 *
 * 🔴 `ScrollFormulario` y no un `ScrollView` pelado: el teclado tapaba los campos y no había cómo
 * llegar a ellos (visto en device el 2026-07-21 en el alta de ARCA). Es además el `ScrollView` de
 * Gesture Handler, no el de `react-native` — esta pantalla vive dentro del `GestureDetector` de
 * `MarcoGlass` y dos sistemas de toque en el mismo árbol se disputan el dedo.
 */

const OPCIONES_A_QUIEN: OpcionSelect[] = [
  { valor: 'empresas', etiqueta: 'Empresas' },
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'ambos', etiqueta: 'Ambos' },
];

interface Campos {
  queVende: string;
  aQuien: AQuienVende;
  nombreComercial: string;
  horarioAtencion: string;
  telefono: string;
  email: string;
  formalidad: FormalidadCopiloto;
  largoRespuesta: LargoRespuesta;
  nombreCopiloto: string;
  /** 🔴 Sólo se LEE. No hay control para cambiarlo (decisión B) y por eso no entra en `aBodyCrudo`:
   *  el modo lo decide el backend y esta pantalla lo refleja. */
  modoCeremonia: ModoCeremonia;
}

/**
 * El estado inicial de un tenant que nunca configuró nada. Los enums arrancan en el valor más
 * habitual del oficio (le vende a los dos, habla cercano, responde corto) en vez de vacíos: un select
 * sin nada marcado obliga a elegir algo antes de poder guardar otra cosa.
 */
const CAMPOS_VACIOS: Campos = {
  queVende: '',
  aQuien: 'ambos',
  nombreComercial: '',
  horarioAtencion: '',
  telefono: '',
  email: '',
  formalidad: 'cercano',
  largoRespuesta: 'breve',
  nombreCopiloto: '',
  // 🔴 Fail-closed también en el estado inicial: el tenant que todavía no configuró nada trabaja en
  // el modo que PREGUNTA. Arrancar en `automatico` mostraría «Automático» durante el instante en que
  // la pantalla carga — y en algo que decide si tus datos se guardan solos, ese instante importa.
  modoCeremonia: 'confirmacion',
};

function aCampos(p: PerfilNegocio): Campos {
  return {
    queVende: p.queVende,
    aQuien: p.aQuien,
    nombreComercial: p.nombreComercial,
    horarioAtencion: p.horarioAtencion,
    telefono: p.telefono,
    email: p.email,
    formalidad: p.formalidad,
    largoRespuesta: p.largoRespuesta,
    nombreCopiloto: p.nombreCopiloto,
    modoCeremonia: p.modoCeremonia,
  };
}

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';
type EstadoGuardado = 'idle' | 'enviando' | 'ok' | 'error';

/** Qué sección se está guardando — para que el "Guardando…" aparezca en SU botón y no en los dos. */
type Seccion = 'negocio' | 'modo';

interface SeccionProps {
  /** Sin título: la pantalla ya se llama igual (mapa `negocio`, SM-K7) — repetirlo era ruido. */
  titulo?: string;
  testID: string;
  children: React.ReactNode;
}

function Seccion({ titulo, testID, children }: SeccionProps) {
  const tema = useTema();
  return (
    <View testID={testID} style={{ gap: tema.espacio.sm }}>
      {/* Rediseño (Martin 15/11): todos los títulos de sección en display, como en el resto de la app. Antes
          «Cómo te habla» iba en caja alta chica y los demás en la letra de interfaz. */}
      {titulo != null && (
        <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
          {titulo}
        </Text>
      )}
      {children}
    </View>
  );
}

/**
 * 🔴 **Los ejemplos dicen «ej.:» y eso NO es cosmética: sin el prefijo, un dato guardado y una
 * sugerencia se leen igual.**
 *
 * Pasó en device el 2026-07-22, con el aparato en la mano: `que_vende` tenía **«Instalaciones»** —un
 * dato real, cargado por el emprendedor— y se leyó como sugerencia. Al tocar el campo para "llenarlo",
 * el texto nuevo se **concatenó**: quedó *«InstalacionesHerreria y portones a medida»*. El dato no se
 * perdió: se ensució, que es peor, porque nada avisa.
 *
 * **Por qué no alcanzaba con más contraste.** El valor ya se pinta con `color.texto` y el placeholder
 * con `color.textoTenue` — son distintos en el token y aun así se confundieron sobre el vidrio. Una
 * defensa que depende de que dos grises se distingan **en una pantalla al sol, en un teléfono
 * cualquiera**, falla justo cuando importa. El prefijo no depende de la percepción: un texto que
 * empieza con «ej.:» no puede ser algo que vos escribiste.
 *
 * Aplica a **este formulario en particular** porque es el único que llega **pre-cargado desde el
 * servidor con campos opcionales vacíos**: los dos estados conviven en la misma pantalla. En un alta
 * no hay valor guardado que confundir.
 */
/** Cómo se LEE «a quién le vendés» en la ficha (en el formulario son tres pastillas). */
const A_QUIEN_LEIDO: Record<AQuienVende, string> = {
  empresas: 'Empresas',
  consumidor_final: 'Consumidor final',
  ambos: 'Empresas y consumidor final',
};

/** Sin ningún dato del negocio cargado no hay ficha que leer: se entra directo al formulario. */
function sinDatosDeNegocio(c: Campos): boolean {
  return [c.queVende, c.nombreComercial, c.horarioAtencion, c.telefono, c.email].every((v) => v.trim() === '');
}

interface DatoProps {
  rotulo: string;
  valor: string;
  testID: string;
  primera?: boolean;
  /** Cuántos renglones del valor se muestran antes de cortar. */
  renglones?: number;
}

/** Un renglón de la ficha: el rótulo chico y gris arriba, el dato debajo en la letra normal. */
function Dato({ rotulo, valor, testID, primera, renglones = 1 }: DatoProps) {
  const tema = useTema();
  const vacio = valor.trim() === '';
  return (
    <FilaGrupo primera={primera}>
      <View style={styles.dato}>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{rotulo}</Text>
        <Text
          testID={testID}
          numberOfLines={renglones}
          style={{ color: vacio ? tema.color.textoTenue : tema.color.texto, fontSize: tema.tipo.base, lineHeight: 22 }}
        >
          {vacio ? 'Sin cargar' : valor}
        </Text>
      </View>
    </FilaGrupo>
  );
}

/**
 * El ejemplo de «Antes de guardar»: lo que se le dice y la tarjeta que devuelve, armada con las MISMAS piezas
 * que la tarjeta real del chat (`ResumenTarjeta`), para que no pueda parecerse a otra cosa. Es una lámina:
 * no se toca (`pointerEvents="none"`) y el lector de pantalla la lee como una sola imagen descrita.
 */
function EjemploTarjeta() {
  const tema = useTema();
  const nada = () => {};
  return (
    <View
      testID="perfil-negocio-modo-ejemplo"
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Ejemplo. Le decís: Cargué nafta, 42.000. Odobi te muestra una tarjeta de gasto con monto, categoría, detalle y fecha, y los botones Guardar y Descartar."
      style={{ gap: tema.espacio.sm }}
    >
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Por ejemplo, le decís:</Text>
      <View style={[styles.burbuja, { backgroundColor: tema.glass.mio1 }]}>
        <Text style={{ color: tema.glass.tintaMio, fontSize: tema.tipo.base }}>Cargué nafta, 42.000</Text>
      </View>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Y te muestra esto:</Text>
      <View style={[styles.tarjetaEjemplo, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, paddingBottom: 12 }}>
          Gasto
        </Text>
        <ResumenTarjeta>
          <FranjaPrincipal>
            <CifraResumen texto="$42.000,00" nombre="Monto" onCambiar={nada} testID="perfil-negocio-modo-ejemplo-monto" testIDTexto="perfil-negocio-modo-ejemplo-monto-texto" />
          </FranjaPrincipal>
          <FranjaDatos>
            <FilaResumen rotulo="Categoría" valor="Transporte" onCambiar={nada} testID="perfil-negocio-modo-ejemplo-categoria" />
            <FilaResumen separada rotulo="Detalle" valor="Nafta" onCambiar={nada} testID="perfil-negocio-modo-ejemplo-detalle" />
            <FilaResumen separada rotulo="Fecha" valor="Hoy" onCambiar={nada} testID="perfil-negocio-modo-ejemplo-fecha" />
          </FranjaDatos>
        </ResumenTarjeta>
        <FilaBotones
          testID="perfil-negocio-modo-ejemplo-botones"
          botones={[
            { etiqueta: 'Guardar', onPress: nada, variante: 'primario', testID: 'perfil-negocio-modo-ejemplo-guardar' },
            { etiqueta: 'Descartar', onPress: nada, testID: 'perfil-negocio-modo-ejemplo-descartar' },
          ]}
        />
      </View>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
        Nada se guarda hasta que tocás «Guardar». Si entendió mal un dato, lo cambiás ahí mismo.
      </Text>
    </View>
  );
}

/** Resumen de la fila que lleva a «Cómo hablarle»: «Cercano · Breve · Copi». */
function resumenDeTono(c: { formalidad: FormalidadCopiloto; largoRespuesta: LargoRespuesta; nombreCopiloto: string }): string {
  const f = OPCIONES_FORMALIDAD.find((o) => o.valor === c.formalidad)?.etiqueta ?? '';
  const l = OPCIONES_LARGO.find((o) => o.valor === c.largoRespuesta)?.etiqueta ?? '';
  return [f, l, c.nombreCopiloto.trim()].filter((x) => x !== '').join(' · ');
}

export function PantallaPerfilNegocio() {
  const tema = useTema();
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  // K-15: «Cómo hablarle» es una vista de esta misma ruta (no una ruta nueva: registrarla exigiría
  // tocar `app/_layout.tsx`, de FE1).
  const [verTono, setVerTono] = useState(false);
  // Rediseño (Martin 17/11): los datos del negocio se LEEN como ficha y «Editar» abre el formulario. Antes
  // la pantalla era un formulario abierto permanente —seis cajas con su rótulo— para datos que se cargan una vez.
  const [editando, setEditando] = useState(false);
  /** Lo último que se sabe guardado: a eso vuelve «Cancelar». */
  const [guardados, setGuardados] = useState<Campos>(CAMPOS_VACIOS);
  // El modo y su explicación viven en una vista aparte de esta misma ruta, como «Cómo hablarle».
  const [verModo, setVerModo] = useState(false);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle');
  const [seccionEnCurso, setSeccionEnCurso] = useState<Seccion | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [erroresContacto, setErroresContacto] = useState<{ telefono: string | null; email: string | null }>({
    telefono: null,
    email: null,
  });
  // AVISO (no error): «Qué vendés» corto. Se evalúa al salir del campo y NUNCA entra en `guardar()` —
  // la regla es una heurística de calidad, no un requisito del backend. Ver `avisoDeQueVende`.
  const [avisoQueVende, setAvisoQueVende] = useState<string | null>(null);

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    if (campo === 'telefono' || campo === 'email') {
      setErroresContacto((prev) => ({ ...prev, [campo]: null }));
    }
    // Al escribir sólo se LIMPIA el aviso: nunca se marca uno nuevo a mitad de camino.
    if (campo === 'queVende') setAvisoQueVende(null);
    // Un cambio invalida el "Guardado" anterior: dejarlo en pantalla mientras el usuario edita diría
    // que lo que está viendo ya está a salvo, y no lo está.
    setEstadoGuardado('idle');
    setErrorGuardado(null);
  }

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await leerPerfilNegocio();
        if (!vivo) return;
        if (res.status === 'no_disponible') {
          setEstadoCarga('no_disponible');
          return;
        }
        // `perfil: null` → los campos quedan vacíos y la pantalla es un formulario, no un error.
        if (res.perfil) {
          setCampos(aCampos(res.perfil));
          setGuardados(aCampos(res.perfil));
        }
        setEditando(res.perfil == null || sinDatosDeNegocio(aCampos(res.perfil)));
        setEstadoCarga('ok');
      } catch {
        if (vivo) setEstadoCarga('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(seccion: Seccion) {
    // BL-J10: el formato del contacto se avisa EN el campo y no viaja nada si está mal. El backend
    // sigue siendo la fuente de verdad (su 400 igual se muestra abajo).
    if (seccion === 'negocio') {
      const errores = {
        telefono: errorDeTelefono(campos.telefono),
        email: errorDeEmail(campos.email),
      };
      setErroresContacto(errores);
      if (errores.telefono != null || errores.email != null) return;
    }
    const parcial: GuardarPerfilNegocioRequest = {
      queVende: campos.queVende,
      aQuien: campos.aQuien,
      nombreComercial: campos.nombreComercial,
      horarioAtencion: campos.horarioAtencion,
      telefono: campos.telefono,
      email: campos.email,
    };

    setSeccionEnCurso(seccion);
    setEstadoGuardado('enviando');
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio(parcial);
      if (res.status === 'no_disponible') {
        setEstadoCarga('no_disponible');
        setEstadoGuardado('idle');
        return;
      }
      // 🔴 `modo_no_disponible` (409): el modo pedido está en PAUSA del lado del backend. Esta
      // pantalla todavía no ofrece cambiar el modo, así que hoy no puede llegar acá — pero la rama
      // existe porque sin ella el `res.perfil` de abajo sería `undefined` y los campos se
      // vaciarían solos. Se muestra el mensaje del backend, nunca uno propio: cuando se levante la
      // pausa, el texto cambia solo.
      if (res.status === 'modo_no_disponible') {
        setErrorGuardado(res.mensaje);
        setEstadoGuardado('error');
        return;
      }
      // El POST devuelve el perfil COMPLETO ya actualizado: se re-siembran los campos desde la
      // respuesta en vez de dar por hecho que quedó lo que había en pantalla. Si otro dispositivo
      // cambió la otra sección, este es el momento en que aparece.
      setCampos(aCampos(res.perfil));
      setGuardados(aCampos(res.perfil));
      setEstadoGuardado('ok');
      setEditando(false);
    } catch (e) {
      // El 400 del backend nombra el campo o la regla que falló — mostrarlo es más útil que un
      // "no se pudo guardar" genérico, que deja al usuario adivinando cuál de los siete campos toca.
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : null);
      setEstadoGuardado('error');
    } finally {
      setSeccionEnCurso(null);
    }
  }

  /**
   * 🔴 **Volver a pedir confirmación — el ÚNICO cambio de modo que la app dicta, y sólo en una
   * dirección.** El `va-B` fijó que el automático **se ofrece, no se elige de una lista**: encenderlo
   * es una oferta del copiloto (cuando ve que venís dictando completo), no un toggle de Ajustes.
   * Apagarlo, en cambio, es *«volver es un toque»* — y ahora tiene endpoint real (`POST` con
   * `modo_ceremonia: 'confirmacion'`, forma del `avance_backend_el-modo-de-ceremonia-ya-tiene-forma`).
   * Por eso este botón aparece SÓLO en automático: no hay un «encender» simétrico que contradiga el va-B.
   */
  async function volverAConfirmacion() {
    setSeccionEnCurso('modo');
    setEstadoGuardado('enviando');
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio({ modoCeremonia: 'confirmacion' });
      if (res.status === 'no_disponible') {
        setEstadoCarga('no_disponible');
        setEstadoGuardado('idle');
        return;
      }
      if (res.status === 'modo_no_disponible') {
        setErrorGuardado(res.mensaje);
        setEstadoGuardado('error');
        return;
      }
      setCampos(aCampos(res.perfil));
      setGuardados(aCampos(res.perfil));
      setEstadoGuardado('ok');
    } catch (e) {
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : null);
      setEstadoGuardado('error');
    } finally {
      setSeccionEnCurso(null);
    }
  }

  const enviando = estadoGuardado === 'enviando';

  if (verTono) {
    return (
      <PantallaTono
        onVolver={() => setVerTono(false)}
        onGuardado={(perfil) => {
          setCampos(aCampos(perfil));
          setGuardados(aCampos(perfil));
        }}
      />
    );
  }

  const automatico = campos.modoCeremonia === 'automatico';
  const mensajes = (
    <>
      {estadoGuardado === 'ok' && (
        <Text testID="perfil-negocio-guardado" style={{ color: tema.color.exito, fontSize: tema.tipo.base }}>
          Listo, lo guardamos.
        </Text>
      )}
      {estadoGuardado === 'error' && (
        <Text testID="perfil-negocio-error-guardado" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {errorGuardado ?? 'No pudimos guardar los cambios. Probá de nuevo.'}
        </Text>
      )}
    </>
  );

  // 🔴 **Cómo TRABAJA Odobi — sólo el modo vigente, sin una segunda opción.** Decisión B
  // (`respuesta_..._va-B-la-opcion-nace-ofrecida-no-encendida`): el automático **no se muestra gris** ni se
  // elige de una lista; cuando exista de verdad aparece como OFERTA del copiloto. Esto no reemplaza al
  // candado: el backend rechaza `automatico` aunque acá ni se ofrezca. Lo único que la app dicta es VOLVER
  // a confirmación, y sólo estando en automático.
  if (verModo) {
    return (
      <MarcoGlass titulo="Antes de guardar" icono="miNegocio" sinIcono testID="pantalla-modo">
        <ScrollFormulario contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg }}>
          <View testID="perfil-negocio-seccion-modo" style={{ gap: tema.espacio.sm }}>
            <Text
              testID="perfil-negocio-modo"
              accessibilityRole="header"
              style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}
            >
              {automatico ? 'Automático' : 'Pedir confirmación'}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}>
              {automatico
                ? 'Lo que sale de tu teléfono —facturar, mandar algo a un cliente, cobrar de verdad— te lo sigue preguntando siempre.'
                : 'Cuando le dictás algo, te muestra una tarjeta para que la revises antes de guardarla.'}
            </Text>
          </View>
          {!automatico && <EjemploTarjeta />}
          <FilaBotones
            testID="perfil-negocio-modo-acciones"
            botones={[
              ...(automatico
                ? [
                    {
                      etiqueta: seccionEnCurso === 'modo' && enviando ? 'Volviendo…' : 'Volver a pedir confirmación',
                      onPress: () => void volverAConfirmacion(),
                      variante: 'primario' as const,
                      deshabilitado: enviando,
                      testID: 'perfil-negocio-volver-confirmacion',
                    },
                  ]
                : []),
              { etiqueta: 'Volver a Mi negocio', onPress: () => setVerModo(false), testID: 'perfil-negocio-modo-volver' },
            ]}
          />
          {mensajes}
        </ScrollFormulario>
      </MarcoGlass>
    );
  }

  // `icono="miNegocio"`: el set de 21 tiene un glifo propio con este mismo nombre (local/vidriera),
  // así que ya no hace falta pedir prestado `chat` del catálogo viejo.
  return (
    <MarcoGlass titulo="Mi negocio" icono="miNegocio" sinIcono testID="pantalla-perfil-negocio">
      {estadoCarga === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="perfil-negocio-cargando" color={tema.color.acento} />
        </View>
      )}

      {estadoCarga === 'error' && (
        <View style={styles.centro}>
          <Text testID="perfil-negocio-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu perfil. Probá de nuevo.
          </Text>
        </View>
      )}

      {estadoCarga === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="perfil-negocio-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Esta función todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estadoCarga === 'ok' && (
        <ScrollFormulario contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg }}>
          {editando ? (
          <Seccion titulo="Tu negocio" testID="perfil-negocio-seccion-negocio">
            <CampoTexto
              testID="perfil-negocio-que-vende"
              etiqueta="Qué vendés"
              valor={campos.queVende}
              onChange={(v) => actualizar('queVende', v)}
              onBlur={() => setAvisoQueVende(avisoDeQueVende(campos.queVende))}
              placeholder="Contá qué hacés"
              multiline
              maxLength={LIMITE_QUE_VENDE}
              error={avisoQueVende ?? undefined}
            />
            <CampoSelect
              testID="perfil-negocio-a-quien"
              etiqueta="A quién le vendés"
              opciones={OPCIONES_A_QUIEN}
              valor={campos.aQuien}
              onChange={(v) => actualizar('aQuien', v as AQuienVende)}
            />
            <CampoTexto
              testID="perfil-negocio-nombre-comercial"
              etiqueta="Nombre comercial"
              valor={campos.nombreComercial}
              onChange={(v) => actualizar('nombreComercial', v)}
              placeholder="Con el que te conocen"
              maxLength={LIMITE_CAMPO_CORTO}
            />
            <CampoTexto
              testID="perfil-negocio-horario"
              etiqueta="Horario de atención"
              valor={campos.horarioAtencion}
              onChange={(v) => actualizar('horarioAtencion', v)}
              placeholder="ej.: Lunes a viernes de 8 a 17"
              maxLength={LIMITE_CAMPO_CORTO}
            />
            <CampoTexto
              testID="perfil-negocio-telefono"
              etiqueta="Teléfono"
              valor={campos.telefono}
              onChange={(v) => actualizar('telefono', v)}
              placeholder="ej.: 341 590 6309"
              keyboardType="phone-pad"
              maxLength={LIMITE_CAMPO_CORTO}
              error={erroresContacto.telefono ?? undefined}
            />
            <CampoTexto
              testID="perfil-negocio-email"
              etiqueta="Email"
              valor={campos.email}
              onChange={(v) => actualizar('email', v)}
              placeholder="ej.: contacto@elgalpon.com.ar"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={LIMITE_CAMPO_CORTO}
              error={erroresContacto.email ?? undefined}
            />
            <FilaBotones
              testID="perfil-negocio-guardar-negocio-botones"
              botones={[
                {
                  etiqueta: enviando && seccionEnCurso === 'negocio' ? 'Guardando…' : 'Guardar',
                  onPress: () => void guardar('negocio'),
                  variante: 'primario',
                  deshabilitado: enviando,
                  testID: 'perfil-negocio-guardar-negocio',
                },
                // Sin nada guardado no hay ficha a la que volver.
                ...(sinDatosDeNegocio(guardados)
                  ? []
                  : [
                      {
                        etiqueta: 'Cancelar',
                        onPress: () => {
                          setCampos(guardados);
                          setErroresContacto({ telefono: null, email: null });
                          setAvisoQueVende(null);
                          setEstadoGuardado('idle');
                          setErrorGuardado(null);
                          setEditando(false);
                        },
                        testID: 'perfil-negocio-cancelar',
                      },
                    ]),
              ]}
            />
            {mensajes}
          </Seccion>
          ) : (
          <>
          <View style={{ gap: 10 }}>
            <View style={styles.cabecera}>
              <Text
                accessibilityRole="header"
                style={{ flex: 1, color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}
              >
                Tu negocio
              </Text>
              <Pressable
                testID="perfil-negocio-editar"
                accessibilityRole="button"
                accessibilityLabel="Editar los datos de tu negocio"
                hitSlop={12}
                onPress={() => {
                  setEstadoGuardado('idle');
                  setErrorGuardado(null);
                  setEditando(true);
                }}
                style={pressableStyle(null, PRESS_FADE)}
              >
                <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>Editar</Text>
              </Pressable>
            </View>
            <GrupoFilas testID="perfil-negocio-ficha">
              <Dato primera rotulo="Qué vendés" valor={campos.queVende} renglones={2} testID="perfil-negocio-ficha-que-vende" />
              <Dato rotulo="A quién le vendés" valor={A_QUIEN_LEIDO[campos.aQuien]} testID="perfil-negocio-ficha-a-quien" />
              <Dato rotulo="Nombre comercial" valor={campos.nombreComercial} testID="perfil-negocio-ficha-nombre-comercial" />
              <Dato rotulo="Horario de atención" valor={campos.horarioAtencion} testID="perfil-negocio-ficha-horario" />
              <Dato rotulo="Teléfono" valor={campos.telefono} testID="perfil-negocio-ficha-telefono" />
              <Dato rotulo="Mail" valor={campos.email} testID="perfil-negocio-ficha-email" />
            </GrupoFilas>
          </View>

          {mensajes}

          {/* K-15 / BL-X7: el editor de tono vive en «Cómo hablarle» (PantallaTono) y el modo en su propia
              vista; acá, una fila por cada uno con su estado. ENMIENDAS FUNDADAS que siguen valiendo:
              «A quién le vendés» es un select de 3 valores porque el backend lo guarda como enum, y la
              validación de largo mínimo del prototipo NO se porta (el backend no la exige). */}
          <GrupoFilas rotulo="Cómo trabaja Odobi">
            <FilaGrupo primera testID="perfil-negocio-modo-fila" onPress={() => setVerModo(true)} accessibilityLabel="Antes de guardar">
              <View style={styles.dato}>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Antes de guardar</Text>
                <Text testID="perfil-negocio-estado-modo" style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 22 }}>
                  {automatico ? 'Anota solo y te avisa después' : 'Te muestra una tarjeta para revisar'}
                </Text>
              </View>
              <Chevron />
            </FilaGrupo>
            <FilaGrupo testID="perfil-negocio-tono-fila" onPress={() => setVerTono(true)} accessibilityLabel="Tono y forma">
              <View style={styles.dato}>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Cómo te habla</Text>
                <Text testID="perfil-negocio-tono-resumen" style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 22 }}>
                  {resumenDeTono(campos)}
                </Text>
              </View>
              <Chevron />
            </FilaGrupo>
          </GrupoFilas>

          {/* «Lo que vendo» es una TERCERA sección de esta misma pantalla, con su propio ciclo de
              guardado: no comparte el botón de las otras dos porque no comparte el endpoint —cada
              concepto se guarda solo, apenas se agrega—. Va acá y no en su propio destino porque es
              parte de describir el negocio, que es exactamente lo que esta pantalla hace. */}
          <SeccionCatalogo testID="perfil-negocio-catalogo" />

          {/* Los datos fiscales viven en otra pantalla a propósito — decirlo evita que el
              emprendedor los busque acá y concluya que faltan. */}
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            Tu CUIT, razón social y condición de IVA se cargan en Ajustes → Facturación ARCA.
          </Text>
          </>
          )}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 4 },
  dato: { flex: 1, minWidth: 0, gap: 2 },
  burbuja: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  tarjetaEjemplo: { borderRadius: 22, padding: 16, gap: 4 },
});
