import {
  ApiError,
  completarOnboarding,
  faltantesDelPerfilMinimo,
  guardarPerfilNegocio,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  leerPerfilNegocio,
  listarCatalogo,
  pedirLinkDeVinculacion,
  permisosDelHilo,
  type CampoPerfilMinimo,
  type PermisoDelHilo,
} from '@copiloto/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { LOGOS_MARCA, LOGOS_PROVEEDOR, type LogoMarca } from '../apps/logosMarca';
import { ALTO_BOTON_ENTRADA } from '../auth/BotonProveedor';
import { CampoTexto, ScrollFormulario } from '../../theme/glass/campos';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * 🔴 **Configuración inicial de Odobi — rediseño de Martin, 13/11/2026.**
 *
 * Hasta acá el onboarding era «una conversación en el hilo» (burbujas + tarjeta de vidrio, K-14 / BL-X8).
 * Martin lo redefinió, y el diseño lo define él: **no es un chat, es la configuración de la app**, y
 * tiene que leerse como tal. Se conserva la voz (Odobi habla en primera persona) y las reglas que eran
 * buenas (el alcance se dice antes de pedir, nada bloquea, el backend manda sobre el perfil mínimo).
 *
 * **Dos pantallas, en este orden: Conectar → Perfil.** Después entra a la app, donde lo recibe el
 * tutorial del primer ingreso (`shell/TutorialPrimerIngreso.tsx`).
 * 1. **Conectar** — los dos permisos (Mercado Pago, Google). Ninguno es obligatorio.
 * 2. **Perfil** — `queVende` y `nombreComercial`, el mínimo que exige el backend (SM-C3). Se saltea si
 *    ya están cargados. Antes aparecía sólo como reacción al 409; ahora va en el recorrido.
 *
 * Hubo una tercera pantalla, «Guía» (mapa de la app + muestra de pedidos), y Martin la cambió el mismo
 * 13/11 por el tutorial: en vez de explicar la app antes de entrar, se la recorre adentro.
 *
 * **Se fue el «recibo» con la cifra** («Tenés $X facturados sin cobrar»). Esa cifra sale de las facturas
 * emitidas EN Odobi (`CobroStore.impagos()`), no de Mercado Pago ni de Google: una cuenta nueva nunca la
 * tiene, así que la promesa «te digo algo que no sabés» no se podía cumplir en el primer ingreso.
 *
 * `completarOnboarding` se llama UNA vez, al salir del último paso. Si el backend igual rechaza por
 * perfil incompleto (409), se vuelve al paso del perfil nombrando lo que falta — nunca se cierra dejando
 * a la persona frente a un shell al que el server no la deja entrar.
 *
 * Diverge a propósito de `apps/copiloto-web/src/modules/onboarding/Onboarding.tsx`, que sigue en chat.
 *
 * Se monta desde `apps/mobile/app/_layout.tsx` dentro de `estado === 'autenticado' &&
 * debeMostrarOnboarding(me)`. El OAuth sale de la app con `Linking`: al volver, `AppState` relee el
 * catálogo y el estado que se pinta es el que el backend confirma.
 */

/** Dos permisos ante el usuario, no seis servicios: el alcance se dice ANTES de pedir. */
const FILAS: Record<PermisoDelHilo['id'], { titulo: string; detalle: string; boton: string }> = {
  mercadopago: { titulo: 'Cobrar', detalle: 'Con Mercado Pago. Creo links de cobro y anoto lo que entra.', boton: 'Conectar Mercado Pago' },
  google: {
    titulo: 'Mail, agenda y archivos',
    detalle: 'Con Google. Mando presupuestos, agendo y guardo documentos.',
    boton: 'Conectar Google',
  },
};

/** El logo de cada permiso: el del servicio que se va a abrir, para que se reconozca antes de tocar. */
const LOGO_PERMISO: Record<PermisoDelHilo['id'], LogoMarca> = {
  mercadopago: LOGOS_MARCA.mercadopago,
  google: LOGOS_PROVEEDOR.google,
};

/**
 * Ritmo vertical (Martin 13/11: «más espaciado entre jerarquías»). El espacio dice qué va con qué: poco
 * entre lo que es una misma idea, mucho entre bloques. El rótulo NO se pega al título — son dos niveles
 * distintos (uno nombra la pantalla, el otro habla) y necesitan aire entre sí.
 */
const ESPACIO = {
  rotuloATitulo: 28,
  tituloABajada: 20,
  bloque: 48,
  etiquetaALista: 14,
  entreFilas: 12,
  listaANota: 20,
} as const;

type Paso = 'conectar' | 'perfil';

/** Cómo se nombra cada campo del perfil mínimo ante la persona (las etiquetas de Ajustes → Mi negocio). */
const ETIQUETA_CAMPO: Record<CampoPerfilMinimo, string> = {
  queVende: 'qué vendés',
  nombreComercial: 'el nombre comercial',
};

const nombrarFaltantes = (campos: readonly CampoPerfilMinimo[]): string =>
  campos.map((c) => ETIQUETA_CAMPO[c]).join(' y ');

export interface PantallaOnboardingProps {
  /** La configuración terminó. Quien lo monta lo retira (y la app recibe con el tutorial). */
  onTerminar: () => void;
}

export function PantallaOnboarding(props: PantallaOnboardingProps) {
  if (!VISTA_PREVIA_DISENO) return <Recorrido {...props} />;
  return <ConVistaPrevia {...props} />;
}

/**
 * ⚠️ VISTA PREVIA DE DISEÑO — SÓLO EN DESARROLLO, SACAR ANTES DEL PR (junto con `REVISAR_ONBOARDING` en
 * `app/_layout.tsx`). Una barra arriba para saltar entre las dos pantallas sin recorrerlas en orden,
 * porque Martin revisa el diseño en el teléfono. Nunca corre en tests ni en producción.
 * Ojo: en «Perfil», guardar escribe de verdad en la cuenta con la que se entró.
 */
const VISTA_PREVIA_DISENO = __DEV__ && process.env.NODE_ENV !== 'test';
const VISTAS: readonly { id: Paso; etiqueta: string }[] = [
  { id: 'conectar', etiqueta: 'Conectar' },
  { id: 'perfil', etiqueta: 'Perfil' },
];

function ConVistaPrevia(props: PantallaOnboardingProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Paso>('conectar');
  return (
    <View style={styles.raiz}>
      <Recorrido key={vista} {...props} pasoInicial={vista} />
      <View style={[styles.barraPrevia, { top: insets.top + 4 }]}>
        {VISTAS.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => setVista(v.id)}
            hitSlop={6}
            style={{ backgroundColor: vista === v.id ? tema.color.bloque : tema.color.superficie, borderRadius: tema.radio.completo, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text style={{ color: vista === v.id ? tema.color.bloqueTexto : tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: 12 }}>{v.etiqueta}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** El recorrido real: decide qué pantalla toca y cierra la configuración al final. */
function Recorrido({ onTerminar, pasoInicial = 'conectar' }: PantallaOnboardingProps & { pasoInicial?: Paso }) {
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  /** Lo que el backend dijo que falta al intentar entrar (409): se le muestra al perfil al volver. */
  const [rechazo, setRechazo] = useState<readonly CampoPerfilMinimo[] | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const entrar = useCallback(async () => {
    const res = await completarOnboarding();
    if (!vivo.current) return;
    // 409 `perfil_minimo_incompleto` (SM-C3): NO se cierra — se va (o se vuelve) al perfil nombrando lo que falta.
    if (!res.ok && res.perfilIncompleto) {
      setRechazo(res.faltantes);
      setPaso('perfil');
      return;
    }
    // Cualquier otro fallo (red, 500): se cierra igual y se reintenta al próximo arranque, como antes.
    onTerminar();
  }, [onTerminar]);

  // De «Conectar» se pasa al perfil sólo si falta algo; si ya está completo, entra. No poder leerlo NO es
  // «está completo» (fail-closed, mismo criterio que `faltantesDelPerfilMinimo`): ante la duda se pide.
  const salirDeConectar = useCallback(async () => {
    let completo = false;
    try {
      const res = await leerPerfilNegocio();
      completo = res.status === 'ok' && res.perfil != null && faltantesDelPerfilMinimo(res.perfil).length === 0;
    } catch {
      completo = false;
    }
    if (!vivo.current) return;
    if (completo) await entrar();
    else setPaso('perfil');
  }, [entrar]);

  if (paso === 'perfil') return <PasoPerfil key={rechazo == null ? 'limpio' : rechazo.join()} rechazo={rechazo} onListo={entrar} />;
  return <PasoConectar onSeguir={() => void salirDeConectar()} />;
}

/**
 * Encabezado de las pantallas: primero qué es la pantalla (rótulo), después la voz de Odobi (título)
 * y una bajada con lo que hace falta saber en ESTE paso. El rótulo nombra; el título habla.
 */
function Encabezado({ titulo, bajada, lineasTitulo = 3 }: { titulo: string; bajada: string; lineasTitulo?: number }) {
  const tema = useTema();
  return (
    <View>
      <Text testID="onboarding-rotulo" style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiMedium, fontSize: 15, lineHeight: 20 }}>
        Configuración inicial
      </Text>
      <Text
        testID="onboarding-titulo"
        accessibilityRole="header"
        numberOfLines={lineasTitulo}
        adjustsFontSizeToFit
        minimumFontScale={0.88}
        style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 35, lineHeight: 40, letterSpacing: -1, marginTop: ESPACIO.rotuloATitulo }}
      >
        {titulo}
      </Text>
      <Text
        testID="onboarding-bajada"
        style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: 17, lineHeight: 25, marginTop: ESPACIO.tituloABajada }}
      >
        {bajada}
      </Text>
    </View>
  );
}

/** Rótulo chico que abre un bloque («Dos permisos», «Al entrar vas a ver»). */
function EtiquetaBloque({ children }: { children: string }) {
  const tema = useTema();
  return (
    <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico, lineHeight: 18, marginTop: ESPACIO.bloque, marginBottom: ESPACIO.etiquetaALista }}>
      {children}
    </Text>
  );
}

/** El botón del pie, al alcance del pulgar como en la portada y el registro. `fuerte` = acción principal. */
function BotonPie({ etiqueta, onPress, fuerte, deshabilitado = false, testID }: { etiqueta: string; onPress: () => void; fuerte: boolean; deshabilitado?: boolean; testID: string }) {
  const tema = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={pressableStyle([
        styles.salida,
        { borderRadius: tema.radio.completo, height: ALTO_BOTON_ENTRADA, opacity: deshabilitado ? 0.6 : 1 },
        fuerte
          ? { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie }
          : { backgroundColor: 'transparent', borderColor: tema.color.borde },
      ])}
    >
      <Text style={{ color: fuerte ? tema.color.acentoTexto : tema.color.texto, fontFamily: tema.fuente.display, fontSize: 17, letterSpacing: -0.2 }}>{etiqueta}</Text>
    </Pressable>
  );
}

/** Marco común: contenido que scrollea + pie fijo. */
function Marco({ testID, children, pie }: { testID: string; children: React.ReactNode; pie: React.ReactNode }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.raiz, { backgroundColor: tema.color.fondo }]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + ESPACIO.bloque, paddingHorizontal: tema.espacio.lg, paddingBottom: tema.espacio.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: tema.espacio.lg, paddingBottom: insets.bottom + tema.espacio.md, paddingTop: tema.espacio.sm }}>{pie}</View>
    </View>
  );
}

/* ───────────────────────────── 1 · Conectar ───────────────────────────── */

function PasoConectar({ onSeguir }: { onSeguir: () => void }) {
  const tema = useTema();
  const [permisos, setPermisos] = useState<readonly PermisoDelHilo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<PermisoDelHilo['id'] | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarCatalogo = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current || res.status === 'no_disponible') return;
      setPermisos(permisosDelHilo(res.servicios));
    } catch {
      /* fail-soft: sin catálogo la pantalla igual se ve y «Después» sigue disponible */
    }
  }, []);

  useEffect(() => {
    void cargarCatalogo();
    // El navegador es otra APP: al volver del OAuth cambia el AppState, no el foco de navegación.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void cargarCatalogo();
    });
    return () => sub.remove();
  }, [cargarCatalogo]);

  async function conectar(permiso: PermisoDelHilo) {
    if (permiso.servicio == null) return;
    setError(null);
    setPidiendo(permiso.id);
    try {
      const res = await pedirLinkDeVinculacion(permiso.servicio.connectPath);
      if (!vivo.current) return;
      if (res.status === 'no_disponible') {
        setError(`Conectar ${NOMBRE_SERVICIO[permiso.id]} todavía no está disponible.`);
        return;
      }
      if (!(await Linking.canOpenURL(res.url))) {
        if (vivo.current) setError('No pudimos abrir el navegador en este teléfono.');
        return;
      }
      await Linking.openURL(res.url);
    } catch {
      if (vivo.current) setError(`No pudimos pedir el link de ${NOMBRE_SERVICIO[permiso.id]}. Probá de nuevo.`);
    } finally {
      if (vivo.current) setPidiendo(null);
    }
  }

  const algunoConectado = (permisos ?? []).some((p) => p.conectado);

  return (
    <Marco
      testID="onboarding"
      pie={
        // Con algo ya conectado deja de ser «Después»: es seguir, y pesa como acción principal.
        <BotonPie testID="onboarding-despues" etiqueta={algunoConectado ? 'Seguir' : 'Después'} fuerte={algunoConectado} onPress={onSeguir} />
      }
    >
      <Encabezado
        titulo={'Conectá tus cuentas.\nDel resto\nme ocupo yo.'}
        bajada="Podés conectar uno, los dos o ninguno. Lo que falte lo sumás después."
      />

      <EtiquetaBloque>Dos permisos</EtiquetaBloque>

      <View testID="onboarding-permisos">
        <View testID="onboarding-tarjeta-servicios" style={{ gap: ESPACIO.entreFilas }}>
          {(permisos ?? []).map((p) => {
            const fila = FILAS[p.id];
            const pedible = !p.conectado && p.servicio != null;
            const logo = LOGO_PERMISO[p.id];
            const cuerpo = (
              <>
                <View style={[styles.logo, { backgroundColor: tema.color.fondo, borderRadius: tema.radio.sm }]}>
                  <SvgXml xml={logo.xml} width={Math.round(24 * Math.min(logo.proporcion, 1.3))} height={24} />
                </View>
                <View style={styles.textos}>
                  <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 18, lineHeight: 23, letterSpacing: -0.2 }}>{fila.titulo}</Text>
                  <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: 15, lineHeight: 21 }}>{fila.detalle}</Text>
                </View>
                {p.conectado ? (
                  <Text testID={`onboarding-conectado-${p.id}`} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: 15 }}>
                    Conectado ✓
                  </Text>
                ) : pedible ? (
                  <View style={[styles.pildora, { backgroundColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo }]}>
                    <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiMedium, fontSize: 15 }}>{pidiendo === p.id ? 'Abriendo…' : 'Conectar'}</Text>
                  </View>
                ) : null}
              </>
            );
            const estiloFila = [styles.fila, { backgroundColor: tema.color.superficie, borderRadius: tema.radio.md, padding: tema.espacio.md }];
            return (
              <View key={p.id} testID={`onboarding-permiso-${p.id}`}>
                {pedible ? (
                  <Pressable
                    testID={`onboarding-conectar-${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={fila.boton}
                    disabled={pidiendo != null}
                    onPress={() => void conectar(p)}
                    style={pressableStyle(estiloFila)}
                  >
                    {cuerpo}
                  </Pressable>
                ) : (
                  <View style={estiloFila}>{cuerpo}</View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <Text testID="onboarding-alcance" style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico, lineHeight: 19, marginTop: ESPACIO.listaANota }}>
        Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Ajustes.
      </Text>
      {error != null && (
        <Text accessibilityRole="alert" testID="onboarding-error" style={{ color: tema.color.peligro, fontSize: 15, lineHeight: 21, marginTop: tema.espacio.sm }}>
          {error}
        </Text>
      )}
    </Marco>
  );
}

/** Cómo se nombra cada servicio en los mensajes de error. */
const NOMBRE_SERVICIO: Record<PermisoDelHilo['id'], string> = { mercadopago: 'Mercado Pago', google: 'Google' };

/* ───────────────────────────── 2 · Perfil ───────────────────────────── */

/**
 * Rubros sugeridos para «Qué vendés». Lista de Martin/propuesta 13/11, pensada para el público de Odobi
 * (oficios y comercio o taller local). Son ATAJOS de escritura, no categorías: el backend no clasifica por
 * rubro, sólo recibe el texto. Agregar o sacar uno no rompe nada. No hay «Otro»: para eso está el campo.
 */
const RUBROS = [
  'Electricidad',
  'Plomería y gas',
  'Carpintería',
  'Albañilería y reformas',
  'Pintura',
  'Herrería',
  'Mecánica',
  'Peluquería y estética',
  'Repostería y comidas',
  'Veterinaria',
  'Fletes y mudanzas',
  'Comercio',
] as const;

/**
 * El perfil mínimo (SM-C3): `queVende` y `nombreComercial`, y no deja avanzar sin los dos. La regla sale
 * de `faltantesDelPerfilMinimo` de core (UNA definición para las dos apps; vacío o sólo espacios cuenta
 * como vacío igual que el backend). Guarda el perfil y, si salió bien, `onListo` cierra la configuración.
 * Si el backend rechazó al intentar entrar, llega `rechazo` y se nombra lo que falta.
 */
function PasoPerfil({ rechazo, onListo }: { rechazo: readonly CampoPerfilMinimo[] | null; onListo: () => Promise<void> }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [campos, setCampos] = useState({ queVende: '', nombreComercial: '' });
  // vacío al abrir: el error aparece al intentar avanzar (SM-K8) — salvo que el backend ya haya rechazado
  const [rechazados, setRechazados] = useState<readonly CampoPerfilMinimo[]>(rechazo ?? []);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(rechazo != null && rechazo.length > 0 ? `Todavía falta ${nombrarFaltantes(rechazo)}.` : null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  // Pre-llena con lo que ya hay (alguien que cargó uno de los dos antes). Fail-soft: sin perfil, vacío.
  // Nunca pisa lo que la persona ya empezó a escribir.
  useEffect(() => {
    leerPerfilNegocio()
      .then((res) => {
        if (!vivo.current || res.status !== 'ok' || res.perfil == null) return;
        const { queVende, nombreComercial } = res.perfil;
        setCampos((c) => ({
          queVende: c.queVende === '' ? queVende : c.queVende,
          nombreComercial: c.nombreComercial === '' ? nombreComercial : c.nombreComercial,
        }));
      })
      .catch(() => {});
  }, []);

  const vacios = faltantesDelPerfilMinimo(campos);
  /** El rubro queda marcado mientras el texto empiece con él: sumarle detalle no lo desmarca. */
  const rubroElegido = RUBROS.find((r) => campos.queVende.trim().startsWith(r)) ?? null;
  const estiloEtiqueta = { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 };
  const errorDe = (campo: CampoPerfilMinimo) =>
    rechazados.includes(campo) && vacios.includes(campo) ? `Falta ${ETIQUETA_CAMPO[campo]}` : undefined;

  async function guardar() {
    if (vacios.length > 0) {
      setRechazados(vacios);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const g = await guardarPerfilNegocio({
        queVende: campos.queVende.trim(),
        nombreComercial: campos.nombreComercial.trim(),
      });
      if (!vivo.current) return;
      if (g.status !== 'ok') {
        setError('Guardar tu negocio todavía no está disponible. Probá de nuevo en un rato.');
        return;
      }
      await onListo();
    } catch (e) {
      if (vivo.current) {
        setError(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar tu negocio. Probá de nuevo.');
      }
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  return (
    <ScrollFormulario
      testID="onboarding-perfil"
      style={{ backgroundColor: tema.color.fondo }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + ESPACIO.bloque,
        paddingHorizontal: tema.espacio.lg,
        paddingBottom: insets.bottom + tema.espacio.md,
      }}
    >
      <Encabezado titulo={'Contame\nde tu negocio.'} bajada="Son dos datos. Los cambiás cuando quieras, desde Ajustes." lineasTitulo={2} />

      <View style={{ marginTop: ESPACIO.bloque, gap: ESPACIO.etiquetaALista }}>
        <Text style={estiloEtiqueta}>Qué vendés</Text>
        {/* Rubros sugeridos + texto libre (Martin 13/11). El dato viaja como texto al system prompt
            («A qué se dedica: …»): un desplegable cerrado le quitaría detalle a Odobi y siempre le
            faltaría un oficio. Tocar un rubro COMPLETA el campo; el campo sigue siendo editable. */}
        <View testID="onboarding-perfil-rubros" style={styles.solapas}>
          {RUBROS.map((r) => {
            const activo = r === rubroElegido;
            return (
              <Pressable
                key={r}
                testID={`onboarding-perfil-rubro-${r}`}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                onPress={() => setCampos((c) => ({ ...c, queVende: r }))}
                style={pressableStyle([styles.rubro, { borderRadius: tema.radio.completo, backgroundColor: activo ? tema.color.bloque : tema.color.superficie }])}
              >
                <Text style={{ color: activo ? tema.color.bloqueTexto : tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: 15 }}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
        <CampoTexto
          testID="onboarding-perfil-que-vende"
          etiqueta="Qué vendés"
          etiquetaOculta
          valor={campos.queVende}
          onChange={(v) => setCampos((c) => ({ ...c, queVende: v }))}
          placeholder="O contalo con tus palabras"
          multiline
          maxLength={LIMITE_QUE_VENDE}
          error={errorDe('queVende')}
        />
        {rubroElegido != null && (
          <Text testID="onboarding-perfil-rubro-ayuda" style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico, lineHeight: 19 }}>
            Si querés, sumale detalle: qué hacés y para quién. Me ayuda a entenderte mejor.
          </Text>
        )}
      </View>

      <View style={{ marginTop: tema.espacio.xl, gap: ESPACIO.etiquetaALista }}>
        <Text style={estiloEtiqueta}>Nombre comercial</Text>
        <CampoTexto
          testID="onboarding-perfil-nombre-comercial"
          etiqueta="Nombre comercial"
          etiquetaOculta
          valor={campos.nombreComercial}
          onChange={(v) => setCampos((c) => ({ ...c, nombreComercial: v }))}
          placeholder="Con el que te conocen"
          maxLength={LIMITE_CAMPO_CORTO}
          error={errorDe('nombreComercial')}
        />
        {error != null && (
          <Text accessibilityRole="alert" testID="onboarding-perfil-error" style={{ color: tema.color.peligro, fontSize: 15, lineHeight: 21 }}>
            {error}
          </Text>
        )}
      </View>

      <View style={styles.empujaAbajo} />
      <View style={{ marginTop: ESPACIO.bloque }}>
        <BotonPie testID="onboarding-perfil-guardar" etiqueta={enviando ? 'Guardando…' : 'Guardar y entrar'} fuerte deshabilitado={enviando} onPress={() => void guardar()} />
      </View>
    </ScrollFormulario>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  barraPrevia: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  pildora: { height: 36, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  salida: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  empujaAbajo: { flexGrow: 1 },
  solapas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rubro: { height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
