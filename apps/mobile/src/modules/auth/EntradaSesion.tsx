import { useState } from 'react';

import { TEXTOS_REVEAL } from '@copiloto/core';

import { PantallaLogin } from './PantallaLogin';
import { RevealEntrada } from './RevealEntrada';
import { useSession } from './useSession';

/**
 * BL-X12m — lo que se ve sin sesión. Quien salió a PROPÓSITO (`cierreVoluntario`) aterriza en el reveal
 * «volver» con dos puertas: «Entrar» (mismo mail, sólo falta la contraseña) y «Entrar con otra cuenta»
 * (formulario en blanco). Todo lo demás —primer arranque, sesión caída sola— va directo al formulario,
 * como hasta ahora: el aviso de sesión caída vive ahí.
 */
export function EntradaSesion() {
  const { cierreVoluntario } = useSession();
  const [paso, setPaso] = useState<{ tipo: 'reveal' } | { tipo: 'login'; email: string }>({ tipo: 'reveal' });

  if (cierreVoluntario == null || paso.tipo === 'login') {
    return <PantallaLogin emailInicial={paso.tipo === 'login' ? paso.email : ''} />;
  }
  return (
    <RevealEntrada
      primario={TEXTOS_REVEAL.volver.primario}
      secundario={TEXTOS_REVEAL.volver.secundario}
      onPrimario={() => setPaso({ tipo: 'login', email: cierreVoluntario.email ?? '' })}
      onSecundario={() => setPaso({ tipo: 'login', email: '' })}
    />
  );
}
