---
name: tests-que-mockean-la-serializacion-son-ciegos-al-borde-del-wire
description: Una suite verde que mockea el fetch/serialización real NO ejerce el borde del wire — el tipo que cruza HTTP nunca se prueba, y ahí viven bugs invisibles
metadata:
  type: project
---

Dos bugs de la misma clase en una semana, ambos con la suite en verde:

1. **500 `interval` vs `int`** (`GET /mi-dia/tablero`): `(CURRENT_DATE - max(fecha))` en Postgres
   devuelve `int`, no `interval`; `.days` sobre eso tira `AttributeError`. 979 tests verdes nunca lo
   vieron — pasaban `dias` ya calculado como fixture.
2. **Tarjeta descartada en silencio** (PR#107): el `id` viajaba `int` desde Postgres, el cliente
   (`miDia.ts:91`, `typeof id === 'string'`) lo filtraba sin error → tablero vacío indistinguible de
   "no hay nada". Los tests mockeaban `avanzar_tablero_fn` completo, sin pasar por la serialización real.

**El patrón:** cuando el test **mockea la capa de fetch/serialización** (pasa el dato ya con la forma
final, o stubea la función que arma la respuesta), el **tipo real que cruza el wire** —lo que Postgres
serializa, lo que el JSON transporta, lo que el cliente parsea— **nunca se ejercita**. La suite prueba
la lógica *alrededor* del borde, no el borde. Y el borde es exactamente donde un `int` que debía ser
`str` (o un `int` que debía ser `interval`) rompe **en silencio**: sin excepción del lado que descarta,
sin 500 si el cast falla suave.

**Why:** el verde de la suite se **siente** como cobertura del endpoint, pero mide una versión del
endpoint con el borde cortado. Es [[instrumentos-que-confirman-en-vez-de-verificar]] a nivel de test:
*¿qué devolvería el test si el tipo del wire estuviera mal? — verde, porque el mock nunca lleva ese
tipo.* Por eso el contrato pide **device/HTTP real antes de cerrar**, no solo tests: un `GET`/`curl`
real contra Postgres caza en 30 s lo que 1000 tests con fixtures no.

**How to apply:** (1) al menos un test de integración que pegue por HTTP real contra la DB real y
**afirme el tipo** del campo en la respuesta (`"id":"5"` string, no `5`), no solo su valor. (2) No
mockear la función que serializa la respuesta — mockear más adentro (el repo/DB), dejar el borde vivo.
(3) Regla de cierre: un endpoint no está verificado hasta un `curl`/device real, aunque la suite esté
verde ([[la-evidencia-vence-y-el-documento-no-lo-dice]], [[gate-jsdom-no-ve-gestos-tactiles]]).
