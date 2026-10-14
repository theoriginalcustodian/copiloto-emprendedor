import {
  ApiError,
  completarOnboarding,
  dejarPendiente,
  faltantesDelPerfilMinimo,
  guardarPerfilNegocio,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  leerPerfilNegocio,
  leerPortada,
  listarCatalogo,
  pedirLinkDeVinculacion,
  PEDIDO_DETALLE_POR_COBRAR,
  permisosCompletos,
  permisosDelHilo,
  primerInsight,
  textoDelInsight,
  type CampoPerfilMinimo,
  type PermisoDelHilo,
  type PrimerInsight,
} from '@copiloto/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Burbuja } from '../chat/Burbuja';
import { Recibo } from '../chat/Recibo';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { CampoTexto, FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/** Dos permisos ante el usuario, no seis servicios: el alcance se dice ANTES de pedir. */
const FILAS: Record<PermisoDelHilo['id'], { titulo: string; detalle: string; boton: string }> = {
  mercadopago: { titulo: 'Cobrar', detalle: 'Mercado Pago', boton: 'Conectar Mercado Pago' },
  google: {
    titulo: 'Mail · Agenda · Archivos',
    detalle: 'Google · Gmail, Calendar, Drive, Docs, Sheets',
    boton: 'Conectar Google',
  },
};

/** `perfil` = el paso del perfil mínimo (SM-C3): sólo se entra desde un 409 `perfil_minimo_incompleto`. */
type Paso = 'promesa' | 'recibo' | 'perfil';

/** Cómo se nombra cada campo del perfil mínimo ante la persona (las etiquetas de Ajustes → Mi negocio). */
const ETIQUETA_CAMPO: Record<CampoPerfilMinimo, string> = {
  queVende: 'qué vendés',
  nombreComercial: 'el nombre comercial',
};

const nombrarFaltantes = (campos: readonly CampoPerfilMinimo[]): string =>
  campos.map((c) => ETIQUETA_CAMPO[c]).join(' y ');

export interface PantallaOnboardingProps {
  /** El hilo terminó (por «Entrar» o por «Después»). Quien lo monta lo retira. */
  onTerminar: () => void;
}

/**
 * Onboarding de dos permisos y primer insight (K-14 / BL-X8 resto, contrato `2026-09-22_contrato_
 * planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8.md` fila 3, corrección del ANEXO). «El
 * onboarding es una conversación en el hilo, no una pantalla»: se dibuja con las MISMAS `Burbuja` y el
 * mismo `CristalVidrio nivel="informe"` que usa el gate de confirmación real del chat
 * (`ListaMensajes.tsx` → `TarjetaConfirmacion`), no con el formulario viejo — paridad estructural con
 * `apps/copiloto-web/src/modules/onboarding/Onboarding.tsx` (misma decisión, mismas clases del lado
 * web vía `chat.css`/`.hitl-card`).
 *
 * **Se monta desde `apps/mobile/app/_layout.tsx` (de FRONTEND-1)** dentro de
 * `estado === 'autenticado' && debeMostrarOnboarding(me)`; ver el `dato_` de entrega. Este módulo no
 * toca el layout.
 *
 * El OAuth sale de la app con `Linking` (misma decisión y deuda gestionada que `PantallaApps`): al
 * volver, `AppState` relee el catálogo y el estado que se pinta es el que el backend confirma. «Después»
 * cierra y marca el onboarding como hecho; nunca bloquea.
 */
export function PantallaOnboarding({ onTerminar }: PantallaOnboardingProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [paso, setPaso] = useState<Paso>('promesa');
  const [permisos, setPermisos] = useState<readonly PermisoDelHilo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<PermisoDelHilo['id'] | null>(null);
  const [faltantes, setFaltantes] = useState<readonly CampoPerfilMinimo[]>([]);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarCatalogo = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current || res.status === 'no_disponible') return;
      const p = permisosDelHilo(res.servicios);
      setPermisos(p);
      // ya están los dos: no se pide nada más. Sólo desde la promesa: volver del navegador con el paso del
      // perfil abierto no puede devolver a la persona al recibo (el AppState dispara esta carga).
      if (permisosCompletos(p)) setPaso((actual) => (actual === 'promesa' ? 'recibo' : actual));
    } catch {
      /* fail-soft: sin catálogo la promesa igual se ve y «Después» sigue disponible */
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

  async function terminar() {
    const res = await completarOnboarding();
    if (!vivo.current) return;
    // 409 `perfil_minimo_incompleto` (SM-C3): el hilo NO se cierra — el server no deja entrar al shell
    // sin `queVende` y `nombreComercial`, y el paso se los pide acá, dentro del hilo (no es pantalla nueva).
    if (!res.ok && res.perfilIncompleto) {
      setFaltantes(res.faltantes);
      setPaso('perfil');
      return;
    }
    // Cualquier otro fallo (red, 500): se cierra igual y se reintenta al próximo arranque, como antes.
    onTerminar();
  }

  async function conectar(permiso: PermisoDelHilo) {
    if (permiso.servicio == null) return;
    setError(null);
    setPidiendo(permiso.id);
    try {
      const res = await pedirLinkDeVinculacion(permiso.servicio.connectPath);
      if (!vivo.current) return;
      if (res.status === 'no_disponible') {
        setError(`Conectar ${FILAS[permiso.id].detalle} todavía no está disponible.`);
        return;
      }
      if (!(await Linking.canOpenURL(res.url))) {
        if (vivo.current) setError('No pudimos abrir el navegador en este teléfono.');
        return;
      }
      await Linking.openURL(res.url);
    } catch {
      if (vivo.current) setError(`No pudimos pedir el link de ${FILAS[permiso.id].detalle}. Probá de nuevo.`);
    } finally {
      if (vivo.current) setPidiendo(null);
    }
  }

  const contenedor = [
    styles.pantalla,
    { paddingTop: insets.top + tema.espacio.lg, paddingBottom: insets.bottom + tema.espacio.lg, paddingHorizontal: tema.espacio.lg, gap: tema.espacio.md },
  ];

  if (paso === 'perfil') {
    return <PasoPerfil estiloContenedor={contenedor} faltantesIniciales={faltantes} onTerminar={onTerminar} />;
  }

  if (paso === 'recibo') return <PasoRecibo estiloContenedor={contenedor} onEntrar={() => void terminar()} />;

  return (
    <View testID="onboarding" style={[contenedor, { backgroundColor: tema.color.fondo }]}>
      <Burbuja role="assistant" text="Laburo así: vos me hablás, yo resuelvo. Pero primero necesito ver tu negocio." />
      <Burbuja role="assistant" text="¿Conectamos tus servicios? Son dos minutos y te digo algo que no sabés." />
      <View testID="onboarding-permisos">
        <CristalVidrio nivel="informe" testID="onboarding-tarjeta-servicios">
          <View style={{ padding: tema.espacio.md, gap: tema.espacio.sm }}>
            <View style={styles.encabezado}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '700', flex: 1 }}>Tus servicios</Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base - 2, fontWeight: '700' }}>2 permisos</Text>
            </View>
            {(permisos ?? []).map((p) => (
              <View key={p.id} testID={`onboarding-permiso-${p.id}`} style={{ gap: tema.espacio.xs }}>
                <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}>{FILAS[p.id].titulo}</Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                  {FILAS[p.id].detalle}
                  {p.conectado && (
                    <Text testID={`onboarding-conectado-${p.id}`}> Conectado ✓</Text>
                  )}
                </Text>
                {!p.conectado && p.servicio != null && (
                  <FilaBotones
                    testID={`onboarding-conectar-${p.id}-botones`}
                    botones={[
                      {
                        etiqueta: pidiendo === p.id ? 'Abriendo…' : FILAS[p.id].boton,
                        onPress: () => void conectar(p),
                        variante: 'primario',
                        deshabilitado: pidiendo != null,
                        testID: `onboarding-conectar-${p.id}`,
                      },
                    ]}
                  />
                )}
              </View>
            ))}
            <Text testID="onboarding-alcance" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
              Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Ajustes.
            </Text>
            {error != null && (
              <Text accessibilityRole="alert" testID="onboarding-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
                {error}
              </Text>
            )}
            <FilaBotones testID="onboarding-salida" botones={[{ etiqueta: 'Después', onPress: () => void terminar(), variante: 'secundario', testID: 'onboarding-despues' }]} />
          </View>
        </CristalVidrio>
      </View>
    </View>
  );
}

/**
 * El paso del perfil mínimo (SM-C3 DoD 2-4): `queVende` y `nombreComercial`, y no deja avanzar sin los dos.
 * La regla sale de `faltantesDelPerfilMinimo` de core (UNA definición para las dos apps; vacío o sólo
 * espacios cuenta como vacío igual que el backend). El backend sigue siendo el que manda: si rechaza otra
 * vez, el hilo no se cierra y se nombra lo que falta.
 */
function PasoPerfil({
  estiloContenedor,
  faltantesIniciales,
  onTerminar,
}: {
  estiloContenedor: object[];
  faltantesIniciales: readonly CampoPerfilMinimo[];
  onTerminar: () => void;
}) {
  const tema = useTema();
  const [campos, setCampos] = useState({ queVende: '', nombreComercial: '' });
  const [rechazados, setRechazados] = useState<readonly CampoPerfilMinimo[]>(faltantesIniciales);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const res = await completarOnboarding();
      if (!vivo.current) return;
      if (!res.ok && res.perfilIncompleto) {
        setRechazados(res.faltantes);
        setError(`Todavía falta ${nombrarFaltantes(res.faltantes)}.`);
        return;
      }
      onTerminar();
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
      contentContainerStyle={[...estiloContenedor, { flexGrow: 1 }]}
    >
      <Burbuja role="assistant" text="Antes de entrar, contame de tu negocio: qué vendés y cómo se llama." />
      <CampoTexto
        testID="onboarding-perfil-que-vende"
        etiqueta="Qué vendés"
        valor={campos.queVende}
        onChange={(v) => setCampos((c) => ({ ...c, queVende: v }))}
        placeholder="Contá qué hacés"
        multiline
        maxLength={LIMITE_QUE_VENDE}
        error={errorDe('queVende')}
      />
      <CampoTexto
        testID="onboarding-perfil-nombre-comercial"
        etiqueta="Nombre comercial"
        valor={campos.nombreComercial}
        onChange={(v) => setCampos((c) => ({ ...c, nombreComercial: v }))}
        placeholder="Con el que te conocen"
        maxLength={LIMITE_CAMPO_CORTO}
        error={errorDe('nombreComercial')}
      />
      {error != null && (
        <Text accessibilityRole="alert" testID="onboarding-perfil-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}
      <FilaBotones
        testID="onboarding-perfil-guardar-botones"
        botones={[
          {
            etiqueta: enviando ? 'Guardando…' : 'Guardar y entrar',
            onPress: () => void guardar(),
            variante: 'primario',
            deshabilitado: enviando,
            testID: 'onboarding-perfil-guardar',
          },
        ]}
      />
    </ScrollFormulario>
  );
}

function PasoRecibo({ estiloContenedor, onEntrar }: { estiloContenedor: object[]; onEntrar: () => void }) {
  const tema = useTema();
  // «Armame el detalle» ENTRA al hilo con el pedido ya dicho (fila `onb-cumplida`, #5): lo deja en el
  // buzón de `mensajePendiente` y el chat principal lo manda al tomar foco, una sola vez.
  const pedirDetalle = useCallback(() => {
    dejarPendiente(PEDIDO_DETALLE_POR_COBRAR);
    onEntrar();
  }, [onEntrar]);
  const [insight, setInsight] = useState<PrimerInsight | 'cargando'>('cargando');
  useEffect(() => {
    let vivo = true;
    leerPortada()
      .then((res) => {
        if (vivo) setInsight(res.status === 'no_disponible' ? { tipo: 'sin_dato' } : primerInsight(res.portada));
      })
      .catch(() => {
        if (vivo) setInsight({ tipo: 'sin_dato' });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const listo = insight !== 'cargando';
  const pregunta = listo && insight.tipo === 'dato';

  return (
    <View testID="onboarding-recibo" style={[estiloContenedor, { backgroundColor: tema.color.fondo }]}>
      {/* El `REC('Servicios conectados','Mercado Pago · Google','')` del prototipo: el MISMO `Recibo` del
          chat (título + `detalle` = su `t2`), no una píldora de texto propia (fila `onb-cumplida`, #2). */}
      <Recibo testID="onboarding-recibo-servicios" tono="exito" titulo="Servicios conectados" detalle={['Mercado Pago · Google']} />
      <Burbuja role="assistant" text="Listo, ya veo tu negocio." />
      <View testID="onboarding-insight">
        {listo ? (
          <Burbuja role="assistant" text={textoDelInsight(insight)} />
        ) : (
          <ActivityIndicator testID="onboarding-cargando" color={tema.color.texto} />
        )}
      </View>
      {pregunta && (
        <>
          <Burbuja role="assistant" text="¿Querés que te arme el detalle de quiénes son?" />
          <FilaBotones
            testID="onboarding-chip-detalle"
            botones={[{ etiqueta: 'Armame el detalle', onPress: pedirDetalle, variante: 'secundario', testID: 'onboarding-chip-detalle-boton' }]}
          />
        </>
      )}
      <FilaBotones
        testID="onboarding-entrar-botones"
        botones={[{ etiqueta: 'Entrar', onPress: onEntrar, variante: 'primario', deshabilitado: !listo, testID: 'onboarding-entrar' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center' },
  encabezado: { flexDirection: 'row', alignItems: 'center' },
});
