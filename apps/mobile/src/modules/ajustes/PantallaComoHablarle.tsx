import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { leerCapacidades, type GuiaCapacidades } from '@copiloto/core';

import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaComoHablarle` — **la guía de uso**: qué se le puede pedir al copiloto, con frases que
 * funcionan.
 *
 * 🔴 **Los ejemplos NO están escritos acá, y ésa es toda la idea.** Vienen de `GET /capacidades`, que
 * publica una capacidad **sólo si su tool está viva**. La versión escrita a mano de esta pantalla ya
 * había nacido con el bug: el contrato traía *«facturale 80 mil a la panadería»* entre los ejemplos y
 * `emitir_factura` **no existe** (`grep` → cero). Una guía con las frases adentro es el mismo objeto
 * que el catálogo de papel de Apps — lo vivo cambia por su cuenta, cada lado verifica su mitad y la
 * junta no es de nadie. [[verificar-que-el-camino-recomendado-existe]]
 *
 * Con esto, el DoD del contrato —*«los ejemplos coinciden con lo que existe»*— es cierto **por
 * construcción** en vez de algo que alguien tiene que acordarse de revisar. Verificar a mano funciona
 * una vez.
 *
 * 🔴 **Si la guía no está disponible, se dice — no se inventa una lista.** Un respaldo hardcodeado
 * sería reintroducir el mismo bug una capa más abajo, y encima invisible: se vería igual de bien
 * mientras enseña a decir cosas que fallan. **Prometer de menos es gratis** (si el emprendedor dice
 * algo que anda y no estaba en la lista, gana); prometer de más quema la confianza en todo lo demás.
 *
 * 🔵 **El tono: no es una lista de comandos.** El copiloto entiende lenguaje natural, así que la
 * pantalla muestra EJEMPLOS y lo dice explícitamente — si alguien lee esto como una sintaxis que hay
 * que memorizar, la guía habría empeorado el producto que viene a explicar.
 */

type Estado = 'cargando' | 'ok' | 'no_disponible';

export function PantallaComoHablarle() {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [guia, setGuia] = useState<GuiaCapacidades | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerCapacidades();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setGuia(res.guia);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  // `capacidades` vacío NO es lo mismo que `no_disponible`: el endpoint contestó y dice que hoy no
  // hay ninguna tool viva. Es rarísimo, pero mostrarlo como «no disponible» ocultaría una poda
  // demasiado agresiva justo cuando hay que verla.
  const sinCapacidades = estado === 'ok' && (guia?.capacidades.length ?? 0) === 0;

  return (
    <MarcoGlass titulo="Cómo hablarle" icono="mic" testID="pantalla-como-hablarle">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="como-hablarle-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="como-hablarle-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            No pudimos traer la guía ahora. Igual podés escribirle a tu copiloto como le hablarías a
            alguien que te ayuda.
          </Text>
        </View>
      )}

      {estado === 'ok' && guia != null && (
        <ScrollFormulario
          testID="como-hablarle-lista"
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
        >
          {/* 🔴 El encabezado desactiva la lectura equivocada ANTES de mostrar la lista. Una tabla de
              frases invita a leerse como comandos; si el emprendedor cree que tiene que decirlas
              exactas, la guía lo empeoró. */}
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            Hablale como le hablarías a alguien que te ayuda. Estos son ejemplos, no fórmulas: si te
            falta un dato, te lo pide; si entendió mal, lo corregís en la tarjeta.
          </Text>

          {sinCapacidades && (
            <Text testID="como-hablarle-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
              Tu copiloto todavía no tiene funciones habilitadas.
            </Text>
          )}

          {guia.capacidades.map((c) => (
            <Row key={c.tool} testID={`como-hablarle-${c.tool}`}>
              <View style={styles.bloque}>
                <Text
                  style={{
                    color: tema.color.acento,
                    fontFamily: tema.fuente.mono,
                    fontSize: tema.tipo.chico,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  {c.rotulo}
                </Text>
                {c.ejemplos.map((e) => (
                  <Text
                    key={e}
                    style={{ color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: tema.tipo.base }}
                  >
                    «{e}»
                  </Text>
                ))}
              </View>
            </Row>
          ))}

          {/* Las fechas van aparte porque no son una capacidad: son un modificador de todas. Y salen
              de la MISMA tabla medida contra el resolvedor que usa el backend — no de una lista
              paralela que podría decir otra cosa. */}
          {guia.fechas.entiendo.length > 0 && (
            <Row testID="como-hablarle-fechas">
              <View style={styles.bloque}>
                <Text
                  style={{
                    color: tema.color.acento,
                    fontFamily: tema.fuente.mono,
                    fontSize: tema.tipo.chico,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Fechas
                </Text>
                <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                  {guia.fechas.entiendo.map((f) => `«${f}»`).join(' · ')}
                </Text>
                {guia.fechas.siNoEsta != null && (
                  <Text
                    testID="como-hablarle-fechas-si-no-esta"
                    style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
                  >
                    {guia.fechas.siNoEsta}
                  </Text>
                )}
              </View>
            </Row>
          )}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bloque: { flex: 1, gap: 4 },
});
