---
name: el-checkout-compartido-sirve-comandos-viejos
description: Los slash commands, hooks y scripts se leen del checkout donde estás parado. Si esa rama es vieja, corrés la versión anterior de tus propias herramientas — y grepear ahí "verifica" un estado que ya no existe.
metadata:
  type: project
---

Una auditoría externa reportó que `.claude/commands/monitoreo.md` seguía instalando dos crones que se
habían retirado esa misma mañana. Lo grepeé, **confirmé el hallazgo**, y estaba equivocado: en `main`
ya estaban podados. Lo que grepeamos —los dos— fue el **checkout compartido**, parado en una rama de
feature creada antes del fix.

**El hallazgo era falso y el problema era real, pero otro:** ese checkout es desde donde trabajan las
sesiones, así que **sirve la versión vieja de los slash commands** hasta que su rama avance. Un
mecanismo retirado sigue vivo para quien está parado en la rama anterior.

**Dos reglas que salen de acá:**

1. **Para verificar el estado del repo, consultá `origin/main`, no el working tree.**
   `git show origin/main:<path>` o `git ls-tree -r origin/main`. El working tree responde «qué hay en
   mi rama», que casi nunca es la pregunta cuando verificás si algo está arreglado.
2. **Todo lo que el harness lee del cwd —`.claude/commands/`, hooks del repo, `scripts/`— hereda la
   antigüedad de la rama del checkout.** Un fix mergeado a `main` no está activo para una sesión que
   sigue en una rama vieja, y **no hay ningún aviso**: el comando existe, corre, y hace lo de antes.

Es hermana de [[sincronizar-al-vps-desde-el-worktree-equivocado]]: la misma clase de error —el
artefacto correcto leído desde el lugar equivocado— pero acá el que queda desactualizado es **tu
propio instrumental**, no el destino.

Relacionadas: [[la-evidencia-vence-y-el-documento-no-lo-dice]] ·
[[verificar-la-composicion-root-no-el-default]].

## La combinación que hace RE-IMPLEMENTAR lo que ya existe (2026-08-07)

Fui a tomar un hito del tablero (`RAILz`: sacar `ajustes` de `TABS`, estado **pendiente**, disparador
cumplido). Grepeé `TABS` en el checkout: **5 entradas y ningún `ajustes`**. La lectura inmediata fue
«este no es el archivo». Era el archivo correcto **en la versión de hace 237 commits**. En
`origin/main` el hito estaba **hecho desde hacía horas**, con las dos puertas de reemplazo nombradas
en el propio docstring.

**Por qué muerde más que el caso de arriba.** Ahí el checkout viejo producía un hallazgo falso —algo
que uno va a intentar arreglar y descubre—. Acá produce **trabajo duplicado que sale limpio**: el
tablero dice «pendiente», el archivo efectivamente no tiene el cambio, la implementación compila, los
tests pasan y el PR se ve impecable. Nada en el camino contradice la premisa. El conflicto recién
aparece al mergear, o nunca — si el diff es equivalente, se pisa solo y queda como si nada.

Es un **caso de dos evidencias viejas que se confirman entre sí**: el tablero envejece por un lado, el
checkout por el otro, y coinciden. Dos fuentes desactualizadas de forma independiente se leen como
corroboración.

**How to apply:** antes de tomar un hito de `PLAN.md`, verificá su condición contra
`git show origin/main:<archivo>`, no contra el disco. Si el hito ya está hecho, el trabajo es un
`dato_` al dueño del tablero — no el hito.

## Corrección: el contador de commits NO mide los archivos del working tree (2026-08-12)

Usé el «237/364 commits atrás» como si midiera los archivos, y **no los mide**.
`git rev-list --count HEAD..origin/main` mide el **HEAD** del checkout compartido, que está parado en
una rama vieja. Pero ese checkout tiene ~100 archivos **modificados sin commitear**, porque las
sesiones escriben scripts y docs directamente ahí: esos archivos pueden estar **al día o incluso más
nuevos que `main`**.

Concretamente: escribí en el registro de deuda un bloqueante **con dueño operador** afirmando que
`scripts/vigilancia-check.sh` del checkout compartido era la versión vieja «sin el chequeo», y que por
eso los fixes de vigilancia #394/#400/#409/#414 tampoco corrían. Una línea lo desmintió:

```
$ diff <(git show origin/main:scripts/vigilancia-check.sh) scripts/vigilancia-check.sh
  → sólo faltaba mi propio bloque de 23 líneas
```

Estaba al día. Los otros fixes **sí** corren. La causa real era mucho más chica y era mía: escribí el
script en un worktree y nunca lo copié al checkout que ejecuta.

**Por qué esto no contradice lo de arriba, y por qué muerde igual.** El checkout compartido no es
«viejo»: es **inconsistente** — archivos trackeados sin tocar viven en la rama vieja, y archivos que
alguna sesión editó a mano están al día. Un solo número no puede describir las dos mitades, así que
cualquier conclusión sacada del contador es una inferencia disfrazada de medición.

**How to apply:** para saber qué versión de un archivo corre en ese checkout, **diffealo**
(`diff <(git show origin/main:<path>) <path>`). Nunca lo deduzcas del contador de commits, y nunca
generalices de un archivo a «todo `scripts/`». Y si vas a escribir la conclusión en un registro
versionado con dueño ajeno, la barra es más alta, no más baja:
[[una-orden-cerrada-exige-evidencia-de-device]] es la misma exigencia en otro contexto.

---

## Faz nueva (2026-09-30): con squash-merge, «¿este commit está en main?» es un NO **permanente**

El gancho de esta entrada dice «diffeá el archivo; el contador de commits no lo mide». Falta el porqué, y
el porqué es lo que hace que el error se sienta como una medición sólida.

**Este repo mergea por squash.** Un squash crea en `main` un commit **nuevo**, con otro SHA y el **mismo
árbol**. El commit original de la rama **nunca** pasa a ser ancestro de `main` — ni antes de mergear, ni
después. Por lo tanto:

```bash
git merge-base --is-ancestor <commit-de-una-rama> origin/main   # -> NO, para siempre
```

**no distingue «falta mergear» de «ya se mergeó hace una semana».** Es un falso negativo por construcción,
y el peor tipo: **no tiene estado de recuperación**, así que ninguna re-medición lo corrige.

**Caso.** Verifiqué por efecto un ítem de cola (los hallazgos P-1..P-4 del prototipo). `--is-ancestor`
dijo NO, `git branch -r --contains` confirmó que el commit sólo vivía en su rama, y emití un `pedido_` a
frontend2 diciendo que su trabajo no llegaba a `main`. **Estaba mergeado desde el PR #717**: el blob del
`index.html` del prototipo era **idéntico** (`2d20e38a`) en las dos puntas. Dos de los tres archivos que
reclamé ya estaban, y el tercero estaba **más nuevo en `main`** que en su rama — o sea que mi reclamo
apuntaba al revés. Tuve que retractarme ante una sesión par.

**El test correcto es el blob, y cuesta lo mismo:**

```bash
[ "$(git rev-parse "$RAMA:$f")" = "$(git rev-parse "origin/main:$f")" ] && echo IDENTICO || echo DIFIERE
```

Sobre los 25 archivos que los commits tocaban: **18 idénticos · 7 difieren · 0 sólo en la rama**, con
control positivo horneado (un archivo que se sabe igual **tiene** que salir idéntico, o el comparador está
roto). Y cuando difiere, **el signo del diff dice la dirección**: `−11 líneas` del lado de la rama significa
que `main` es el que está adelante.

**Cómo aplicarlo:** cualquier afirmación de la forma «esto no llegó a `main`» se mide por **contenido**, no
por pertenencia de commits — y antes de mandársela a otra sesión, con la dirección del diff escrita. Ver
[[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]] y
[[push-es-el-ultimo-paso-no-el-primero]].

---

## Refuerzo 2026-10-08 — el instrumento que **ejecuta** el checkout hereda su versión, y no lo sabe

Hasta hoy esta entrada era sobre *afirmar* desde un checkout viejo. Lo nuevo es que el **instrumento
mismo** puede ser el viejo, y entonces el error no está en la afirmación: está en la medición que la
respalda.

BACKEND levantó 14 filas del tablero con «estado no reconocido» y lo diagnosticó como *«la lista de
enums válidos quedó vieja»*. Era falso: `cola-check.sh` en `main` ya reconocía `⏸*` (`:140`) y
`⏳*` (`:154`). **Lo viejo era el archivo que se ejecutaba.** Test diferencial, mismo `PLAN.md`:

| | checkout compartido (`4a9f4f7c`) | `origin/main` |
|---|---|---|
| enums «no reconocidos» | **14** | **0** |
| frentes activos | *no los reporta* | **4 en paralelo** |
| `arrancando` | `SMTPLINKPROD` | `SNIPPETMIENTE` |
| bloqueados `⏳` | *ninguno* | 4 filas |
| **exit code** | **0** | **0** |

Atribución: `git diff HEAD origin/main -- scripts/cola-check.sh` = **+119/-12**. Control positivo: un
canario con el enum roto a propósito **sí** lo caza la versión de `main`, así que el 0 es un cero real.

**Las dos corridas salen `rc=0`.** O sea el vigilante decía «sin novedades» mientras ocultaba 4 items
bloqueados y nombraba otro frente activo. `vigilancia-check.sh:39` resuelve `REPO_ROOT` desde
`BASH_SOURCE`: **la versión de cada pieza la decide desde qué checkout lo invocás**, y los crones lo
invocan desde el compartido.

### DOS CLASES DE MEDICIÓN, y se trataban como una

- **Lee `<ref>:<path>`** (`git show origin/main:x`, `git grep <ref>`, `git log <ref>`) → **inmune** al
  checkout: contesta sobre el objeto del ref.
- **Ejecuta un script del working tree** → **hereda** su versión.

La pregunta que separa las dos: *¿mi veredicto salió de un objeto de git o de un archivo del disco?*

### Y el defecto del guard que escribimos para esto, que es la mejor parte

`git diff <ref> -- <path>` **absuelve en falso a una pieza untracked**: sólo mira archivos trackeados,
así que para un script nuevo sin commitear dice **«sin diferencia»**. El guard recién hecho no listaba
**su propia librería** por eso. Es un guard que falla hacia el «no hay nada» — el que no da síntoma.

```bash
git diff --quiet <ref> -- <path>      # untracked -> rc 0, "sin diferencia". MIENTE.
git cat-file -e <ref>:<path>          # la pregunta por el OBJETO. rc!=0 -> no está en el ref.
```

Y antes de eso, el **test de completitud** cazó al autor en la primera corrida: la lista de piezas
vigiladas no incluía la librería del guard. Una lista que hay que acordarse de actualizar se
desincroniza y deja pasar justo la pieza nueva — se deriva del fuente y se compara, no se mantiene a
mano. Ver [[el-guard-que-caza-a-su-propio-autor]],
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]], [[el-instrumento-respondio-sobre-otro-sujeto]] y
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]].

**Fix de raíz, no disciplina:** `scripts/lib/version-instrumento.sh` + bloque `0.bis` de
`vigilancia-check.sh`, que compara por **contenido** (no por HEAD: por HEAD gritaría en cada latido y
se desarmaría solo) las 8 piezas que ejecuta, incluido él mismo, y da `rc=2` —no un pase— cuando no
puede verificar.

## Refuerzo 2026-10-08 (2) — el guard **no puede llegar al checkout que fue construido para cazar**

El guard de versión se mergeó (#944, `9a3b55e5`) y **el checkout compartido no lo tiene ni en HEAD
ni en disco** (`PIEZAS_INSTRUMENTO: 0`). Un guard instalado sólo donde el problema no ocurre.

**Es un agujero de ARRANQUE, y tiene forma general:** *el arreglo de un artefacto viejo no puede
vivir dentro de ese artefacto* — una copia vieja del guard no se ejecuta nunca, así que no se
entera de que debería gritar. El fix tiene que entrar por una capa que el árbol viejo no controle.
Acá fueron dos: el **texto del cron** (vive fuera del repo) y `scripts/vigia.sh`, un lanzador cuya
propiedad de diseño es **ser tan chico y estable que su propia vejez no importa**: no decide nada,
ubica el pin de `origin/main` y delega. Toda la lógica que evoluciona vive en el instrumento, que
se lee del pin. Si alguna vez hay que agregarle una decisión, va en el instrumento, no en él.

**El diferencial que lo probó** (misma orden, minutos de diferencia):

| | desde el pin de `main` | desde el compartido (`4a9f4f7c`) |
|---|---|---|
| COLA | ⏳ 4 hitos bloqueados por disparador EXTERNO | ⚠️ **15 ids «estado no reconocido»** (falso) |
| escaladores | 2897 · 2045 · 2036 · 2067 min | **`999999min` en 4 de 6** |

El `999999` **no** es un mtime ilegible: es un centinela deliberado de la versión vieja («de un día
anterior, por encima de cualquier umbral, sin más cálculo»). Pierde la antigüedad verdadera y deja
todo igual de urgente — un valor sustituto que hace ciego al control sin romper nada.

## Y la regla que unifica las TRES instancias del mismo día

**La pregunta por la DIFERENCIA absuelve; la pregunta por el OBJETO no.** Tres instrumentos
distintos, el mismo fallo hacia el «no hay», en una sola jornada:

| instrumento | la pregunta floja | lo que no ve | la pregunta por el objeto |
|---|---|---|---|
| `git diff --quiet <ref> -- <path>` | ¿difiere? | una pieza **untracked**: rc 0, «sin diferencia» | `git cat-file -e <ref>:<path>` |
| `git diff --quiet` (podador) | ¿sucio? | archivos **untracked** (rc 0 con uno nuevo) | `status --porcelain` **y** `diff`, en conjunción |
| `find -newermt` (WIP) | ¿se tocó? | nada: **un checkout renueva el `mtime`** | `hash-object` + `cat-file --batch-check` |

El tercero casi me hace reportar 1.484 archivos de WIP inexistente; lo mató el control positivo —el
mismo conteo sobre un worktree creado ese día desde `main`, sin trabajo propio, dio **1.859**—.
**El `mtime` mide cuándo se materializó el archivo en disco, no si su contenido está guardado.**

Merece entrada propia cuando el índice tenga lugar: el 2026-10-08 estaba a 23.924 de 24.000 chars y
una línea nueva truncaba la cola ([[el-indice-truncado-fabrica-duplicados]]).

## El lanzador que delega TAMBIEN envejece, si carga POLITICA (2026-10-13)

`scripts/vigia.sh` nació justo para esto: corre el instrumento desde un pin de `origin/main` en vez del
working tree. Su docstring afirmaba la propiedad que lo hace funcionar — *«este lanzador NO decide nada…
una copia vieja de ESTE archivo hace lo mismo que la nueva»*. **Era falso, y la afirmación es lo que apagó
la búsqueda** ([[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]): la
**whitelist** de instrumentos permitidos vivía en el lanzador, y una whitelist es **política**.

Medido: las copias de `/c/gfw-src/_*-vigia` rechazaban `mi-buzon.sh` con **rc 2** aunque el instrumento
existiera en el pin; **5 de 6 pines atrasados**. Lo levantó FRONTEND2, no el docstring. Y mi primer fix de
ese día fue **agrandar la whitelist** — o sea tratar el síntoma y hacer crecer la política en el lugar que
envejece, contra el corolario que el propio archivo declaraba. El fix de raíz: el lanzador se
**re-ejecuta** desde el `vigia.sh` del pin si difiere del suyo, **antes** de aplicar la whitelist.

**Y el agravante que convierte esto en una trampa:** receté a las tres sesiones `bash scripts/vigia.sh …`
con path **relativo**. Ese archivo **no existe** en el checkout compartido, y el comando pipeado por
`| head` devuelve **rc=0** — la señal de «sin novedades» ([[el-pipe-se-come-el-exit-code]]). Un instrumento
que no existe reportando éxito. Y al escribir el reemplazo metí `MSYS_NO_PATHCONV=1` delante de un
`git -C /c/…`, que **rompe** la conversión del path: el redirect escribió un archivo **vacío** (blob
`e69de29`), y un lanzador vacío también sale **rc=0 sin salida**. Dos formas distintas de éxito falso en el
mismo arreglo, las dos cazadas por correr el comando y mirar el EFECTO.

**How to apply:** (1) si un lanzador/wrapper declara ser inerte, buscá qué **decide**: una lista de
permitidos, un umbral o un default ES política y envejece con la copia. (2) Un comando que vas a recetar a
otras sesiones **corrilo desde donde ellas corren** antes de mandarlo. (3) Instalar un script copiándolo:
`[ -s "$T" ] && bash -n "$T" && cp "$T" destino` — sin la guarda, un vacío se instala callado.
(4) Nunca pipees un instrumento cuyo `rc` es el veredicto. `MSYS_NO_PATHCONV=1` va **sólo** cuando el ref
empieza con punto (`origin/main:.claude/…`), nunca con un path `/c/…`.

---

## Faz nueva (2026-10-13): el guard vivía en el COMPOSITOR, y al componente lo llaman directo

**Difundí este `urgente_` a las tres sesiones por la mañana** —«la causa de TODOS los falsos positivos
de hoy: sus crones corren instrumentos atrasados»— **y caí en él yo mismo unas horas después**, en la
misma sesión. Corrí `bash scripts/cola-check.sh` desde el checkout compartido para medir el tablero y
me reportó **13 renglones con «estado no reconocido»**. Casi abrí un frente para arreglar el parser.

**No había nada roto.** Esa copia estaba **4 commits atrás** (`+12/-119`), y uno de ellos era
`4f675376 — el parser reconoce el estado congelado`. Los 13 renglones son `⏸ CONGELADA` / `⏳OPERADOR`:
estados **legítimos y sancionados** por la regla `CONGELAINSTR`. El mismo `PLAN.md` leído por el
`cola-check.sh` de `origin/main` da **0 no reconocidos y 5 frentes activos**.

**Lo nuevo no es el síntoma —`lib/version-instrumento.sh` ya lo documentaba del 2026-10-08, con 14
filas en vez de 13—, es por qué el fix de entonces no me cubrió:** el guard `🕒 INSTRUMENTO VIEJO`
quedó cableado **sólo en el compositor** (`vigilancia-check.sh:159`), que sí lista `cola-check.sh` en
`PIEZAS_INSTRUMENTO`. Pero al componente lo invocan **directo** los crones, las tres sesiones y yo.
Dos caminos a la misma pregunta, **uno solo protegido**, y el defecto vivió **5 días más** por el
camino sin guard. → [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]

**Y el falso rojo no sólo miente: invita al daño.** El aviso dice textual «arreglá el renglón antes de
creerle al veredicto» — o sea empuja a volver `pendiente` **13 hitos que el operador congeló a
propósito**. Un instrumento viejo que condena produce trabajo destructivo con aire de prolijidad.
→ [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

**Lo que esto dice de una norma difundida:** la bajé a las otras sesiones y a mí no me quedó ningún
instrumento apuntado. Una norma sin instrumento es disciplina, y la disciplina es justo lo que falla
cuando el cwd es el compartido y el comando es de una línea. **El fix no fue acordarme: fue que el
componente se verifique a sí mismo** (`cola-check.sh`, 2026-10-13) — a **stderr** y **también con
`--quiet`**, porque `--quiet` es el modo por el que lo llaman los crones, y un aviso que vive sólo en
el modo verboso no cubre el camino real.
→ [[un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate]]

**El bug que tuvo mi propio guard al nacer, y cómo lo cacé:** escribí
`_out="$(instrumento_divergente … || true)"; _rc=$?`. El `|| true` hace que `$?` sea **siempre 0** ⇒ un
guard que **no puede disparar**, y casi lo embarco en la rama que existe para que los guards disparen.
No lo vi leyéndolo: lo vi porque corrí el **control positivo** —el archivo *estaba* divergente y el
guard **calló**—. Un guard nuevo se mide con el caso que debe encender, no con el que debe callar.
→ [[medir-si-un-gate-dispara-antes-de-embarcarlo]] · [[el-pipe-se-come-el-exit-code]]

**How to apply:** (1) antes de creerle a un instrumento del repo que corrés desde el checkout
compartido: `git diff --stat origin/main -- <el script>`. Vacío ⇒ creele; no vacío ⇒ el veredicto es de
otra versión, **incluido su rc=0**. (2) Cuando cablees un guard a un compositor, preguntá **quién más
invoca a sus piezas por separado**: si alguien las llama directo, ese camino no tiene guard. (3) Una
norma que difundís a otros no se cumple sola en vos: dejale un instrumento, no un recordatorio.

## Faz nueva (2026-10-13): sirve la **memoria** truncada, y una memoria truncada hace REINCIDIR en el defecto que ella documenta

Las fases anteriores de esta entrada son sobre **scripts** e **instrumentos** viejos. Esta es sobre el
`memoria/` del propio repo, y el daño es de otra clase: no ejecuta nada mal, **me hace repetir un error
que ya estaba escrito**.

Abrí `memoria/el-pipe-se-come-el-exit-code.md` desde el checkout compartido para no reincidir en un
defecto de exit code. Me sirvió **27 líneas**. En `main` tiene **197**, con cinco refuerzos — dos de
ellos, los del 10-08 y el 10-12, describían el caso que yo tenía delante y uno prohibía explícitamente
lo que hice después (acusar a un instrumento ajeno sin medirlo). Reincidí en los dos, con la entrada
abierta.

**Por qué no se nota, que es lo único que importa acá:**

- El frontmatter está completo y el título es el correcto, así que el archivo **se ve íntegro**.
- La versión corta **cierra bien**: termina en una regla general sensata (*«para un comando de fondo, el
  veredicto es el output, no el status»*) y en un corolario con `[[link]]`. Nada dice «sigue».
- Y produce el efecto contrario al de no consultar: **la sensación de haber consultado**. Si el archivo
  no hubiera existido, habría buscado. Al existir truncado, dejé de buscar.
- La versión corta nombra el defecto por **una** causa (el pipe). Los refuerzos faltantes son justamente
  los que agregan las otras vías. ⇒ un documento truncado no es «la misma información, menos»: es
  **una teoría más simple y más falsa**, con la autoridad del documento completo.

**Y el riesgo de escritura, que es simétrico y peor:** appendeé mi refuerzo a esa versión corta. El
commit habría borrado los cinco refuerzos anteriores, con `+36 −167` y un mensaje que dice «agrega
refuerzo». Lo cacé con `git diff origin/main --numstat` **antes** de commitear. Leer el archivo no lo
habría cazado: se leía perfecto.

**La regla, en dos comandos:**

- Antes de **confiar** en una entrada de `memoria/` leída desde el checkout compartido:
  `git diff origin/main --numstat -- memoria/<entrada>.md`. Si borra líneas, lo que tenés no es la
  entrada — leé `git show origin/main:memoria/<entrada>.md`.
- Antes de **appendear** a cualquier archivo versionado del checkout compartido, el mismo comando. El
  signo manda: [[base-rancia-invierte-la-direccion-del-diff]].

Hermanas: [[el-indice-truncado-fabrica-duplicados]] (el índice truncado hace **escribir de nuevo** lo
que ya existe; acá la **entrada** truncada hace **hacer de nuevo** el error que ya se pagó) ·
[[el-pipe-se-come-el-exit-code]] §refuerzo 2026-10-13.
