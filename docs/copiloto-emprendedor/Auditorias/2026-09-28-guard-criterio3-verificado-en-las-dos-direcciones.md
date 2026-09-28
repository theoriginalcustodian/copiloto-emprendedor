# El guard de `criterio3-matriz.mjs`, verificado en las dos direcciones — y el server rompe la ACTIVACIÓN, no sólo el `goto`

**2026-09-28 · planificación · rama `docs/registro-a5-y-memoria` · commits `975c3802` (guard) y `b751b006` (los dos arreglos)**

El guard se entregó **`[UNVERIFIED]`** a propósito: *un guard sin control positivo no está verificado*, y
uno que sólo se prueba hacia el «no» no da síntoma cuando falla hacia el «sí». Queda verificado acá, con
las dos direcciones medidas y con **causas atribuidas**, que es la parte que casi se me escapa.

## Lo que el guard hace

| brazo | qué mide | qué hace |
|---|---|---|
| **aserción positiva** (`ASERCION_PROTO`, `:44-50`) | ¿la activación del `?ver=<id>` ocurrió de verdad? | **aborta** antes de `fotoA` |
| **`pageerror`** | excepción de JS sin atrapar | **aborta** |
| **`console.error` / `http>=400`** | recurso faltante | **avisa y captura** |
| **`NO_MEDIDAS` + exit 1** | toda celda no capturada, por cualquier causa | lista en stdout + JSON + **exit ≠ 0** |

## Los controles, con el resultado crudo

| # | dirección | cómo | resultado |
|---|---|---|---|
| 1 | **debe RECHAZAR** (aserción) | auditoría rompió `ASERCION_PROTO.hitl` a un selector inexistente | aborta las 2 celdas, **0 PNG** — el `throw` precede a `fotoA` |
| 2 | **debe RECHAZAR** (sin inyectar) | `cuenta@desktop` contra el server python | abortó sola: falta `#s-cuenta.on`, **0 PNG**, listada, **exit 1** |
| 3 | **debe PASAR con 404** | `cuenta@390` contra un server que devuelve **404** al favicon | **⚠️ aviso NO fatal + PNG escrito** — el 404 ya no tumba una celda buena |
| 4 | **debe PASAR limpio** | `cuenta` contra el server con favicon **204** | **2 PNG**, aserción verificada en los dos viewports |
| 5 | **el exit code** | 4 celdas fallidas | 4 listadas + JSON + **exit 1**. Antes: `console.log` y **exit 0** |

**Alcance honesto del control 5:** el fallo que usé fue `Executable doesn't exist`, no el guard abortando.
Prueba el conteo end-to-end, **no atribuye** a la rama del guard — eso lo cierran los controles 1 y 2. Es
el `catch` que abarca dos `await` aplicado a mi propio control: una sola mitad no alcanza.

## El hallazgo nuevo: el server también rompe la ACTIVACIÓN

Auditoría midió que `python -m http.server` cuelga entre el 3% y el 19% de los `page.goto` (H1), y que
la sonda de salud lo declaraba sano porque **disponibilidad no es capacidad**. Acá apareció **su segunda
cara**, y es peor de diagnosticar:

> **Mismo id, mismo prototipo, mismo viewport-set, dos servers: contra el de Node los dos viewports de
> `cuenta` capturan; contra python, `desktop` pierde la activación (`#s-cuenta.on` ausente) y `390` no.**

O sea que el server degradado no sólo hace fallar la carga: deja cargar la **pantalla base** y no ejecuta
la activación. Sin la aserción positiva eso es un PNG **plausible de la pantalla equivocada** — un
COHERENTE falso, indistinguible de una medición buena. Es la clase
`un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion` llegando por el transporte.

**Consecuencia operativa:** el server de Node (`scripts/evidencia/server-proto.mjs`) no es una preferencia
de estilo — **es precondición de cualquier fila de la matriz**. Una corrida contra python puede firmar
COHERENTE sobre la pantalla base. Y el `favicon` en 204 evita el ruido, pero **no** es lo que protege de
esto: lo que protege es la aserción positiva.

## Lo que NO queda verificado

- El brazo `pageerror` **no se ejercitó con una excepción real** — sólo se sabe que no dispara cuando no
  hay ninguna (controles 3 y 4). Para cerrarlo hace falta un proto que tire una excepción a propósito.
  Queda **`[PARCIAL]`**, declarado, no escondido.
- El brazo de la app no corrió: `.env.e2e` no existe en este worktree (la credencial vive en el
  checkout que corre las capturas). Las 2 celdas fallaron **con causa atribuible** y fueron contadas,
  que es justamente lo que se estaba arreglando.
