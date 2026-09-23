---
name: romper-la-capa-interna-de-un-control-en-profundidad-sale-verde
description: El control positivo de un control con defensa en profundidad sale VERDE si rompés la capa de adentro; el verde parece "el test no sirve" cuando en realidad es la capa de afuera funcionando.
metadata:
  node_type: memory
  type: feedback
---

Backend escribió el test adversarial HTTP de `GET /feedback` (#660) y, como manda el DoD, corrió el
control positivo: rompió a mano el mecanismo y esperó verlo en rojo. Rompió el `WHERE cliente_id` del
store — la capa de adentro — y el test siguió **VERDE**. No porque el test fuera ciego: porque RLS
`FORCE` lo tapó. Recién al romper `require_tenant`, la capa de afuera, dio rojo limpio.

**Why:** un control positivo prueba *este instrumento ve este defecto*, y con una sola capa eso es
inequívoco. Con **defensa en profundidad hay N defectos posibles y sólo el de la capa más externa es
observable**: romper cualquier capa interna produce el mismo verde que un sistema sano. Lo peligroso
es cómo se lee ese verde. Las dos lecturas disponibles son «mi test no sirve» y «hay una capa que no
sabía que estaba», y la primera es la que viene a la mano — lleva a tirar un test bueno, o peor, a
declarar que el control positivo «no se pudo hacer» y cerrar igual. La segunda es un **hallazgo**:
acabás de medir que la redundancia existe y funciona, algo que normalmente nadie verifica.

Y hay un tercer verde, el que de verdad muerde: si mañana alguien **borra** la capa externa, el `WHERE`
roto deja de estar tapado. Un control positivo que sólo probó la externa no dice nada sobre eso.

**How to apply:** antes de romper algo para el control positivo, **enumerá las capas** que pueden
denegar ese request (guard de request, filtro de query, RLS, policy de la DB) y rompé la **más
externa** — es la única cuya ausencia el test puede ver. Si rompés una interna y sale verde, **no es
un fallo del test: es la capa de afuera tapándola**, y eso se escribe en la entrega. La forma correcta
es la que usó backend: declarar **qué se rompió y qué color dio cada capa**, no un «control positivo:
OK» sin sujeto. Y si querés cobertura de las capas internas, necesitás un test por capa, no uno solo.

Emparenta con [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] y con
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]]: acá el instrumento **absolvía** al `WHERE` roto.
