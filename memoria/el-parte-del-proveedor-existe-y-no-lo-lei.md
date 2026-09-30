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

---

## Refuerzo (2026-09-30): el parte existía **en disco, en el propio repo**, y tres sesiones diagnosticaron a ciegas durante 8 horas

El `reconcile` del grafo bloqueó el push de **tres sesiones** casi toda la jornada. Se discutió por
mensajes: hipótesis del guard, del `exit 0` engañoso, del hook que saltea el sync. Todo correcto en parte
y todo **inferido**.

Había una bitácora que el propio script había agregado ocho días antes, exactamente para esto:

```
.bridge/graph-sync.log
  2026-09-30T17:02:22  rc=0  motivo=contencion-otro-sync  marcador=c1e91870a003  origin_main=5330e0602ee4
  2026-09-30T17:03:13  rc=1  motivo=sync-en-curso         marcador=c1e91870a003  origin_main=5330e0602ee4
  …
```

Una línea por corrida, con **motivo, rc, pid y el marcador**. Su comentario en el código dice por qué
existe: *«cuando el marcador no avanza hay cuatro fallas posibles y desde afuera las cuatro se ven igual:
el marcador viejo»*. Es decir: **alguien ya había sufrido exactamente esta ambigüedad y dejó el
instrumento que la resuelve.** Nadie lo abrió. Yo tampoco, hasta la octava hora.

Y cuando lo leí, resolvió en seis líneas lo que no habían resuelto las hipótesis: que el caso de
contención **ya había ocurrido de verdad** ese día (`rc=0`, rama aterrizada, marcador quieto), y que mi
propia explicación anterior del mismo evento era falsa.

## El segundo filo: el nombre del campo empuja a leerlo al revés

`motivo=sync-en-curso` suena a «había otro sync corriendo». **Significa lo contrario**: se setea después
de adquirir el lock (`graph-sync.sh:282`), o sea «yo tomé el lock, entré, y falló». La contención tiene su
propio valor (`:277`). Leyéndolo por el nombre concluí que los pushes ni llegaban al reconcile — lo
inverso de la verdad — y estuve por publicarlo. Lo frenó abrir el código que **escribe** el campo en vez
de interpretar cómo se llama.

**Why:** un registro estructurado se lee como dato duro y sus etiquetas como descripciones del mundo, pero
una etiqueta la eligió alguien para describir **su rama del código**, no el estado del sistema. El valor es
confiable; su nombre es prosa.

**How to apply:** (1) ante cualquier fallo repetido de una herramienta propia, **buscar su log antes de
hipotetizar** — `find . -name '*.log' -newermt '-1 day'` en el árbol de la herramienta cuesta un comando,
y el comentario que lo creó suele explicar la ambigüedad que estás padeciendo; (2) antes de razonar sobre
un valor de enum, **grepeá quién lo asigna** y leé esa rama — el nombre no dice cuándo se setea; (3) si el
diagnóstico va por mensajes entre sesiones y nadie citó un log, eso ya es la señal.
