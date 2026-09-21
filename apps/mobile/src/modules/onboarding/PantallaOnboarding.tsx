import {
  completarOnboarding,
  leerPortada,
  listarCatalogo,
  pedirLinkDeVinculacion,
  permisosCompletos,
  permisosDelHilo,
  primerInsight,
  textoDelInsight,
  type PermisoDelHilo,
  type PrimerInsight,
} from '@copiloto/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/** Dos permisos ante el usuario, no seis servicios: el alcance se dice ANTES de pedir. */
const FILAS: Record<PermisoDelHilo['id'], { titulo: string; detalle: string; boton: string }> = {
  mercadopago: { titulo: 'Cobrar', detalle: 'Mercado Pago', boton: 'Conectar Mercado Pago' },
  google: { titulo: 'Mail, agenda y archivos', detalle: 'Google', boton: 'Conectar Google' },
};

const TITULO = 28;

type Paso = 'promesa' | 'recibo';

export interface PantallaOnboardingProps {
  /** El hilo terminó (por «Entrar» o por «Después»). Quien lo monta lo retira. */
  onTerminar: () => void;
}

/**
 * Onboarding de dos permisos y primer insight (K-14 / BL-X8) — paridad con
 * `apps/copiloto-web/src/modules/onboarding/Onboarding.tsx`; la decisión de QUÉ mostrar vive en el core
 * (`permisosDelHilo`, `primerInsight`, `textoDelInsight`), acá sólo se dibuja.
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
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarCatalogo = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current || res.status === 'no_disponible') return;
      const p = permisosDelHilo(res.servicios);
      setPermisos(p);
      if (permisosCompletos(p)) setPaso('recibo'); // ya están los dos: no se pide nada más
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
    await completarOnboarding(); // false = no se pudo marcar: se cierra igual y se reintenta al próximo arranque
    if (vivo.current) onTerminar();
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
    { backgroundColor: tema.color.fondo, paddingTop: insets.top + tema.espacio.lg, paddingBottom: insets.bottom + tema.espacio.lg, paddingHorizontal: tema.espacio.lg, gap: tema.espacio.md },
  ];

  if (paso === 'recibo') return <Recibo estiloContenedor={contenedor} onEntrar={() => void terminar()} />;

  return (
    <View testID="onboarding" style={contenedor}>
      <Text accessibilityRole="header" style={{ color: tema.color.texto, fontSize: TITULO, fontWeight: '700' }}>
        ¿Conectamos tus servicios?
      </Text>
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>Son dos minutos y te digo algo que no sabés.</Text>
      <View testID="onboarding-permisos" style={{ gap: tema.espacio.sm }}>
        {(permisos ?? []).map((p) => (
          <View key={p.id} testID={`onboarding-permiso-${p.id}`} style={{ gap: tema.espacio.xs }}>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}>{FILAS[p.id].titulo}</Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>{FILAS[p.id].detalle}</Text>
            {p.conectado ? (
              <Text testID={`onboarding-conectado-${p.id}`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                Conectado ✓
              </Text>
            ) : (
              p.servicio != null && (
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
              )
            )}
          </View>
        ))}
      </View>
      <Text testID="onboarding-alcance" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
        Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Cuenta.
      </Text>
      {error != null && (
        <Text accessibilityRole="alert" testID="onboarding-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}
      <FilaBotones testID="onboarding-salida" botones={[{ etiqueta: 'Después', onPress: () => void terminar(), testID: 'onboarding-despues' }]} />
    </View>
  );
}

function Recibo({ estiloContenedor, onEntrar }: { estiloContenedor: object[]; onEntrar: () => void }) {
  const tema = useTema();
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

  return (
    <View testID="onboarding-recibo" style={estiloContenedor}>
      <Text accessibilityRole="header" style={{ color: tema.color.texto, fontSize: TITULO, fontWeight: '700' }}>
        Listo, ya veo tu negocio.
      </Text>
      {insight === 'cargando' ? (
        <ActivityIndicator testID="onboarding-cargando" color={tema.color.texto} />
      ) : (
        <Text testID="onboarding-insight" style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
          {textoDelInsight(insight)}
        </Text>
      )}
      <FilaBotones
        testID="onboarding-entrar-botones"
        botones={[{ etiqueta: 'Entrar', onPress: onEntrar, variante: 'primario', deshabilitado: insight === 'cargando', testID: 'onboarding-entrar' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center' },
});
