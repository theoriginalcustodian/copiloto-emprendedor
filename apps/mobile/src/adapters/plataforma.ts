import { configurarApi } from '@copiloto/core';

import { almacenTokens } from './almacen';
// Metro resuelve `./http` a `http.native.ts` | `http.web.ts` según la plataforma. Import por DEFAULT
// a propósito -- Task 10 encontró en vivo que importar un nombre (`httpNativo`) rompía la web, porque
// `http.web.ts` nunca exportó ese nombre (ver el comentario en ese archivo).
import http from './http';
import { conModoDemo } from '../demo/httpDemo';

/** Registra la plataforma activa ante `@copiloto/core` -- se llama UNA vez al arrancar la app.
 *  (En documed esto citaba su ADR-010; acá la decisión mobile-first vive en
 *  `docs/copiloto-emprendedor/2026-07-20-plan-sprint-mobile-first.md` §3 D1.) */
// ⚠️ `conModoDemo`: sólo en desarrollo, SACAR ANTES DEL PR (ver `demo/modoDemo.ts`). Fuera de desarrollo devuelve `http` tal cual.
configurarApi({ http: conModoDemo(http), tokens: almacenTokens });
