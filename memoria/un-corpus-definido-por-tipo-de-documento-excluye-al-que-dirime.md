---
name: un-corpus-definido-por-tipo-de-documento-excluye-al-que-dirime
description: Definí el corpus como «los documentos de medición» y afirmé un retiro que ningún documento declara. El que resuelve una contradicción entre mediciones no es una medición: es un contrato. Filtrar por tipo garantiza no encontrarlo, y el denominador sale verde porque sólo puede discrepar dentro del universo que le diste
metadata:
  type: feedback
---

**El caso (2026-09-29, criterio 3).** Afirmé —en un dictamen, en un `cierre_` y en dos mensajes a pares—
que un documento de medición «está retirado», y lo usé para **bajarle la severidad a un defecto real**:
«el parser pierde sus 22 filas, pero el doc está retirado, así que hoy el daño es cero, el parser acierta
por accidente».

**No estaba retirado.** Lo cazó una sesión par que se negó a aplicar el retiro sin documento: *«excluirlo
sería aplicar un retiro que sólo vive en la memoria de una sesión — decime dónde está escrito»*. Medido:
0 hits de `retirad|superad|reemplaz|invalidad` en el propio documento, y en el contrato que lo sucede:

```
línea 3 : Reemplaza: el contrato de BL-Q3 v1 en todo lo que se refiere a *qué* se mide.
§6      : No invalidado: todo id CAMINO-UNICO. Los 19 siguen valiendo TAL COMO SE MIDIERON.
```

Lo que reemplaza el v2 es **el contrato**, no las mediciones — y de las mediciones nombra una por una las
que caen. El defecto pasó de «daño cero» a **daño activo**: 22 filas de ids que el contrato declara
vigentes. Mi conclusión no era optimista por descuido: **era falsa en la dirección que me convenía.**

## El mecanismo, que es lo reusable

Mi corpus eran «los 6 documentos de medición del 22/09», y el filtro era literal:
`f.startswith('2026-09-22_dato_frontend')`.

> **Un corpus definido por TIPO de documento excluye por construcción al documento que DIRIME.** El que
> resuelve una contradicción entre mediciones **no es una medición**: es un contrato, una decisión, un
> cierre. Un filtro por prefijo, carpeta o autor garantiza no encontrarlo.

Y el síntoma es el peor posible: **todos los controles salen verdes.** 6 de 6 documentos, denominador
horneado, positivo 3/3. Porque un denominador sólo puede discrepar **dentro del universo que le diste** —
es [[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]] un nivel más
arriba, y por eso fue el **quinto** error de universo del mismo día y el único que ningún control mío
podía cazar.

La cura no es otro control automático: es que **«¿quién dirime esto?» se conteste con un grep antes de
escribir el veredicto**, porque la respuesta nunca está en el corpus que elegiste. Y el grep es barato: el
documento que dirime **te nombra** — dice `Reemplaza:`, `Invalidado:`, `queda sin efecto`.

## El corolario, y por qué duele más siendo auditoría

La regla que apliqué al corpus —«un veredicto sin cita no vale»— **no la apliqué a mi propia premisa**.
Y el par que me corrigió no midió mejor: **pidió la cita que yo no tenía.** Ver
[[el-guard-que-caza-a-su-propio-autor]] y
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]].

Hermanas: [[el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario]] (el corpus del
mismo día) · [[un-gate-contra-referencia-externa-hereda-los-roles-el-que-compara-el-corpus-consigo-mismo-no]] ·
[[el-instrumento-respondio-sobre-otro-sujeto]] · [[vacio-no-es-hallazgo-correr-el-control]] ·
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].
