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
