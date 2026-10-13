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

---

## Refuerzo 2026-10-13 — la norma era INSATISFACIBLE, y la adopción cero parecía desobediencia

El 2026-10-08 bajé una norma a las tres sesiones: *«nadie trabaja sin goal — la orden de trabajo se
declara y el gate la compara»* (`scripts/goal.sh` + `.githooks/pre-push`). Cinco días después el
barrido medía **0 de 59 worktrees con orden declarada**, y lo leí como un problema de disciplina.

**Lo medido:** `goal.sh set <ID>` valida contra un padrón cuyo patrón de id es
`RE_ID='\b(BL-[A-Z0-9]+|DEC-[0-9]+|M-[0-9]+)\b'`, y **la cola viva nombra sus filas en MAYÚSCULA**
(`SNIPPETMIENTE`, `DURABGATE`, `GUARDSOLOWEB`). Control en las dos direcciones: `set BL-V1` → aceptado
con su DoD; `set SNIPPETMIENTE` → `⛔ no está en el padrón`. **Ninguno** de los ~60 ids del tablero
entraba. La norma no se desobedecía: **no se podía cumplir.**

**Por qué no dio síntoma:** el fail-closed del padrón es correcto («un goal que yo me invento no es una
orden de trabajo») y su mensaje de rechazo **culpa al que pide**, no al padrón. Y el consumidor que
reportaba el agregado (`atribucion.sh`) corre en modo REPORTE, así que el 0/59 se imprimía cada ciclo
sin que nadie lo tomara por un defecto del instrumento.

**Y el error de inferencia que cometí encima, porque es el mismo vicio:** al ver *84% no atribuido* en
los últimos 25 commits de `main`, lo atribuí al mismo vocabulario. Medido después: **0 de 25 asuntos
citan un id del tablero** (los 2 que citan algo citan `BL-O6` y `BL-X6`), así que ese 84% es real y el
fix no lo mueve. Dos números en la misma pantalla, **uno era del instrumento y el otro de la conducta**,
y los expliqué con la misma causa sin medir cuál era cuál.

**How to apply (4):** antes de **broadcastear** una norma que un mecanismo va a hacer cumplir, corré el
mecanismo sobre el trabajo REAL de cada rol —no sobre un ejemplo— y guardá el output. Si el padrón, el
corpus o el vocabulario del mecanismo no contiene lo que las sesiones tienen contratado **hoy**, la
norma nace insatisfacible y su adopción cero te va a parecer desobediencia durante días. El control es
una línea: tomá el id de la cabeza de la cola y pedíle al mecanismo que lo acepte.
→ [[un-criterio-de-cierre-con-algo-fuera-de-alcance-no-se-cumple-nunca]] · [[prometer-no-es-ejecutar-el-gate-media-la-palabra]]
