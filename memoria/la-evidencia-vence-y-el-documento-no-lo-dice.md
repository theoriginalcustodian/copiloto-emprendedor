---
name: la-evidencia-vence-y-el-documento-no-lo-dice
description: Una verificación correcta caduca cuando otro proceso pisa el estado — y el documento que la registra no tiene fecha de vencimiento
metadata:
  type: project
---

**Verificar bien no alcanza si el estado verificado puede ser pisado después.** La evidencia tiene
fecha; el documento donde se escribe, no. *«Verificado en vivo»* sigue leyéndose igual dentro de un
mes, cuando ya es falso.

**Caso raíz (2026-07-22, PR #3).** El fix del `navigateFallbackDenylist` del service worker —el que
hace que el **login con Google de la PWA** funcione— se desplegó a mano el 2026-07-08 con evidencia
real de estar vivo. Nadie mintió y nadie se olvidó. **La rama nunca se mergeó**, así que un
`sync-web.sh` posterior rebuildeó desde un árbol sin el fix y lo pisó **en silencio**. Dos semanas con
el login roto, con el arreglo escrito, revisado y correctamente declarado funcionando. Lo cazó backend
bajando el `sw.js` **vivo** y grepeando la denylist antes de tocar nada:

```
antes:   NavigationRoute(e.createHandlerBoundToURL("index.html"))
después: NavigationRoute(e.createHandlerBoundToURL("index.html"),{denylist:[/^\/auth\//]})
```

**Por qué ninguna regla lo cubría.** Todas las de este repo apuntan a *no afirmar sin verificar* — y
acá **se verificó**. El hueco está un paso después: nada vigila que lo verificado **siga siendo
cierto**. Y el fallo no avisa: no hay excepción, no hay rojo, el síntoma aparece del lado del usuario
y **no vuelve al que lo arregló**.

**La defensa NO es desconfiar de la evidencia** —eso no escala y paraliza—: es que **el estado bueno
viva en `main`**, lo único que un build no puede pisar en silencio.

> **Un PR que arregla algo ya desplegado a mano no es una formalidad pendiente: es lo único que hace
> que el arreglo sobreviva al próximo build.** Un PR abierto sobre código vivo es **deuda invisible con
> reloj**.

**How to apply:** (1) si arreglaste algo a mano en el VPS, el PR se mergea **el mismo día** — el fix no
existe hasta que está en `main` ([[apps-deploys-siempre-vps]] dice dónde corre; esto dice dónde
**vive**). (2) Antes de dar por vivo un arreglo viejo, **bajá el artefacto servido y buscá la marca**,
no releas el PR. (3) Al escribir *«verificado en vivo»*, poner **contra qué y cuándo** — una evidencia
sin fecha se lee como permanente.

**La misma forma, en otra capa:** una **etiqueta sobrevive a la evidencia que la justificó**. Un
`listo_frente-cerrado` emitido con una pantalla a medias no deja el frente al 80% — lo deja al 80%
**con un cartel que dice 100%**, y nadie vuelve a mirar lo que ya figura cerrado. Hermana de
[[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento confirmaba de más; acá el
registro **sigue confirmando después de que dejó de ser cierto**.
