import { useState } from 'react';

import { TEXTOS_REVEAL } from '@copiloto/core';

import { Splash } from '../modules/splash';
import { LoginScreen } from './LoginScreen';
import { useSession } from './useSession';

/**
 * BL-X12w — lo que se ve sin sesión. Gemelo de mobile `modules/auth/EntradaSesion.tsx` (PR #597):
 * quien salió a PROPÓSITO (`cierreVoluntario`) aterriza en el reveal «volver» con dos puertas —
 * «Entrar» (mismo mail, sólo falta la contraseña) y «Entrar con otra cuenta» (formulario en
 * blanco). El PRIMER arranque (`primeraVez`, BL-X10 fila 2) aterriza en el MISMO reveal con las
 * puertas de `TEXTOS_REVEAL.primeraVez` («Empecemos» / «Crear una nueva cuenta»). La sesión caída
 * SOLA (CTA5, ninguno de los dos flags) sigue yendo directo al formulario, como hasta ahora: el
 * aviso de sesión caída vive ahí (`LoginScreen`).
 *
 * «Crear una nueva cuenta»: la decisión operador #3 YA está resuelta (2026-08-04, ver docstring de
 * `SignupScreen.tsx`/`App.tsx`) pero `SignupScreen` no manda invite-token, así que contra el backend
 * real toda alta por email queda rechazada salvo la ruta directa para invitados — y el alta
 * self-service de la beta es Google (BETA-5), donde «entrar» y «crear cuenta» son el mismo acto, ya
 * cubierto por `Entrar`. No hay alta distinta que ofrecer acá: el botón secundario de `primeraVez`
 * no se dibuja (rama del DoD para "no hay alta en la app"), sin PR de seguimiento pendiente.
 *
 * No hay un segundo splash: es `Splash` (BL-X10) con `cta`, mismo motor para las dos puertas.
 */
export function EntradaSesion() {
  const { cierreVoluntario, primeraVez } = useSession();
  const [paso, setPaso] = useState<{ tipo: 'reveal' } | { tipo: 'login'; email: string }>({ tipo: 'reveal' });

  if ((cierreVoluntario == null && !primeraVez) || paso.tipo === 'login') {
    return <LoginScreen emailInicial={paso.tipo === 'login' ? paso.email : ''} />;
  }

  const textos = cierreVoluntario != null ? TEXTOS_REVEAL.volver : TEXTOS_REVEAL.primeraVez;
  return (
    <Splash
      onFin={() => {}}
      cta={{
        primario: textos.primario,
        // BETA-4b (ver docstring): sin alta distinta que ofrecer. `onSecundario` no se llega a
        // disparar porque `Splash` no dibuja el botón cuando `secundario === ''`.
        secundario: cierreVoluntario != null ? textos.secundario : '',
        onPrimario: () => setPaso({ tipo: 'login', email: cierreVoluntario?.email ?? '' }),
        onSecundario: () => setPaso({ tipo: 'login', email: '' }),
      }}
    />
  );
}
