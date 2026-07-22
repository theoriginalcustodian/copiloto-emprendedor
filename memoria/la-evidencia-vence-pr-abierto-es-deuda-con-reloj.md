---
name: la-evidencia-vence-pr-abierto-es-deuda-con-reloj
description: Un fix desplegado a mano cuya rama nunca se mergeó tiene fecha de vencimiento — el próximo build lo pisa sin avisar, y el «verificado en vivo» del PR sigue escrito igual
metadata:
  type: feedback
---

**LEER cuando encuentres un PR viejo abierto sobre código que ya está en producción, o cuando vayas
a escribir «verificado en vivo» en un documento.**

## El caso

PR #3 del copiloto: `navigateFallbackDenylist` en el service worker de la PWA — sin eso, el SW
intercepta la navegación a `/auth/v1/authorize` y el login con Google «recarga y no hace nada».
Abierto el **2026-07-08**, con evidencia real de estar desplegado en su propio cuerpo:

> *Antes: `NavigationRoute(createHandlerBoundToURL("index.html"))` con 0 denylist.
> Después (deployado): `NavigationRoute(…,{denylist:[/^\/auth\//]})`.*

El **2026-07-22**, antes de tocar nada, corrí el control: bajé el `sw.js` **vivo** y busqué la
denylist. **No estaba.** Como la rama nunca se mergeó, algún `sync-web.sh` posterior rebuildeó desde
un árbol sin el fix y lo pisó en silencio. El login con Google estuvo roto **dos semanas**, con el
arreglo escrito, revisado y "verificado".

Se arregló mergeando el PR y rebuildeando **desde un checkout de `main`** — no desde el worktree de
turno, que no tenía el fix.

## Por qué rinde

**Nadie mintió y nadie se olvidó.** El arreglo estuvo vivo, la evidencia era cierta cuando se
escribió. Después *venció*, y **el documento donde estaba escrita no tiene fecha de vencimiento**.

Ése es el filo: `«verificado en vivo»` describe un instante, pero se lee como una propiedad. El
estado bueno se volvió falso sin que nadie tocara nada — no hay commit que culpar, no hay error en
ningún log, y el síntoma reaparece lejos del que lo arregló.

Es la cara temporal de *el auto-deploy es destructivo bidireccional*: lo que vive **sólo** en el VPS
y no en `main` tiene reloj. La defensa no es desconfiar de la evidencia; es que **el estado bueno
viva en `main`**, que es lo único que un build no puede pisar en silencio.

## Cómo aplicarlo

1. **Un PR que arregla algo desplegado a mano no es una formalidad pendiente: es lo único que hace
   que el arreglo sobreviva al próximo build.** Mergealo o revertí el deploy manual. Dejarlo abierto
   es deuda **con reloj**, no deuda dormida.
2. Antes de confiar en un «ya está arreglado» de más de un día, **corré el control contra el vivo**,
   no contra el PR. Cuesta un `curl` + un `grep`.
3. Al deployar un fix que vive en una rama, **buildeá desde un checkout de esa rama o de `main`** —
   nunca desde el worktree en el que estabas trabajando, que casi nunca la tiene.
4. **Un aviso también vence.** `sync-web.sh` advertía que `deploy.sh` borraba la PWA; medí el orden
   «peligroso» y ya no pasa. Se corrige, no se borra: un aviso vencido hace ordenar deploys
   alrededor de un peligro inexistente y, cuando se descubre falso, el descuento se lo llevan
   también los demás avisos del archivo.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] (aquella: el instrumento nunca midió;
ésta: midió bien y **caducó**) y de [[propagar-cierre-a-docs-maestros]].
