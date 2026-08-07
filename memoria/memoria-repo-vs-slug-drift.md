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

## 📏 Los dos `MEMORY.md` también divergen — y el que se CARGA es el del slug (2026-08-07)

No son sólo los topic files: **el índice mismo diverge, y por 15.000 caracteres**.

| Archivo | Tamaño medido | Quién lo usa |
|---|---|---|
| `memoria/MEMORY.md` (repo) | **31.206 chars** | Lo que ves en un `git diff`, lo que valida `scripts/medir-indice-memoria.py` |
| `~/.claude/projects/<slug>/memory/MEMORY.md` | **46.114 bytes** | **El que el harness carga en cada sesión** |

**Consecuencias prácticas, las tres contraintuitivas:**

1. **El warning de truncamiento que ves al arrancar** (*"MEMORY.md is 214 lines and 43.4KB. Only part
   of it was loaded"*) habla del **slug**, no del repo. Podar el del repo no lo apaga.
2. **Un sub-agente al que le das el repo puede medir el del slug igual** y devolverte un análisis
   entero sobre el archivo equivocado, con cifras verosímiles. Pasó el 2026-08-07: reportó 44.080
   chars y 12 entradas a bajar; **7 de las 12 no existían en el índice del repo**. El reporte de un
   agente es **testimonio, no medición** — contrastalo antes de ejecutarlo
   ([[no-lo-vi-no-distingue-no-llego-de-no-lo-procese]]).
3. **El control barato que los separa:** correr `scripts/medir-indice-memoria.py` (mide el del repo,
   con su techo) y `wc -c` sobre el del slug, y comparar. Si difieren, decí **cuál** estás mirando
   antes de sacar conclusiones.

**Deuda visible, con dueño (planificación):** el índice del repo está **6.528 chars sobre el techo de
24.000** aun después de la poda del 2026-08-07 (bajé 5 hitos cerrados a `HISTORIA.md`, −678). Lo que
falta no es poda editorial: la mayoría de lo que queda es doctrina viva y trampas vigentes, y bajar
una trampa que todavía muerde es peor que el truncamiento. Las salidas reales son **comprimir las
líneas** (muchas pasan de 300 chars cuando el techo por línea son 160) o **subir el presupuesto** —
las dos son decisión, no limpieza.
