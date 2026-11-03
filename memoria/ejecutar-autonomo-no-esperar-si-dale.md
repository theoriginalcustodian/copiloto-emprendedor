---
name: ejecutar-autonomo-no-esperar-si-dale
description: En operación AUTÓNOMA, un trabajo cuyo disparador ya se cumplió se EJECUTA — no se convierte en un peaje de aprobación humana ("¿le doy dale?"). Regla dura del operador (2026-07-23) tras perder ~400 min de ocio esperando un "sí" que él ya había dado al declarar el sprint autónomo.
metadata:
  type: feedback
---

**Caso raíz (2026-07-23):** el operador declaró el sprint **autónomo**. La eval Fable estaba en
memoria como "gated a *cuando cierre lo pendiente*". El pendiente **cerró ~4h antes**. En vez de
ejecutar —que es lo que el disparador auto-cumplido ordenaba— convertí ese trigger en una **pregunta
de aprobación** ("¿arranco? confirmame 3 cosas") y esperé. Resultado: **~400 min de ocio de las tres
sesiones** para que el operador dijera un "sí" que **ya había dado** al autorizar el modo autónomo.
Su palabra: *"no más 'si dale' — ejecutá autónomo"*.

## La distinción que fallé
- **Disparador auto-cumplido** (una condición objetiva que se vuelve verdadera sola: "cuando cierre el
  sprint", "cuando el PR mergee", "cuando el de-risk dé verde") → **EJECUTAR al cumplirse**. Nadie lo
  aprueba; ya está aprobado por haberse definido el disparador.
- **Decisión MAYOR genuina** (cambio de stack/scope/dirección, algo irreversible/destructivo, algo que
  afecta a otro humano) → esa sí se escala. La eval **report-only, ya especificada al detalle** (modelo,
  dimensiones, exclusiones, report-only, measure-first) **no era MAYOR**: era ejecución.
- El error fue tratar una **ejecución** como si fuera una **decisión**, y encima re-preguntar cosas que
  el operador **ya había fijado** ("confirmá el síntoma #1", "confirmá report-only") — eso es
  [[encabezado-tranquilizador-se-come-la-carga-util]] al revés: rehacer el ritual de aprobación sobre
  algo ya decidido.

## How to apply
1. **En modo autónomo, cuando un disparador definido se cumple → ACTUAR, no avisar-y-esperar.** El
   default de la duda es *ejecutar y reportar el resultado*, no *pedir permiso*. (Es la cara-acción de
   [[cero-tiempo-ocioso-tres-estados]]: el único no-trabajar válido es "terminé TODO y reporté", no
   "espero un sí para algo ya autorizado".)
2. **Antes de mandar "¿le doy dale?" preguntate:** ¿el operador ya autorizó esto (modo autónomo,
   disparador definido, spec cerrada)? Si sí → NO preguntar; ejecutar. Sólo escalá si es MAYOR de verdad
   o si apareció una incertidumbre nueva que la spec no cubre.
3. **Re-pedir confirmación de algo YA fijado es ruido, no prudencia.** Si la memoria dice "decisión
   FIJADA", esa decisión no se re-vota.
4. **El costo no es el mío: es el de pared de TODAS las sesiones.** Una espera falsa de planificación
   congela a backend y frontend también. Un "sí" evitable se paga ×N sesiones.

Hermana de [[atar-la-accion-a-un-momento-no-a-un-estado]] (engancharse a un momento que ocurre) y de
[[una-espera-sin-disparador-nombrable-es-paralisis]]: acá el disparador SÍ tenía nombre y SÍ se cumplió
— y aún así esperé. Peor que la parálisis sin disparador: parálisis **con** disparador cumplido.

## Refuerzo 2026-11-03 — 🫀 una sesión SIN HEARTBEAT trabaja bien y después SE APAGA SOLA

Este archivo trata de **no esperar** un «dale». El caso del 2026-11-03 es el escalón de abajo, y no se
arregla con disciplina porque **no es una decisión**: una sesión interactiva de Claude Code **termina
su turno y se queda `idle` indefinidamente**. No tiene bucle propio. Nada la vuelve a invocar salvo
que llegue un mensaje o dispare un cron.

Y los **crones viven en la sesión** (in-memory, mueren con ella; auto-expiran a 7 días). Se instalan
invocando la skill de monitoreo **del rol** (`/monitoreo`, `/monitoreo-backend`,
`/monitoreo-frontend1`, `/monitoreo-frontend2`). Si nadie la invoca: la sesión hace su trabajo, lo
reporta bien… **y se apaga hasta que alguien le escriba**.

**Medido:** las **4** sesiones del sprint idle entre **7 y 22 h**, con **38 fichas** pendientes y 4
contratos «sin tomar». El escalador los marcaba, y nadie los leía porque **no había nadie despierto
para leerlos**. El operador despertó a mano cuatro veces y su reclamo fue exacto: *«no entiendo por
qué tengo que estar arreándote como un trabajador holgazán cuando definimos que el sprint iba a ser
autónomo»*.

🔴 **Lo peor: planificación tampoco los tenía.** Es el motor que empuja a las otras tres, así que
el único heartbeat del sistema era el operador escribiendo. Un sistema «autónomo» cuyo único reloj
es la persona que lo mira no es autónomo: es manual con más pasos.

**Lo que engaña del síntoma — y por qué se diagnostica mal:** se ve **idéntico** a pereza o a falta de
contrato, y las dos lecturas son falsas. Los contratos estaban bajados, las fichas tenían DoD, y las
tres sesiones, al recibir un `SendMessage`, respondieron en segundos **y me refutaron con medición**
(una ficha ya TERMINADA, un PR ya MERGED, un sha ya ancestro, dos hipótesis mías con `path:línea`).
No estaban descansando: estaban **apagadas**. Y mientras diagnostiqué «falta de claridad» estuve
escribiendo más contratos — más instrucciones para nadie.

**El control, y es de dos tiempos:**

> 1. **Al arrancar: `CronList`.** «`No scheduled jobs`» = no tengo heartbeat. Invoco la skill de **mi**
>    rol y **vuelvo a correr `CronList`** — una skill invocada que no creó los jobs **no da ningún
>    síntoma** ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).
> 2. **Ante una sesión quieta: NO es un estado, son TRES.** Muerta (transcript viejo) · bloqueada
>    (disparador nombrable ajeno) · **viva, idle y sin trabajo empujado**. La tercera es la que los
>    instrumentos no ven, porque `ListAgents` la reporta `idle` igual que a una que acaba de
>    terminar, y el mtime del transcript **ni la ve** si corre en worktree
>    ([[una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd]]). Se resuelve
>    **empujándole trabajo por `SendMessage`**, no dejando un archivo en el buzón: el buzón
>    necesita alguien despierto que lo abra.

**Fix de raíz, no recordatorio:** `heartbeat_crones_recordatorio.mjs` en `SessionStart`
(HARNESS §1.1.quater) — dispara **una vez por sesión**, no-op fuera de este repo, y pide confirmar
con `CronList`. En cada turno sería un guard que grita en el caso normal, y ésos se desarman solos
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]).
