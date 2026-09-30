---
name: arreglar-una-comparacion-en-un-sentido-deja-el-opuesto-vivo
description: Cambiar != por < arregló la fecha adelantada y dejó vivo el caso de la atrasada, que además es indistinguible del caso legítimo.
metadata:
  type: feedback
---

Cuando un bug es de **comparación** —`!=` que debía ser `<`, un `>` que debía ser `>=`— el fix suele
arreglar el lado que dio síntoma y **dejar vivo el opuesto**. Y el opuesto no aparece en los tests,
porque nadie lo vio fallar.

**Caso, 2026-09-30 00:03.** `escaladores-buzon.sh`, función `edad_alta_min`: el piso de edad se decide
por la fecha del nombre del archivo.

```bash
if [[ "$fecha_archivo" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$fecha_archivo" < "$fecha_hoy" ]]; then
  echo 999999   # de un día anterior
```

El comentario documenta el fix del **2026-08-12**: con `!=`, los archivos nombrados en UTC
(`2026-08-13`) mientras `date` local daba `2026-08-12` caían en esa rama, y **todo `pedido_` nuevo
escalaba en el instante de nacer**. Se arregló con `<`, que es exactamente lo que la regla quiere decir.

**Pero `<` sólo protege contra la fecha ADELANTADA.** Escribí a las 00:03 del 30 dos documentos fechados
`2026-09-29` —mi jornada mental seguía siendo la de ayer— y el escalador reportó:

```
PEDIDO SIN RESPUESTA (999999min >= 30): 2026-09-29_pedido_... -> deudora: planificacion
```

Un `pedido_` de **tres minutos** con 999999 min. Renombrado a `2026-09-30_`, el dry-run pasó de
`EXIT_ESCALADOR=1` a `0` («nada que escalar»).

**Y acá está lo que hace la lección general:** el caso atrasado **no se puede arreglar con otro
operador**, porque una fecha pasada es *indistinguible* de un archivo realmente viejo. El lado
adelantado tenía una solución simple; el opuesto necesita un dato **distinto** (el `mtime`, que el propio
sidecar ya usa para el primer avistamiento) o al menos un mensaje que no disfrace un piso de medición:
`999999min` presentado como edad invita a creerlo, «de un día anterior (nombre: X, hoy: Y)» invita a
mirar el nombre.

**Segundo filo, y es el que me tocó a mí:** el que nombra el archivo no sabe que está escribiendo una
**medición**. La fecha del nombre parece etiqueta narrativa y es dato de control. Pasada la medianoche se
fecha con el día del reloj, aunque la jornada se sienta la de ayer — y esto aplica a las cuatro sesiones
a la vez, porque todas cruzan la medianoche trabajando.

**Cómo aplicarlo:** al arreglar una comparación, escribí el caso del **signo opuesto** y corrélo. Si el
opuesto resulta indistinguible de un caso legítimo, eso no es «no aplica»: es que hace falta un segundo
dato, y decirlo en el comentario evita que el próximo lector crea que el fix cerró las dos puntas. Ver
[[el-guard-falla-abierto-en-su-caso-de-activacion]] y
[[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]].
