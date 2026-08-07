---
name: metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree
description: El dev-server (Metro en mobile, vite en web) sirve desde el checkout compartido y no desde el worktree donde estás mirando — el falso negativo se lee como "el fix no funciona" y el falso positivo es peor
metadata:
  type: project
---

# 📱🔀 Metro sirve el bundle del CHECKOUT COMPARTIDO, no del worktree del device

**Medido el 2026-08-05** (ODOBI hito 4). Backend cherry-pickeó el rename de marca al worktree del
device (`_wt-mobile-e2e`), recargó, y **la pantalla seguía diciendo "Copiloto"**. El archivo correcto
estaba ahí, verificado. El bundle venía de otro lado: **Metro corría sobre el checkout compartido**.

## Por qué duele más que un bug normal

El síntoma es **indistinguible de "el cambio no funciona"**. Tenés el archivo bien, lo verificaste,
lo recargaste, y la pantalla te dice que no. La conclusión natural —y falsa— es dudar del código:
buscás el bug en el componente, en el import, en el caché de RN. Nada de eso es la causa, y todo eso
parece razonable.

Es de la familia de [[sincronizar-al-vps-desde-el-worktree-equivocado]] y
[[el-checkout-compartido-sirve-comandos-viejos]]: **el artefacto que se ejecuta no sale de donde
estás mirando**. Acá el falso negativo apunta al *device*, que es la evidencia más cara de conseguir
(dueño único, gestos manuales) — desperdiciarla en una medición inválida cuesta doble.

## El control, antes de dudar del código

Si verificás en device y **no ves tu cambio**: confirmá **de dónde sirve Metro** antes que nada.
Un `grep` del símbolo nuevo en el archivo que Metro tiene abierto, o mirar el cwd del proceso.
Es un chequeo de segundos que evita una hora buscando un bug que no existe.

**Y a la inversa, el caso peligroso:** si el checkout compartido *sí* tiene el cambio pero tu worktree
no, el device te da **verde por el archivo equivocado** — evidencia falsa que se ve idéntica a la
buena. Ver [[device-fisico-exige-dueno-unico]].

## El fix que aplicó backend

Editar el archivo puntual **también** en el checkout compartido (edición explícita, un solo archivo)
para que Metro lo sirviera. No es elegante, pero es lo correcto mientras Metro apunte ahí: el
alternativo —reapuntar Metro al worktree— tiene su propia trampa documentada en
[[metro-en-windows-no-sigue-links-de-node-modules-en-worktrees]].

## No es de Metro: pasa igual con `vite` en la web (2026-08-07)

Frontend levantó `npm --prefix "apps/copiloto-web" run dev` para medir el rail **con el cwd del
checkout compartido**, no del worktree. El `--prefix` relativo resolvió al árbol viejo, y vite sirvió
código de **cientos de commits atrás**. Todo lo demás daba señal de correcto: el puerto contestaba
200, el log era el de *mi* proceso (`--strictPort`, arrancado 20 segundos antes), el HTML era el de
la app. Nada apuntaba al árbol equivocado.

**Lo que lo delató fue un control de DOMINIO, no de paths:** al listar las etiquetas del rail
aparecieron `Chat · Apps · Conexiones · Gastos · Cuenta` — el registro de tabs que un PR anterior ya
había eliminado. O sea: *la página se contradecía con el repo*. Un chequeo de PID o de puerto habría
dado verde igual, porque el puerto **sí** era mío; lo que no era mío era el **árbol**.

De ahí la regla práctica: **antes de medir, pedile al artefacto que se identifique con un dato que
sólo tu versión tiene** (un símbolo nuevo, un texto renombrado, un tab que agregaste). "El servidor
es mío" y "el servidor sirve mi código" son dos afirmaciones distintas, y la primera no implica la
segunda. Es [[el-canario-el-control-positivo-de-lo-que-falla-callado]] aplicado al dev-server.

⚠️ Y el motivo por el que esto muerde tan seguido acá: `npm --prefix`, `npx` y los scripts de `ci/`
resuelven rutas **relativas al cwd**, y el cwd por default de la sesión es el **checkout compartido**,
que está cientos de commits detrás. Con worktrees, la ruta al dev-server va **absoluta**, siempre.

## Hermano del mismo día, mismo hito

El checkout compartido está **muy divergido de `origin/main`** (cientos de archivos, commits locales
sin pushear). Backend armó el commit desde un **worktree descartable basado en `origin/main` limpio**
— y *sólo así* apareció un archivo (`PantallaLogin.tsx`) que en el checkout divergido era invisible.
Portar a ciegas al checkout habría **revertido código ajeno en silencio**.
Ver [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]].
