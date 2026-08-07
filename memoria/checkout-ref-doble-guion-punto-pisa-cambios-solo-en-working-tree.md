---
name: checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree
description: git checkout <ref> -- . reescribe TODO el working tree y borra sin retorno los cambios que solo viven ahí (nunca en índice ni commit) — y en checkout compartido pisa lo de otras sesiones
metadata:
  type: project
---

Incidente 2026-07-24 (frontend, reportado limpio): corrió `git checkout main -- .` para "chequear si
su checkout estaba al día" — sin `git status` ni stash previos, en el **checkout compartido** por las
tres sesiones. Dos daños:

1. **Pisó todo el working tree** con el `main` LOCAL viejísimo (`68ba367`, pre-hito-7) — decenas de
   archivos de otras sesiones (`apps/copiloto/*.py`, `motor/`, frontend ajeno) reescritos a un estado
   antiguo. Recuperable con `git checkout HEAD -- .` (restaura al HEAD real de la rama).
2. **Borró sin retorno** el diff **sin commitear** de `memoria/MEMORY.md` (2 punteros de índice que
   planificación había agregado sin commit). Un cambio que vive **solo en el working tree** —nunca en
   el índice ni en un commit— **no lo recupera nada**: ni reflog, ni stash, ni fsck. reflog/fsck
   rescatan objetos que ALGUNA VEZ entraron a git; un working-tree-only pisado no dejó objeto.

**El daño real fue acotado por suerte, no por diseño:** los archivos-tópico nuevos eran **untracked**,
y `checkout -- .` solo toca paths **trackeados** → sobrevivieron. Solo se perdió el índice (archivo
trackeado con diff sin commitear). Si el contenido hubiera estado en un tracked file sin commit, se
perdía entero.

**Why:** `checkout <ref> -- .` no es "mirar", es **escribir** el working tree entero desde `<ref>`,
descartando lo no-commiteado en su camino — el failure mode exacto que la regla de git ([[amend-en-checkout-compartido-pisa-el-commit-de-otro]], [[sincronizar-al-vps-desde-el-worktree-equivocado]])
existe para prevenir, ahora en su variante más filosa: el `-- .` toca TODO, y en checkout compartido
"todo" incluye el trabajo vivo de las otras dos sesiones.

**How to apply:**
1. **La pregunta "¿mi rama está al día con origin/main?" NO necesita tocar archivos.** Usá
   `git merge-base --is-ancestor origin/main HEAD` (o `git log origin/main..HEAD` / `git status -sb`) —
   responden sin escribir el working tree. `checkout -- .` era la herramienta equivocada para esa pregunta.
2. **Antes de CUALQUIER comando que pueda descartar cambios** (`checkout -- .`, `reset --hard`, `clean`,
   `stash` mal usado) en checkout compartido: `git status` primero, y `git add` con rutas explícitas de
   lo tuyo. La regla dura del repo: nunca `-A`, nunca reset/checkout/clean sobre el árbol completo.
3. **Cambios de memoria: commitealos pronto.** Un puntero de `MEMORY.md` sin commit es exactamente el
   working-tree-only que se pierde. `memoria/` es trackeado — un `git add memoria/... && commit` cierra
   la ventana. No lo dejes colgando entre ciclos de monitor.

## La variante que muerde sin que nadie escriba `checkout`: el script que RESTAURA (2026-08-07)

Un **control diferencial** es un script que rompe el fix a propósito, corre el test esperando rojo, y
después restaura. Escribí el restaurador así:

```bash
restaurar() { git -C "$WT" checkout -- "<los dos archivos del fix>"; }
trap restaurar EXIT
```

Se comió el fix entero. El control **sí** dio su veredicto (rojo en los dos eslabones), y al terminar
`trap` "restauró" los archivos… **a `HEAD`** — o sea, a la versión SIN el fix, porque el trabajo
todavía no estaba commiteado. Hubo que reescribir los dos archivos de cero.

**Por qué se cuela.** Nadie tipeó un comando destructivo: se tipeó un comando de **restauración**, y
la palabra tapa lo que hace. `git checkout -- <path>` restaura *desde git*, así que es correcto
exactamente cuando el estado bueno **ya está en git** — y un control diferencial corre, por
definición, **antes del commit**, que es el único momento en que no lo está. La herramienta es la
correcta para el 90 % de la vida de un archivo y la equivocada justo en la ventana donde se usa.
Peor: como el script **funcionó** (imprimió los rojos esperados), el resultado se lee como éxito.

**How to apply:** un script de rollback snapshotea al **disco**, no a git —
`SNAP=$(mktemp -d); cp "$F" "$SNAP/"; trap 'cp "$SNAP/$(basename $F)" "$F"' EXIT` — y termina
**imprimiendo el contador de verificación** (`grep -c` de la línea del fix, con el número esperado al
lado). Sin esa última línea no sabés si restauró: un archivo vacío y un archivo restaurado se ven
igual desde el prompt. Vale para cualquier script que "deshaga" algo, no sólo para tests.

Hermana en el mismo script y del mismo día: una **reversión que no matchea** (mi `perl` multilínea
contra un comentario con acentos) imprime el mismo verde que un fix que funciona — por eso cada lever
verifica con `grep -c` **antes** de creerle al test. Es [[instrumento-que-no-mira-nunca-falla]]
aplicado al instrumento que mide al instrumento.
