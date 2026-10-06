---
name: una-simulacion-calibrada-a-la-linea-base-no-valida-la-capa-que-no-modela
description: Mi simulación reprodujo al dígito los 4 ids del instrumento real y dijo «0 regresiones»; el instrumento encontró 9 falsos positivos en la capa que la simulación no tenía.
metadata:
  type: feedback
---

Para medir el efecto de un cambio en un lector antes de aplicarlo, escribí una simulación en awk de
su regla de parseo y la corrí sobre los 153 renglones reales. **Reprodujo la línea base al dígito:
los mismos 4 ids malformados que reportaba el instrumento, uno por uno.** Con esa calibración en la
mano, su veredicto fue: 4 malformados → 2, **«REGRESIONES: NINGUNA»**.

Apliqué el cambio y el instrumento real reportó **9 falsos positivos nuevos** —`BLQ2`, `FACTID`,
`LEGAL`, `X10`, `BLQ4`, `B1`, `MIDIA`, `CIVERDE3`, `ALFACAN`—, los 9 renglones de 3 campos.

**La causa estaba en una capa que la simulación no tenía.** El lector pasa los campos de awk a bash
y los lee con `read`. Yo había elegido el tab como separador; el tab es **whitespace de IFS**, así
que `read` colapsa los delimitadores consecutivos: un campo vacío desaparece y todos los siguientes
corren un lugar. El disparador vacío de esos 9 renglones hacía que `$estado` recibiera el **prefijo
del renglón**. Mi simulación modelaba la **regla de parseo**; el defecto vivía en el **transporte**.

**Por qué la coincidencia con la línea base no protegía:** los 4 ids coincidían porque esos 4 estaban
mal por la regla, que es lo único que la simulación modela. Los 9 sanos coincidían porque estaban
bien en los dos mundos: la simulación los leía bien por su regla, el instrumento los leía bien porque
todavía no tenía el transporte roto. **Un acuerdo en la línea base sólo acredita las capas que ambos
comparten.** La simulación no podía producir el hallazgo ni siquiera por casualidad.

**Qué hacer en vez de confiar en la calibración:** preguntarse *¿qué capas tiene el instrumento que
mi simulación no tiene?* y, si la respuesta no es «ninguna», no publicar «0 regresiones» — correr el
instrumento. Acá el instrumento tardaba 29 s y lo corrí recién después de aplicar el cambio.

**Y el pariente del mismo día, de la misma familia:** para medir cuántos renglones tenía el bloque,
reimplementé la extracción del instrumento con `sed -n '/COLA-VIVA/,/FIN-COLA-VIVA/p'`. Ese marcador
**no existe** (son `COLA-VIVA:INICIO` / `:FIN`), así que el rango barrió hasta el final del archivo:
201 renglones en vez de 153, y **dos hallazgos inventados** (`COBROMP`, `FACTGATEPROD`) que estaban
fuera del bloque. Los descarté sólo porque corrí el instrumento. Reimplementar la extracción en vez
de reusar la del lector —`awk '/COLA-VIVA:INICIO/{on=1;next} /COLA-VIVA:FIN/{on=0} on'`, que está
escrita y a mano— no ahorró nada y fabricó trabajo falso.

**Por qué:** una simulación se construye para ser más rápida que el instrumento, y lo logra dejando
capas afuera. Esas capas son exactamente donde vive lo que no se te ocurrió. Cuando además coincide
con la línea base, el acuerdo **se siente** como validación y apaga la pregunta.

**Cómo aplicarlo:** una simulación sirve para **elegir** entre alternativas, nunca para **declarar**
el resultado. El renglón de evidencia lo escribe el instrumento, corrido sobre el sujeto real, después
del cambio. Si la simulación dice «0 regresiones», eso es una hipótesis con la forma de un número.

Relacionadas: [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] ·
[[instrumento-que-no-mira-nunca-falla]] · [[un-control-positivo-con-esperado-falso-acusa-al-script]] ·
[[el-canario-el-control-positivo-de-lo-que-falla-callado]] ·
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]
