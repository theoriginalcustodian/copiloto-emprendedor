---
name: en-bypasspermissions-solo-sobrevive-permissions-deny
description: "Con el modo bypassPermissions activo se apagan las 66 reglas del clasificador; lo único que sigue bloqueando es permissions.deny (funciona en todos los modos), las reglas ask explícitas y el circuit breaker de rm -rf / y rm -rf ~"
metadata: 
  node_type: memory
  type: project
  originSessionId: f0352eb8-852a-422c-82c3-a0a38ff31be9
  modified: 2026-08-13T13:16:15.839Z
---

Decidido y aplicado el 2026-08-12/13, al cerrar el double-block headless
([[headless-gate-exige-claude-p-pero-el-clasificador-lo-bloquea-igual]]). El harness quedó en
`bypassPermissions` para las sesiones de VS Code, así que el clasificador ya no corre ahí.

**Lo único que sobrevive** (doc oficial, textual — "in every mode"):
`permissions.deny`, las reglas `permissions.ask` explícitas, y el circuit breaker de `rm -rf /`
y `rm -rf ~`. Todo el resto —force push, borrado irreversible, deploy a producción sin preview,
merge sin review, secretos entrando a un repo público, self-modification, instruction poisoning—
dejó de tener red automática.

Se repusieron 12 reglas `deny` en `~/.claude/settings.json`: force push en cinco formas
(`--force`/`-f` en posición temprana y tardía, más el refspec `+rama`, que ninguna regla de
`--force` ve) por duplicado para Bash y PowerShell, y `Write`/`Edit` sobre `**/.env*` anclado al
repo copiloto-emprendedor con path absoluto (`//c/Proyectos/...`, doble barra: una sola ancla al
settings source, no al filesystem). Verificadas 8/8 con control positivo y negativo: push normal
pasa, archivo común en el repo pasa, `.env` fuera del repo pasa.

**Por qué rinde.** La doc advierte que *"Bash permission patterns that try to constrain command
arguments are fragile"* — y es cierto: quedan huecos conocidos que NO cubren (`git push --mirror`,
un alias de git que expanda a force, `F=--force && git push $F` porque el literal no aparece en el
comando). La regla vale igual, pero tratarla como hermética la convierte en un instrumento que
miente ([[instrumentos-que-confirman-en-vez-de-verificar]]).

**Gap abierto con dueño.** El repo es PÚBLICO y `.githooks/pre-push` sólo sincroniza el grafo: no
escanea secretos. La regla `deny` sólo cubre archivos llamados `.env*`; una key hardcodeada en un
`.py` o un token pegado en un `.md` no la toca nada desde que el clasificador se apagó. Falta un
scanner (gitleaks o detect-secrets) en el pre-push. No se tomó en la sesión del 2026-08-13 porque
el archivo ya estaba modificado en el checkout compartido y tocarlo sin coordinar es edit-race
([[coordinacion-tres-sesiones-buzon]]).

**Cómo aplicar.** Al tocar `permissions.deny`, probar SIEMPRE las dos caras: que la forma hostil
muera y que la forma legítima pase. Una deny mal anclada puede bloquear un repo entero sin aviso.
