import { useState } from 'react';

import { TEXTOS_REVEAL } from '@copiloto/core';

import { PantallaLogin } from './PantallaLogin';
import { RevealEntrada } from './RevealEntrada';
import { useSession } from './useSession';

/**
 * BL-X12m — lo que se ve sin sesión. Quien salió a PROPÓSITO (`cierreVoluntario`) aterriza en el reveal
 * «volver» con dos puertas: «Entrar» (mismo mail, sólo falta la contraseña) y «Entrar con otra cuenta»
 * (formulario en blanco). El PRIMER arranque (`primeraVez`, BL-X10 fila 2) aterriza en el MISMO reveal
 * con las puertas de `TEXTOS_REVEAL.primeraVez` («Empecemos» / «Crear una nueva cuenta»). La sesión
 * caída SOLA (CTA5, ninguno de los dos flags) sigue yendo directo al formulario, como hasta ahora: el
 * aviso de sesión caída vive ahí.
 *
 * «Crear una nueva cuenta»: mobile no tiene pantalla de alta propia — el alta self-service de la
 * beta es Google (`loginConGoogle`, BETA-5), donde «entrar» y «crear cuenta» son el mismo acto, ya
 * cubierto por «Empecemos»/«Entrar». No hay alta distinta que ofrecer: el botón secundario de
 * `primeraVez` no se dibuja (mismo tratamiento que web, decisión operador #3 resuelta 2026-08-04).
 */
export function EntradaSesion() {
  const { cierreVoluntario, primeraVez } = useSession();
  const [paso, setPaso] = useState<{ tipo: 'reveal' } | { tipo: 'login'; email: string }>({ tipo: 'reveal' });

  if ((cierreVoluntario == null && !primeraVez) || paso.tipo === 'login') {
    return <PantallaLogin emailInicial={paso.tipo === 'login' ? paso.email : ''} />;
  }

  const textos = cierreVoluntario != null ? TEXTOS_REVEAL.volver : TEXTOS_REVEAL.primeraVez;
  return (
    <RevealEntrada
      primario={textos.primario}
      secundario={cierreVoluntario != null ? textos.secundario : ''}
      onPrimario={() => setPaso({ tipo: 'login', email: cierreVoluntario?.email ?? '' })}
      onSecundario={() => setPaso({ tipo: 'login', email: '' })}
    />
  );
}
