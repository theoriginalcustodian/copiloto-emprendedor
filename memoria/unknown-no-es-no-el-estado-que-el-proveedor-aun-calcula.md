---
name: unknown-no-es-no-el-estado-que-el-proveedor-aun-calcula
description: Consultar un estado que el proveedor todavía está calculando devuelve un valor que PARECE dato — `mergeStateStatus: UNKNOWN` + `auto:false` se leyó como "el auto-merge no se activó", cuando significaba "todavía no sé".
metadata:
  type: feedback
---

**LEER al consultar el estado de algo recién disparado** (merge de GitHub, deploy, migración, job
encolado, DNS, índice recién creado).

2026-07-28. Tras `gh pr merge 154 --merge --auto`, consulté el estado y obtuve:

```json
{"auto": false, "mergeStateStatus": "UNKNOWN"}
```

Lo reporté como *"el auto-merge no se activó en este repo"*. **Era falso.** El auto-merge funcionó: el
CI terminó `success` a las 23:54:16 y el merge ocurrió a las 23:54:30 — **14 segundos después**, que
es su latencia típica. El `false` que leí no era el estado final: era el estado **mientras GitHub
todavía calculaba**, señalado por el `UNKNOWN` que estaba **al lado** y que ignoré.

**Por qué engaña.** `UNKNOWN` no llega como error ni como `null`: llega como un valor más del mismo
objeto, con la misma forma que un dato real. Y el campo que me importaba (`auto`) traía un `false`
perfectamente tipado. Nada en la respuesta grita "esto es provisorio" — hay que **saber leer el campo
que lo dice**. Es la trampa de [[el-mensaje-niega-el-efecto-que-ya-ocurrio]] movida al eje del tiempo:
allá la envoltura mentía sobre el efecto, acá el reloj miente sobre el estado.

**La regla:** ante un estado recién disparado, **antes de interpretar el valor, buscar el campo que
declara si el valor está listo** (`mergeStateStatus`, `status`, `phase`, `ready`, `state`). Si dice
`UNKNOWN` / `PENDING` / `calculating`, la respuesta correcta no es *"no"*, es **"todavía no sé"** — y
lo que corresponde es re-consultar, no concluir.

**Y el control que lo cierra: preguntarle al reloj, no al campo.** Lo que resolvió el caso no fue
volver a consultar el estado, sino comparar dos timestamps —fin del CI y momento del merge— contra el
timeline. El estado consultado *durante* la transición es opinión; los timestamps *después* son hecho.

Prima de [[medicion-de-estado-volatil-vence]]: aquella es una medición **correcta que envejece**; esta
es una medición **tomada antes de que hubiera algo que medir**. Las dos producen un número que se ve
sano y no lo es.
