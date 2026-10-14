---
name: dato-degenerado-imita-ausencia-del-mecanismo
description: Un período con UNA sola categoría hizo que el desglose por categorías pareciera inexistente; el render llevaba 2 meses en el código
metadata:
  type: feedback
---

# 📉🫥 La salida DEGENERADA del dato se leyó como AUSENCIA del mecanismo

**GASTOSCATEG estuvo 15 días escalada al operador como «capacidad de producto faltante» — y la
capacidad existía desde hacía dos meses.**

Medido el 2026-10-14 (planificación, verificando por su cuenta y no citando el reporte de FE2):

- `apps/copiloto-web/src/modules/gastos/ResumenMes.tsx:47` emite `gastos-resumen-barra-<cat>`, y
  `GastosScreen.tsx:232` lo monta.
- **Ya lo emitía en `9e344bdf`**, el sha exacto de la medición que lo declaró ausente
  (`git show 9e344bdf:…/ResumenMes.tsx | grep gastos-resumen-barra` ⇒ línea 47).
- El componente entró el **2026-08-04** (`0dba3bef`, `#237`). Llevaba **~2 meses** en el código.

**El instrumento era correcto y el dato también.** El PWA servido a 390×844 con el service worker
desregistrado es la medición buena; `GET /gastos/resumen` devolvía lo que realmente había. Lo que
falló fue el **paso de inferencia**: octubre del usuario canónico tiene **todos** los gastos en la
categoría `otros`, así que `por_categoria` devuelve **una sola entrada** y la tarjeta pinta **una**
barra. Una barra se leyó como **ninguna**, y «ninguna barra» se leyó como «el desglose no existe».

**Por qué este error no se siente como un error:** la salida degenerada es *indistinguible a simple
vista* de la ausencia del mecanismo. Con N=1 categoría, un render que agrupa por categoría y un
render que no agrupa **producen la misma pantalla**. No hay nada en la observación que delate la
diferencia — por eso el veredicto se escribió con confianza, sobrevivió una re-lectura y llegó a
escalarse al operador como decisión de producto.

**La pregunta que lo habría cazado**, y que hay que hacerse antes de reportar una ausencia:

> *¿Cómo se vería esta pantalla si el mecanismo SÍ existiera y el dato fuera degenerado (0 ó 1
> elemento)?* Si la respuesta es «exactamente igual», **no medí el mecanismo: medí el dato.**

**Qué hacer en su lugar — una de las dos, antes de declarar ausente nada:**

1. **Buscar el mecanismo en el código**, no sólo en la pantalla: un `grep` del testID o del nombre
   del componente cuesta un comando y responde la pregunta de verdad. La ausencia de una capacidad
   se afirma contra el código; la pantalla sólo muestra una ejecución con un dato.
2. **Ejercitar el caso NO degenerado**: si no hay dato real con ≥2 elementos, mutar la respuesta o
   montar el componente con un fixture de ≥3. Si no se puede fabricar el caso que distingue, el
   veredicto correcto no es «no existe» sino **«no medible con este dato»**.

**Consecuencia de segundo orden, que es la que más costó:** el defecto real quedó **tapado** por el
falso. Lo que sí falta es que **nada fija el mecanismo que ya existe** — el único caso que cubre
`GastosScreen.test.tsx` es `porCategoria: []`, o sea justamente el camino en que las barras **no se
pintan**. El orden descendente, la normalización sobre la suma real y el caso de ≥2 categorías no
están fijados por ningún test, así que el render se puede romper sin que ninguna suite se ponga
roja. Quince días de escalado se gastaron en la pregunta equivocada.

**Lo que sí salió bien y hay que repetir:** FE2 **volvió a medir antes de escribir una línea de
código** cuando le bajaron la orden de implementar, y refutó la premisa de su propia fila. El costo
fue un comando; el costo de no hacerlo habría sido implementar un desglose que ya existía, encima
del que existía.

Primo de [[supuesto-cuya-falla-parece-un-estado-legitimo]] (allá la falla parece un estado válido;
acá el estado válido con dato degenerado **imita** la falla) y de
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]]. Ficha: `SM-D8 · GASTOSCATEG`.
