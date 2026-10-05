---
name: wc-l-de-un-git-log-que-erroro-da-cero-no-nada-que-ver
description: Medir "commits sin pushear" con `git log origin/<rama>..HEAD | wc -l` da 0 tanto si no hay nada como si origin/<rama> nunca existió — hay que preguntarle al REMOTO, no al ref local.
metadata:
  type: feedback
---

Contar commits sin pushear con `git log "origin/<rama>..HEAD" --oneline | wc -l` (o `git rev-list --count`)
da **0** en dos casos indistinguibles: "ya está todo pusheado" y "`origin/<rama>` nunca existió como
remote-tracking ref porque la rama JAMÁS se pusheó". `git log` con un ref inexistente sale por stderr
(`unknown revision`) sin escribir nada a stdout, y `wc -l` de stdin vacío da `0` — el error se pierde
en la tubería y el 0 se lee como "no hay nada", cuando en realidad es "no puedo ver".

**Caso raíz (2026-09-28/29):** barrí 13 worktrees backend con exactamente ese patrón y reporté
"0 sucios, 0 sin pushear" en los 13. Planificación (`copiloto-emprendedor-d7`) lo corrigió: 7 de esas
13 ramas nunca habían sido pusheadas — incluía `backend/ratchet-endpoint-cross-tenant`, un test de
aislamiento cross-tenant que vivía SÓLO en disco. El control que lo cazó fue `git ls-remote origin
refs/heads/<rama>` (le pregunta al servidor, no al ref local) — vacío ahí sí es inequívoco.

Es la misma familia que [[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] y
[[git-push-puede-salir-exit-0-sin-haber-pusheado]]: un instrumento que colapsa "no puedo medir" y "medí
cero" en la misma salida.

**Cómo aplicar:** para "¿tengo commits sin pushear?", usar `git ls-remote origin refs/heads/<rama>`
primero — vacío ahí es la señal real de "nunca se pusheó", no de "está al día". Sólo si el ref remoto
existe tiene sentido comparar `origin/<rama>..HEAD`. En un barrido de N worktrees, no confiar en `wc -l`
de un pipe que puede haber recibido stderr en vez de stdout — separar y loguear el stderr, o usar
`git rev-parse --verify` antes de diffear.
