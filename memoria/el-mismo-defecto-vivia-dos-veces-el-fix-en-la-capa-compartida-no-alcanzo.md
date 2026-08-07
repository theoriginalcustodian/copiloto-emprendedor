---
name: el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo
description: Arreglar el cliente HTTP del core no arregló la web — usa su propia copia; el test verde y el deploy hecho no lo delataron, sólo el navegador
metadata:
  type: project
---

Arreglé el refresh-on-401 en `packages/core/src/api/client.ts` (CTA7), mergeé con 6/6 checks verdes,
desplegué la web… y **el defecto seguía vivo**. Chat, conexiones y cuenta no usan el cliente del core:
usan `apps/copiloto-web/src/lib/api/client.ts`, que es **una copia** con la lógica vieja — hasta el
comentario del single-flight es el mismo texto.

**Cómo apareció.** No por un test: por medir en el navegador. Con el sitio ya desplegado, borré sólo
`copiloto-token` dejando `copiloto-refresh`, recargué, y la app terminó en el login **con el refresh
token borrado**. Un `/auth/refresh` se disparó (mi fix del core corrió) y aun así la sesión murió,
porque el otro cliente la limpió antes.

**Por qué ningún instrumento lo dijo.** Los 28 test files del core pasaban — probaban el código
correcto. Los 65 de la web pasaban — no había test para ese caso. El gate no distingue "arreglado en
la capa que importa" de "arreglado en una capa". Y el deploy fue exitoso: subió el bundle nuevo con
el defecto adentro. **Tres verdes seguidos sobre un defecto vivo.**

**La pregunta que lo caza antes:** *¿esta capa es la que la pantalla realmente usa?* No alcanza con
que el módulo arreglado exista y esté importado en algún lado — hay que ver **quién** hace la llamada
en el camino que el usuario ejercita. `almacenTokens.ts` lo decía en su docstring: «MISMAS claves que
`lib/api/client.ts` (el cliente propio de web, usado hoy por chat/connections/account)». Estaba
escrito; no lo leí como lo que era: **la declaración de que hay dos clientes**.

Es la versión de capa de [[el-fix-ya-existe-en-otro-call-site]] y hermana de
[[el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado]]: el código se copió, el razonamiento que lo
corrige no viaja solo. Cuando un fix toca un mecanismo transversal (sesión, errores, reintentos),
grepear el **patrón** —no el símbolo— antes de declarar el arreglo: `sentBearer`, `clearToken`,
`refreshInFlight` estaban en dos archivos, y el grep tardaba 5 segundos.
