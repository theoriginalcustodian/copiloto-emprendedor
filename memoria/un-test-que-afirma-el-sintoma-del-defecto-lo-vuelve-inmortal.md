---
name: un-test-que-afirma-el-sintoma-del-defecto-lo-vuelve-inmortal
description: El caso 7 exigía el banner DEGRADADO, que era justo lo que el bug producía — verde POR el bug, 5 días
metadata:
  type: feedback
---

Un test cuya aserción es **el síntoma que el defecto produce** no sólo deja pasar el bug: lo **protege**.
Cada corrida verde lo acredita, y nadie vuelve a mirar esa rama.

**El caso, medido el 2026-10-13.** `scripts/vigia.sh` tenía en su rama de recuperación del pin un `\n`
**literal inline** (entró con el archivo original, PR #953, 2026-10-08), así que ejecutaba
`git worktree add --detach "$PIN" "$REF" n` — un argumento de más. El `add` fallaba **siempre** y el
lanzador se declaraba `DEGRADADO`. El caso 7 del test afirmaba:

```
if grep -q 'DEGRADADO' "$TMP/e7b"; then ok "pin roto ⇒ DEGRADADO (no lo usa a ciegas)"
```

O sea: **exigía exactamente la salida que el defecto garantiza.** Suite 22/0 durante 5 días. Al arreglar
el `\n`, el test se puso **ROJO** — y ese rojo fue la prueba del fix.

**Por qué es distinto de «el control positivo cubre una mitad»** ([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]):
ahí la otra mitad queda **muda**. Acá la aserción está **alineada con el bug**: no es que no mire, es que
mide la cosa equivocada y el bug la hace cierta. Un test mudo no te engaña; este te **confirma**.

**Y había un segundo defecto debajo, que sólo apareció al medir el primero:** `worktree add` plano **y**
`--force` fallan igual sobre un directorio existente (`fatal: ... already exists`). Lo único que recupera
es sacar la carcasa del camino. O sea la rama era **inalcanzable** aun sin el `\n`: `DEGRADADO` para
siempre. Arreglar el síntoma visible no alcanzaba; había que ejercitar la rama.

**Why:** el test se escribió desde la intención («que no lo use a ciegas» ⇒ que avise), y «que avise» es
observable mientras «que se recupere» no se miró. La intención y la propiedad no son lo mismo: la
intención era *no usar un pin roto*, y la propiedad que la cumple es **que el pin vuelva**, no que haya
banner. El banner es el plan B.

**How to apply:** ante un guard con rama de error, preguntate *«si el mecanismo que esta rama protege
estuviera roto, este test sería verde o rojo?»*. Si la respuesta es **verde**, la aserción es el síntoma.
Dos aserciones, no una: **(a)** el caso se RECUPERA y el efecto bueno ocurre · **(b)** cuando la
recuperación es imposible, el aviso sigue estando. Y un mutante por cada una — si un solo mutante pone
las dos en rojo, no discriminan. (En este caso: devolver el `\n` ⇒ rojo sólo (a), con (b) verde; quitar el
re-exec ⇒ rojo sólo el caso 9.)

Hermanas: [[el-guard-falla-abierto-en-su-caso-de-activacion]] (leé la rama de ERROR) ·
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[instrumento-que-no-mira-nunca-falla]].
