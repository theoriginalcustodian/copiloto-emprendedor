---
name: git-push-puede-salir-exit-0-sin-haber-pusheado
description: Un `git push` que falla por red imprime `fatal:` y después «Everything up-to-date» y termina en exit 0 — el control no es el exit code, es comparar el SHA contra `git ls-remote`
metadata:
  type: project
---

# 🚀🎭 `git push` puede salir **exit 0** sin haber pusheado nada

**Medido el 2026-08-07** (fix del rail, PR 335). Salida cruda, completa:

```
[pre-push] ✅ grafo de código sincronizado desde origin/main
error: RPC failed; curl 28 Failed to connect to github.com:443 after 21083 ms
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
Everything up-to-date
EXIT=0
```

`git ls-remote origin refs/heads/<rama>` → **vacío**. La rama no existía en el remoto.

## Por qué es peor que un error normal

**No parece un fallo: parece un no-op.** «Everything up-to-date» es la frase que uno lee cuando ya
había pusheado — o sea, el mensaje de éxito más aburrido que existe. Va **después** del `fatal:`, así
que quien mira la última línea (o hace `| tail -1`) ve exactamente lo contrario de lo que pasó. Y el
exit code, que es lo que usaría un script o un `&&`, **confirma la mentira**.

Es la forma de fallo de [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] aplicada a git: el camino del
"no" no protesta. Y de [[el-pipe-se-come-el-exit-code]], pero al revés — acá el exit code está
disponible y **es el que miente**.

## El control (1 comando, siempre)

No confíes en el exit code ni en la última línea. **Compará el SHA:**

```bash
git -C "<worktree>" rev-parse <rama>
git ls-remote origin refs/heads/<rama> | awk '{print $1}'
```

Vacío o distinto ⇒ no pusheaste. Este control ya estaba en la casa para otra cosa
(`copiloto-emprendedor` lo usó para no desmentir un cierre correcto con un `origin/main` local
stale, ODOBI hito 5): es el mismo instrumento, sirve para las dos direcciones.

## Y ojo con la explicación ya canonizada

El `urgente_` del 2026-08-06 estableció que «los pushes colgados» eran el clasificador de permisos
frenando un `cd <path> && git push`. Es cierto **y no es la única causa**: este caso usó `git -C`,
sin `cd`, y falló por red (`curl 28`). Una explicación instalada absorbe al siguiente caso
distinto y hace esperar un cartel que nunca va a aparecer. Reintentar alcanzó, sin `--no-verify`.

**No medido:** con qué frecuencia pasa, ni si es la misma causa de los cuelgues de backend del 06.
Un caso no es una tasa.

## Y la causa del `cd`, ahora medida en pares (2026-08-07, más tarde)

Ese mismo día, tres ramas seguidas (CTA7 core / web / arranque) **no llegaron al remoto** pese a
`exit 0`, y las reintenté con loops de hasta 7 minutos. Todas usaban `cd "<worktree>"; git push …`.
Al leer el `urgente_` del 06 —tarde— reformulé la misma operación como:

```bash
git -C "<worktree>" push -u origin <rama>
```

**Salió a la primera**, con `* [new branch]` y el SHA confirmado por `ls-remote`. Mismo repo, misma
rama, mismo minuto: lo único que cambió fue el prefijo que ve el clasificador de permisos.

Las dos causas conviven y **se distinguen por la salida**: la de red imprime `fatal:`/`curl 28` y
reintentar alcanza; la del `cd` no imprime nada útil — el comando simplemente no avanza, porque está
esperando una autorización que nadie ve. Si un push no avanza **y no hay `fatal:`**, no reintentes:
reescribilo sin `cd`.

## El caso espejo, 2026-09-29: `gh pr merge` sale ROJO con el merge YA HECHO

Auditoría mergeó el PR #708 y `gh pr merge` devolvió
`fatal: 'main' is already used by worktree at C:/gfw-src/wt-a4reg` con exit ≠ 0. **El merge había
ocurrido** (`state: MERGED`, 19:53:28Z, `main` de `6f969fbe` a `5278a169`). Lo que falló fue la fase
**post-merge**: `gh` quiso hacer checkout local de `main` para borrar la rama, y con ~20 worktrees
activos `main` ya estaba tomado por otro.

**Por qué es el espejo exacto del caso de arriba y no otro bug:** ahí el exit `0` mentía diciendo
«hice algo» sin haberlo hecho; acá el exit rojo miente diciendo «no hice nada» después de haberlo
hecho. **Las dos direcciones del mismo error: tomar el exit code como veredicto de un efecto.** Y el
rojo es el más peligroso de los dos, porque invita a **reintentar** una operación ya aplicada.

**El control es el mismo de siempre, el EFECTO:** para un merge, `gh pr view <N> --json state`, o
`git log origin/main` después de un `fetch`. Nunca el exit de `gh`.

**Y el agravante estructural:** con muchos worktrees esto le va a pasar a cualquiera, porque `main`
está tomado por construcción — casi ninguna sesión trabaja en el checkout principal. No es un caso
raro: es el caso normal de este repo.

**Refuerzo (2026-09-30), la parte operativa que faltaba:** cuando `gh pr merge --squash
--delete-branch` sale **rc=1 con el merge YA hecho**, el borrado de la rama **queda sin ejecutar** —
es un paso posterior en la misma invocación, y el fallo local de `main` lo corta antes. Medido en el
PR #747: `MERGED` con commit `f36a842d` en el remoto, y `ls-remote` seguía devolviendo la rama. Así
que el rc=1 no deja sólo un veredicto falso: deja el trabajo **a medias**, y la rama sobrevive
silenciosamente hasta que alguien mira. El cierre es `git push origin --delete <rama>` aparte, con
`ls-remote` como veredicto (⚠️ ese push dispara el `pre-push` completo — batería + gitleaks — así que
pasa de los 120 s y va a background).


---

## Refuerzo (2026-09-30): el script que horneó este patrón salió `rc=4` en su PRIMER uso real, y estuvo bien

`scripts/mergear-pr.sh` nació justo para dejar de repetir a mano el «rc=1 con el merge ya hecho».
Primer uso real, PR #749:

```
✅ PR 749 MERGED en el remoto · commit 418d5dac
── borrando rama … (dispara el pre-push, puede tardar)
❌ la rama … SIGUE en el remoto: el merge está hecho pero el trabajo quedó a medias
rc=4
```

**El `rc=4` no es una falla del script: es el script funcionando.** Su contrato separa «mergeado **y**
rama borrada» (0) de «mergeado, rama sobrevive» (4), y el veredicto salió de `ls-remote`, no de un
exit code. Un script que hubiera devuelto 0 ahí habría dejado la rama huérfana con cara de éxito.

**La causa del 4, y es ambiental, no lógica:** el `pre-push` sincroniza el grafo de código contra
Graphity y **excede el timeout de la herramienta** (120 s). El borrado necesitó una segunda corrida en
background; recién ahí `ls-remote` dio 0.

**Lo que se aprende para cualquier envoltorio de `git push`:** el paso lento no es el push, es el
**hook**. Un timeout de herramienta no distingue «el remoto rechazó» de «el hook todavía está
corriendo», así que el envoltorio tiene que (a) mandar el push lento a background **con salida a
archivo completo**, nunca por `tail` ([[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]]),
y (b) dar su veredicto con `ls-remote` **después**, no con el exit del push.

**Y la trampa de lectura:** la notificación del harness dijo «exit code 0» porque yo había appendeado
`echo rc=$?` al log — el 0 era del **shell envolvente**, no del script. El `rc=4` real sólo estaba en
el archivo. La notificación del wrapper no es el veredicto del programa.

---

## Refuerzo (2026-09-30): un commit puede salir «merged» y verde con el árbol byte-idéntico al padre

Misma familia —el control es el **efecto**, no el registro— en git y no en la red.

Un PR se mergeó con el título `docs(A5REG): bajar al repo el veredicto del Cierre A y los dos
hallazgos verificados contra el código (#760)`. Medido:

```
tree 7dc32747 : d4364390e3f3045150bb02022c97933522911e77
tree 5330e060 : d4364390e3f3045150bb02022c97933522911e77   (su unico padre)
=> IDENTICOS: el commit no cambia NI UN BYTE
```

**Nada en la vista normal lo distingue de un commit que aportó:** `git log --oneline` lo lista igual,
el PR dice *merged*, el CI salió verde (no hay nada que pueda romper), y `git diff-tree --numstat`
devuelve vacío — que se lee como «no pude leerlo», no como «no cambió nada». El título queda como
única fuente, afirmando un contenido que el árbol no tiene.

El control es de una línea y hay que pedirlo: **`git rev-parse HEAD^{tree}` vs `HEAD^1^{tree}`**. Y
necesita control positivo, porque un método que dijera «vacío» de todo daría el mismo resultado: acá
el mismo chequeo dio 2 archivos para el PR de al lado y 26 para otro commit del mismo prefijo, así que
el vacío significaba algo.

**Y la segunda mitad, que es la que evita la alarma falsa:** vacío admite dos causas —*perdió* el
contenido, o era *redundante*— y son opuestas en gravedad. Se separan con `git log -- <archivo>` +
`git merge-base --is-ancestor`: acá el contenido había entrado nueve horas antes por otro commit, que
es ancestro del vacío. Redundante, nada perdido, nadie bloqueado. Publicar antes de dirimirlo habría
mandado a otra sesión a rehacer trabajo que estaba hecho.

**Why:** porque el costo no se paga al mergear, se paga cuando alguien cita ese commit como el lugar
donde entró algo. El título sobrevive; el árbol vacío no se ve.

**How to apply:** (1) si un commit importa como puntero («acá bajó X»), verificá el árbol antes de
citarlo; (2) `--numstat` vacío no es lectura fallida ni «sin cambios» — comparalo con `^{tree}` para
saber cuál de las dos; (3) todo veredicto de «aporte cero» se cierra con el tree hash, no con la
lectura del diff; (4) antes de avisar, separá *perdió* de *redundante* — la primera manda a alguien a
rehacer, la segunda sólo corrige un puntero.

## Hermana medida aparte (2026-09-29, rescatada el 2026-10-05)

El gemelo exacto del lado de la LECTURA: [[wc-l-de-un-git-log-que-erroro-da-cero-no-nada-que-ver]].
Acá el push sale 0 sin haber pusheado; allá el conteo de ``commits sin pushear`` sale 0 porque el ref
remoto nunca existió y el stderr se perdió en el pipe. Los dos colapsan ``no pude medir`` y ``medí cero``
en la misma salida, y el control es el mismo: ``git ls-remote origin refs/heads/<rama>`` — preguntarle al
servidor, nunca al ref local.


## Refuerzo 2026-10-06 — con muchos worktrees, `gh pr merge --delete-branch` SIEMPRE sale exit 1 y el merge igual se hizo

```
VERDE — se puede mergear (6/6 jobs del rollup)
failed to run git: fatal: 'main' is already used by worktree at 'C:/gfw-src/wt-a4reg'
[merge exit=1]
```

**El merge se hizo.** `gh pr view 823` → `state=MERGED`, `mergedAt=16:07:43Z`, commit `5e038559`, y el
cambio verificado en `git show origin/main:…`. Lo que falló fue el paso **local** de `--delete-branch`:
`gh` intenta cambiarse de rama y no puede porque `main` está tomado por **otro worktree**. En este repo
hay ~30 worktrees activos, así que esto no es un accidente: **todo merge que corra con
`--delete-branch` desde un worktree va a reportar exit 1 con el merge ya hecho.**

**Por qué muerde más que el caso inverso:** un exit 0 sin pushear se descubre al mirar el remoto. Un
exit 1 con el merge hecho empuja a **reintentar** — y el reintento falla con un mensaje distinto («no
está abierto»), que se lee como que algo está roto. Dos mediciones falsas seguidas sobre un trabajo que
ya terminó bien.

**Control, siempre el EFECTO y nunca el código de salida:** `gh pr view <n> --json state,mergeCommit`
y `git show origin/main:<archivo>` por el contenido que tenía que entrar. Si `state=MERGED`, terminó:
la rama sin borrar es cosmética. Y para evitarlo de entrada, mergeá **sin** `--delete-branch` desde un
worktree, o borrala después con `git push origin --delete <rama>`, que no necesita checkout.

Relacionadas: [[el-pipe-se-come-el-exit-code]] · [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]

## Refuerzo 2026-10-15 - `mv -n` al destino que YA existe sale **0 sin mover nada**, y el nombre FIJO hace que colisionar sea el caso NORMAL

Archivaba a mano un artefacto huerfano del gate (`urgente_vigilancia-a-frontend2_contratos-sin-tomar.md`,
generado por `escaladores-buzon.sh` y ya sin objeto porque cerre el contrato que citaba):

    mv -n "$U" "coordinacion/cerrado/2026-10-15/$(basename "$U")"
    echo "mv_urgente_rc=$?"        ->  mv_urgente_rc=0

**Exit 0. El archivo seguia en `abierto/`.** Lo cazo el control por efecto que corri a continuacion
(`ls coordinacion/abierto | grep urgente`), no el `rc`. Causa: `-n` es *no-clobber*; con el destino
ocupado **no es un error**, es el comportamiento pedido - no mover. Y el destino estaba ocupado
porque **el escalador genera el archivo con nombre FIJO por rol**
(`escaladores-buzon.sh:92-93`: `URGENTE_ST_INFIJO` + `URGENTE_ST_SUF` = `_urgente_vigilancia-a-<rol>_contratos-sin-tomar.md`),
asi que una copia de las 15:32 ya estaba en `cerrado/<hoy>/`.

**Y aca esta lo que lo vuelve clase y no anecdota: para un artefacto de nombre fijo que se REGENERA
cada ciclo, la colision no es el borde raro - es el caso normal.** Cuanto mas veces dispara la
alarma, mas garantizado es que `mv -n` no haga nada. El flag que elegi *para no perder datos* es
exactamente el que garantiza que la limpieza falle en silencio.

**Los dos lados del mismo filo, medidos el mismo dia:** el janitor
(`archivar-buzon.sh:100,124`) mueve con `mv` **pelado**, sin `-n`, asi que el riesgo alla es el
opuesto: **pisa** la copia anterior del mismo nombre y pierde el registro de lo que se escalo antes.
Ninguno de los dos defaults es seguro para un nombre que se repite: `-n` pierde la **limpieza**,
pelado pierde la **historia**. Si el nombre se repite, el sufijo distintivo no es prolijidad, es la
unica forma de que la operacion tenga efecto Y conserve lo anterior:

    mv -n "$U" "$CERRADO/$(basename "$U" .md)--regen-1546.md"   # efecto + historia

**El patron padre, otra vez:** `rc=0` no dice *hice lo que pediste*, dice *no hubo error segun MI
definicion de error*. Para `mv -n`, "no hice nada" **no** es un error. El control sigue siendo el
mismo de toda esta entrada: **medir el efecto en el destino y en el origen**, nunca el codigo de
salida. Relacionado: [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] -
aca ni mensaje hubo.
## Refuerzo 2026-10-15 (2) - la firma que separa el push COLGADO del gate LENTO es la DERIVADA del CPU, no su valor

Esta entrada ya dice que el push se verifica **por efecto** (`git ls-remote`), y eso sigue siendo el
control. Lo que faltaba era como decidir **si esperar o matar**, porque las dos situaciones se ven
igual desde afuera: el comando no vuelve.

Hoy me pasaron las dos, con cuatro horas de diferencia:

| | push COLGADO (manana) | gate LENTO (17:00) |
|---|---|---|
| `git.exe` CPU | 0,031 s y 0,016 s, **sin moverse** | 0,047 s y 0,016 s (igual de bajo) |
| proceso del hook | **ninguno** | `python` PID 21176 |
| CPU de ese proceso | — | **31,9 s -> 55,9 s en 3 min** |
| `.git/*.lock` | 0 | 0 |
| que hice | `TaskStop` + repush (nunca `--no-verify`) | **esperar** |

**El valor del CPU de `git` no separa nada: es bajisimo en los dos casos**, porque en un push con hook
el que trabaja no es `git`, es el **gate**. Mirar a `git` y ver 0,03 s invita a concluir "colgado" —
y en el caso lento es falso.

**Lo que separa es la DERIVADA del CPU del proceso que hace el trabajo.** Dos mediciones separadas
2-3 minutos: si el CPU **crece**, hay trabajo y se espera; si esta **estancado** y ademas no existe
proceso de hook, esta bloqueado en I/O y se mata. Una sola foto no alcanza — un numero alto puede ser
trabajo viejo ya terminado, y uno bajo puede ser un gate que recien arranco.

    Get-Process git,python,bash | Select Id,ProcessName,CPU,StartTime   # ...y repetir a los 3 min

**AUTOCORRECCION 20 min despues, en el mismo turno: la tabla de arriba esta bien y el criterio que
saque de ella estaba MAL, por una razon que importa mas que la tabla.**

Mientras esperaba, dije "el `pre-push` de este repo tarda 8-10 min, asi que esperar es lo correcto".
Despues mate el push y **el repush completo tardo 7 segundos** (`17:05:05 -> 17:05:12`, rc=0, rama en
el remoto). O sea: el `pre-push` **no** tarda 8-10 min. El primer push estuvo **colgado desde el
principio**, y yo justifique 20 minutos de espera con una duracion que me invente.

**De donde salio el numero:** del CPU de un proceso `python` que crecia (31,9 -> 55,9 -> 84,1 -> 102,4 s)
y que **nunca verifique que fuera hijo de mi push**. Cuando por fin medi parentesco, **no habia ningun
`git` vivo**: ese proceso era de otra sesion del repo, trabajando en lo suyo. Mi "evidencia de que el
gate trabaja" era el trabajo de alguien mas.

**La regla corregida, y es mas simple que la anterior:**

1. Medir **parentesco antes que actividad**: `Get-Process git` — si **no hay `git` vivo**, el push
   murio, sin importar que CPU veas en otro proceso. Con tres sesiones sobre el mismo repo, mirar
   "el python que trabaja" es mirar a cualquiera.
2. El umbral real de este repo es **segundos**, no minutos. Un push que pasa de **~2 min** ya es
   sospechoso; no hay ninguna duracion normal de 10 minutos que justifique esperar.
3. El control sigue siendo el **efecto**: `git ls-remote --heads origin "<rama>*"` con control
   positivo en `main`. Un `0` con el positivo en `1` es un `0` real.

**La derivada del CPU sigue sirviendo, pero solo sobre el proceso correcto.** Sin el paso 1 mide a un
vecino y confirma lo que quieras creer: [[el-control-que-mide-la-propiedad-destapa-el-defecto-ajeno-el-que-mide-mi-accion-no]].
Y el costo de equivocarse para el otro lado es bajo — repushear sale 7 s — asi que ante la duda
**se corta y se repushea**, nunca con `--no-verify`.
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]] (el falso rojo parece prudencia) ·
[[un-disparador-cumplido-no-avisa-a-nadie]]

**Y el corolario de eficiencia, que sobrevive a la correccion:** los refuerzos del mismo turno se
apilan en la **misma** rama antes de que cierre el push, no en PRs separados. El motivo real no es la
duracion del gate (son segundos) sino que cada PR extra es otro ciclo de revision, otro merge y otra
rama que limpiar. Este refuerzo y los dos anteriores viajaron juntos por eso.
