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
