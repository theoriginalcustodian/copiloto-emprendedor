---
name: el-contrato-que-manda-a-hacer-algo-ya-hecho
description: Un contrato que asigna trabajo ya cerrado es el mismo defecto que una fila que dice pendiente sobre trabajo mergeado, al reves - y cuesta un turno entero de la sesion que lo recibe, que ademas puede no atreverse a contradecirlo.
metadata:
  type: feedback
---

# 📋🔃 El contrato que manda a hacer algo YA HECHO

**2026-09-29.** Bajé la cola por sesión para las cuatro sesiones, con DoD binario por ítem. A FE2 le
asigné dos cosas y **las dos estaban mal**:

| lo que el contrato dijo | lo que el tablero decía, en la misma línea |
|---|---|
| «terminar `Q3R` (30 filas)» | `PLAN.md:170`: «**Lote B (FE2) 4/4 sub-tareas cerradas**; falta lote A (FE1)» |
| «`DOCANC` — corregir el audit del 16/09» | `PLAN.md:184`: «**Dueño: frontend1**» |

Cité los ids **sin medirlos contra el tablero** — el mismo día, y en el mismo contrato, en que bajé la
regla «cierre por EFECTO: ninguna fila cambia de estado por lo que alguien reporta».

## Es el defecto espejo del drift de tablero, y por eso no se ve

[[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]] y la fila que dice `pendiente` sobre trabajo
ya mergeado son el caso conocido: **el tablero miente hacia «falta»**. Este es el otro lado: **el
contrato miente hacia «falta» también**, pero la fuente no es el tablero sino yo, que escribí de
memoria. Los dos mandan trabajo hacia algo que ya existe.

La asimetría que lo hace peor: el drift de tablero lo caza un script (`plan-drift-check.sh`). El drift
del contrato **no lo caza nada**, porque el contrato es nuevo: no hay historia contra la que compararlo.
Su único control es medir cada id **antes** de escribirlo.

## Y el costo real no es el turno perdido

FE2 paró y preguntó — bien. Pero una sesión más obediente hubiera hecho las dos cosas: re-cerrado un
lote ya cerrado, y tocado un archivo de otra sesión en checkout compartido. **El contrato no sólo
desperdicia trabajo: autoriza una colisión.** Lo que lo evitó fue que la sesión midiera el tablero antes
de arrancar, no que el contrato estuviera bien.

Corolario que vale para toda cola que baje: **decir explícitamente que medir el tablero antes de
arrancar es parte del trabajo, y que contradecir la cola con evidencia es lo esperado.** Sin esa
licencia escrita, la sesión que obedece produce el daño y la que pregunta parece la lenta.

## El hallazgo de fondo: FE2 no tenía NINGUNA fila

Al medir las 13 filas abiertas del tablero con su dueño, salió que **todas eran de FE1, de backend o
mías**. FE2 no tenía ni una. Por eso el contrato le inventó trabajo: yo sabía que tenía que darle algo
y llené el hueco con los ids que tenía a mano. **El contrato no falló al copiar: falló al no medir que
no había nada que copiar.**

**Why:** porque una cola inventada se ve igual que una cola real — tiene ids, tiene DoD binario, tiene
formato válido. [[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]] dice lo mismo de los
artefactos generados: formato válido no es contenido correcto. Un contrato bien formateado con ids
equivocados pasa cualquier lint y no pasa la realidad.

**How to apply:** (1) antes de escribir un id en una cola, abrí su fila y leé **el estado y el dueño**,
no el título — son los dos últimos campos y son los que contradicen; (2) si al armar la cola de alguien
te encontrás buscando qué darle, pará: **medí cuántas filas abiertas tiene** antes de asignarle una, y
si son cero, decilo en vez de rellenar; (3) escribí en el contrato que medir el tablero antes de
arrancar es parte del trabajo — la sesión que obedece sin medir es la que produce el daño.


---

## 🔁 REFUERZO 2026-10-13 — el mismo defecto, pero escalado AL OPERADOR, y el tablero **no** era el control

Hoy cometí la versión cara: le mandé al operador un `pedido_` titulado **«UNA sola decisión traba 7 de
las 54 filas — y es tuya (MAYOR)»**, con las tres opciones A/B/C y mi recomendación. **El mecanismo ya
estaba implementado**, y era ≈ mi propia opción C: `useDictadoPorFuncion.ts` va por `POST /chat` con
`kind: 'dictado:<destino>'`, extrae el agente (una sola extracción, `dictado_destinos.py:43-53`) y la
pantalla abre su formulario con los campos ya cargados (`PantallaGastos.tsx:155-167` + sus 3 gemelas).
Ninguna de las 7 filas estaba trabada. Lo cazó **otra sesión**, no yo.

**Y acá está el delta con lo de arriba, que invalida mi propio «How to apply» #1:** el 29/09 el control
era *leer la fila del tablero*. Hoy **leí la fila** — decía `pendiente`, con su veredicto escrito — y la
fila **era la que mentía**. El mismo día, frontend1 midió 19 cláusulas del padrón una por una: **10
estaban rancias**. Un padrón donde la mitad de lo medido describe el código de hace dos semanas no es un
control: es la fuente del error.

⇒ **Para afirmar que algo falta, el único control es el CÓDIGO.** El tablero sirve para saber **dueño y
estado declarado**, nunca para afirmar ausencia. «La fila dice pendiente» no es evidencia de que falte;
es evidencia de que nadie la volvió a medir.

## Por qué escalar al humano lo convierte en el caso peor

Un contrato con un id ya hecho cuesta el turno de una sesión, que además puede contradecirlo. Un
`pedido_` al operador con una decisión ya implementada cuesta tres cosas más:

1. **Gasta el recurso más escaso** — es lo único que ninguna sesión puede reemplazar.
2. **Puede fabricar un rollback.** Si contesta **A** o **B** sobre algo que ya salió como **C**, su
   respuesta —legítima, él contestó lo que le preguntaron— manda a desarmar código que funciona. El
   daño no lo hace su decisión: lo hace mi menú obsoleto.
3. **Entierra lo que sí necesita respuesta.** Mi lista consolidada tenía 8 ítems reales; el noveno
   falso le baja la señal a los ocho.

Lo único que sobrevivió del pedido fue **una propiedad que yo le había vendido y no se cumplió**: mi C
prometía «todo queda en la conversación durable», y el dictado abre **sesión propia** y no toca el hilo,
a propósito, con un test que lo exige (`useDictadoPorFuncion.test.tsx:55`). Eso sí es pregunta — chica,
no bloqueante. **La parte válida de un pedido obsoleto no es el pedido: es el residuo que queda después
de medir.**

## Refuerzo 2 — un `pedido_` que viene con la acción ya decidida vuelve la respuesta un trámite

En el mismo turno, frontend1 me pidió fijar dónde cuelga `presentacion` y cerró con: *«cuando lo fije,
borro la rama sobrante (una línea + un test)»*. La respuesta ya existía (§D2) **y decía lo contrario**:
la tolerancia `?? datos.presentacion` **se queda**, y su test es la única cobertura de un camino que
todavía ningún emisor ejercita. Si hubiera ejecutado su propia frase, el PR sacaba tolerancia y test
**sin que nada se pusiera rojo**.

**Why:** quien escribe «cuando contestes, hago X» ya dejó de leer la respuesta como decisión y la lee
como permiso. Si la respuesta es «no hagas X», llega a alguien que no está esperando un **no**.

**How to apply (completa la de arriba):** (4) para afirmar que algo falta, **abrí el código**, no la
fila — la fila da dueño y estado declarado, nada más; (5) antes de escalar al humano, medí el mecanismo
que decís ausente y escribí el `path:línea` de su ausencia: si no podés escribirlo, no está medido;
(6) un pedido obsoleto **se retira con el mismo ruido con que se mandó** (bloque de retiro + archivarlo
+ una línea en la lista consolidada), porque un pedido muerto en `abierto/` sigue cobrando atención;
(7) si tu `pedido_` incluye la acción que vas a tomar al recibir respuesta, escribí también **qué harías
si la respuesta la prohíbe** — y leé la respuesta entera antes de ejecutar esa frase.

## Refuerzo 3 (2026-10-13) — **lo medí: 4 de 11 filas del tablero estaban rancias**, y un estado rancio FABRICA cola ajena

Los refuerzos de arriba tratan el caso de **una** fila. Hoy barrí el tablero entero por primera vez y
la proporción es el hallazgo: de **11** filas no cerradas de `PLAN.md` (COLA-VIVA), **4** tenían el
trabajo **hecho**:

| fila | estado que decía | lo que medí |
|---|---|---|
| `CRASHFRIO` | `pendiente` | frontend2 la cerró con DoD **4/4** y evidencia de device (0 de 60 en frío, con control positivo de la receta) |
| `TERCEROSINOBSERVADOS` | `pendiente` | backend la cerró el **10-07** y lo reportó en un `dato_` que nadie recogió |
| `PROTO4DEPS` | `pendiente` | el commit se llama literalmente `feat(proto4deps): …` y está en `main` |
| `DETALLEKV` | `pendiente` | los **dos** lados mergeados; falta sólo el deploy |

**El daño no es cosmético, y es la causa raíz de esta entrada:** una fila `pendiente` con dueño es lo
que `cola-check.sh`, el escalador del buzón y cualquier barrido «¿qué le queda a X?» leen como
**trabajo vivo**. Así es como bajé contratos de trabajo ya hecho. Y al revés: backend declaró **ocio**
el mismo día teniendo 3 filas suyas en el tablero — dos rancias y la tercera un deploy sin correr. El
tablero rancio miente **en los dos sentidos a la vez**: inventa trabajo que no existe y tapa el que sí.

**La causa es estructural, no desprolijidad.** El `cierre_` vive en el **buzón** y el estado vive en el
**tablero**. El que cierra no es dueño del tablero (nadie edita el archivo de otra sesión) y el dueño
del tablero no mira 2.947 archivos del buzón. Nadie es dueño de **mover uno al otro**, y eso no se
arregla con disciplina: se arregla con un instrumento. Misma forma que
[[un-disparador-cumplido-no-avisa-a-nadie]] y que
[[el-artefacto-que-genera-el-instrumento-no-tiene-dueno]].

**El barrido que los cazó**, por si hay que repetirlo a mano (está anotado como `TABLERORANCIO` en
`PLAN.md`, congelado por `CONGELAINSTR`): por cada fila con id en MAYÚSCULAS cuyo estado no empiece en
✅/❌, buscar `*_cierre_*<ID>*` y `*_avance_*<ID>*` en `abierto/`+`en-curso/`+`cerrado/`. Cazó los 4 en
una corrida. **Con su control positivo**, que acá es obligatorio: imprimir cuántos archivos barrió
(2.947) — si da 0, el `walk` está ciego y «ninguna fila rancia» es exactamente lo que se ve
([[instrumento-que-no-mira-nunca-falla]]).

**Y el cierre ajeno se verifica por efecto, no se cita.** Para las 4 fui a `origin/main`:
`git cat-file -e` del archivo, `merge-base --is-ancestor` del commit, y el símbolo grepeado. En
`TERCEROSINOBSERVADOS` mi propio grep de «red o credenciales» dio **1 hit** y lo fui a ver: era una
línea del **docstring** que enumera lo que el test *no* cubre, no código — el control que **cita** el
riesgo se parece al riesgo ([[el-guard-se-satisface-con-su-propio-comentario]]).
