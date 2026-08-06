---
name: el-puerto-que-contesta-puede-ser-de-otra-sesion
description: Con sesiones paralelas, el dev server que responde en localhost puede ser el de OTRA sesión con código viejo — y medís el servidor equivocado creyendo que tu cambio no funcionó
metadata:
  type: project
---

**LEER antes de verificar un cambio de UI contra un dev server local.** Caso raíz: 2026-08-06, hito 6
de ODOBI — backend perdió ~78 min y se comió la ventana de su `avance_` de 90 min por esto.

## Qué pasó

Levantó Vite para el E2E web, apuntó Playwright a `localhost:5183`, y vio **"Clash Display"** donde
el hito 3 había puesto **NeueEinstellung**. Conclusión natural y falsa: *"el cambio no llegó"*.

El puerto 5183 ya estaba tomado por **otra sesión**, corriendo código **pre-hito-3**. Su propio Vite
había avisado —`Port 5183 is in use, trying another one...`— y se había ido a 5187/5199. El aviso
estaba en el log; la medición apuntaba al otro lado.

## Por qué es traicionero

El servidor equivocado **responde 200 y renderiza la app**. No hay error, no hay conexión rechazada,
no hay nada que proteste: hay una app funcionando que simplemente no es la tuya. Es un
[[instrumentos-que-confirman-en-vez-de-verificar]] perfecto — mide algo real, sólo que no lo tuyo.

Y con checkout compartido + tres sesiones, el puerto colisionado es lo **normal**, no lo raro.

## El control: cruzar el PID del puerto contra tu propio proceso

No alcanza con leer el puerto que imprimió tu comando — hay que confirmar que quien contesta es él:

```bash
netstat -ano | grep :<puerto>        # PID que tiene el puerto
# comparar contra el PID del Vite/Metro que arrancaste vos
```

Barato y definitivo. Es lo que finalmente lo destrabó.

## La generalización

Todo servicio de desarrollo que elige puerto **con fallback silencioso** (Vite, Metro, Storybook,
`serve`) tiene esta trampa: el fallback es una conveniencia para el que arranca y una mentira para el
que mide. Ante un resultado visual que contradice un cambio ya mergeado, la primera pregunta no es
*"¿falló el cambio?"* sino **"¿le estoy preguntando al proceso correcto?"** — control positivo antes
de explicar el vacío ([[vacio-no-es-hallazgo-correr-el-control]]).

Relacionado: [[sincronizar-al-vps-desde-el-worktree-equivocado]] (mismo error, escribiendo en vez de
leyendo) · [[el-checkout-compartido-sirve-comandos-viejos]] · [[el-control-corrido-contra-la-base-equivocada]]
