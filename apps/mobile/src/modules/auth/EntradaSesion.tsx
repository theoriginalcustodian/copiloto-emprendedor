import { useState } from 'react';

import { TEXTOS_REVEAL } from '@copiloto/core';

import { PantallaLogin } from './PantallaLogin';
import { PantallaMetodo } from './PantallaMetodo';
import { PantallaRegistro } from './PantallaRegistro';
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
 * SM-N30 DoD 4 (decisión, 2026-11-03): el aviso NO viaja al reveal. `avisoSesion` se pinta sólo en
 * `PantallaLogin` (`login-aviso-sesion`); pasar por el reveal sumaría un toque antes de verlo y rompería SM-K6,
 * que acredita ese aviso. Test: `EntradaSesion.test.tsx` («sesión caída SOLA…»).
 *
 * Desde el 12/11 hay alta propia con mail (`PantallaRegistro`) y la elección de método (`PantallaMetodo`).
 */
type Paso = { tipo: 'reveal' } | { tipo: 'metodo'; nuevo: boolean } | { tipo: 'login'; email: string } | { tipo: 'registro'; email: string };

/**
 * Flujo «Entrada a Odobi» (Martin 12/11): reveal → «Elegí cómo seguir» (Apple · Google · mail) → con mail,
 * entrar o crear la cuenta. Quien salió a propósito («volver») vuelve a entrar directo con su mail;
 * «Entrar con otra cuenta» pasa por la elección de método.
 */
export function EntradaSesion() {
  const { cierreVoluntario, primeraVez } = useSession();
  const [paso, setPaso] = useState<Paso>({ tipo: 'reveal' });

  const aLogin = (email: string) => setPaso({ tipo: 'login', email });
  const aRegistro = (email: string) => setPaso({ tipo: 'registro', email });
  // `nuevo`: llegó por «Empecemos» — con mail, lo más probable es que no tenga cuenta y va directo a crearla.
  const aMetodo = (nuevo = false) => setPaso({ tipo: 'metodo', nuevo });

  if (paso.tipo === 'metodo') {
    return <PantallaMetodo onMail={() => (paso.nuevo ? aRegistro('') : aLogin(''))} />;
  }
  if (paso.tipo === 'registro') return <PantallaRegistro emailInicial={paso.email} onIrAIngreso={aLogin} onVolver={() => aMetodo(true)} />;
  if ((cierreVoluntario == null && !primeraVez) || paso.tipo === 'login') {
    return (
      <PantallaLogin emailInicial={paso.tipo === 'login' ? paso.email : ''} onCrearCuenta={aRegistro} onOtrasFormas={() => aMetodo()} />
    );
  }

  const textos = cierreVoluntario != null ? TEXTOS_REVEAL.volver : TEXTOS_REVEAL.primeraVez;
  return (
    <RevealEntrada
      variante={cierreVoluntario != null ? 'reveal' : 'splash'}
      primario={textos.primario}
      secundario={cierreVoluntario != null ? textos.secundario : ''}
      onPrimario={() => (cierreVoluntario != null ? aLogin(cierreVoluntario.email ?? '') : aMetodo(true))}
      onSecundario={() => aMetodo()}
    />
  );
}
