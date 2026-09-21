import { cambiarContrasena } from '@copiloto/core';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { CampoSecreto, FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/** Largo mínimo de la política de GoTrue; el backend decide (`contrasena_invalida`), esto sólo evita
 *  ir a la red por un caso que ya se sabe inválido. */
const MIN_CONTRASENA = 6;

function FormularioContrasena({ onListo }: { onListo: () => void }) {
  const tema = useTema();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar() {
    if (nueva.length < MIN_CONTRASENA) return setError(`La contraseña nueva necesita al menos ${MIN_CONTRASENA} caracteres.`);
    if (nueva !== repetida) return setError('Las dos contraseñas nuevas no coinciden.');
    setError(null);
    setEnviando(true);
    try {
      const res = await cambiarContrasena(actual, nueva);
      if (res.ok) setHecho(true);
      else setError(res.mensaje);
    } catch {
      setError('No pudimos cambiarla ahora. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <View testID="cuenta-contrasena-ok" style={{ gap: tema.espacio.sm }}>
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>Listo, cambiaste tu contraseña.</Text>
        <FilaBotones testID="cuenta-contrasena-ok-botones" botones={[{ etiqueta: 'Cerrar', onPress: onListo, testID: 'cuenta-contrasena-cerrar' }]} />
      </View>
    );
  }

  return (
    <View testID="cuenta-contrasena-form" style={{ gap: tema.espacio.sm }}>
      <CampoSecreto etiqueta="Contraseña actual" valor={actual} onChange={setActual} testID="cuenta-contrasena-actual" />
      <CampoSecreto etiqueta="Contraseña nueva" valor={nueva} onChange={setNueva} testID="cuenta-contrasena-nueva" />
      <CampoSecreto etiqueta="Repetí la contraseña nueva" valor={repetida} onChange={setRepetida} error={error ?? undefined} testID="cuenta-contrasena-repetida" />
      <FilaBotones
        testID="cuenta-contrasena-botones"
        botones={[
          { etiqueta: enviando ? 'Guardando…' : 'Guardar contraseña', onPress: () => void enviar(), deshabilitado: enviando || actual === '', testID: 'cuenta-contrasena-guardar' },
          { etiqueta: 'Cancelar', onPress: onListo, testID: 'cuenta-contrasena-cancelar' },
        ]}
      />
    </View>
  );
}

/**
 * «Cambiar contraseña» (K-12 / BL-J11; espejo de web `CambiarCredenciales`). Con `cuentaGoogle` NO se
 * renderiza nada: no hay contraseña propia que cambiar y ofrecerla llevaría a un error de GoTrue
 * confuso — una fila que siempre falla enseña que la pantalla no anda.
 *
// [DIFERIDO_CIERRE_B] fila «Cambiar email»: el backend ya la soporta (POST /auth/cambiar-email,
// PR #559); falta SMTP real + ruta /auth/v1/verify en Caddy. Dueño: operador. Revisar en Cierre B.
// No se monta: el backend respondería 200 y la UI diría «revisá tu mail» sin que llegue nada — un
// éxito falso es más caro que un error (planificación, respuesta K-12 opción b).
 */
export function CambiarCredenciales({ cuentaGoogle }: { cuentaGoogle: boolean }) {
  const tema = useTema();
  const [abierta, setAbierta] = useState(false);
  if (cuentaGoogle) return null;

  return (
    <View testID="cuenta-credenciales" style={{ gap: tema.espacio.md }}>
      {abierta ? (
        <FormularioContrasena onListo={() => setAbierta(false)} />
      ) : (
        <Row testID="cuenta-cambiar-contrasena" onPress={() => setAbierta(true)} accessibilityLabel="Cambiar contraseña">
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>Cambiar contraseña</Text>
        </Row>
      )}
    </View>
  );
}
