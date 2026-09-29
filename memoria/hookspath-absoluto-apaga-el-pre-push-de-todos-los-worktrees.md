---
name: hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees
description: `core.hooksPath` absoluto hacia el checkout compartido hace que TODO worktree corra el pre-push de ese árbol (100+ commits atrás, sin gitleaks). Lo escribe cada worktree que crea Claude Code (`isolation:"worktree"`, `--worktree`).
metadata:
  type: feedback
---

**LEER antes de declarar activo un control que vive en `.githooks/`** (pre-push, scanner de secretos,
drift-check) **o antes de dar por cerrado un PR que lo agrega.**

`core.hooksPath` está configurado con ruta **absoluta** hacia `.githooks/` del checkout compartido, y
la config de git la comparten todos los worktrees. Entonces cada worktree ejecuta el pre-push **de ese
árbol**, no el de su propio HEAD. El checkout compartido estaba 114 commits detrás de `main` al medirlo (la cifra crece con cada merge: recontala con `git rev-list --count HEAD..origin/main`) y su
pre-push no tenía el paso de gitleaks de #601. Resultado: #601 estaba mergeado y el scanner de
secretos no corría en ningún push. El repo es **público**.

**Prueba en vivo (A3, 2026-09-22):** el push de `docs/auditoria-a3-ola-3` imprimió sólo
`[pre-push] ✅ grafo de código sincronizado` y **0** líneas `[secretos]`
(`_evidencia/2026-09-22/A3/a3-push-sin-secretos.log`).

**Quién la reescribe (causa raíz, 2026-09-22 10:27 -03, H-A4-1):** la **creación de worktrees de
Claude Code**. Tanto los subagentes con `isolation: "worktree"` como la CLI con `claude --worktree`
escriben `core.hooksPath = C:\…\copiloto-emprendedor\.githooks` (absoluto, con barras de Windows) en la
config **compartida**. Dos backends buscaron en el repo y no lo encontraron porque no lo escribe el
repo: lo escribe el harness.
- **Cómo se encontró:** el vigía empezó a chequear `hooksPath` en cada latido (`d9425472`) y a la
  hora de la primera alarma dio con la causa. El config se escribió a las 10:22:32 y FE1 había creado
  `.claude/worktrees/agent-af3a…` a las 10:22:31.
- **Experimento controlado:** corrí `claude -p … --worktree exp-…` dos veces y las dos pasó de
  `.githooks` a la ruta absoluta. En la ventana no se creó ningún otro worktree.
- **Control negativo:** un `git worktree add` común no la toca.

**Cómo aplicarlo:**
- Para aislar trabajo: `git worktree add C:/gfw-src/<nombre>`. **Nunca** `isolation: "worktree"` ni
  `--worktree` en este repo. Si igual pasó, `git config core.hooksPath .githooks` y avisá.
- Un hook se verifica con un push real y mirando su salida, no leyendo `.githooks/pre-push` en
  `main`. Es la misma lección que [[los-crones-corren-los-scripts-del-checkout-principal-no-los-de-main]]:
  el que ejecuta es otro árbol.
- El valor correcto es `core.hooksPath=.githooks` **relativo**, que git resuelve contra la raíz de
  cada worktree. Detectores: `gate.sh` da rojo si se desvía (H-A4-1) y `vigilancia-check.sh` alarma en
  cada latido con la hora del cambio. El control de servidor (push protection de GitHub) se le propuso
  al operador (Telegram 22).
- Mientras tanto, un scanner que se saltea en silencio no es defensa: antes de commitear algo con
  forma de credencial, asumí que no hay red. Ver [[en-bypasspermissions-solo-sobrevive-permissions-deny]].
