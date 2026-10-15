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

---

## Refuerzo 2026-10-14 — `TABLERORANCIO` **al revés**: el cierre vivía en el TABLERO y el hallazgo seguía abierto en el BUZÓN

La fila `TABLERORANCIO` nombró la falla en una dirección: *«el `cierre_` vive en el BUZÓN y el estado vive
en el TABLERO, y nadie mueve uno al otro»* — con el daño medido: una fila `pendiente` rancia **fabrica cola
ajena**. Hoy pagué **la dirección opuesta**, y no la había nombrado nadie.

Encontré 4 `hallazgo_` de auditoría dirigidos a mí en `abierto/`, de 7 días, **sin una sola marca de
acuse**. Leí eso como «cola propia sin resolver» y me puse a cerrarlos uno por uno, midiendo todo de nuevo.
Dos de ellos —`A4/LEGAL` y los `39 casts`— **ya estaban resueltos en `COLA-VIVA`**: `LEGALNOOPERA` ✅
cerrada el 13/10 (y con una medición mejor que la mía: `eas.json` no tiene perfil de distribución real, así
que no puede haber víctima), `MECLAVESRESTO`/`SMOKESTDIN`/`MECLAVESRUNTIME`/`MECLAVESCORE` ✅ cerradas.

**Y el daño no fue sólo el trabajo repetido:** `LEGALNOOPERA` había decidido, textual, que lo que quedaba
va *«dentro del ítem 9 sin inflarle la lista»* al operador. Yo le agregué un **ítem 11** al pedido — el
ítem que esa fila resolvió **no** abrir. Lo retiré 10 minutos después, pero si el operador lo lee antes,
el costo es suyo: contestar una binaria ya contestada.

**La asimetría que lo hace invisible:** cerrar una fila del tablero es un acto **local** —el renglón, el
enum, el estado— y no deja nada en el buzón. El `hallazgo_` que la originó no tiene quién lo cierre: su
emisor ya reportó, y el que cerró la fila no es su destinatario. Así que **la ausencia de acuse en el
buzón no es señal de nada**: no distingue «nadie lo atendió» de «lo atendió el tablero».

**La regla, que es la de esta entrada con un sujeto más:** antes de tomar un `hallazgo_`/`pedido_` viejo,
medí su estado **en el tablero**, no sólo en el buzón — `awk -F'|' '/^<ID> \|/ {n=split($0,a,"|"); print a[n]}' PLAN.md`
sobre el id, y un grep del id en `COLA-VIVA` si el hallazgo no nombra uno. Vale igual que *«medí estado y
dueño de cada id ANTES de citarlo»*: el registro que hay que mirar es **el que cierra**, y no siempre es
donde llegó el pedido.

**Lo que sí rescató el ciclo, para no leerlo como puro desperdicio:** los 4 estaban efectivamente sin
acuse, y los dos que no tenían fila —`WIPCOMPART` (resuelto, nunca archivado porque el janitor **no toca
obligaciones por diseño**) y el de ARCA— sólo salieron de `abierto/` porque alguien los miró. El trabajo
correcto por la razón imprecisa sigue siendo trabajo correcto; lo que hay que arreglar es la razón.

→ [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]] · [[un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar]] · [[lo-que-no-esta-en-la-tabla-de-hitos-no-existe]]
---

## 🔁 REFUERZO 2026-10-14 (b) — **dos** contratos rancios en diez minutos, con el tablero BIEN y la respuesta en mi propio `cierre_` de ese día

El refuerzo del 13/10 cerró con «para afirmar que algo falta, el único control es el CÓDIGO; el tablero
sirve para dueño y estado, nunca para afirmar ausencia». Hoy pagué el **caso simétrico**, y por eso la
regla necesita las dos mitades: **medí el código, no leí el tablero, y el tablero tenía razón.**

| contrato bajado | lo que medí | lo que el tablero decía |
|---|---|---|
| `A7 DRIVECERO` → backend | `catalog.py:67` (`_PRESENTATION["googledrive"]`) + `connect_path` (`:112`) ⇒ «la UI ofrece Drive sin acciones» | `PLAN.md` L301: **✅ CERRADA 2026-10-07**, PR #812, con el test citado |
| `A4 BL-O6 mobile` → frontend2 | `git grep aceptarLegal\|legal_aceptado` en `apps/mobile/**` ⇒ sólo mocks ⇒ «nadie registra la aceptación» | `PLAN.md` L310: **✅ CERRADA 2026-10-13**, y la decisión del operador es **v2 «Informar»**, no registrar |

Los dos salieron en el mismo turno; los dos los retracté en minutos, uno ya tomado a `en-curso/`.

## La causa única: medí un símbolo cuyo NOMBRE se parece al sujeto

No fue descuido de lectura: en los dos casos **el grep dio un resultado real** y el resultado era de
**otro sujeto**.

- `_PRESENTATION` dice cómo se **pinta** un servicio *cuando aparece*. Quién aparece lo decide
  `services.connectable_policy()` (`services/__init__.py:62`: sólo módulos con `TOOLS` no vacío),
  compuesta en `web.py:483-489`. El test que lo fija es literal: `test_catalog_route.py:125` →
  `assert "googledrive" not in keys`.
- El consumidor del estado legal en mobile no nombra el campo: va por `descripcionLegal()`
  (`packages/core/src/legal.ts:148`), consumida por `PantallaCuenta.tsx` **y** `AccountScreen.tsx`.

⇒ **La ausencia se mide por el SÍMBOLO QUE ENCAPSULA, no por el nombre del campo ni por el dict que se
le parece.** Y el agravante: la fila L310 **ya tenía escrita esa lección**, y la premisa vencida que
cita como ejemplo **es mía, del 06/10**. La repetí ocho días después sobre la misma fila.

## Lo peor no fue duplicar trabajo: fue pedir la rama que el operador había descartado

`A4` no estaba sólo hecho: mi contrato pedía **v1** (registrar/forzar aceptación) cuando la decisión
explícita del operador es **v2 «Informar»** («no se bloquea el uso de la app con
`legal_aceptado=false`: se informa el estado»), y el propio docstring del código lo declara. Un
contrato que duplica trabajo cuesta un turno; **uno que contradice una decisión MAYOR hace que una
sesión obediente implemente contra el operador** — y el PR saldría verde, porque los tests no saben
qué decidió el humano.

## Y la respuesta ya existía, escrita por mí, ese mismo día

En `cerrado/2026-10-14/` estaba mi propio `cierre_planificacion-a-auditoria_A4-LEGAL-…`, con una
rectificación al frente: *«la fila `LEGALNOOPERA` está ✅ CERRADA desde el 13/10 y ya contestó la
binaria: la beta cierra con "Informar"»*. Horas después bajé el contrato que la contradecía. Es
[[sesion-parada-la-respuesta-existe-pero-enterrada]] **con el autor y el lector en la misma sesión**:
el enterramiento no necesita dos sesiones, le alcanza un día largo y un buzón grande.

**Why:** «medir el código» y «leer el tablero» no son dos niveles de rigor donde el primero vuelva
opcional al segundo: **miden cosas distintas.** El código dice qué existe **hoy**; la fila dice qué se
**decidió** y quién lo cerró — y una decisión del operador no está en el código, está en la fila. Saltear
la fila por confiar en el grep deja afuera exactamente la clase de información que ningún grep tiene.

**How to apply (completa las de arriba):** (8) **ningún contrato sale sin leer la fila de su id
completa** —el último campo, donde vive el estado— *además* de medir el código: si los dos coinciden,
bajá; si difieren, **el que manda es el código para la ausencia y la fila para la decisión**, y el
contrato tiene que nombrar la diferencia; (9) antes de bajar un id, `grep` tu propio `cierre_`/`dato_`
**del día** por ese id: el emisor rancio puede ser vos hace tres horas; (10) cuando el grep del nombre
da «0 en fuente, sólo tests», **no concluyas ausencia**: buscá la función/el helper que lo encapsula
(`descripcionLegal`, `connectable_policy`) — el patrón se repitió en dos dominios distintos el mismo
día, así que no es casualidad de un archivo.
---

## 🔁 REFUERZO 2026-10-14 (c) — la premisa rancia era una **AUSENCIA**, y la escalé al operador sin grepear nada

El refuerzo (b) cerró con *«el que manda es el código para la ausencia y la fila para la decisión»*.
Hoy pagué el caso que ese consejo no cubre: **la afirmación de ausencia no venía del tablero ni de mi
grep — venía de una TABLA DE MEDICIÓN dentro de la ficha**, y las tablas de medición también vencen.

`SM-E3` trae en su cuerpo una tabla «dónde encaja cada una», medida *«contra `modules/` de los dos
fronts, no supuesto»*. Su fila del margen decía: **«⚠️ no existe módulo `trabajos` en ningún front ⇒ el
más alto: pantalla nueva, o bloque en `inteligencia` — a decidir»**. Sobre esa fila escalé al operador
que el margen era **MAYOR** (pantalla nueva). Medido hoy con `git grep` contra `origin/main`:
`TarjetaMargenTrabajo` **existe en los dos fronts** —
`apps/copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:151` y
`apps/mobile/.../GraficosInteligencia.tsx:163`, las dos montadas por `GraficosInteligencia`, con
`leerGraficoMargenTrabajo` ya cableado en core. La opción «bloque en `inteligencia`» que la tabla
dejaba *a decidir* **ya se había tomado de hecho**, y lo que faltaba no era una pantalla: era **pintar
el conteo de gastos imputados** — el trabajo que terminé en una tarde.

**La diferencia con (b), que es la que hace falta nombrar:** ahí el defecto fue *medir el código y no
leer la fila*. Acá **no medí nada**: heredé la medición de un tercero fechada, la leí como estado
presente y la convertí en una escalación. Una tabla con el sello «medido, no supuesto» **invita** a
eso: lleva adentro la palabra que desactiva la pregunta. Es
[[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]] aplicado a una
medición: el sello acredita **el día en que se midió**, nunca hoy.

**Y el costo específico de escalar una ausencia:** una escalación de trabajo ya hecho se retracta; una
escalación que dice «esto es MAYOR, no lo puedo decidir yo» **transfiere al operador una decisión que
no existe** y, peor, deja la ficha congelada mientras espera una respuesta que no destraba nada. Las
otras tres escalaciones que mandé el mismo día siguen siendo reales; la cuarta bajó la señal de las tres.

**How to apply (completa las de arriba):** (11) **toda afirmación de ausencia se re-mide antes de
citarse**, también —y sobre todo— cuando viene de una tabla que dice «medido»: una ausencia es la clase
de afirmación que el tiempo invierte sola, porque alguien implementa y nadie vuelve a la tabla;
(12) si la ficha ofrece opciones «a decidir», antes de escalar la decisión **medí si el código ya eligió
una**: en un repo con tres sesiones, la decisión de hecho llega antes que la decisión escrita.

## REFUERZO 2026-10-15 - el ESCALADOR reclama el contrato rancio, y convierte mi descuido en presion sobre un peer OCUPADO

Dos ciclos seguidos del vigia, dos `CONTRATO SIN TOMAR` (155min y 128min), los dos **mios**, los dos
contra sesiones que estaban trabajando. Y los dos **sin objeto**:

| contrato | lo que pedia | medido @ `a554d088` desde el pin |
|---|---|---|
| `los-6-P-son-TODOS-mobile` (a FE1+FE2) | implementar 6 elementos `P` | **4 de 6 ya cerradas** (`bi-refresh` `detalle` `entrada` `splash`); las 2 restantes con contrato mas fresco y otro dueno |
| `el-instrumento-de-60fps-EXISTE-1237` (a FE2) | medir `splash`/`entrada`/`detalle` hasta 51/54 | las 3 **CERRADA-EN-CODIGO**, y 51/54 es el numero exacto que mide `origin/main` hoy: **su propio DoD, cumplido** |

**Lo nuevo no es que un contrato quede rancio - eso ya esta medido tres veces mas arriba. Lo nuevo es
que el GUARD lo amplifica.** `escaladores-buzon.sh` mide *"nadie lo tomo"*, y ese predicado **no
distingue** dos estados opuestos:

- *nadie lo tomo y hace falta* -> alarma legitima, hay que destrabar
- *nadie lo tomo porque su objeto ya no existe* -> el reclamo es **ruido dirigido**, y encima
  genera un `urgente_` con nombre fijo que vuelve cada ciclo

Un contrato **no tiene fecha de vencimiento**, asi que su ranciedad no se degrada sola: se convierte
en presion recurrente sobre quien esta ocupado. FE2 estaba en **SM-F3 en device**, el recurso mas
escaso del sprint, y el gate le empujaba dos contratos hechos.

**La correccion, y es de dueno, no de instrumento:** el escalador **no puede** saber si el objeto se
movio - eso se mide con el instrumento canonico del dominio (aca `medir-mapeo-implementacion.py`
desde el pin), no con el mtime de un archivo. Entonces **la ranciedad es del EMISOR**: antes de
reclamar un contrato propio, medir sus filas; si el objeto se movio, el cierre correcto es
**cerrarlo citando donde se movio** - no reclamarlo, y tampoco borrarlo en silencio. Cerrar ademas
apaga el escalador por efecto (lo verifique: al ciclo siguiente ya no aparecia).

**Y el segundo contrato tenia mas veneno que el primero:** su §5 declaraba `soporte` "marcador
muerto, retiralo", y `(home)` "decision del operador (OAuth de Calendar)". **Las dos falsas** -
`soporte` es una `D` real del operador (A/B/C del dictado) y `(home)` nunca fue suya (su DoD pide que
el elemento exista y se vea; la autoridad esta en main, `apps/copiloto/mi_dia_web.py:12-13`). Un
contrato rancio **no se queda quieto**: sus afirmaciones laterales siguen citables y mandan trabajo
en la direccion equivocada. Por eso el cierre lleva la tabla de *que dijo mal*, no solo *ya esta
hecho*. Relacionado: [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]] y
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]].
