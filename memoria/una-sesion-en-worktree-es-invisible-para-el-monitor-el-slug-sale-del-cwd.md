---
name: una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd
description: Claude Code deriva la carpeta de transcripts del cwd, así que una sesión que corre en un worktree escribe en otro slug y el monitor la reporta como inexistente — indistinguible de muerta.
metadata:
  type: project
---

# 🗂️🕳️ Una sesión en worktree es INVISIBLE para el monitor — el slug sale del `cwd`

Claude Code guarda los transcripts en `~/.claude/projects/<slug>/`, y el `<slug>` se deriva del
**`cwd`** de la sesión. Una sesión que corre desde un worktree (`_wt-*`) o desde un subdirectorio
escribe en **otra carpeta**. `scripts/no-ocio-check.sh` mira **un solo slug** — el del checkout
principal.

**Medido el 2026-08-06 10:20:**

```
PRODUCCIÓN (último Write/Edit): backend 9999min · frontend 9999min
VIDA (transcript): backend — sin transcript reciente
VIDA (transcript): frontend — sin transcript reciente
```

Frontend había escrito al buzón **9 minutos antes**. En el slug del proyecto había exactamente dos
transcripts vivos: el de planificación y uno solo más.

## El `9999` no significa "no trabaja"

Significa **"no encontré dónde mirar"** — y las dos cosas salen idénticas por pantalla. Es
[[instrumento-que-no-mira-nunca-falla]] con una causa concreta y reproducible: no es que el detector
falle al medir, es que **el universo que barre no contiene el objeto**.

Peor: el veredicto que emite es `DEAD-MAN`, o sea la lectura más alarmante posible sobre una sesión
que está trabajando bien. Aplicar la acción que sugiere (avisar al operador, reasignar su trabajo)
sobre una sesión viva desperdicia atención humana y puede duplicar trabajo en curso.

## La señal que sí distingue: el buzón

```bash
for s in backend frontend; do
  f=$(ls -1t coordinacion/abierto/*_${s}-a-* coordinacion/cerrado/$(date +%F)/*_${s}-a-* 2>/dev/null | head -1)
  [ -n "$f" ] && printf "  %-9s %s\n" "$s" "$(stat -c %y "$f" | cut -c12-16)"
done
```

Resolvió en un comando lo que el transcript no pudo: `backend 09:47 · frontend 10:11`. **No infiere
nada** — el archivo del buzón *es* la acción, con su hora. El transcript, en cambio, exige un paso de
atribución (¿de quién es este `.jsonl`?) que es justo donde se rompe.

## Regla operativa

Para saber si una sesión trabaja, el **buzón es fuente primaria** y el transcript sólo desempate.
Si algún día se arregla el barrido de slugs (`~/.claude/projects/*<proyecto>*/`), el instrumento debe
además declarar **sobre cuántos transcripts miró** — hoy miró cero y sonó igual de seguro
([[instrumento-que-no-mira-nunca-falla]]).

## Alcance

Aplica a cualquier monitoreo por transcript en este repo, y a cualquier flujo que asuma "una sesión =
un slug". Con `git worktree` como patrón estándar de trabajo aislado, la suposición es falsa por
diseño, no por accidente.
