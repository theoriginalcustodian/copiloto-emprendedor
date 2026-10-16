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
 * «Crear una nueva cuenta» (SM-C2, 2026-10-15): **se dibuja**, y va al alta por email.
 *
 * ⚠️ Hasta hoy este docstring decía lo contrario — «`SignupScreen` no manda invite-token, así que
 * contra el backend real toda alta por email queda rechazada […] el botón secundario de
 * `primeraVez` no se dibuja». Esa premisa **venció el 2026-10-14**: `f3b60672` (PR #1206) retiró el
 * gate `invite_token` de `POST /auth/signup` («Sin gate: alta self-service», `web.py:1399`). El
 * comentario sobrevivió al cambio y era la razón DECLARADA para no dibujar la puerta — mientras
 * dijera eso, el próximo que leyera volvía a apagarla. Es
 * `memoria/el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo.md`.
 *
 * No hay un segundo splash: es `Splash` (BL-X10) con `cta`, mismo motor para las dos puertas.
 */
export interface EntradaSesionProps {
  /** SM-C2 — lleva al alta por email. Lo provee `App` (que es quien tiene el estado del router). */
  onCrearCuenta?: () => void;
}

export function EntradaSesion({ onCrearCuenta }: EntradaSesionProps = {}) {
  const { cierreVoluntario, primeraVez } = useSession();
  const [paso, setPaso] = useState<{ tipo: 'reveal' } | { tipo: 'login'; email: string }>({ tipo: 'reveal' });

  if ((cierreVoluntario == null && !primeraVez) || paso.tipo === 'login') {
    return (
      <LoginScreen
        emailInicial={paso.tipo === 'login' ? paso.email : ''}
        onCrearCuenta={onCrearCuenta}
      />
    );
  }

  const textos = cierreVoluntario != null ? TEXTOS_REVEAL.volver : TEXTOS_REVEAL.primeraVez;
  return (
    <Splash
      onFin={() => {}}
      cta={{
        primario: textos.primario,
        // SM-C2: el secundario se dibuja en los DOS caminos, pero NO significan lo mismo —
        // «Entrar con otra cuenta» (volver) es un login en blanco; «Crear una nueva cuenta»
        // (primeraVez) es el alta. En `primeraVez` sin `onCrearCuenta` queda `''` y `Splash` no
        // lo dibuja: un botón que no lleva a ninguna parte es peor que su ausencia.
        secundario: cierreVoluntario != null || onCrearCuenta ? textos.secundario : '',
        onPrimario: () => setPaso({ tipo: 'login', email: cierreVoluntario?.email ?? '' }),
        onSecundario: () =>
          cierreVoluntario != null ? setPaso({ tipo: 'login', email: '' }) : onCrearCuenta?.(),
      }}
    />
  );
}
