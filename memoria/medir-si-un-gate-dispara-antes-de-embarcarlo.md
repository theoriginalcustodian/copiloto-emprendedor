---
name: medir-si-un-gate-dispara-antes-de-embarcarlo
description: Antes de embarcar un umbral, medí si algún dato del corpus real puede alcanzarlo — si no, es un gate inerte con cara de protección
metadata:
  type: feedback
---

Auditoría propuso reemplazar un control roto mío por «un documento que cubre >80% del padrón es
normativo». Sonaba bien y venía de quien había encontrado el defecto. **Lo medí antes de escribirlo** y
no separa nada:

```
techo de MENCIONES de una medición  : 29/54 (53%)
techo de MENCIONES de un descartado : 29/54 (53%)   <- empate literal
techo de VEREDICTOS de una medición : 22/54
techo de VEREDICTOS de un descartado: 12/54          <- las mediciones están ARRIBA
```

Un gate al 80% **nunca habría disparado**. Y la premisa también se caía: el documento que motivaba el
umbral «citaba 54 de 54» contadas a mano, pero medido contra el padrón cita **29**.

**Why:** un gate inerte es peor que ninguno, y por la misma razón que el control que reemplaza —
promete una garantía que no puede dar, y encima parece rigor. Peor aún: no hay forma de descubrirlo
después, porque un gate que nunca dispara y uno que funciona bien se ven **idénticos** en verde.

**How to apply:** un umbral nuevo se embarca con **dos números medidos sobre el corpus real**: el techo
de lo que debe pasar y el piso de lo que debe frenar. Si no hay brecha entre los dos, el umbral no
existe — buscá otra propiedad, no otro número. Y dejá el empate **impreso en el reporte**, marcado «no
es un gate», para que el próximo que proponga el mismo discriminante lo vea antes de escribirlo: un
callejón sin salida sin señalizar se recorre dos veces. Hermana de
[[un-umbral-calibrado-al-corpus-del-dia-envejece-con-el]] (ése envejece, éste nace muerto) y de
[[instrumento-que-no-mira-nunca-falla]].

---

**Refuerzo (2026-10-06): el caso más rápido en que un barrido nuevo se delata — corrélo contra el hallazgo que
YA tenés en la mano.** Acababa de encontrar que el adversarial de `/catalog` asierta `status` y no `connected`
—el campo cuyo decisor cambió #855—, y para ver si el molde se repetía armé un barrido de los 7 PRs del día:
*¿algún PR cambió código de producto sin tocar un test?* Salida: **0 sospechosos**, y **#855 marcado ✅**
(«código + 1 archivo de test»). O sea, mi barrido daba verde **exactamente sobre el hallazgo que lo motivó**.

**Por qué falla, y es un error de eje, no de implementación:** el barrido mide *«¿existe un test tocado?»* y el
defecto vive un nivel más abajo, en *«¿el test asierta el campo que cambió de dueño?»*. Son dos preguntas
distintas y la gruesa **absuelve** a la fina: el test existía, estaba bien construido, y era el aserto el que
miraba el campo que no se movió. Un barrido cuyo denominador es *archivos* no puede ver un defecto cuyo
denominador es *asertos* ([[instrumento-que-no-mira-nunca-falla]]).

Lo que lo vuelve aprendizaje y no anécdota es que **el control positivo costó cero**: ya tenía un hallazgo
confirmado en el mismo corpus que el barrido iba a recorrer. No hubo que fabricar un canario
([[el-canario-el-control-positivo-de-lo-que-falla-callado]]) — bastó mirar qué decía el barrido **sobre el caso
que ya sabía la respuesta**. Si lo hubiera embarcado sin ese paso, el `0 sospechosos` habría pasado por
tranquilizador y **habría refutado mi propio hallazgo por omisión**.

**How to apply:** (1) todo barrido nuevo se estrena **contra un caso con veredicto conocido** antes de leer su
cifra — y si venís de encontrar algo, ese algo es el canario gratis; (2) si el barrido absuelve al caso
conocido, **el barrido está mal, no el caso**: escribí qué eje mide y qué eje medía el hallazgo, porque casi
siempre difieren en el **denominador** (archivos vs asertos, llamadores vs capacidad, forma vs efecto); (3) un
`0` de un barrido sin ese estreno no es evidencia de ausencia — es evidencia de nada
([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).
