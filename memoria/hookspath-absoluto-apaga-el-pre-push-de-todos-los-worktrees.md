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
  cada latido con la hora del cambio. El control de servidor (push protection de GitHub) se le
  propuso al operador (Telegram 22) y sigue sin respuesta: hasta que exista, los dos detectores
  son de cliente y un arbol con el valor absoluto los apaga a los dos.

**🔴 DETECTAR NO ES BLOQUEAR — probado con un push real (A4-bis, 2026-09-22).** Los dos detectores de
arriba funcionan y tienen control negativo, y aun así **un commit con secreto entró al remoto**: con el
`hooksPath` desviado, el push fue ACEPTADO (rc=0) y `rama-b2` quedó escrita. No es una inferencia sobre
el script: es el ref en el remoto. El control positivo (push limpio, también aceptado) es lo que le da
sentido al rojo de los casos con `hooksPath` sano.

La conclusión es de arquitectura y vale fuera de este repo: **un control cuyo interruptor está del lado
del controlado es una advertencia, no un bloqueo.** `.githooks/pre-push` está bien escrito y es
fail-closed —aborta si el escáner falla— y eso no lo salva, porque cuando `hooksPath` apunta a otro
árbol git **ni siquiera lo invoca**: no hay código del hook corriendo que pueda notarlo. Ningún parche
al hook puede arreglarlo; el techo es de la capa. Por eso `gate.sh` (#649) cierra lo que puede cerrar
—que el *gate* no dé verde con el hook desviado— y deja intacto el agujero del *push*: detecta
**después**, el push pasa **antes**. En un repo público, el instante del push es el instante de la
publicación.

Corolario para redactar cierres: el Cierre A afirmaba que «ya no apaga el hook en los demás
worktrees». Es **falsa**, y la confusión es fácil de repetir: lo que sí se probó es que un segundo
worktree hereda bien el hook **cuando el `hooksPath` es el relativo**, que es otra afirmación. Antes de
escribir que un agujero se cerró, preguntá qué caso exacto ejercitó la prueba.

- **La única capa fail-closed es la del servidor**, y en repos públicos es gratis: `secret_scanning` +
  `secret_scanning_push_protection` de GitHub. Medido por API el 2026-09-22: los dos **`disabled`**.
  Re-escalado al operador con el comando exacto (Telegram msg 25) porque el `PATCH` lo bloquea el
  clasificador de permisos — y **pedírselo a otra sesión sería lavado de permisos**, no una salida.
  **Actualización del mismo día, post-reboot:** el operador los activó y la relectura por API da
  `secret_scanning: enabled` y `push_protection: enabled`. **El agujero no cerró**: queda
  `secret_scanning_non_provider_patterns: disabled`, o sea el servidor sólo intercepta el **catálogo
  de proveedores** — un `.env`, un token interno o un connection string pasan. El operador decidió
  encenderlo **al terminar el sprint**: sus falsos positivos frenarían pushes legítimos, y
  [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]. Dejar la cifra vieja sin fecha era
  reincidir en [[una-cifra-en-un-comentario-es-un-cache-sin-invalidacion]].
- Mientras tanto, un scanner que se saltea en silencio no es defensa: antes de commitear algo con
  forma de credencial, asumí que no hay red. Ver [[en-bypasspermissions-solo-sobrevive-permissions-deny]].

---

## El MISMO acoplamiento con la polaridad INVERTIDA — y el ruidoso es el bueno (2026-09-29)

Arriba: **un** worktree desvía `core.hooksPath` y el control **no corre** en ninguna sesión. Push
aceptado, secreto al remoto, repo público. Fail-**open** silencioso.

Hoy, el espejo. Un `git push` mío abortó así:

```
[pre-push] origin/main se movió (c9c8c852db7d -> 2d4b311383e6); sincronizando el grafo…
[graph-sync] ❌ 'C:/gfw-src/copiloto-grafo' tiene la rama 'backend/batch-a4-ratchet-blq2' checkouteada.
[graph-sync]    El worktree del grafo va SIEMPRE detached; con rama es un árbol de trabajo
[graph-sync]    y este script lo sanearía con 'reset --hard'. Abortando antes de destruir.
```

Mismo acoplamiento —**un** worktree, todas las sesiones—, resultado opuesto: el control **corre**,
**rechaza**, y frena el push de cualquiera. Fail-**closed** ruidoso. Y de paso le salvó a su dueño un
`reset --hard` sobre un árbol de trabajo con su rama adentro.

**La trampa está en que los dos se sienten iguales:** un `rc=1` en el push por algo que no tiene nada
que ver con tu diff, y la salida «obvia» es la misma — `--no-verify`. Ahí **convertís el buen fallo en
el malo**: le sacás el escáner de secretos en un repo público, que es el agujero de la mitad de arriba
de esta entrada. [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]].

**Y el escape documentado tampoco era la salida.** `graph-sync.sh:202` sugiere
`UC_GRAPH_WORKTREE=<path-exclusivo>`, correcto **para su caso** (aislar tu propio árbol). Usado para
saltear el rechazo es un bypass: `UC_GRAPH_LOCK` sale de `${WT}.sync.lock` (`:217`), así que mover
`WT` **mueve el lock** — dos sesiones escribiéndole al grafo compartido sin mutex. *Un escape
documentado es correcto para el problema que documenta; usarlo para saltear un guard es `--no-verify`
con otro nombre.*

**El diagnóstico reusable:** el mensaje del guard nombra **el árbol**, no al dueño. **La rama sí lo
nombra** — `backend/batch-a4-ratchet-blq2` dice de quién es. Medí el estado
(`git -C <árbol> rev-parse --abbrev-ref HEAD` + `status --short`), identificá al dueño por el prefijo
de la rama, pedíselo. Acá lo dejó detached en minutos, y se resolvió **sin que ninguna sesión toque el
árbol de otra**. Verificado por mí después, no por su reporte: `rev-parse --abbrev-ref HEAD` → `HEAD`
(detached), `status --short` → 0 archivos.

> Cuando un guard **compartido** te rechaza, la pregunta no es «cómo lo salteo» sino **«qué invariante
> global rompió quién»**. Si el invariante es de un recurso común —el árbol del grafo, su lock, el
> `hooksPath`— restaurarlo es del dueño; romperlo por tu cuenta es asumir exclusividad sobre estado
> que no es tuyo.

Hermana de [[git-stash-es-comun-a-todos-los-worktrees]] y
[[el-puerto-que-contesta-puede-ser-de-otra-sesion]]: la misma clase de estado que git **no** aísla por
worktree.
