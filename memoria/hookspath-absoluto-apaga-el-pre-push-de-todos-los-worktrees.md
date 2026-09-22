---
name: hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees
description: `core.hooksPath` absoluto hacia el checkout compartido hace que TODO worktree corra el pre-push de ese árbol (100+ commits atrás, sin gitleaks). Un fix del hook mergeado a main no llega a ningún push.
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

**Cómo aplicarlo:**
- Un hook se verifica con un push real y mirando su salida, no leyendo `.githooks/pre-push` en
  `main`. Es la misma lección que [[los-crones-corren-los-scripts-del-checkout-principal-no-los-de-main]]:
  el que ejecuta es otro árbol.
- La raíz es un `core.hooksPath=.githooks` **relativo**, que git resuelve contra la raíz de cada
  worktree. El cambio es de config compartida, así que lo decide la dueña (fila H-A3-1, asignada a
  backend el 2026-09-22). No lo cambia una sesión por su cuenta.
- Mientras tanto, un scanner que se saltea en silencio no es defensa: antes de commitear algo con
  forma de credencial, asumí que no hay red. Ver [[en-bypasspermissions-solo-sobrevive-permissions-deny]].
