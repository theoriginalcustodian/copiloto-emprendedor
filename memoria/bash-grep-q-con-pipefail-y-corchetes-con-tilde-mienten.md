---
name: bash-grep-q-con-pipefail-y-corchetes-con-tilde-mienten
description: "Dos trampas de bash que hacen mentir a instrumentos y tests: `prod | grep -q` con pipefail, y `[AÁ]` en grep con locale C"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T22:13:21.934Z
---

Dos trampas medidas el 2026-09-21 arreglando `scripts/vigilancia-check.sh` (PR #575):

1. **`productor | grep -q` con `set -o pipefail` miente en las dos direcciones.** `grep -q` sale al
   primer match y cierra el pipe; el productor muere por SIGPIPE y el pipeline entero sale ≠0.
   Resultado: falso ROJO en `if prod | grep -q X` y falso VERDE en su negación. En el test pareció
   que el fix no funcionaba cuando sí. Usar here-string: `grep -q X <<< "$(prod)"`.
2. **`[AÁ]` / `[ií]` / `[oó]` en `grep -E` con locale C comparan byte a byte**: `Á` son dos bytes,
   así que «PARÁLISIS» nunca matchea. El marcador de rol del vigilante sólo funcionaba por el cron
   «Control de SESIONES», que no lleva tildes. Usar alternancia: `PAR(A|Á)LISIS`.

**Why:** las dos producen un instrumento que calla sin error, la familia de
[[un-instrumento-tiene-dos-modos-de-no-saber-callarse-e-inundar]]. La 2 sólo apareció porque el
fixture usó el marcador con tilde; la 1, porque se miró la salida cruda en vez del ✅/❌.

**How to apply:** en tests con `pipefail`, nunca `| grep -q`; en regex con caracteres no ASCII, nunca
corchetes. Ante un caso positivo que falla, imprimí la salida cruda antes de tocar el código.
Además: una sesión lanzada desde un worktree guarda su transcript en el slug de ESE cwd — todo
instrumento que lea transcripts tiene que derivar los slugs de `git worktree list`.
