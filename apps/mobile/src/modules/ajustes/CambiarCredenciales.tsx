import { cambiarContrasena, cambiarEmail } from '@copiloto/core';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { CampoSecreto, CampoTexto, FilaBotones } from '../../theme/glass/campos';
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

function FormularioEmail({ onListo }: { onListo: () => void }) {
  const tema = useTema();
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);

  async function enviar() {
    const email = nuevo.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Escribí un email válido.');
    setError(null);
    setEnviando(true);
    try {
      const res = await cambiarEmail(email);
      if (res.ok) setPendiente(email);
      else setError(res.mensaje);
    } catch {
      setError('No pudimos pedir el cambio ahora. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (pendiente != null) {
    return (
      <View testID="cuenta-email-pendiente" style={{ gap: tema.espacio.sm }}>
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
          Revisá tu mail para confirmar: te mandamos un enlace a {pendiente}. Hasta que confirmes, sigue valiendo el actual.
        </Text>
        <FilaBotones testID="cuenta-email-pendiente-botones" botones={[{ etiqueta: 'Cerrar', onPress: onListo, testID: 'cuenta-email-cerrar' }]} />
      </View>
    );
  }

  return (
    <View testID="cuenta-email-form" style={{ gap: tema.espacio.sm }}>
      <CampoTexto
        etiqueta="Email nuevo"
        valor={nuevo}
        onChange={setNuevo}
        error={error ?? undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        testID="cuenta-email-nuevo"
      />
      <FilaBotones
        testID="cuenta-email-botones"
        botones={[
          { etiqueta: enviando ? 'Enviando…' : 'Pedir el cambio', onPress: () => void enviar(), deshabilitado: enviando || nuevo.trim() === '', testID: 'cuenta-email-guardar' },
          { etiqueta: 'Cancelar', onPress: onListo, testID: 'cuenta-email-cancelar' },
        ]}
      />
    </View>
  );
}

/**
 * «Cambiar contraseña» y «Cambiar email» (K-12 / BL-J11; espejo de web `CambiarCredenciales`). Con
 * `cuentaGoogle` la fila de contraseña se OCULTA: no hay contraseña propia que cambiar y ofrecerla
 * llevaría a un error de GoTrue confuso — una fila que siempre falla enseña que la pantalla no anda.
 */
export function CambiarCredenciales({ cuentaGoogle }: { cuentaGoogle: boolean }) {
  const tema = useTema();
  const [abierta, setAbierta] = useState<'contrasena' | 'email' | null>(null);
  const cerrar = () => setAbierta(null);

  const fila = (id: 'contrasena' | 'email', etiqueta: string) => (
    <Row testID={`cuenta-cambiar-${id}`} onPress={() => setAbierta(id)} accessibilityLabel={etiqueta}>
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>{etiqueta}</Text>
    </Row>
  );

  return (
    <View testID="cuenta-credenciales" style={{ gap: tema.espacio.md }}>
      {!cuentaGoogle && (abierta === 'contrasena' ? <FormularioContrasena onListo={cerrar} /> : fila('contrasena', 'Cambiar contraseña'))}
      {abierta === 'email' ? <FormularioEmail onListo={cerrar} /> : fila('email', 'Cambiar email')}
    </View>
  );
}
