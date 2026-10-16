---
name: el-instrumento-tambien-CONDENA-no-solo-absuelve
description: Un instrumento roto no sólo da falsos verdes — también da falsos ROJOS, y ese error se siente como rigor
metadata:
  type: feedback
---

**Un instrumento mal hecho puede equivocarse en las DOS direcciones sobre la misma pregunta — y el
falso rojo es más difícil de cazar que el falso verde, porque se siente como rigor.**

**El caso (2026-07-29, retest del modo automático).** Un script medía si el copiloto sigue afirmando
acciones que no ejecutó, comparando el texto contra los `execute_tool` del history de Temporal. Tres
versiones, tres veredictos, sobre exactamente la misma realidad:

| | Dijo | Realidad |
|---|---|---|
| v1 | ✅ *"0/3, la cura sostiene"* | Las 3 rondas reventaron con `KeyError: 'text'` (el campo es `reply_text`) y el `except` las contaba como no-mentira → **no midió nada** |
| v2 | 🔴 *"1/3 mentiras"* | El contador buscaba `.endswith("ActivityTaskCompleted")`; el `eventType` real es `EVENT_TYPE_ACTIVITY_TASK_COMPLETED` → **daba 0 siempre** → toda afirmación parecía mentira |
| v3 | ✅ *"0/10"* | Contador validado: 2 `execute_tool` por sesión, filtrado por nombre de activity |

Con v1 se levantaba un flag de producto a ciegas. Con **v2 se dejaba puesto un flag que bloquea una
feature, y se declaraba fallida una cura que funciona** — durante meses, con toda la apariencia de
estar siendo prudente.

**Por qué el falso rojo es el más peligroso de los dos.** Un falso verde choca tarde o temprano con la
realidad: el bug aparece, el usuario se queja, algo se rompe. **Un falso rojo nunca choca con nada** —
la feature queda apagada, nadie la usa, no hay síntoma. Y encima se lleva bien con la propia
disciplina: *"lo mantengo bloqueado porque no tengo evidencia"* suena exactamente igual siendo
correcto que siendo el producto de un contador roto. [[instrumentos-que-confirman-en-vez-de-verificar]]
cubre el verde falso; esta cubre el rojo falso, que no tiene quien lo denuncie.

**El control, y es uno solo para las dos direcciones:** antes de creerle un veredicto a un
instrumento, preguntarle **qué mediría si la respuesta fuera la contraria**. Concreto:

- ¿Este contador **alguna vez cuenta**? Correrlo contra un caso donde el valor conocido **no** es cero.
- ¿Cuántas unidades **miró**, aparte de si pasó? Una corrida que revienta **no es evidencia de nada**:
  tiene que invalidar el veredicto entero, no contarse como "sin problema"
  ([[instrumento-que-no-mira-nunca-falla]]).
- ¿El nombre que estoy buscando **existe** en el dato real? El `eventType` no era el que yo suponía —
  y suponerlo por analogía es el mismo error que [[vacio-no-es-hallazgo-correr-el-control]] nombra.

**El arreglo va en el script, no en la cabeza de nadie.** En este caso quedaron horneados: una ronda
que revienta hace `return 2` (veredicto **inválido**, no "aprobado"), y el contador filtra por el
nombre exacto de la activity. La versión que te engañó no se olvida sola: si el arreglo vive en tu
memoria y no en el código, la v4 vuelve a mentir.

---

## El recorte del campo de visión no te hace PERDER el hallazgo — te hace SOBREESTIMARLO (2026-09-29)

Los dos casos de arriba son contadores rotos. Este es otro mecanismo con el mismo falso rojo: el
instrumento mide bien **lo que ve**, y lo que exculpa vive **afuera del recorte**.

**El caso.** Barriendo los comentarios del prototipo Odobi, estuve a punto de entregar un hallazgo
🔴 ALTA: «el proto afirma cumplir WCAG 2.5.1 con un checkbox que no existe». Verificado: el checkbox
no existe (`grep -c 'type="checkbox"'` = 0). Y el hallazgo era **falso**, porque la alternativa de un
solo puntero sí existe y está cableada — es `.borrar`, con markup y handler.

Dos recortes distintos, la misma dirección del error:

| recorte | qué devolvió | dónde estaba la exculpación |
|---|---|---|
| `sed -n '1425,1429p'` sobre un comentario de **7** líneas | las 5 primeras, que se leen como un texto completo | la línea **6**: «la alternativa de un solo puntero que exige WCAG 2.5.1 pasa a ser **"Borrar" dentro de la tarjeta expandida**» |
| el **rango** `1951‑3899` de un barrido partido en dos | el hallazgo correcto en el hecho (`:3852` nombra un checkbox inexistente) y **excesivo en la conclusión** | `:1427`, en el **otro** rango — que dice a dónde se mudó el mecanismo. El barrido que sí lo tenía lo clasificó **CONSISTENTE** |

Las dos mitades acertaron por separado. **El sentido sólo aparece en el par**, y ningún barrido tenía
el par. El hallazgo caminó 🔴 ALTA → 🟠 MEDIA → 🟡 BAJA, y cada paso salió de leer *más del archivo
real*, no de pensarlo mejor.

**Por qué este falso rojo es especialmente convincente:** el grep que lo sostiene es **verdadero**.
No hay contador roto que auditar ni nombre mal escrito que descubrir — «no existe ningún checkbox en
las 3899 líneas» es un hecho, medido bien, con control positivo y negativo que discriminan. Lo que
falla no es la medición: es el **salto** de «no existe X» a «no se cumple el requisito que X servía».
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]] es el espejo de esto.

**Los controles, y son baratos:**

- Cuando la evidencia es un **bloque de prosa**, leé hasta su **delimitador de cierre** (`*/`, `-->`,
  la línea en blanco), **nunca hasta un número de líneas**. Un `sed -n 'A,Bp'` sobre un contrato de
  largo variable lo trunca y sale exit 0.
- Antes de escribir una conclusión que **tu recorte no puede verificar**, grepeá el **archivo entero**
  por el mecanismo que el sujeto nombra. Si la conclusión es «esto no se cumple», el sujeto de la
  búsqueda es el **requisito**, no el control que lo implementaba.
- **Quien parte un barrido se queda con la costura.** Un sub-agente por rango no puede ver la
  contradicción ni la exculpación que viven en otro rango; eso no se delega, se reconcilia arriba.
  Pedirle al barrido que además declare «qué no pude ver» es más útil que pedirle más cobertura.

Evidencia: `docs/copiloto-emprendedor/Auditorias/2026-09-29-barrido-comentarios-proto-odobi-y-el-recorte-que-sobreestima.md` §0 y §4.
Prima de [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] (ahí el hueco vive en el par de
decisiones; acá el **sentido** vive en el par de fragmentos) y de
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]] (ahí lo que
engaña es el agregado; acá, el fragmento).

---

## Tercera faz (2026-09-30): el cebo del control positivo entra por la puerta que el guard abre a propósito

El falso rojo no siempre viene de un recorte. Puede venir del **control positivo mal construido**, y
entonces el instrumento condena justo al sujeto que estaba **bien**.

**Caso.** Escribí un canario que cruza los 54 ids del padrón del criterio 3 contra el lector que los
parsea (`memoria/vacio-no-es-hallazgo-correr-el-control.md` es su abuela). Su control positivo usaba un
cebo con forma imposible, `((cebo-del-canario))`, y lo pasaba **dentro de `ids`** para poder buscarlo.
Sobre el parser viejo dio bien. Sobre el parser **arreglado** (#742) el cebo salió **legible**, el
control se declaró roto y el canario devolvió `exit 2` — *precondición faltante* — sobre el único lector
que leía los 54 ids correctamente.

**Y el parser tenía razón.** Su fix reconoce los tokens que el padrón **declara**; al meter el cebo en
el padrón, **yo lo había declarado**. El cebo no era imposible: lo autoricé. El control entró por la
misma puerta que el guard abre a propósito, así que no medía la ceguera del lector: medía la lista
blanca que yo mismo había ampliado.

**La regla:** *un guard condicionado a una lista blanca no se puede probar metiendo el cebo en la lista
blanca.* Cuando el mecanismo bajo prueba es «acepto lo que la fuente declara», el control positivo no
puede consistir en declarar algo nuevo — eso ejercita el camino del **sí**, no el del **no**.

**El control que sí sirve:** inyectar un **lector ciego** (monkeypatch del parser devolviendo vacío) y
exigir que **los 54 de 54** salgan ilegibles. Así el control mide al canario, no al parser, y vale con
cualquier lector — incluido uno que todavía no existe. Verificado en las dos direcciones: `main` →
`exit 1` nombrando `['(home)']`; #742 → `exit 0`, `0 de 54`.

**Cómo detectarlo antes de pagarlo:** preguntá *¿mi cebo llega al instrumento por el mismo canal que el
instrumento está autorizado a aceptar?* Si la respuesta es sí, el control no discrimina. Hermana de
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] (allá falta el control positivo; acá **existe y apunta al
lado equivocado**) y de [[el-guard-que-caza-a-su-propio-autor]].

---

## Cuarta faz (2026-09-30): el sujeto sin delimitador de cierre condena con el veredicto del vecino

La faz 2 dice «leé hasta su delimitador de cierre». Falta la pregunta previa: **¿la forma que estás
leyendo TIENE uno?**

`contar-veredictos.py` reconoce dos formas de medición. Para la de **tabla** el propio código lo tiene
escrito: «en una tabla el sujeto y el veredicto viven en la **MISMA línea**: la medición se cierra acá y
no arrastra contexto a la fila siguiente». Para la de **heading** no existe la regla equivalente: la
ventana se abre y se cierra recién con el próximo sujeto reconocido — **o con el fin del archivo**.

Consecuencia medida en `2026-09-29_cierre_frontend1-…_B1-13-ids-superficie-y-dimension.md` (252 líneas):
el heading `` ### `ingresar` / `ingresar-error` / `volver` `` (línea 160) fue el último sujeto del
documento, así que su ventana fueron las **92 líneas restantes**, y capturó el único veredicto que caía
ahí — **1 de 26** ocurrencias del vocabulario en todo el doc: la línea **237**,
`contenido=DESVÍO (card "Te deben" ausente del proto)`, que es la medición partida de **`factura`**, 77
líneas más abajo. Resultado: `ingresar` entra al contraste con un `DESVÍO` **de otro sujeto**, mientras
la línea 207 del mismo documento dice «**`ingresar` es COHERENTE**» y el desglose que el heading abre lo
confirma tres veces («1:1 con el mock del proto», «no hay drift»).

**Y el instrumento contradice una declaración explícita del autor.** Tres de los cuatro casos son
headings que dicen literalmente `— PARTIDO`, y uno agrega «coincide con el cierre del 28/09, **no lo
contradice**». El rol de la sección está escrito; el lector no lo mira. Es #721 —*el rol de la cita se
escribe, no se infiere*— con el agravante de que acá **está escrito**.

**Cómo aplicarlo:** cuando un parser soporta varias formas de asociar sujeto→dato, listá las formas y
preguntá por cada una **qué la cierra**. La que no tenga respuesta absorbe hasta el fin del archivo, y su
falso positivo no se ve como bug: se ve como un documento que se contradice consigo mismo. Y un sujeto
que nombra **varios** ids no es una medición de uno — adjudicar al primero es peor que ignorar, porque
produce un dato con la forma correcta. Ver [[contar-un-simbolo-no-dice-en-que-rol-aparece]] y
[[el-instrumento-respondio-sobre-otro-sujeto]].

---

## Refuerzo (2026-10-05): el falso rojo que casi se convierte en **fila para otra sesión**

Corrí `contar-veredictos.py` desde mi worktree y dio `rc=8` con **7 documentos sin clasificar**, donde la
corrida de la mañana había dado `rc=0`. Estaba por reportarlo como hallazgo —«`main` detecta más»— con dueño
planificación. No existía: el archivo en el disco de mi worktree era el blob `408c7753` (107 499 B),
**anterior** a los commits que crecieron el instrumento a 173 KB, porque mi rama estaba **3 commits detrás**
de `main`. Corrido desde su carpeta, `main` da `rc=0` en `--json` y en texto.

**Dos trampas encadenadas, las dos mudas:**
1. **Un worktree atrasado corre una versión caducada del instrumento sin avisar.** `python scripts/x.py` no
   dice «soy de hace 3 commits», y el resultado tiene la forma correcta.
2. **Un script movido de carpeta resuelve mal sus insumos.** Copiarlo al scratchpad para «comparar versiones»
   le cambia el repo root (`Path(__file__)`) y aborta por *otra* causa (`rc=2`, universo no encontrado), que
   se lee como si fuera del dato.

**Cómo aplicarlo:** antes de atribuir una divergencia entre dos versiones de un instrumento, verificá que
corriste **las dos desde su ubicación real** (`git hash-object <archivo>` contra `git rev-parse <ref>:<archivo>`)
y hacé la matriz completa de condiciones, no dos puntas. Y antes de convertir una anomalía en fila para otra
sesión, preguntate *¿qué parte de esto es mi apuntado?* — el falso rojo se siente como diligencia y le cuesta
tiempo a quien lo recibe.

Emparentado: [[verificar-la-composicion-root-no-el-default]] ·
[[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] ·
[[el-instrumento-fabrica-una-referencia-que-no-existe]].

## Refuerzo 2026-10-06 — el grep que mide la FORMA de una aserción condena a todo lo que la logra con otra forma

Dos veces en un turno salí a buscar un hueco de cobertura, y las dos veces el falso rojo lo produjo
**mi patrón de búsqueda**, no el código. Ninguna de las dos llegó a reportarse, pero las dos estaban a
un mensaje de distancia.

**Caso 1 — medí la forma de la aserción.** Los seis clientes de `packages/core/src/api/*.ts` mandan
`idem_key` al backend, y la mitad que suele faltar en un test de wire es la de **ausencia**: que cuando
no se pasa `idemKey`, la clave **no viaje** (un `idem_key: null` sería idempotencia muerta sin dar
síntoma). Busqué esa mitad así:

```bash
grep -E "not\.toHaveProperty\('idem_key'|'idem_key' in " …    # 3 de 6 -> "sin cobertura"
```

Iba a reportar «`clientes`, `cobros` e `ingresos` no cubren la ausencia». Los tres estaban cubiertos:

```ts
expect(peticiones[1]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez' });   // clientes.test.ts:291
expect(peticiones[0].cuerpoJson).toEqual({ monto: '85000' });          // ingresos.test.ts:117
```

Un `toEqual` del objeto **completo** cubre la ausencia de *toda* clave de una vez, y lo hace **más
fuerte** que un `not.toHaveProperty` dirigido. Mi patrón no podía verlo porque buscaba una sintaxis, y
la propiedad que me importaba —*¿este test falla si el wire manda `idem_key` de más?*— no está escrita
en ninguna sintaxis en particular.

**Caso 2 — ni siquiera había caso.** En la misma pasada marqué `cobros` como gap. Su firma es
`idemKey: string` (`cobros.ts:67`) y el wire lo pone **siempre** (`:168`): no existe el caso de ausencia
que yo buscaba. El 0 de mi medición era correcto y mi lectura del 0 era falsa — *vacío = pregunta*,
no veredicto.

**La pregunta que separa las dos cosas, y va antes de correr el grep:** *¿estoy buscando la PROPIEDAD
que me importa, o una de las formas de escribirla?* Si lo segundo, el resultado es un techo, no una
medición: encuentra los que usan mi forma y condena a todos los demás. La forma más fuerte de una
aserción casi nunca es la más específica, así que **un patrón específico sesga sistemáticamente contra
el código mejor escrito** — exactamente al revés de lo que busca una auditoría.

**Y la asimetría de costos, que es la razón para frenar antes de mandar el hallazgo:** un falso verde se
paga cuando el defecto aparece; un falso rojo se paga **ya**, y lo paga otro — alguien escribe un test
que ya existe, o «arregla» código correcto. Por eso un hallazgo que se desinfla al verificarlo es un
buen resultado, y ninguno de los dos llegó al buzón. Ver también
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] — ahí el instrumento no
mira una mitad; acá mira la mitad correcta con una lente que sólo reconoce un dialecto.

## Refuerzo — el «ROJO» que en realidad era «YA ESTÁ HECHO» (2026-10-08)

Mismo mecanismo, caso nuevo y con número. Dejé un loop de merge esperando que `ci-verde.sh 934`
diera verde. Las **10 vueltas** imprimieron:

```
[1..10] ROJO — SIN MEDIR: el CI pasó, pero GitHub no informa si el PR es mergeable (UNKNOWN/UNKNOWN)
AGOTADO
```

**El #934 estaba MERGED desde 20 minutos antes** (`gh pr view 934 --json state` → `MERGED`,
`mergedAt 13:30:19Z`). GitHub devuelve `mergeable=UNKNOWN` para un PR **ya mergeado** — no hay nada
que mergear, así que la pregunta no tiene respuesta. El script la hace igual y traduce el silencio a
`ROJO`.

**Lo que hace esto peor que un falso rojo común:** el veredicto es `ROJO — SIN MEDIR … volvé a
correrlo`, o sea **manda a reintentar lo que ya está terminado**. Un falso rojo sobre código te hace
revisar código bueno; éste te hace **esperar un evento que ya pasó**, y la espera no tiene fin propio
—el loop se agota solo y el resultado se lee como fracaso. Es el mismo defecto de clase que
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] visto del otro lado: el instrumento no distingue
**«todavía no se puede medir»** de **«ya está hecho»**, y colapsa las dos en la peor de las dos.

**El control, y es una línea:** antes de preguntar `mergeable`, preguntar `state`. `MERGED` y `CLOSED`
no son estados en los que `mergeable` signifique algo — `gh pr view N --json state,mergeable` trae las
dos en la misma llamada, así que no cuesta nada. La pregunta que lo caza: **¿mi instrumento tiene una
respuesta para «la tarea ya está hecha», o sólo para «sí» y «no»?**

## Refuerzo 2026-10-08 — el falso ROJO salió de buscar el NOMBRE cuando la inclusión es por GLOB

Estuve a un commit de publicarle al operador una fila que decía **«6 de los 12 controles de
`deploy/` no están cableados a ningún gate»**. Era falsa, y la medición que la produjo parecía
impecable: `git grep -l -F "$basename" origin/main -- scripts/ .github/` por cada archivo, con
control positivo (los dos `.py` que sí están daban 4 y 5 hits) y control negativo (un nombre
inventado daba 0). El instrumento funcionaba. La **pregunta** estaba mal.

> **`scripts/ci/lint.sh:86` no los cablea por nombre: los cablea por patrón** —
> `bash tests-coordinacion.sh "$ROOT/deploy/copiloto" 'test_*.sh' 'de deploy'`. Un glob **no contiene
> el nombre de ningún archivo**, así que un grep por nombre literal no puede encontrar la inclusión
> que existe. Mis seis «sin gate» eran seis cubiertos.

Corriendo el mecanismo real: **9 de 9 controles de `deploy/` corridos, 0 fallados**, incluido el que
yo iba a denunciar. Y el repo ya tenía el guard que yo creía faltante —
`scripts/tests/test-lint-controles-deploy-cableados.sh`, 5/5 — cuyo **caso 3 deriva los globs de la
línea declarada en `lint.sh`** en vez de copiarlos, justamente para que un control nuevo no nazca
invisible. El guard que yo iba a pedir ya estaba escrito, y además mejor de lo que lo habría pedido.

**Por qué este falso rojo iba a pasar el filtro.** Se sentía como rigor doble: medí por archivo, no
por asunto; hornée los dos controles; el resultado era *negativo*, y un hallazgo negativo contra uno
mismo huele a honestidad. Nada de eso toca el defecto, que no estaba en la ejecución sino en la
traducción de la pregunta: **«¿alguien lo nombra?» no es «¿alguien lo corre?»**.

**El control que lo caza, y es el único que no se puede falsear: correr el gate.** Ante un «esto no
está cableado», no buscar más referencias — **ejecutar el gate y mirar si el archivo aparece en su
salida**. Un glob se delata corriendo, nunca grepeando. Generalización barata: antes de afirmar que
algo no está incluido, preguntarse **por qué mecanismo se incluiría si lo estuviera** (nombre, glob,
autodescubrimiento, registro, convención de nombre) y medir **ese** mecanismo. Hermana de
[[instrumento-que-no-mira-nunca-falla]] (ahí el instrumento no miraba; acá miraba el lugar
equivocado) y de [[contar-un-simbolo-no-dice-en-que-rol-aparece]] (ahí el símbolo aparecía en otro
rol; acá no aparece en ninguno **y aun así está incluido**).

**Y el revés del mismo día, que es la razón de anotarlo:** la fila de arriba sobre `ci-verde.sh` la
reproduje yo esta tarde sobre `#943` ya mergeado —`state=MERGED`, `mergeable=UNKNOWN`, los 6 jobs en
`SUCCESS`, veredicto «ROJO — SIN MEDIR … volvé a correrlo»— y era **verdadera**. Dos candidatos a
falso rojo en una hora, uno real y uno mío: la diferencia no la dio el olfato, la dio **correr el
mecanismo** en los dos casos.

---

## 🔁 Refuerzo 2026-10-08 — el archivo **enunciaba el principio** y lo violaba en el caso más frecuente

`ci-verde.sh` daba `rc=1` con los jobs **corriendo**, y su última línea decía *«hay al menos un job
ausente o fallado»*. Lo cazó AUDITORÍA sobre el PR #948: los 6 jobs `IN_PROGRESS`/`QUEUED`, **cero
fallados**. Un falso rojo, de la misma familia que esta entrada ya nombra.

**Lo nuevo, y es lo que vale guardar:** el archivo **ya tenía escrito el principio que violaba**.
En `ci-verde.sh:265-267`, a propósito de otro caso:

> *«las causas NO se funden en un solo código … un CONFLICTING no es "mirá tu código" (exit 1) ni
> "no pude medir" (exit 2) … Fundirlos es la forma de que el falso rojo enseñe a saltear el gate.»*

Y no lo había aplicado **al caso más frecuente de todos**: cualquier PR recién abierto. Igual
`mergear-pr.sh`, cuyo docstring `:18` dice *«cada causa con el suyo»* y que, por **delegar** el
gate, heredaba la fusión y la repetía un nivel más arriba.

### Por qué la enunciación ESCONDE en vez de proteger

Un archivo que argumenta su propio principio **se lee como cumplido**. El lector —incluido el que
lo escribió— ve el párrafo, reconoce el criterio, y no audita las ramas contra él. La regla
presente es evidencia de que **alguien pensó el problema una vez**, no de que todas las salidas lo
obedezcan. ⇒ **Cuando un archivo declara una regla, grepeá sus PROPIAS ramas contra esa regla.** El
párrafo es el lugar donde empezar a dudar, no donde dejar de hacerlo.

### Y el segundo filo: un detalle CORRECTO enmascara un veredicto FUSIONADO

La fusión sobrevivió meses porque **la línea por job sí distinguía** — `:236` imprime «está
CORRIENDO, no pasó». Quien leía la salida completa veía la palabra correcta y asumía que el
veredicto la conocía. Lo que no distinguía era **la última línea y el exit code**, que es lo que
se lee cuando hay apuro y lo único que lee un script.

> **Pregunta que lo caza:** *¿el resumen dice lo mismo que el detalle?* Si el detalle tiene tres
> estados y el veredicto tiene dos, hay una fusión, y vive justo donde nadie mira dos veces.

**El arreglo** (PR #954): `exit 3` para el todavía-no, **estrecho a propósito** —cero fallados,
cero ausentes, cero indeterminados y al menos uno corriendo—, status **enumerados** y no comodín, y
propagado a `mergear-pr.sh` con su propio `exit 5`. El texto sigue diciendo ROJO para no romper el
invariante `{VERDE, ROJO}`: lo que cambia es el código y el diagnóstico, no el fail-closed.

**Un defecto propio, en el mismo arreglo, que sólo cazó el test:** el `if` quedó partido por un
`\n` **literal** donde iba una continuación de línea ⇒ bash lee `[ … ] n && …`, tira *too many
arguments*, y **el `if` es siempre falso, en silencio**. El arreglo no se activaba y **nada daba
síntoma** salvo el caso que lo ejercitaba. Un guard introducido con un error de sintaxis que no
aborta es indistinguible de un guard ausente — [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].

---

## ⚠️ REFUERZO 2026-10-11 · el instrumento ENSUCIÓ el sujeto, y el falso rojo salió con cara de **dato malo**

Variante peor que el falso rojo "que se siente como rigor": el falso rojo que **señala a un tercero
inocente y plausible**. Automatizando el login del device, `adb shell input text` escribe en el campo
enfocado — y **appendea**: el campo no se vacía solo. Dos pasadas dejaron el email y la contraseña
**concatenados en el mismo campo**, y el login falló. El síntoma no decía "tu instrumento ensucia el
formulario": decía *credencial rechazada*. El sospechoso natural pasa a ser el dato (¿caducó la
clave?, ¿es el usuario correcto?) y la investigación arranca mirando el lugar equivocado.

Tres causas apiladas, todas del instrumento, ninguna de la app:

1. **Escribir sin vaciar.** Fix: vaciar, **verificar que quedó vacío**, y si no se logró **no
   escribir**. Escribir sobre residuo no es un intento fallido: es fabricar el próximo diagnóstico
   falso.
2. **Coordenadas de un árbol viejo.** Al escribir el primer campo se abre el teclado y el layout se
   desplaza, así que el centro de `login-password` leído del dump anterior caía en el de email. Cada
   toque re-lee el árbol. Hermana exacta de [[el-fallo-que-se-mueve-acusa-al-recurso-compartido]]:
   el blanco se movió, el instrumento no.
3. **La precondición nunca verificada.** El bundle que servía Metro no tenía `EXPO_PUBLIC_API_BASE`,
   así que la app **no hablaba con el backend** y ninguna credencial podía entrar. Un rojo del
   ENTORNO con la cara exacta de uno de la app.

🔑 **La regla que queda, y es barata:** cuando un instrumento **escribe** en el sujeto, verificá el
dato en la **capa más barata** antes de ejercitar la cara. Acá: `POST /auth/login` → **200 con
`access_token`** en un comando, sin teléfono. Con eso verde, cualquier rojo en pantalla **es de la
UI** y no de la clave — la variable queda aislada *antes*, no deducida después. Y al revés: si el
HTTP hubiera dado 401, tocar el device habría sido tiempo tirado midiendo una pregunta ya contestada.

**Lo cazó el operador, no el instrumento** — *«estás llenando el campo con basura… revisa primero los
usuarios registrados»*. Mi instrumento no tenía forma de notarlo: medía el resultado del login, no su
propia huella sobre el formulario. Un instrumento que muta el sujeto necesita un control sobre **lo
que él mismo dejó**, no sólo sobre lo que quería medir.
→ [[un-script-que-muta-produccion-y-revierte-al-final-deja-el-mutante]] ·
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] ·
[[el-instrumento-respondio-sobre-otro-sujeto]]

---

## Refuerzo 2026-10-12 — el falso ROJO salió de un valor que YO congelé, y además recomendaba una acción

Armé un monitor para esperar la llegada de un push, con el SHA esperado escrito como **literal**:
`L=f106d2c1...`. Después hice un segundo commit en la misma rama. El push llevó los dos, y el monitor
comparó el remoto nuevo contra mi literal viejo y dictó:

> `PUSH-DISTINTO: el remoto tiene 75c642bb y el local f106d2c1 — repushear antes de abrir PR`

Todo estaba bien: local y remoto eran **el mismo** `75c642bb`. El «local» del mensaje no era el local
— era mi expectativa, petrificada en el momento de armar el instrumento.

**Dos cosas que esta entrada no decía todavía:**

1. **El falso rojo no vino de un bug ajeno: vino de que yo moví el sujeto después de calibrar el
   instrumento.** Un monitor es código que corre en el futuro; cualquier valor que fije al armarlo
   envejece solo si el estado sigue avanzando
   ([[un-umbral-calibrado-al-corpus-del-dia-envejece-con-el]]).
2. **El veredicto traía una acción, y seguirla habría sido el error.** «Repushear» era inocuo acá;
   un falso rojo que recomiende `--force`, revertir o borrar no lo es. Un instrumento que condena
   **y además indica remedio** multiplica el costo de equivocarse.

**How to apply:**

· En un monitor o watcher, **releé el valor de referencia en cada iteración** (`git rev-parse HEAD`
  dentro del loop), nunca lo congeles en una variable al armarlo.
· Cuando un instrumento diga que algo está mal **y** te diga qué hacer, verificá el **efecto** antes
  de ejecutar el remedio: acá bastaba `git ls-remote` contra `git rev-parse HEAD`, los dos leídos
  **en el momento de decidir**.
· Si el mensaje de un control nombra «local» o «esperado», preguntá **cuándo** se leyó ese valor.

---

## Refuerzo 2026-10-12 — el control comparaba la FORMA del path, no el archivo

Un control positivo **ciego** (5 filas resueltas por un resolvedor que no había visto el mapeo)
volvió con `no reproducidas: 2`. Parecía que el resolvedor había fallado dos de cinco. No:

```
card-cobro:  literal -> VACIA   ·  basename -> ['PantallaIngresos.tsx']
preg:        literal -> VACIA   ·  basename -> ['ListaMensajes.tsx', 'PreguntarInteligencia.tsx']
```

Había acertado **las cinco**. El control extraía los paths citados y comparaba los **strings**
(`esp & got`), y el documento auditado cita el mismo archivo de hasta **tres formas distintas en la
misma tabla** — medido: **23 basenames con más de una forma** (`PantallaMiDia.tsx`,
`midia/PantallaMiDia.tsx`, `apps/mobile/src/modules/midia/PantallaMiDia.tsx`).

**Lo que vuelve el caso instructivo, y no una curiosidad:** el fixture *viejo* pasaba. No por ser
correcto, sino porque sus 5 filas caían en celdas que **abrevian el path igual que él**. Un
resolvedor ciego escribe el path completo que ve en el filesystem; el fixture escrito con el
documento a la vista copia su convención de abreviación. Es decir: **el falso rojo sólo aparece
contra un resolvedor independiente, y la coincidencia de estilo del fixture viejo era en sí misma la
señal de que no fue escrito a ciegas.** El control condenaba exactamente al único insumo que podía
acreditarlo.

**El fix y por qué no es "ajustar el instrumento para que pase":** comparar por **sufijo de
segmentos**, no por basename — así `chat/Burbuja.tsx` sigue sin colapsar con
`otra/carpeta/Burbuja.tsx`. Y cuatro controles, no uno: el fixture ciego pasa (el caso), el fixture
original **sigue** pasando (no se debilitó), el canario sigue disparando los 5 sabotajes, y un caso
negativo prueba que el homónimo en otra carpeta no coincide. Un fix de comparador sin el control 2
y el 4 es indistinguible de aflojar el umbral.

**La pregunta que lo caza antes:** *¿el control compara el **referente** o la **manera de
escribirlo**?* Cualquier identificador con más de una forma válida — path abreviado, URL con y sin
barra final, id con mayúsculas, fecha con y sin cero — hace que un comparador de cadenas condene al
que escribe distinto, que suele ser el independiente.

→ [[un-control-positivo-con-esperado-falso-acusa-al-script]] · [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] · [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]

**Refuerzo 2026-10-13 — el falso rojo que explica 63 worktrees acumulados.** Para podar worktrees
cumplidos escribí el test obvio: *¿el HEAD de la rama es ancestro de `main`?*

```bash
git merge-base --is-ancestor "$h" "$M" && mg=SI || mg=NO
```

Dio **NO** para 4 de 6 — entre ellas las ramas de **#1054 y #1057, que yo mismo había mergeado ese día**.
La causa: este repo mergea con **squash**, y el squash crea un commit **nuevo**; el HEAD de la rama
original **nunca** queda como ancestro de `main`. Así que `is-ancestor` responde `NO` para **toda** rama
squash-mergeada, y un podador construido sobre él **no poda nunca**. Medido ese día: **64 worktrees
registrados**, de los que 6 estaban listos para irse.

**Y por qué sobrevivió tanto:** el veredicto era *«1 commit fuera de main — no tocar»*. Un falso rojo en
un instrumento **destructivo** se lee como **prudencia**, así que nadie lo audita: parece que el podador
te está salvando de perder trabajo. Es el mismo esqueleto de este archivo con el incentivo invertido —
acá no hay fricción que empuje a arreglarlo, porque la consecuencia del error es *no borrar*, y eso nunca
duele hoy. Pariente de [[la-cita-de-procedencia-muere-en-el-merge]], que es el mismo hecho del squash
visto desde el otro lado.

**How to apply:** la pregunta *«¿esto ya está en `main`?»* **no** se contesta con la topología del grafo
cuando el merge es squash o rebase — ahí la verdad vive en el **forge**: `gh pr list --head <rama>
--state all --json state` → `MERGED`. Y el control de ese chequeo va en las **dos** direcciones: una rama
con PR abierto (debe dar `OPEN`) y una rama inexistente (debe dar vacío). Regla general: antes de confiar
en un instrumento que **prohíbe**, preguntate *«¿qué costo tiene su falso rojo, y quién lo paga?»*. Si la
respuesta es «ninguno, hoy», ese instrumento no se va a auditar solo.

---

## Refuerzo 2026-10-13 · una LISTA DE DIVERGENCIAS también condena, y la mía acusaba al código correcto

El instrumento acá no es un script: es la **lista de divergencias** de una fila del mapeo
prototipo→nativo. Es un instrumento igual —produce veredictos que bloquean un cierre— y produjo un
**falso rojo** que vivió semanas sin que nadie lo auditara.

La fila `caida`, divergencia #5: *«el chip pierde la variación y conserva la fecha de corte»*, marcada
`sin veredicto`, trabando el cierre. Medido:

```ts
// packages/core/src/midia/caja.ts:54-55
// K-09: con una conexión caída la comparación contra el mes anterior sería falsa — no se dibuja.
const variacion = caja.incompleta === true ? null : formatearVariacion(caja.variacionPct);
```
```ts
// packages/core/src/midia/caja.test.ts:59  → devuelve 'Al 19 de agosto'
chipDeCaja({ fechaCorte: '2026-08-19', variacionPct: '-18.0', incompleta: true })
```

**La divergencia describe, palabra por palabra, el comportamiento implementado, probado y con su motivo
escrito** — y el prototipo manda exactamente lo mismo, con la misma razón escrita en su propio código
(`index.html:3647-3648`: *«el delta compara contra el mes pasado; con el dato incompleto esa comparación
sería falsa»*). No era una falta: era una **coincidencia** que nadie había leído.

**Por qué nadie lo auditó**, y es el esqueleto de este archivo con otra piel: un ítem «sin veredicto» no
se lee como un posible error del instrumento — se lee como **trabajo pendiente**, que es el estado más
inocente que existe en un tablero. El falso rojo de un script destructivo parece prudencia; el falso rojo
de una lista de pendientes parece **diligencia**. Ninguno de los dos duele hoy.

**La causa raíz estaba escrita en el propio doc** (`:220`): *«las divergencias 3-5 de `caida` y 2-5 de
`clientes` las leí por su símbolo en el árbol; **no re-derivé qué dice el prototipo**»*. El autor declaró
el límite y el límite se perdió: siete filas quedaron «sin veredicto» porque **el símbolo viajó sin la
derivación**. → [[el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado]]

**Y el hallazgo gemelo:** al derivar la referencia, **cuatro** divergencias de `caida` (2, 3, 4 y 5)
resultaron ser **cuatro síntomas de UN mecanismo** — el estado de caída de la portada, que en el prototipo
hace tres cosas juntas en la misma rama (`index.html:3642-3650`). Pedidas de a una eran irresolubles y
parecían cuatro deudas; vistas como una, dos ya estaban resueltas, una era duplicada y una sola quedó
abierta.

**How to apply:**
- Antes de pedir N veredictos de una fila, **derivá la referencia una vez**. Si las N divergencias
  apuntan al mismo bloque de la referencia, no son N: contarlas por separado infla la deuda y bloquea
  el cierre con trabajo ya hecho. → [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]
- Para cada divergencia preguntate lo que no se pregunta: **«¿y si el código actual fuera el correcto?»**
  El chequeo es barato — grepear el mecanismo **y su test**, no el docstring que lo declara.
  → [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]
- Un doc que declara *«no re-derivé X»* está marcando un **falso rojo probable**, no una nota al pie.
  Esa frase es el disparador de una re-medición, y quien la escribe no es quien la va a leer.
  → [[instrumento-que-no-mira-nunca-falla]]

## 🔁 REFUERZO 2026-10-15 — el falso rojo salió de un ancla que **heredé del PR anterior**, donde el sufijo existía por una colisión que este archivo no tenía

Mergeé dos refuerzos de memoria seguidos. El primero (#1256) entró en una entrada que **ya tenía** un
refuerzo con la fecha de hoy, así que el guard de unicidad me obligó a renombrar el mío a
`REFUERZO 2026-10-15 **(b)**` y a anclar el control en ese literal. El segundo (#1257) fue a **otro
archivo**, que no tenía ninguna colisión: su ancla es `REFUERZO 2026-10-15`, sin sufijo.

El control por efecto del segundo merge imprimió:

```
b46494e3 docs(memoria): refuerzo — la autoridad hablaba de este mismo caso POR NOMBRE … (#1257)
el refuerzo en main: 0          ← FALSO ROJO
control positivo (DEC-11 sigue): 3
```

El `0` no decía «el merge falló»: decía «el literal que busqué no está». Re-medido contra
`origin/main` en el acto, el refuerzo **sí estaba** — `grep -n '^## '` lo encuentra en la **línea 56**
y el archivo pesa los **5241 bytes** exactos que había escrito. El merge fue perfecto; lo que falló
fue el instrumento.

### Por qué este falso rojo es de una clase propia

Los demás de este archivo salen de medir **la forma equivocada del sujeto** (el nombre cuando la
inclusión es por glob, el path en vez del archivo, la FORMA de una aserción). Éste sale de otra
parte: **el ancla era correcta — para el commit anterior.** El `(b)` no era un error de tipeo ni una
elección estética: era la **cicatriz de una colisión** en un archivo distinto, y viajó al control del
siguiente porque los dos comandos se escribieron en la misma tanda, a quince minutos uno del otro.

Y el control positivo **no lo podía cazar**, aunque hizo todo bien: `DEC-11 → 3` sólo acredita que el
grep leyó el archivo correcto en la rama correcta. Un control positivo valida el **canal**; no puede
validar el **literal que buscás**, porque el literal es justamente la parte que no comparten.

### La pregunta que lo caza

> **«¿este ancla la escribí para ESTE sujeto, o la copié del anterior?»**

Y su versión operativa, que es más barata que la pregunta: **el ancla se saca del archivo que vas a
medir, en el momento de medirlo** — `grep -n '^## ' <el archivo>` y copiar el renglón que salga. No
del comando de al lado, ni de lo que recordás haber titulado. Es la misma regla que ya aprendí para
las citas de línea (*medí contra el sha que vas a citar, en el momento de citarlo*,
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]]), aplicada un escalón antes: al **literal de
búsqueda**, no al número de línea.

### El costo real, que no es el minuto de re-medir

Un falso rojo en un control por efecto **ya corrido después del merge** no se parece a un bug: se
parece a prudencia. Si lo hubiera reportado tal cual, habría dicho *«el merge de #1257 entró pero el
refuerzo no está en main»* — una frase que manda a alguien a investigar un repo sano, y que en un
checkout compartido invita exactamente al movimiento que CANON 9 prohíbe. El guard de colisión de
anclas se ganó el lugar dos PRs antes; lo que faltaba era **el guard simétrico**: que el ancla del
control salga medida del sujeto, igual que el ancla de la escritura.

- Dos commits seguidos sobre el mismo tema comparten el **comando**, no el **sujeto**. Reusar el
  comando es correcto; reusar su literal es el defecto. → [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]
- Un sufijo que nació de una colisión (`(b)`, `-v2`, `-final`) es **estado de otro archivo**. Si
  aparece en un control, preguntá de dónde vino antes de creerle el veredicto.
  → [[el-instrumento-fabrica-una-referencia-que-no-existe]]

### Coda medida en el acto: **el guard de unicidad del ancla tenía el mismo defecto**

El `assert` que escribí para proteger este refuerzo contaba el ancla **en todo el archivo**, no en los
renglones de encabezado — y disparó, porque el cuerpo de arriba **cita** dos veces el ancla del PR
anterior. Un rojo de apariencia legítima sobre un archivo correcto: el mismo patrón que este refuerzo
describe, reproducido por el instrumento escrito para describirlo. El guard real mide el **sujeto**,
que es el renglón `^## `:

```python
encabezados = [l for l in t.split("
") if l.startswith("## ") and ANCLA in l]
assert len(encabezados) == 1     # un solo ENCABEZADO
assert t.count(ANCLA) == 3       # + las citas en prosa, contadas a proposito
```

Medido en este archivo: **1 encabezado · 3 menciones**. Y el primer intento de corrección falló otra
vez, por una tercera vía: `print()` del encabezado reventó con `UnicodeEncodeError` en `cp1252` por el
emoji del título — el **archivo** estaba bien, el `stdout` de Windows no
(`sys.stdout.reconfigure(encoding="utf-8")`). Tres rojos seguidos, ninguno del sujeto.

Un guard de unicidad que no distingue **declarar** de **citar** prohíbe hablar del caso anterior, y
escribir memoria es casi siempre citar el caso anterior.
---

## Refuerzo 2026-10-16 — el control POSITIVO del gate medía la RAMA, y por eso sólo era verde donde no hacía falta

El caso de arriba es un contador roto. Éste es más fino: el instrumento estaba bien, **el dato de
prueba con el que se auditaba a sí mismo** era el equivocado.

`scripts/sprint-estado.py --autotest` se enganchó al `lint.sh` el 2026-10-15 (`7b4a6efd`, PR #1274)
precisamente para que un `--check` verde no pudiera venir de un gate ciego. Su caso positivo armaba
una ficha `TERMINADO` con un sha real y exigía 0 errores. El sha salía de:

```python
sha_real = git rev-parse HEAD
```

y la validación que ese caso ejercita es `sha_en_main()`, que pide ser **ancestro de `origin/main`**.
En `main`, `HEAD` lo es. **En cualquier rama de PR, no.** Resultado medido al día siguiente: autotest
**VERDE en main** y **ROJO en las dos primeras ramas que lo estrenaron** (CI de los PR #1275 y #1276,
caso `TERMINADO sha REAL`: `esperado=0 obtenido=1`).

O sea: el control positivo del gate fallaba **en toda rama** — el único lugar donde un gate de PR
sirve — y pasaba sólo en main, donde ya no hace falta. Un instrumento que mide bien exclusivamente
en el estado en que nadie lo consulta.

**Lo que lo vuelve caro acá y no sólo molesto:** un `lint` rojo por una razón falsa es el permiso
para el `--no-verify`, y en este repo `--no-verify` arrastra **gitleaks** en un repo PÚBLICO. El
falso rojo no es la versión prudente del error: es el agujero.
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]

**La pregunta que lo caza, y que no es «¿el gate dispara?»** — eso ya lo había medido (canario sobre
`validar_decision`, ROJO 1/17). La que faltaba es:

> **¿el dato de prueba de mi control positivo depende del ESTADO en que corro el gate?**

Si el caso positivo se construye con `HEAD`, la rama actual, la fecha de hoy, el cwd o la variable de
entorno del momento, entonces el control no mide el gate: mide dónde estoy parado. Y como el autor lo
corre en su rama y el CI lo corre en otra, el desacuerdo aparece **después** del merge.
[[un-umbral-calibrado-al-corpus-del-dia-envejece-con-el]] · [[el-instrumento-versionado-difiere-por-rama]]

**Fix de raíz** (`c8f6ce1f`): el sha sale de `merge-base HEAD origin/main` — el punto de bifurcación,
ancestro de `origin/main` por definición y presente en cualquier checkout con el remoto. Sin remoto
el caso se **saltea declarándolo** (`[SKIP ]`): ni condena ni finge verde, que es la tercera opción
que casi nunca se escribe. [[un-control-de-ceguera-ubicado-despues-del-guard-que-dispara]]

**Y el canario del fix falló primero, por una razón que vale más que el fix.** El mutante reintrodujo
el bug así:

```python
NUEVO = '["rev-parse", "HEAD"]'      # sin la coma final
```

lo que dejó `for args in (["rev-parse", "HEAD"])` — que itera los **strings** y hace crashear el
script. `rc=1`, el canario cantó «acusó»… por el crash, no por el defecto. Un canario que se declara
satisfecho con un rojo que no midió nada es el mismo error que este archivo describe, cometido en el
instrumento del instrumento. Con la coma (`'["rev-parse", "HEAD"],'`) el mutante reprodujo el renglón
exacto del CI. [[un-control-positivo-con-esperado-falso-acusa-al-script]]
