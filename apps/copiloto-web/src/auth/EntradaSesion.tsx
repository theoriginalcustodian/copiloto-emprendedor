import { useState } from 'react';

import { TEXTOS_REVEAL } from '@copiloto/core';

import { Splash } from '../modules/splash';
import { LoginScreen } from './LoginScreen';
import { useSession } from './useSession';

/**
 * BL-X12w — lo que se ve sin sesión. Gemelo de mobile `modules/auth/EntradaSesion.tsx` (PR #597):
 * quien salió a PROPÓSITO (`cierreVoluntario`) aterriza en el reveal «volver» con dos puertas —
 * «Entrar» (mismo mail, sólo falta la contraseña) y «Entrar con otra cuenta» (formulario en
 * blanco). Todo lo demás —primer arranque, sesión caída sola— va directo al formulario, como
 * hasta ahora: el aviso de sesión caída vive ahí (`LoginScreen`).
 *
 * No hay un segundo splash: es `Splash` (BL-X10) con `cta`, mismo motor que el de primer ingreso.
 */
export function EntradaSesion() {
  const { cierreVoluntario } = useSession();
  const [paso, setPaso] = useState<{ tipo: 'reveal' } | { tipo: 'login'; email: string }>({ tipo: 'reveal' });

  if (cierreVoluntario == null || paso.tipo === 'login') {
    return <LoginScreen emailInicial={paso.tipo === 'login' ? paso.email : ''} />;
  }
  return (
    <Splash
      onFin={() => {}}
      cta={{
        primario: TEXTOS_REVEAL.volver.primario,
        secundario: TEXTOS_REVEAL.volver.secundario,
        onPrimario: () => setPaso({ tipo: 'login', email: cierreVoluntario.email ?? '' }),
        onSecundario: () => setPaso({ tipo: 'login', email: '' }),
      }}
    />
  );
}
