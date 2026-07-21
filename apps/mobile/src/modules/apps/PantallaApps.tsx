import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import type { NombreIconoGlass } from '../../theme/glass/icons';

/**
 * `PantallaApps` — las integraciones del copiloto.
 *
 * 🔴 Trae su propio `MarcoGlass` (2026-07-21, convergencia con documed): antes se montaba dentro de
 * `CapaFuncion`, la capa `absoluteFill` inventada por este repo que en device se comía los toques.
 * `CapaFuncion` se borró; el chrome (vidrio, handle, ícono, título, "Volver") ahora lo aporta
 * `MarcoGlass`, uno por pantalla — mismo mecanismo que `PantallaAjustes`/`PantallaRecientes`. El
 * ícono/título son los MISMOS que el tile de entrada en `EscritorioFunciones` (`apps`→`folder`):
 * entrar por un ícono y llegar a otro desorienta (ver docstring de `MarcoGlass`).
 *
 * La lista sale de los servicios que el backend ya tiene cableados (`apps/copiloto/services/`:
 * gmail, drive, sheets, docs, hubspot, instagram) más los dos boundaries propios (Calendar y
 * MercadoPago). No es una lista de deseos: cada entrada existe del lado del servidor.
 *
 * El **estado de conexión por servicio** se lee del backend recién en F5, cuando haya sesión. Hasta
 * entonces esta pantalla lista qué sabe hacer el copiloto, sin afirmar que estén conectados — decir
 * "conectado" sin haberlo consultado sería exactamente la clase de afirmación sin evidencia que
 * este sprint viene evitando.
 */
interface Integracion {
  nombre: string;
  que: string;
  icono: NombreIconoGlass;
}

const INTEGRACIONES: Integracion[] = [
  { nombre: 'Gmail', que: 'Leer, redactar y responder correo', icono: 'note' },
  { nombre: 'Google Drive', que: 'Buscar y compartir archivos', icono: 'folder' },
  { nombre: 'Google Sheets', que: 'Leer y actualizar planillas', icono: 'chart' },
  { nombre: 'Google Docs', que: 'Crear y editar documentos', icono: 'doc_search' },
  { nombre: 'Google Calendar', que: 'Agendar y consultar eventos', icono: 'clock' },
  { nombre: 'HubSpot', que: 'Contactos y oportunidades del CRM', icono: 'user' },
  { nombre: 'Instagram', que: 'Publicar y leer mensajes', icono: 'media' },
  { nombre: 'MercadoPago', que: 'Cobros, pagos y conciliación', icono: 'chart' },
];

export function PantallaApps() {
  const tema = useTema();

  return (
    // Mismo ícono que el tile de entrada en `EscritorioFunciones` ('folder') — ver docstring de
    // `MarcoGlass`: entrar por un ícono y llegar a otro desorienta.
    <MarcoGlass titulo="Apps" icono="folder" testID="pantalla-apps">
      <ScrollView
        // 🔴 `flex:1` en el ScrollView MISMO, no sólo en su contenedor. Un ScrollView sin flex se
        // mide por su CONTENIDO: aunque el padre esté acotado, el hijo se estira más allá y lo
        // que sobra se recorta (overflow:hidden del vidrio) sin poder desplazarse. Verificado en
        // device: la lista de integraciones quedaba cortada en MercadoPago y el gesto no hacía nada.
        style={styles.scroll}
        testID="apps-lista"
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="apps-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, marginBottom: tema.espacio.sm }}
        >
          Lo que el copiloto puede hacer por vos. Se lo pedís en el chat, en lenguaje natural.
        </Text>

        {INTEGRACIONES.map((i) => (
          <Row key={i.nombre} testID={`app-${i.nombre.toLowerCase().replace(/\s+/g, '-')}`}>
            <View style={[styles.fila, { gap: tema.espacio.sm }]}>
              <GlassIcon name={i.icono} size={24} />
              <View style={styles.textos}>
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                  {i.nombre}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: 2 }}>
                  {i.que}
                </Text>
              </View>
            </View>
          </Row>
        ))}
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenido: { flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  textos: { flexShrink: 1 },
});
