---
name: la-excepcion-documentada-que-nunca-disparo
description: "Una regla de escape que nunca se ejecutó es indistinguible de una que no existe: testeala con el dato como lo escribe un humano, no con la forma canónica."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T18:50:48.221Z
---

Cuando un instrumento tiene una **excepción** ("escala salvo que el archivo declare `X`"), el test
tiene que usar el dato **tal como lo escribe un humano en el medio real** — en un `.md` eso es
`**DISPARADOR: pendiente.**`, con negrita, bullet o blockquote — no la forma canónica idealizada
que tenías en la cabeza al escribir el regex.

**Why:** el 2026-08-12 el escalador del buzón anclaba `grep -qiE '^DISPARADOR:[[:space:]]*pendiente'`.
El contrato de lote C la declaraba en negrita, así que el ancla **no llegaba ni a la D**. La regla
existía desde su commit original y **no disparó una sola vez**. Backend la usó de buena fe y escribió
en el propio contrato: *"esta línea es sólo para que `escaladores-buzon.sh` deje de re-alarmar cada
3 min"*. Siguió alarmando. Nadie lo detectó porque el síntoma —la alarma sigue sonando— es idéntico
al caso sano (el disparador realmente está cumplido). Una excepción rota no produce error: produce
el comportamiento por defecto, que es justo el que parece normal.

Lo caro no era el ruido: ese `exit 1` es el que la sesión usa para decidir si hay parálisis. Una
alarma permanente por una espera correcta **es indistinguible de la parálisis real** que el
instrumento existe para cazar — y entrena a saltear la lista entera
([[instrumentos-que-confirman-en-vez-de-verificar]]).

Correr el instrumento arreglado contra el dato real destapó una **segunda** capa que no se sospechaba:
el mismo barrido leía sus *propias* alertas como contratos (glob `*_contrato_*` por substring), y
pasado el umbral generaba una alerta sobre su propia alerta, con el nombre anidado. Reproducido
literalmente en test contra `origin/main`. Es el mismo defecto que
[[clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo]] en otro plano: **el tipo es posicional
(`<fecha>_<tipo>_…`), no una palabra suelta en el nombre**.

**How to apply:** (1) si una alarma se repite sobre algo que sabés correcto, la hipótesis *"la
excepción está rota"* va **antes** que *"todavía nadie la usó"* — verificala con un `--dry-run` sobre
el dato real, no leyendo el código. (2) Todo test de una excepción necesita **control positivo** (sin
la marca, sí escala) y **control de fail-open** (una marca parecida pero distinta —`DISPARADOR:
cumplido`— tiene que seguir escalando); sin el segundo, "tolerar markdown" degenera en "no escalar
nunca". (3) Después de arreglar un instrumento, **corrélo contra el dato de producción**: ahí
aparecieron ambas capas, no en la lectura.
