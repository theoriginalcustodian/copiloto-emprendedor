---
name: un-mecanismo-roto-hacia-el-no-no-da-sintoma
description: El gate de no-regresión nunca corrió un solo test en producción — `python3` sin pytest. Nadie lo notó porque falla hacia RECHAZAR: no propuso nada malo, sólo era incapaz de aceptar. Todo mecanismo fail-closed necesita un control positivo que pruebe que sabe decir SÍ.
metadata:
  type: project
---

# 🔇🚫 Un mecanismo de seguridad roto hacia el "NO" no da síntoma

El primer E2E real del ciclo de auto-reparación (2026-08-01) devolvió esto:

> `rechazado_por_tests` — *"NO_EVALUABLE: la suite ya estaba roja SIN el parche (0 fallaron, 0
> errores)"*

Una frase que **se contradice sola**: roja con cero fallos. Tirando de ahí aparecieron tres cosas, y
la tercera es la que importa.

## Lo medido

1. **El intérprete.** `python = os.environ.get("COPILOTO_SANDBOX_PYTHON", "python3")`. El worker
   corre bajo systemd con `PATH=/usr/local/sbin:…:/usr/bin` —**sin el venv**—, así que `python3` era
   `/usr/bin/python3`, que responde `No module named pytest`. El subproceso moría antes del epílogo,
   no dejaba ninguna línea de conteo, y el parser devolvía ceros.
   → **El gate de no-regresión nunca corrió un solo test en producción.**
2. **El sandbox estaba incompleto.** Copiaba `apps/copiloto` + `motor`, pero dos tests importan
   `provision_tables`, que vive en `deploy/worker`. Sin ese subárbol pytest **corta la colección**:
   0 recolectados. Con él, 1277 passed. Era la misma lista que `sync-test-backend.sh` ya usaba; el
   sandbox se había quedado con dos de los tres.
3. **El mensaje mezclaba dos causas opuestas.** *"Estaba roja"* y *"no llegó a correr"* piden
   arreglos distintos —uno mira los tests, el otro el intérprete y el `PYTHONPATH`— y salían con la
   misma frase. Mandó la primera investigación al lugar equivocado.

## La regla

**Todo mecanismo que falla hacia el "no" necesita un control positivo que pruebe que sabe decir
"sí".**

Fail-closed es la postura correcta para un gate: ante la duda, no aprobar. Pero tiene un precio que
no se ve — **su propia rotura es indistinguible de su funcionamiento normal**. Un gate mudo no
propone parches malos, no rompe nada, no genera incidente. Sólo es incapaz de aceptar. Y nadie
investiga un "no": se lee como prudencia, o como que todavía no apareció el caso.

Esto pasó **dos veces el mismo día**, en dos piezas distintas del mismo ciclo:

| Pieza | Rotura | Cómo se veía |
|---|---|---|
| **Auditor** | juzgaba sin ver la causa → rechazó 3/3 el parche correcto | "es conservador" |
| **Gate de tests** | `python3` sin pytest → `NO_EVALUABLE` siempre | "no encontró nada reparable" |

La diferencia entre las dos: **el auditor tenía control positivo** —`test_REAL_el_auditor_no_rechaza_TODO_por_reflejo`,
que le pasa un parche bueno y exige que lo apruebe— y por eso su sesgo se pudo acorralar. El gate de
tests no tenía ninguno: nada afirmaba nunca *"el gate aceptó algo real"*.

## Por qué el banco daba 12/12 y 3/3 con el gate de producción mudo

`scripts/medir_c0_autosanacion.py:311` ya declaraba `--python default=sys.executable`. **El banco
ejercitaba el ciclo con el intérprete correcto; producción usaba otro.** Las dos rutas divergían
exactamente en el parámetro que estaba roto, así que ninguna medición del banco —por buena que fuera,
y era buena: 12/12 de consistencia, 3/3 de amplitud, contra el LLM real— podía enterarse.

Es [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] otra vez, y en su forma más
incómoda: no fallaba el banco ni la suite, fallaba **el único parámetro que el banco elegía por su
cuenta en vez de heredar**. Cuando un instrumento tiene que *elegir* algo que producción también
elige, esa elección es una junta — y las juntas son de nadie.

Barrido posterior: no hay otro `"python3"` hardcodeado en el repo (`apps/`, `deploy/`, `scripts/`,
`motor/`), así que el arreglo es de raíz y no un parche puntual.

## Y el criterio del propio E2E era demasiado flojo

`DESENLACES_QUE_PRUEBAN` incluía `rechazado_por_tests`, que el gate devuelve **tanto cuando midió y
rechazó como cuando no pudo medir**. La corrida salió con un `✅` grande y el gate mudo. Corregido:
un motivo con `NO_EVALUABLE` ya no cuenta como prueba, por más que el estado esté en la lista.

Es la misma trampa que la del banco de casos reales unas horas antes: **un solo veredicto cubriendo
dos realidades opuestas**. Cuando un resultado puede significar "funcionó" o "ni se ejecutó", no es
un resultado.

## El coletazo: arreglar un mecanismo mudo lo vuelve PELIGROSO

Apenas el gate empezó a correr tests de verdad, apareció lo que su mudez venía tapando: el sandbox
**hereda el entorno del worker**, que en producción tiene las credenciales reales. Con ellas puestas
se activan los tests de integración real —Composio, Drive, Docs, Sheets, el LLM—, y uno de ellos,
`test_gmail::test_send_real_y_readback`, **manda un mail**. El ciclo corre la suite dos veces por
intento, hasta tres intentos por trauma, todos los días a las 04:00.

O sea: **mientras el gate estuvo roto, ese riesgo fue teórico. El arreglo lo activó.** Un mecanismo
que nunca funcionó no tiene su comportamiento en producción probado por nadie — ni siquiera el que
lo arregla, si sólo mira que ahora "haga algo".

Al reparar algo que nunca funcionó, la pregunta no es *¿ya funciona?* sino **¿qué hace ahora que
antes no hacía, y quién lo autorizó?** Acá la respuesta correcta era que el gate debe ser
**hermético**: sin credenciales de servicios externos, sin efectos afuera, determinista. El módulo ya
tenía esa doctrina escrita para `DATABASE_URL` (*"el gate jamás debe escribir en una base real"*) y
aplicada a **una sola variable**. Generalizarla es el arreglo; se hizo por patrón (`*_API_KEY`,
`*_TOKEN`, …) para que una integración nueva quede tapada sola.

## La variante peor: el camino que NUNCA se ejecutó (2026-08-01)

Mismo día, tercera pieza del mismo ciclo. `_abrir_pr` —el paso final, el que abre el PR en GitHub—
**no podía funcionar**: hacía `git add <archivo>` sobre un clon prístino, sin escribir nunca el
contenido reparado en el árbol. Sin diff no hay commit; `git commit` salía con error; el `except`
degradaba a artefacto. Faltaba además el `git push` de la rama, sin el cual `gh pr create --head`
tampoco habría abierto nada. **Dos pasos ausentes en cinco líneas de código.**

Vivió así desde que se escribió, y no dio ni un síntoma por una razón distinta de las de arriba:

> **El camino nunca se ejecutó.** `COPILOTO_AUTOSANACION_REPO_GIT` no estaba seteada en producción,
> y la función que la lee devolvía `None` **antes** de llegar acá. Un camino muerto no se rompe:
> espera.

Y cuando por fin se ejecutó, tampoco protestó — porque **su degradado es un desenlace legítimo**. El
workflow devolvía `{"estado": "pr_propuesto", "url": "/tmp/…​.patch"}`: estado de éxito, URL
presente. Ni el E2E ni yo lo miramos dos veces. `pr_propuesto` cubría dos realidades opuestas —un PR
abierto en GitHub y un `.patch` tirado en un `/tmp` que nadie visita— y **se leen igual desde
afuera**.

El tercer defecto tapaba a los dos: `capture_output=True` + `check=True` mete el `stderr` real dentro
del `CalledProcessError`, y `f"{exc}"` sólo dice *"Command … returned non-zero exit status 1"*. El
diagnóstico verdadero —*"nothing to commit"*— **existía y nunca se imprimió**.

**Las tres correcciones, y ninguna es el fix del bug:**

1. El desenlace lleva `modo` (`pr` | `artefacto` | `sin_cambios`). Un resultado que puede significar
   dos cosas contrarias no es un resultado.
2. El E2E **exige** `modo == "pr"` cuando hay repo declarado. Antes daba ✅ con el paso final muerto.
3. El `except` pone el `stderr` **en el motivo y en el log**. Un error que sabe explicarse y no se
   imprime es peor que uno mudo: hace creer que no había nada que decir.

**La pregunta que lo hubiera encontrado antes:** al mirar un `if` que decide entre el camino real y
un fallback — *¿alguna vez se tomó la rama de la izquierda?* Si la respuesta es "no lo sé", ese
código es **no-ejecutado**, no "probado por defecto". Y un test que lo ejercite contra el recurso
real (acá: un repo git de verdad en `tmp_path`) lo caza en un segundo — se verificó por mutación:
quitar la escritura del archivo reproduce el bug original y el test se pone rojo con el mensaje
exacto.

## Al revisar cualquier gate, guarda, validador o filtro

Preguntá las dos, no una:

- *¿Qué devolvería si lo que vigila estuviera roto?* (la de siempre)
- **¿Qué devuelve si ÉL está roto?** Si la respuesta es "lo mismo que cuando funciona y dice que no",
  falta el control positivo.

## Hermanas

- [[instrumentos-que-confirman-en-vez-de-verificar]] — la cara espejo: el instrumento que siempre
  absuelve. Este siempre condena.
- [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] — el falso rojo no choca con nada.
- [[al-juez-tambien-hay-que-darle-el-plano]] — el otro caso del mismo día, misma forma.
- [[instrumento-que-no-mira-nunca-falla]] — "0 recolectados" es no mirar.

---

## Refuerzo 2026-09-30 — el contador que sólo puede contar la DEUDA, nunca el pago

El caso más limpio de esta memoria hasta hoy, y el más peligroso, porque el mecanismo roto hacia el
«NO» estaba **adentro de un ratchet escrito con todo el rigor**: control positivo de ruta falsa,
enumeración real en vez de lista a mano, clasificación por identidad del callable, deuda contada.

`test_ratchet_endpoint_tenant_scope.py` cuenta la deuda de aislamiento así:

```python
sin_cobertura = set(clasificacion["tenant_scoped"]) - cubiertas
```

- `tenant_scoped` viene de `route.path` → guarda la **PLANTILLA**: `/afip/facturas/{factura_id}/estado`.
- `cubiertas` sale por AST del archivo de tests, aceptando sólo `ast.Constant` que empiece con `/` →
  guarda el **PATH CONCRETO DEL REQUEST**: `/afip/facturas/abc-123/estado`.

**Esos dos strings nunca coinciden para una ruta con parámetro.** Entonces: ninguna de las 24 rutas
tenant-scoped con id en el path puede registrarse como cubierta **jamás**, no importa cuántos casos
hostiles se escriban. Y el remate, que es lo que lo vuelve un mecanismo roto hacia el «NO» y no un
simple bug de conteo: el assert es `len(sin_cobertura) == _DEUDA_TENANT_SCOPED_SIN_TEST`, así que

- si alguien escribe los casos y **baja** la constante como el propio mensaje de falla le ordena → el
  conteo computado no bajó → **ROJO**;
- si no la baja → **VERDE**, con cero progreso medido.

**Verde premia la quietud y rojo castiga el avance.** Un contador que sólo sabe sumar deuda y no
puede restar el pago no es un ratchet: es un trinquete soldado. Y no da síntoma porque `68 == 68`
es exactamente lo que se espera ver cuando todo está bien.

**Por qué estaba verde y nadie lo vio:** los 8 paths que el mecanismo sí cuenta son **planos**
(`/me`, `/catalog`, `/reply`, `/mi-dia/calendario`…), donde plantilla == path del request. El
instrumento acierta precisamente en el conjunto donde las dos dimensiones **colapsan por
casualidad**, y es ciego en todo el resto — que es además el conjunto de mayor consecuencia (la forma
BOLA / OWASP API1:2023, el modo de falla que ADR-013 §3.3.4 pagó con ~2 meses de drift en prod).

**La pregunta que lo caza, y va con las de arriba:**
*¿este contador puede llegar a CERO?* Si no existe ninguna acción que lo baje, no está midiendo deuda:
está midiendo una constante. Formulada sobre un gate: *¿cuál es el diff exacto que lo pone verde?* Si
no lo puedo escribir, el gate no sabe decir «sí».

⚠️ **Y el dato de método, que es la mitad incómoda:** cometí el MISMO error de dimensión tres minutos
antes de encontrarlo. Para medir la cobertura grepeé el archivo de tests buscando paths con `{` y me
dio **0** — y por un segundo eso me pareció un hallazgo. No lo era: un test no pide
`/afip/facturas/{factura_id}/estado`, pide `/afip/facturas/abc-123/estado`. Estaba contando plantillas
contra instancias, igual que el ratchet. El cero de un instrumento que mira la dimensión equivocada se
ve idéntico a un cero real; lo que lo separó fue preguntarme **cómo se escribe de verdad lo que estoy
buscando**. Ver [[el-instrumento-respondio-sobre-otro-sujeto]] y [[vacio-no-es-hallazgo-correr-el-control]].

---

## 🔻 2026-10-06 — el caso límite: el guard **no existe**, y la regla se cumple igual

El escalón de arriba de esta entrada. Hasta acá el patrón era *un mecanismo roto hacia el «no» no da
síntoma*. El caso de hoy es más barato de pasar por alto: **el mecanismo no está roto — no está.** Y el
sistema se ve idéntico.

«Prohibido push directo a `main`» es la regla más citada de este repo: está en `CLAUDE.md:65`, en el DoD
del sprint autónomo, y en el `CLAUDE.md` global como no negociable con *«gobernanza el Día 0 (G-2), no
como afterthought»*. **Medido, nada la hace cumplir:**

```
servidor: /branches/main/protection -> 404 "Branch not protected"   ·  /rulesets -> NINGUNO
cliente:  core.hooksPath=.githooks, UN hook (pre-push, 139 lineas)
          'refs/heads' -> 0 hits        <- nunca mira el ref de DESTINO
          CONTROL POSITIVO: 'exit 1' -> 3 · 'origin/main' -> 7 · 'graph-sync' -> 7
```

**Lo que lo mantuvo invisible no es un falso verde: es el cumplimiento.** Control de efecto sobre
`origin/main`, 7 días: **140 commits, 104 con `(#NNN)` de squash-merge y el resto merge-commits de PR** —
ni un push directo. Un guard ausente hacia el «no» **no da síntoma mientras todos cooperan**, y con 38
worktrees y tres sesiones autónomas con merge autorizado, «todos cooperan» es una propiedad **del día**,
no del sistema. La evidencia de que la regla se respeta es, exactamente, la razón por la que nadie fue a
ver si estaba mecanizada.

→ **Pregunta operativa:**

> **De las reglas que este proyecto repite como no negociables, ¿cuál tiene un mecanismo que la haga
> cumplir, y cuál sólo tiene disciplina?** Y para cada una: *¿qué comando debería ser RECHAZADO, y lo
> probé?* Un `git push origin main` que hoy sería aceptado es la prueba, y no hace falta correrlo para
> saber que falta: basta preguntarle al servidor si la rama está protegida.

**Y el corolario que no esperaba, que es el verdadero hallazgo:** el repo **sí** mecanizó, fail-closed, el
riesgo que **temía** —un secreto en un repo público: `pre-push:13-16`, *«hallazgo o escáner roto ⇒ el push
aborta»*— y dejó sin mecanizar el que da por **disciplinado**. El guard existe donde hubo miedo, no donde
hubo confianza → [[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]].

**Y el filo operativo: cerrar este hueco, solo, ABRE otro.** `ci-verde.sh:244` decide con
`case "$ms" in MERGEABLE/*)`, y el comodín **ignora el `mergeStateStatus`**. Medido con canario
(`gh` stubeado, script real, 4 controles positivos): `MERGEABLE/BLOCKED`, `/BEHIND` y `/DIRTY` → **rc=0,
«VERDE — se puede mergear»**. Hoy es inofensivo porque sin protección esos valores **no son alcanzables**
(y `DRAFT` tampoco: 0 drafts en 100 PRs). Pero `BLOCKED` es justamente lo que GitHub devuelve **cuando un
ruleset exige PR**:

> **Activar la protección sin tocar el `case` convierte un guard ausente en un FALSO VERDE** — y peor que
> antes, porque `mergear-pr.sh:46` delega en ese gate y no reimplementa la decisión. Los dos fixes van en
> el mismo PR. → [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]

**Cómo lo encontré, que es lo reutilizable:** no buscando esto. Fui a auditar `ci-verde.sh` por un
fail-open **adentro** del script, y **tres de cuatro candidatos se cayeron al medirlos** (el rollup viene
anclado al HEAD — 4 PRs, uno con 9 commits; el recibo sin `.detalle` sí avisa; el `UNKNOWN` de `pr list`
era de PRs mergeados). El script estaba bien. **El agujero estaba una capa afuera del archivo que me
pidieron mirar** — y sólo apareció porque, para calibrar la severidad de una fila menor, le pregunté a la
plataforma si el caso era alcanzable. **Calibrar la severidad de un hallazgo chico es la forma de
encontrar el grande.**

Relacionadas: [[medir-si-un-gate-dispara-antes-de-embarcarlo]] ·
[[instrumento-que-no-mira-nunca-falla]] · [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]

Doc completo: `docs/copiloto-emprendedor/Auditorias/2026-10-06-que-decide-que-un-PR-se-puede-mergear.md`

## Refuerzo 2026-10-08 — el caso más caro: la lección estaba escrita CUATRO veces y el fix estaba en un script del repo

Antes de borrar dos worktrees usé el control que parece obvio:

    git merge-base --is-ancestor aud/punto2-residuo-verificado origin/main   # -> falso

Contestó **«NO mergeada»** para dos ramas que estaban `MERGED` (`#936`, `#937`), con sus archivos en
`origin/main`. La causa es estructural: este repo mergea por **squash**, así que el commit de la rama
**nunca** queda como ancestro ⇒ ese chequeo da `falso` **por construcción, para todas las ramas,
siempre**. No es un chequeo con un bug: es uno que **no puede decir SÍ**, que es justo la forma que
esta entrada describe. Se esconde porque falla hacia «no borres», y eso se siente prudente.

**Pero el hallazgo no es ése, y conviene no quedarse ahí.** Cuando lo reporté, planificación barrió la
flota y midió lo que de verdad dolía:

| lo que buscaba | lo que había |
|---|---|
| gates de la flota expuestos (`ci-verde`, `recibo-cubre`, `no-drift`, `gate`, `archivar-buzon`, `vigilancia-check`) | **0** — con control positivo: `merge-base` aparece en 47 archivos y `is-ancestor` en 25, así que el grep no estaba ciego |
| usos ejecutables de `is-ancestor` | **2**, y ninguno mal: `arbol-identico.sh:99` está dentro de un string de ayuda, y `podar-worktrees.sh:134` es el uso correcto (prueba *(a)* de tres, con `&& return 0`: sólo puede decir SÍ) |
| **el fix** | **ya escrito, en este repo** |

`scripts/podar-worktrees.sh:14-30` documenta mi defecto **textual** —*«acá los PRs se mergean con
**squash**, así que la rama NUNCA es ancestro de main y `merge-base --is-ancestor` da "no mergeado"
para todo lo que sí terminó»*— y lo resuelve con **tres pruebas independientes de las que alcanza
una**: *(a)* ancestro · *(b)* `gh pr list --state merged` con esa rama como head, «la autoridad
real» · *(c)* el contenido que la rama tocó es idéntico al de `origin/main`. Es exactamente lo que yo
reconstruí a mano. Trae hasta el número del daño: *«la primera versión clasificó 18 de 29 así —
conservador, y por eso mismo indistinguible de no tener script»*.

Y la lección ya estaba en `memoria/` **cuatro veces**, una de ellas nombrándome:
[[push-es-el-ultimo-paso-no-el-primero]] tiene una ADENDA del **2026-09-29** titulada *«el control de
un squash es el CONTENIDO, y `--is-ancestor` puede acertar por casualidad»*, con la línea *«Auditoría:
el `--is-ancestor` frenó el borrado de una rama ya mergeada. Correcto por accidente»*. Las otras:
[[el-checkout-compartido-sirve-comandos-viejos]] (`# -> NO, para siempre`),
[[el-instrumento-respondio-sobre-otro-sujeto]] (el mismo 18 de 29) y un comentario de
`scripts/plan-drift-check.sh:66` que dice *«auditoría se equivocó así este mismo día»*.

> **El defecto real: el conocimiento vivía en `memoria/` y el fix vivía en un script, y ninguno de los
> dos se interpuso en el momento de tipear el comando crudo.** Tres sesiones pagaron el mismo peaje en
> diez días teniendo la solución en el repo. Es [[el-fix-ya-existe-en-otro-call-site]] aplicado a un
> instrumento: el fix no estaba en otro call-site del código, estaba en **otro script que nadie
> llamó**.

**Qué hacer, entonces, y no es «acordate»:** para la pregunta *«¿el trabajo de esta rama ya está en
`main`?»* **no se tipea el comando — se corre `scripts/podar-worktrees.sh`**, que ya hace las tres
pruebas, exige working tree limpio y respeta una ventana de gracia. Si hace falta la respuesta sola,
las dos fuentes que sí responden son el estado del PR (`gh pr list --state all --head <rama>`) y el
contenido (`git cat-file -e origin/main:<archivo que el PR agregó>`, con control positivo). Una
lección sin puntero al código que la implementa **se vuelve a aprender**; con puntero, se usa.
