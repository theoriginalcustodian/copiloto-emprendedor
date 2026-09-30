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
([[copiloto-emprendedor]] lo usó para no desmentir un cierre correcto con un `origin/main` local
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
