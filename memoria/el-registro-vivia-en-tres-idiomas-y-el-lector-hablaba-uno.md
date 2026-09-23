---
name: el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno
description: El backlog listaba 73 frentes abiertos y 51 ya estaban mergeados. Nadie fue descuidado: el trabajo se cerró citando ids de OTROS espacios (`K-*` de los contratos, `H-A3-*` de auditoría) que el backlog no puede grepear. Un registro que sólo entiende su propio espacio de nombres envejece sin dar señal.
metadata:
  type: feedback
---

# 🗂️🈳 El registro vivía en tres idiomas, y el lector hablaba uno

El 2026-09-23 barrí los **73 ids que el backlog de la beta marcaba abiertos** contra los 400 PR
mergeados del repo:

```
73 "abiertos" = 51 YA MERGEADOS + 5 parciales + 16 abiertos de verdad + 1 ambiguo
```

**El 70% de lo que el documento maestro llamaba pendiente ya estaba en `main`.** Y le había pasado
ese número al operador como «71 frentes abiertos que bloquean la beta»: no era un detalle, era el
diagnóstico del sprint al revés. El sprint estaba mucho más cerca de cerrar de lo que informé.

## La causa, que no es descuido

El mismo trabajo se identifica con ids de **tres espacios distintos**, y el backlog sólo puede
grepear el suyo:

| espacio | quién lo usa | ejemplo |
|---|---|---|
| `BL-*` | el backlog | `BL-J6` |
| `K-*` | los contratos de las juntas backend↔frontend | #542 cerró `K-04`, que **es** `BL-J6` |
| `H-A3-*` | los hallazgos de auditoría | #628 cerró `H-A3-8`, que **es** `BL-B1` |

Las mitades backend de **casi todas** las `BL-J` se mergearon citando sólo su `K-`. Cada PR estaba
perfectamente registrado **en su propio idioma**. El cierre existía, estaba escrito y era
verificable — simplemente **no era legible desde donde se preguntaba**.

Por eso no da síntoma: no hay un hueco donde mirar. El ítem sigue abierto, el link resuelve, ningún
gate se pone rojo, y el que lo lee concluye razonablemente que falta hacerlo.

## El corolario que más muerde: el sello lo pone el que empieza

Seis ítems arrastraban `[PENDIENTE_INTEGRACION]` **aunque su mitad backend se había mergeado el
mismo día**. El sello lo puso el PR de frontend al abrir la junta, y **nada lo retira cuando el otro
lado cierra**. Un estado escrito por uno de los dos lados de una costura sólo puede envejecer: el que
podría corregirlo no sabe que existe.

## Las preguntas que lo cazan

- **¿En cuántos espacios de nombres se identifica este trabajo?** Si son más de uno y ninguno
  puentea, el registro ya está envejeciendo aunque hoy se vea bien.
- **¿Quién retira este sello, y cómo se entera?** Si la respuesta es «el que lo puso, cuando se
  acuerde», el sello miente por diseño.
- **¿Contra qué mido «abierto»?** Contra el registro, o contra el sistema. Acá la respuesta correcta
  era `gh pr list --state merged`, no el documento maestro.

## Lo que hice, y lo que deliberadamente NO hice

Anoté en cada ítem los PR que lo cierran y tendí el puente explícito entre los tres espacios. **No
tildé un solo DoD**: eso exige verificar casilla por casilla, y tildar 51 ítems por conteo es
exactamente la aprobación ritual que este repo prohíbe. La anotación sirve para **no reimplementar**,
no para declarar cerrado — [[no-codificar-la-esperanza-principio-raiz]].

**Y el barrido se equivocó en un caso, del modo predecible:** dio `BL-B3` por abierto leyendo el
**título** de su PR («reabre H-A3-1») en vez del código; el guard existía. Es el mismo defecto que
[[el-nombre-es-una-hipotesis-sobre-el-contenido]], cometido por el instrumento que estaba corrigiendo
otro registro. Por eso el barrido pedía **cita de PR** para declarar cerrado: sin esa regla, habría
producido un registro nuevo igual de plausible y también equivocado.

Ver también [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]] y
[[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]] — la familia de «el registro no está atado
al hecho».
