---
name: memoria-repo-vs-slug-drift
description: seed-memory.sh espeja repo→slug con --delete y habría borrado 14 lecciones que sólo vivían en el slug de Claude Code
metadata:
  type: project
---

# 🧠💣 La memoria del repo y la del slug divergen — y `seed-memory.sh` borra

**Detectado el 2026-07-21** al ir a escribir una entrada nueva. No lo estaba buscando.

## Qué pasa

Hay **dos** memorias y ninguna sabe de la otra:

| Dónde | Quién escribe ahí |
|---|---|
| `memoria/` (versionada en el repo) | Lo declara fuente de verdad `scripts/seed-memory.sh` |
| `~/.claude/projects/<slug>/memory/` | **Cada sesión de Claude Code**, porque el harness le dice que su memoria persistente vive ahí |

`seed-memory.sh` hace `rsync -a --delete memoria/ → slug/`. Espeja **borrando lo que sobra en el
destino**. Y `HANDOFF.md` lo declara parte del init de arranque.

**Al detectarlo, 14 topic files vivían SÓLO en el slug** — todas las lecciones del sprint mobile-first:
`instrumentos-que-confirman-en-vez-de-verificar`, `teclado-tapa-campos-cascara-glass`,
`test-en-carpeta-app-es-una-ruta`, `sincronizar-al-vps-desde-el-worktree-equivocado` (escrita dos
horas antes), y diez más. Correr el script las habría borrado sin aviso.

Rescatadas al repo el mismo día (copia aditiva, sin `--delete`). El `MEMORY.md` del slug era además
estrictamente más actual: las 3 líneas que sólo estaban en el del repo eran versiones **obsoletas** de
las mismas entradas (AFIP figuraba «en pausa» cuando ya había cerrado E2E verde).

## Causa raíz

**Dos mecanismos con distinta idea de dónde está la verdad, que nunca se reconciliaron.** Ninguno está
mal por su cuenta: el script asume que la memoria viaja con el repo (razonable: versionada, sobrevive
al clon); el harness asume que vive en el slug (razonable: es su directorio de auto-memory). El daño
aparece sólo en la intersección — y como el `--delete` es silencioso y el arranque es rutinario, la
pérdida no habría dado síntoma hasta que alguien buscara una lección que ya no estaba.

## Regla

1. **Escribir las entradas nuevas en `memoria/` del repo**, no sólo en el slug. Lo versionado
   sobrevive; el slug es una copia.
2. **Antes de correr `seed-memory.sh`, comparar los dos directorios.** Si hay archivos sólo en el
   slug, rescatarlos primero.
3. ~~El `--delete` del script sigue siendo una bomba armada mientras exista.~~ → ✅ **DEUDA PAGADA**
   (verificado el 2026-07-31): `seed-memory.sh` ya no espeja con `--delete`, es **bidireccional** —
   rescata al repo lo que sólo vive en el slug antes de reconciliar, y reporta
   `rescatados / purgados / divergentes` en cada corrida.

   ⚠️ **La regla 2 sigue viva igual, y no es redundante:** el script rescata **archivos**, no decide
   cuál de dos versiones **divergentes** es la buena. La corrida del 2026-07-31 dio
   `194 archivos · rescatados: 0 · purgados: 0 · divergentes: 0` **porque la comparación se hizo antes
   y los dos huérfanos del slug ya se habían copiado a mano**. Mirar el contador de `divergentes`
   antes de dar por buena la reconciliación.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: un espejo con `--delete` no falla
ruidosamente, *confirma* — termina en exit 0 diciendo cuántos archivos sembró, sin mencionar los que
borró.
