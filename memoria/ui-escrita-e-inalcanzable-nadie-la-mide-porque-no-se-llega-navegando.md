---
name: ui-escrita-e-inalcanzable-nadie-la-mide-porque-no-se-llega-navegando
description: Código de UI vivo y sin entrada — ninguna auditoría de pantallas lo encuentra, y aparece sin medir el día que alguien cablea el prop
metadata:
  type: project
---

Hay UI **escrita, completa y sin ninguna entrada**. No es código muerto (se renderizaría perfecto) ni
un desvío de fidelidad (nadie lo vio nunca). Es una pantalla que existe y a la que **no se llega
navegando**, así que **ninguna auditoría de pantallas la encuentra**: el barrido entra por donde entra
el usuario, y ahí no está.

**Dos casos medidos el 2026-09-28**, que es lo que la volvió una clase y no una anécdota:

1. **`/midia`** — ruta declarada (`app/midia.tsx:8`, `_layout.tsx:150`) **sin un solo caller en el
   código**. Sólo se alcanza por deep link (`copiloto://`, `app.json:5`). Y no es la misma UI que la
   portada: la portada tiene fecha y avatar (`PantallaMiDia.tsx:517,521`), `/midia` es un glass
   titulado «Mi día» **sin** fecha (`:496-501`). Dos UIs para un id, una inalcanzable.
2. **`presupuestoIdInicial`** — el prop está escrito y **ningún shell lo pasa**
   (`PresupuestosScreen.tsx:62,139-147`). Es una cara latente que aparece sola el día que alguien
   cablee el prop.

**Por qué muerde:** el día que se cablea, esa pantalla entra a producción **sin haber sido medida
nunca**. No hubo regresión —nunca estuvo bien ni mal— y por eso ningún gate de fidelidad la puede
haber cubierto. El riesgo no está en el código: está en que **su primera medición va a ser un usuario**.

**Cómo se caza** (no se caza navegando, hay que preguntar al revés): por cada pantalla/ruta/prop de
entrada, **grepear quién la MONTA o la PASA**, no quién la declara. Cero callers ⇒ cara latente. Es la
misma inversión que [[la-costura-leia-un-campo-que-nadie-escribe]]: preguntar quién **escribe**, no
quién lee.

**Dónde va:** al backlog como fila propia con dueño, **nunca a la matriz de fidelidad** — no tiene
contraparte en el prototipo y mezclarla convierte un hallazgo estructural en un desvío que alguien va
a intentar «corregir» dibujándolo.

Relacionado: [[el-instrumento-que-no-mira-nunca-falla]] · [[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]]
