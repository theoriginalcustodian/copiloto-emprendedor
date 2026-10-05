---
name: el-open-w-trunca-antes-de-que-el-write-falle
description: Un script de parcheo que abre el original en modo escritura lo TRUNCA antes de serializar: si el write falla, el archivo queda en 0 bytes. El fallo al leer es benigno; el fallo al escribir ya destruyó.
metadata:
  type: feedback
---

`io.open(P, "w")` **trunca el archivo en el momento de abrirlo**, no cuando se escribe. Si la
serialización falla después, no hay rollback: el original ya no existe.

**El caso (2026-10-05 14:11).** Un parche a `coordinacion/PLAN.md` —363 KB, el tablero de las cuatro
sesiones— abrió el archivo en `"w"` y el `.write()` siguiente explotó con
`UnicodeEncodeError: surrogates not allowed`: había escrito un emoji como par de surrogates
(`\ud83d\udccf`) en vez de `\U0001f4cf`, y Python 3 no los une — el error aparece **al codificar a
utf-8**, o sea *después* de truncar. El archivo quedó en **0 bytes**.

**Por qué no había red.** `coordinacion/` está gitignored **a propósito** (si se versionara,
`git worktree add` lo duplicaría por worktree y el mensaje de una sesión no existiría para la otra),
así que no hay `git checkout` que lo recupere. Un artefacto deliberadamente no versionado necesita un
respaldo deliberado, y no lo tenía: **el único respaldo que existía era el corpus congelado que otra
sesión hace para otra cosa** (`/c/gfw-src/_cong-aud/PLAN.md`, 12:49, 344650 B). Se restauró desde ahí
más la re-aplicación de los parches del día, que son idempotentes. Pérdida medida: **~3707 bytes**
escritos entre el congelado y el parche, que incluían una fila entera (`JANITORSINCRON`), reconstruida
y marcada como reconstruida.

**Los dos fixes, y van al código, no a un comentario:**

1. **Escritura atómica.** Se escribe a un temporal y se renombra (`os.replace`, atómico en NTFS igual
   que en POSIX). Un fallo a mitad deja el original intacto. Abrir en `"w"` el archivo bueno es
   apostar a que la serialización no falle.
2. **El emoji va como `\UXXXXXXXX`**, nunca como par de surrogates. Y antes de cada parche, un `cp`
   con fecha: cuesta nada y habría dejado la pérdida en cero.

**🔴 LA SIMETRÍA QUE IMPORTA, y es el motivo de que esta clase no se vea venir: el mismo día, el
final de línea produjo CUATRO fallos de parcheo y los cuatro fueron BENIGNOS.** Un patrón con `\n`
contra un archivo CRLF da **0 matches**, el script aborta sin escribir y el síntoma es
«NO ENCONTRÉ EL ANCLA» — que se lee como «el texto cambió» cuando el texto está ahí, intacto. Casos
medidos: git escribió un conflicto con finales **mezclados dentro del mismo hunk** (`<<<<<<<` y
`=======` con LF, `>>>>>>>` con CRLF); `CONTEXT.md` es CRLF puro (238) y `COORDINACION.md` LF puro
(1223); `contar-veredictos.py` CRLF puro (2591) contra un `\n}\n`. Todos costaron minutos y ningún
byte.

**La diferencia no es la causa — es DÓNDE falla.** Un error al **leer** o al **buscar** aborta antes
de tocar el disco: barato, ruidoso, autocorregible. Un error al **serializar** ocurre con el archivo
ya truncado: silencioso hasta que alguien lo abre, y destructivo. Por eso la pregunta al escribir un
parche no es «¿puede fallar?» sino **«¿en qué momento falla, antes o después de abrir el destino?»**
— y la respuesta correcta es volverla irrelevante escribiendo a un temporal.

Relacionadas: [[el-indice-truncado-fabrica-duplicados]] (la otra forma en que un archivo
truncado miente: lo que se cortó no existe para nadie) ·
[[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]] (destruir lo que sólo vive en el
disco) · [[un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola]] (el respaldo que te
salva lo hizo otra sesión para otra cosa).
