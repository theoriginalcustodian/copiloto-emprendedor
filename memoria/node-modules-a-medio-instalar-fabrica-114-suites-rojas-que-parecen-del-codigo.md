---
name: node-modules-a-medio-instalar-fabrica-114-suites-rojas-que-parecen-del-codigo
description: "Un node_modules de worktree corrupto por un npm install interrumpido o concurrente (EPERM/ENOTEMPTY en Windows) tumba 114 de 116 suites con \"Could not locate module react-native/Libraries/...\" — se lee como regresión del código y no lo es. Y dos trampas de jest que aparecieron en la misma tanda."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 72310961-bf3f-456b-a228-3af0312f37bf
  modified: 2026-10-13T13:28:29.676Z
---

# 🧱🎭 node_modules a medio instalar: 114 suites rojas que NO son del código

**LEER cuando `gate.sh core|mobile` da rojo masivo (casi todas las suites) con un error de resolución de
módulo, o cuando `npm install` muere con `EPERM`/`ENOTEMPTY` en un worktree.** Pariente de
[[el-disco-lleno-fabrica-rojos-de-gate-que-parecen-del-codigo]]: un recurso de la máquina que se
disfraza de defecto del código.

**Caso (2026-10-13, frontend1, worktree `wt-fe1-chat`):** el gate dio `core: failed` (npm ENOTEMPTY) y
`mobile: 114 failed, 2 passed` con `Could not locate module react-native/Libraries/...`. Ninguna línea
mía lo causaba. `mobile.sh`/`core.sh` corren `npm install` en la raíz; un segundo install (o uno cortado
por el corte de luz) sobre el mismo `node_modules` lo dejó a medias.

**Why:** el síntoma (suites rojas + stack de jest-resolve) parece una regresión del diff, y la tentación
es buscar en el código. La pista es el *conteo*: 114/116 rojas = el entorno, no un cambio.

**How to apply:**
1. Antes de borrar, verificá que `node_modules` NO sea un junction al checkout compartido
   (`Get-Item ... .Attributes` sin `ReparsePoint`) — borrar a través de un junction vacía el de todos.
2. `cmd //c rmdir //s //q` sobre `node_modules`, `apps/mobile/node_modules`, `apps/copiloto-web/node_modules`.
3. **Un solo** `npm ci` (≈3 min, 1194 paquetes) y recién después el gate. Nunca dos installs en paralelo
   ni el gate mientras instala.

## Dos trampas de jest de la misma tanda

- **`jest.restoreAllMocks()` no limpia las llamadas de `Linking.openURL`**: el preset de RN ya lo define
  como `jest.fn`, así que `spyOn` devuelve el mismo mock y las llamadas del test anterior se acumulan
  (`toHaveBeenCalledTimes(1)` dio 2). Usá `.mockClear()` al espiarlo.
- **Un guard de árbol entero no lo ve el jest dirigido.** `presion.test.tsx` exige que todo archivo con
  `<Pressable` importe el canon `presion`; mi `Recibo.tsx` lo violaba y sólo cayó en el gate completo.
  Al sumar un `<Pressable`, corré `npx jest src/theme/glass/presion` además de los tests del módulo.
