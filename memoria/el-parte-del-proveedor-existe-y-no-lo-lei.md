---
name: el-parte-del-proveedor-existe-y-no-lo-lei
description: Cuando un sistema de un tercero se porta raro, su parte de incidente publica la causa exacta — leerlo ANTES de inventar una teoría que explique todas las observaciones
metadata:
  type: feedback
---

# 📄 El parte del proveedor EXISTE, y explicó todo lo que yo estaba adivinando

**2026-08-06.** GitHub Actions dejó de disparar corridas. Medí cinco cosas distintas y las expliqué
**todas** con una teoría propia que me sonó razonable — *"GitHub deduplica por SHA"*. La inventé.

El parte oficial del incidente decía la causa exacta, en una línea:

> *"Webhook triggers are currently **throttled**… we are processing approximately **15% of
> webhooks**, so many events such as pushes and pull requests are **not triggering workflow runs**."*

Con eso, las cinco observaciones se explican solas: el commit vacío por API, el `close`+`reopen`, los
pushes que sí corrieron, los jobs `cancelled`, los runs encolados que nunca arrancan. **Ninguna
necesitaba mi teoría.**

## Por qué no me frenó nada

Porque **estaba midiendo**. Corría comandos, leía salidas, comparaba estados — se sentía empírico. Y
lo era, del lado del artefacto. Pero la **conclusión** sobre por qué el artefacto se portaba así
salía de una suposición, y esa costura es invisible: *"no apareció el run"* es observación,
*"…porque deduplica por SHA"* es teoría, y las escribí en la misma frase.

Peor: una ausencia es **compatible con infinitas causas**, así que la primera explicación plausible
encaja con todo y **nada la contradice**. Un run que no aparece se ve idéntico sea cual sea el
motivo. Después la canonicé — la bajé al buzón a tres sesiones como si fuera un hecho medido.

## La regla

**Ante un tercero que se porta raro, su parte de incidente / status page es una FUENTE PRIMARIA, y
leerla cuesta un `curl`.** Va antes de teorizar, no después de que la teoría no cierre.

Y el matiz que casi me la come: **no alcanza el semáforo.** Yo había mirado `summary.json` y visto
`Actions -> major_outage`; con eso me di por informado y seguí adivinando el mecanismo. La causa
estaba en `incidents/unresolved.json`, en el **cuerpo del último update**. El semáforo dice *que*
está roto; el parte dice *cómo*, y el *cómo* es lo que decide qué podés hacer al respecto.

```bash
curl -s https://<status-page>/api/v2/incidents/unresolved.json   # el cuerpo, no sólo el color
```

## Qué cambió al leerlo

Dejó de ser "no hay palanca, esperá" y pasó a ser "es una lotería del 15% por evento" — con siete
pushes normales, ~68% de que al menos uno dispare. La acción correcta era **la opuesta** a la que yo
había bajado.

Hermana de **V-EXT** (`no-codificar-la-esperanza-principio-raiz`): aquélla dispara ante un **error**
que no cede tras 2 intentos; ésta ante un **comportamiento raro de un tercero** que ya tiene
explicación publicada. Y de [[vacio-no-es-hallazgo-correr-el-control]]: el control te dice si tu
instrumento sirve; el parte te dice si el problema es tuyo.
