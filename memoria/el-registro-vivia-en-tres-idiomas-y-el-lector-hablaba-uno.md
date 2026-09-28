---
name: el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno
description: El backlog listaba 73 frentes abiertos y 51 ya estaban mergeados. Nadie fue descuidado: el trabajo se cerró citando ids de OTROS espacios (`K-*` de los contratos, `H-A3-*` de auditoría) que el backlog no puede grepear. Un registro que sólo entiende su propio espacio de nombres envejece sin dar señal.
metadata:
  type: feedback
---

# 🗂️🈳 El registro vivía en cuatro idiomas, y el lector hablaba uno

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

## El cuarto idioma: el acta (y por qué el conteo bajó tres veces)

**Horas después apareció un cuarto registro, y volvió a pasar lo mismo.** De los 15 frentes que
sobrevivían al barrido, **11 tenían una decisión firmada en el acta del 21/09** que los cerraba, los
difería a Cierre B o los sacaba de la beta. El acta **se declara el cierre de dos de ellos en su
primer renglón** — «Cierra: `BL-P1` y `BL-P3`». El backlog los listaba abiertos igual.

La secuencia completa de un mismo día: **71 → 16 → 4**. Tres correcciones a la baja, y las tres
fueron **el mismo defecto**, no tres errores distintos:

| Idioma del cierre | Ejemplo | Quién lo lee |
|---|---|---|
| Pull request | `#678` | GitHub |
| Namespace de junta / auditoría | `K-07`, `H-A4-3` | el buzón, la auditoría |
| **Acta de decisiones** | `DEC-8`, `DEC-12` | el operador |
| Backlog | `BL-X9` | el backlog |

Cuatro registros, todos **correctos por separado**, y **nada los compara**. Ahí está el punto: una
desincronización en la que ningún documento contradice a otro **no puede producir un rojo**. No hay
gate que falle porque el gate compara código con código, no registro con registro.

**Y la deriva tiene dirección:** las tres correcciones bajaron el conteo. Un registro que sólo sabe
leer su propio idioma **siempre sobreestima lo pendiente**, nunca lo subestima — porque puede perder
avisos de cierre, pero no puede inventar trabajo. Un backlog que crece sin que nadie cierre nada no
es señal de atraso: es señal de que **el cierre se está escribiendo en otro lado**.

## El caso que muestra el costo real

`BL-O6` (legal propio) estaba en la fila del acta que dice «no se enciende todavía: backups, legal
propio, horario de soporte → Cierre B». **Se implementó y se mergeó igual.** El backlog lo mostraba
abierto, que es exactamente el defecto de arriba.

Y el daño no fue trabajo desperdiciado — fue peor: **se construyó lo que la decisión había diferido
precisamente por no estar listo legalmente**, y el texto salió sin una sola palabra de descargo
(medido: 0 ocurrencias de «abogad», «no constituye», «asesor», «orientativo»). El diferimiento
existía para cubrir ese riesgo; saltearlo lo materializó.

**El registro desincronizado no cuesta tiempo. Cuesta las decisiones que el diferimiento protegía.**
Ver [[el-nombre-es-una-hipotesis-sobre-el-contenido]] y [[desplegado-no-significa-con-clientes]].


## El quinto idioma, y el que enseña algo nuevo: **el mismo lote registra en DOS FORMAS y el contador lee una** (2026-09-28)

FE1 reportó **12** DESVÍO y mi acta decía **11**, en la **misma unidad** (mediciones). Cuando dos
mediciones de la misma unidad no coinciden, una está mal — y acá era la del instrumento.

`scripts/evidencia/contar-veredictos.py` reconocía dos formas de registro: el campo `veredicto: X` y la
última celda de una fila de tabla. El lote B usa una **tercera**, en el mismo documento: la medición
escrita en un **bullet de prosa**.

```
- **`gastos`** — CAMINO-ÚNICO confirmado … Veredicto sin cambios (sólo vocabulario): **DESVÍO**
```

Entre «Veredicto» y los dos puntos hay 31 caracteres, así que no entraba por el patrón de campo; y la
línea no empieza con `|`, así que tampoco por el de fila. **No daba HUECO: desaparecía.** Con `gastos`
se perdían también `ingresos` y `presu`, así que el otro número estaba mal igual: COHERENTE era 11, no
10. Ninguno de los dos errores dio síntoma.

### Lo nuevo, y es sobre el CONTROL, no sobre el patrón

El instrumento tenía un control positivo horneado — «lote A ≥ 15 bloques, lote B ≥ 10 filas, si alguno
da 0 el formato cambió y el conteo NO se lee» — y **pasó**. Tenía que pasar: las filas estaban ahí.

> **Un control positivo que verifica que el formato que el instrumento SÍ mira sigue existiendo no dice
> absolutamente nada sobre un segundo formato que no mira.** Confirma el brazo que ya tengo, y por eso
> se siente como cobertura: lo que no puede hacer es descubrir un brazo que falta.

**La pregunta que lo caza, y es un cambio de sujeto:** no «¿cuántos veredictos leí?» sino **«¿cuántos
de los `id` que EXISTEN rindieron algún veredicto?»**. Contar veredictos sólo encuentra los que ya sé
leer — el universo lo define el lector. Contar **sujetos** lo define el dato, y ahí el que falta
aparece como ausencia. Es la misma inversión que [[instrumento-que-no-mira-nunca-falla]] y
[[vacio-no-es-hallazgo-correr-el-control]], aplicada al conteo.

### Y la señal social, que llegó antes que la técnica

**Dos sesiones reportando números distintos en la misma unidad es un instrumento roto hasta que se
demuestre lo contrario, y el sospechoso es el automatizado.** Mi primer reflejo fue pedirle a FE1 que
cruzara cuál fila le sobraba — o sea, mandar a la persona a auditar su lectura para defender a mi
script. FE1 había leído el documento; yo había leído el documento **a través de** un parser.

Fix de raíz (`18b34724`): tercer brazo `bullet`, acotado a líneas que ya son medición para no cazar
prosa suelta, + un control que **aborta** si hay bullets de identidad y ninguno rinde veredicto. Ese
control nació dando un falso ROJO contra un brazo sano — desempaquetaba una lista de dicts como
tuplas, leía `"forma"` (la clave) en vez del valor y daba 0 siempre
([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).
