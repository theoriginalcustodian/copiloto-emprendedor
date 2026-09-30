---
name: el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario
description: Un falso verde MEDIDO, no hipotético: el parser lee COHERENTE de un barrido y VOCABULARIO_DESCONOCIDO de la re-medición que lo bajó, así que el único veredicto legible es el superado. Hacen falta DOS defectos que por separado no hacen nada — sucesión no declarada y vocabulario que no admite el estado corrector
metadata:
  type: feedback
---

**El caso (2026-09-29, `contar-veredictos.py` sobre el corpus del 22/09).** Dos documentos del mismo
autor, los dos declarados como mediciones válidas. Un barrido de 02:11 le da `COHERENTE` a `cuenta` y
`detalle`; una re-medición posterior los baja a `REQUIERE_TRIAGE` con diferencias concretas («Título
"Cuenta" vs "Mi cuenta", falta el link "‹ Ajustes"»). Medido importando el parser como módulo:

```
barrido (02:11)        cuenta·único   -> ['COHERENTE']
re-medida (posterior)  cuenta·único   -> ['VOCABULARIO_DESCONOCIDO']
```

**El único veredicto legible es el que ya fue superado.** La corrección está escrita, es del mismo
autor, vive en un documento que el instrumento sí cuenta — y es muda.

## Por qué hacen falta DOS defectos, y por eso nadie lo vio

| defecto | qué hace solo | por qué solo no alcanza |
|---|---|---|
| la **sucesión** entre documentos no se declara en ninguno | deja vivo el veredicto viejo | si el nuevo fuera legible, al menos habría **conflicto visible** y alguien lo dirime |
| el **vocabulario cerrado** no admite el estado con que se corrige | enmudece el veredicto nuevo | si hubiera marca de sucesión, el viejo quedaría retirado igual |

El producto de los dos es un `COHERENTE` **vigente, legible, contado y superado hace una semana**. Es
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] con el agujero ya cobrado: **buscar el falso
verde en las filas era buscarlo en el lugar equivocado — estaba adentro del instrumento.**

Y el vocabulario cerrado **es la decisión correcta** (su propio código lo argumenta: «visible y MAL es
peor que un hueco», y medido no produce hueco). El defecto no es el parser: es que el **contrato** tiene
7 tokens y ninguno cubre un estado que dos autores usan en 6 archivos, **con la grafía partida 3 y 3**
(`REQUIRES_TRIAGE` / `REQUIERE_TRIAGE`). Un parser que elija una grafía pierde las filas del otro autor
sin dar señal. La pregunta que lo caza: **¿con qué token se corrige un veredicto, y ese token está en el
vocabulario que cuenta los veredictos?**

## El canario que lo aisló, y que el corpus regaló

Dos documentos del corpus dicen **lo mismo sobre los mismos 7 ids** y sólo uno es legible: uno tiene
tablas de 3 columnas (9 ids vistos), el otro de 2 (**0 ids vistos, 7 filas COHERENTE, 7 backticks**).
Replicado sintético, la misma fila cambiando sólo el ancho:

```
3 columnas -> ['card']      2 columnas -> []      sin backticks -> []
control positivo: `factura` a 3 columnas -> ['factura']
```

**Un documento con veredictos legítimos desaparece sin dejar hueco** — no llega a candidato, así que el
guard de «documentos sin clasificar», que existe y funciona, tampoco lo ve.

⚠️ **Y el caso visible salió bien por accidente**, que es lo que lo dejó vivir: el documento invisible
por falta de backticks **estaba retirado**, así que no contarlo era el resultado correcto. Una medición
**vigente** escrita igual desaparece del mismo modo y nadie lo nota. Antes de celebrar que un gate dio
el resultado deseado: **¿lo dio por su mecanismo, o su mecanismo está roto y el caso coincidió?**

## La asimetría entre los dos tipos de control, que es lo más reusable

Cuatro veces en un día dije una cifra mal sobre este corpus (8 → 5 → 0 → 2) y **ninguna falló por
razonamiento: todas por el universo**. Las dos primeras, leyendo 2 de 6 documentos elegidos **por el
nombre del archivo**. Lo que las cazó no fue leer con más cuidado: fue un `assert` que decía «se
esperaban 2 documentos» y encontró 5.

> **Un control de DENOMINADOR mal calibrado sirve igual; un control POSITIVO mal calibrado te deja
> pasar.** El del denominador trabaja discrepando, así que un número esperado que sea una corazonada
> frena bien: el mío exigía ≥30 archivos del proto porque conté 43 `.html` cuando los que importaban
> eran 14, y **frenó por el motivo correcto de todos modos**. El positivo trabaja confirmando: mal
> calibrado da verde y **aumenta** la confianza en la medición cuyo defecto no puede ver.

Por eso el denominador va **horneado en el instrumento** («N de N examinados»), no como paso de
revisión: un paso que hay que acordarse de dar, no se da. Complemento directo de
[[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]] (planificación,
mismo día) y de [[instrumento-que-no-mira-nunca-falla]].

## El falso cero por la FORMA de la celda, tercera variante del día

La tercera cifra (el `0`) salió de un cruce de 10 ids × 5 documentos cuyo patrón `| \`id\` |` no
matcheaba **porque la primera columna no es el id**: es `` `detalle` (Mi día, tarjeta expandida) ``,
`` `card` (gasto) ``, `` `afip` (Facturación ARCA) ``. **Falso cero con la fila delante de los ojos.**
Tercera forma distinta el mismo día —backticks, nombre-de-archivo, paréntesis-de-sufijo— y las tres con
la misma cura: [[vacio-no-es-hallazgo-correr-el-control]] con un positivo que el propio corpus
garantice. El regex del parser lo manejaba bien; el bug era mi grep.

Hermanas: [[un-parser-que-pierde-veredictos-silencia-los-conflictos]] ·
[[el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron]] (quinta cara) ·
[[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]] ·
[[el-guard-que-caza-a-su-propio-autor]] (el mismo parser abortó por *mi* documento sin clasificar).
