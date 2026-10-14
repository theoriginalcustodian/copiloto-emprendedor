---
name: el-escalador-acusa-al-destinatario-nunca-al-emisor-que-no-cumplio-el-disparador
description: "El escalador de contratos mide 'quién no lo tomó' y nombra al DESTINATARIO; nunca mide si el EMISOR cumplió la precondición que el propio contrato declara. Con el emisor en falta, el instrumento acusa — con nombre y minutos — a las sesiones que estaban esperando correctamente"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
---

**2026-10-14.** Reanudé planificación y el instrumento me dio cinco líneas con forma de veredicto:

```
CONTRATO SIN TOMAR (392min >= 120): …-a-backend_REANUDA-cola-SM-C2-C3-E1-E2-E3… -> le toca a backend
CONTRATO SIN TOMAR (392min >= 120): …-a-frontend1_REANUDA-cola-SM-D1-D2-D5-D6-D7… -> le toca a frontend1
CONTRATO SIN TOMAR (360min >= 120): …-a-frontend1_SM-E1-la-mitad-frontend… -> le toca a frontend1
CONTRATO SIN TOMAR (127min >= 120): …-a-frontend2_LA-PASADA-UNICA-DE-DEVICE… -> le toca a frontend2
CONTRATO SIN TOMAR (136min >= 120): …-a-frontend2_SM-E3-SUMA-a-la-pasada-de-device… -> le toca a frontend2
```

Minutos medidos, nombre propio, flecha de atribución. Les mandé un pulso a las tres dándolo por
cierto. **Las tres me contestaron que estaban bien, y las tres tenían razón:**

| sesión | lo que el instrumento decía | lo que medía de verdad |
|---|---|---|
| frontend1 | 2 contratos sin tomar, 392 y 360 min | **cumplidos** — `2d198a96`, `1966c340`, `bb42cfe0`, `01a9b896` ancestros de `origin/main`. Faltaba el `mv` a `cerrado/` |
| frontend2 | 2 contratos sin tomar, 127 y 136 min | **esperando un disparador MÍO**: prod `/healthz` = `9e536c38` y `origin/main` = `2a533905`, 23 commits atrás, con `gasto_store.py` y `trabajo_store.py` entre medio. Medir SM-E3 ahí daba un `medido_contra` falso |
| backend | 1 contrato sin tomar, 392 min | idle real, pero su cola arrancaba en una decisión escalada al operador (SM-C2) |

El bloqueante del sprint entero era **mío y uno solo**: el deploy de `main` a prod. Mi propio
`urgente_` lo decía con esas palabras — *«el bloque F NO espera al operador, el deploy es MÍO y nadie
mide en device hasta que prod tenga el sha de main»* — y el instrumento, corriendo sobre ese mismo
buzón, no lo vio ni podía verlo.

## Por qué el instrumento no puede verlo

`escaladores-buzon.sh` mide **una sola cosa**: `mtime` del archivo contra un TTL, y deriva el acusado
del **nombre** (`-a-<rol>_`). Es correcto en lo que hace y **no tiene acceso a lo que haría falta**: el
contrato declara su disparador *en el cuerpo, en prosa* («disparador: tu `dato_` de que `/healthz` ==
sha de main»), y nadie compara ese disparador contra el mundo. Entonces la única pregunta que el
escalador sabe hacer es **«¿alguien respondió?»**, y la única respuesta que sabe dar apunta **hacia
afuera**. Un contrato cuya precondición no cumplió el emisor es, para el instrumento,
indistinguible de uno que el destinatario ignoró. Los dos se ven igual: un archivo viejo.

**Y el sesgo tiene dirección fija.** No es ruido simétrico: el escalador **nunca** puede acusar a
quien lo corre, porque el emisor no aparece en el lado `-a-` del nombre. Es el único actor
estructuralmente inocente del reporte que él mismo lee. Por eso cada vez que falla, falla igual: el
dueño del instrumento sale limpio y el resto sale nombrado.

Es [[el-control-que-mide-la-propiedad-destapa-el-defecto-ajeno-el-que-mide-mi-accion-no]] en el plano
de la coordinación, y la forma gemela de
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]]: ahí el que no vino era invisible;
acá el invisible es **el que no cumplió lo que prometió en el contrato que él mismo emitió**.

## El daño real: no es el falso positivo, es la orden que se manda encima

Un falso positivo que se lee y se descarta cuesta un turno. Éste costó más porque **actué sobre él**:
mandé tres pulsos diciéndoles que estaban idle sin tomar su cola. A dos sesiones que habían hecho su
trabajo. Si una de ellas me hubiera creído en vez de medir, habría salido a rehacer lo hecho —
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]], esta vez disparado por un instrumento en vez de por
mi memoria. Lo que me salvó no fue mi control: **fue que los pares midieron y me contestaron**.

> Y esto es lo que hace peligroso al escalador: convierte «nadie contestó» en «ellos están en falta»,
> y eso se lee como un hallazgo, no como una hipótesis. Los minutos le dan autoridad a la flecha.

## Cómo aplicarlo

**Antes de reenviar lo que dice un escalador, contestá una pregunta que el escalador no hace: ¿cuál es
el disparador declarado de ese contrato, y lo cumplí yo?** Abrí el contrato, leé su disparador, y
medilo contra el mundo (`/healthz` vs `origin/main`, PR abierto, device libre). Si el disparador es
mío y no está cumplido, **la acción es ejecutarlo**, no pulsar a nadie: el contrato no está «sin
tomar», está **correctamente en espera**.

Control positivo de que estás leyéndolo bien: si el escalador nombra a **todas** las sesiones a la
vez, sospechá del emisor antes que de la flota. Tres sesiones en falta simultánea es menos probable
que una precondición compartida incumplida — y la precondición compartida casi siempre es del que
coordina. Es el mismo criterio que
[[el-fallo-que-se-mueve-acusa-al-recurso-compartido]], leído sobre sesiones en vez de sobre tests.

**Qué NO alcanza:** `ListAgents` + `SendMessage` despiertan a una sesión `idle`, y eso ya estaba
escrito en [[el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el]]. Pero despertar a una sesión
que esperaba bien no la destraba: vuelve a dormirse en el mismo disparador. **Lo que destraba es
cumplir el disparador.**
