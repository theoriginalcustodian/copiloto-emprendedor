# Guión de entrevista — Agente de viajes Disney

> **Fecha:** 2026-07-20 · **Propósito:** descubrimiento de dominio para el vertical Disney del copiloto.
> **Formato de respuesta:** audio (se transcribe después con Groq Whisper).
> **Duración objetivo:** 30-45 min de grabación.

---

## PARTE A — Notas para David (no reenviar)

**Por qué está diseñado así.** Casi todas las preguntas piden **recordar algo que ya pasó**, no opinar sobre
algo que podría pasar. Es deliberado: preguntarle a alguien "¿te gustaría una app que haga X?" siempre da
que sí, y ese sí no vale nada. Preguntarle "contame la última vez que se te pasó una fecha" da un hecho
con fecha, plata y consecuencia — eso sí se puede diseñar.

**Reglas que sostienen el guión:**

- **Cero mención a lo que vamos a construir** hasta la última pregunta. Si sabe que estamos haciendo un
  asistente, va a describir su trabajo en términos de lo que cree que el asistente debería hacer, y
  perdemos el dato crudo. Si te pregunta de qué se trata antes de grabar: "estoy estudiando cómo trabajan
  los agentes de Disney, contame nomás cómo laburás vos".
- **Los números importan más que las opiniones.** Cada vez que aparezca un "muchas veces", "un montón",
  "siempre", queremos el número: cuántas, cuánto tiempo, cuánta plata.
- **No la ayudes a responder.** Si manda un audio corto y vago, mejor repreguntar puntual después que
  haberle dado la respuesta en la pregunta.

**Qué vamos a extraer de la transcripción:** el flujo operativo real, el inventario de herramientas y
planillas, las fechas-regla que efectivamente vigila, el costo en tiempo y en plata de lo que se le escapa,
y el vocabulario exacto del dominio (cómo le dice ella a cada cosa — eso va directo al prompt del agente).

**Bloque 8 es opcional.** Si querés mantener la entrevista corta, sacalo; es el único que revela intención.

---

## PARTE B — Para reenviar (esto es lo que le mandás)

### Cómo grabarlo

Hola! Necesito entender bien cómo es tu trabajo del día a día. Te dejo unas preguntas para que me
contestes **en audio** — no hace falta que escribas nada.

Un par de cosas que ayudan mucho:

- **Decí el número de la pregunta antes de contestar** ("pregunta 4...") así después puedo ordenarlo.
- Podés mandarlo en varios audios, uno por bloque, o todo seguido. Como te quede cómodo.
- **No lo prepares ni lo edites.** Contestá como si me lo estuvieras contando por teléfono. Los "eh...",
  las idas y vueltas y los "ah, pará, ahora que me acuerdo" son justamente lo que más me sirve.
- Si una pregunta no aplica a vos, decilo y seguí. Si te aburre, saltala.
- Cuando puedas, **dame números y ejemplos concretos** en vez de generalidades. "Se me pasó una vez en
  marzo con la familia Gómez y perdí 400 dólares" me sirve muchísimo más que "a veces se me pasan cosas".

---

### Bloque 1 — Cómo trabajás

1. Contame en qué consiste tu trabajo, como se lo explicarías a alguien que no tiene idea de qué hace un
   agente de viajes. ¿Trabajás sola, para una agencia, como independiente? ¿Hace cuánto?

2. ¿Qué vendés exactamente? Nombrame los tipos de cosas que vendés y, si podés, decime más o menos qué
   porcentaje de tus ventas es cada una.

3. ¿Cuántas ventas cerrás en un mes normal? ¿Y en el mejor mes del año, cuál es y por qué?

4. ¿Cuántos viajes tenés "en el aire" ahora mismo? O sea, gente que ya te compró pero todavía no viajó.

---

### Bloque 2 — Una venta de punta a punta

5. Pensá en **la última venta que cerraste**. Contame toda la historia desde el principio: cómo apareció
   ese cliente, qué te pidió, cómo le armaste la propuesta, cómo te dijo que sí, y qué hiciste después de
   que te dijo que sí. Tomate el tiempo que necesites, esta es la pregunta más importante de todas.

6. En esa misma venta: ¿en qué sistemas o páginas tuviste que entrar? Nombrámelos todos, incluso los
   obvios (WhatsApp, mail, la página de Disney, lo que sea).

7. Una vez que la reserva quedó hecha, ¿dónde la anotaste? ¿En una planilla, en un cuaderno, en un
   sistema, en la cabeza? Describime exactamente ese lugar: si es una planilla, ¿qué columnas tiene?

8. ¿Cuánto tiempo te llevó, desde que el cliente dijo "dale" hasta que quedó todo cargado y en orden?

---

### Bloque 3 — Las fechas

9. Desde que un cliente te compra hasta que viaja, ¿qué cosas tenés que hacer o avisar en el medio? Nombrame
   todas las que te acuerdes, con cuánto tiempo antes hay que hacer cada una.

10. ¿Cómo hacés hoy para no olvidarte de esas fechas? Contame el mecanismo real, aunque sea "me acuerdo" o
    "me lo anoto en el celu".

11. **Contame la última vez que se te pasó una fecha.** Qué era, por qué se te pasó, y qué pasó después.

12. ¿Alguna de esas veces te costó plata, o le costó plata al cliente? ¿Cuánta?

13. De todas las fechas que vigilás, ¿cuál es la que más miedo te da que se te escape, y por qué esa?

---

### Bloque 4 — La plata

14. Explicame cómo te pagan a vos. ¿De dónde sale tu comisión, quién te la paga y cuándo?

15. ¿Cómo sabés cuánto te tienen que pagar en un momento dado? ¿Dónde mirás eso?

16. ¿Te pasó de que no te pagaran una comisión, o que te pagaran de menos, o que te la pagaran mucho más
    tarde de lo que correspondía? Contame algún caso concreto.

17. Si ahora mismo te preguntara "¿cuánta plata te deben?", ¿cuánto tardarías en darme el número exacto?
    ¿Y cómo lo sacarías?

18. ¿Los clientes te pagan a vos directamente, o le pagan al proveedor? Si te pagan a vos, ¿cómo? ¿Y cómo
    llevás la cuenta de quién te pagó cuánto y qué le falta?

---

### Bloque 5 — Los clientes

19. Entre que te compran y que viajan, ¿cuánto te escriben? ¿Por dónde y para preguntar qué?

20. ¿Cuáles son las tres preguntas que más te repiten los clientes? Las mismas de siempre.

21. ¿Hay mensajes que mandás vos siempre, más o menos iguales, a todos los clientes? ¿Cuáles?

22. ¿Los tenés escritos en algún lado o los reescribís cada vez?

---

### Bloque 6 — Lo que duele

23. Contame cómo fue **tu peor día de trabajo** de este año. Qué pasó.

24. Si mañana pudieras dejar de hacer para siempre **una sola** de las tareas de tu trabajo, ¿cuál sacarías?
    ¿Y por qué justo esa?

25. ¿Qué parte de tu trabajo sentís que es la más boba, la que hacés en piloto automático y sentís que es
    una pérdida de tiempo?

26. ¿Cuántas horas por semana calculás que se te van en eso?

27. ¿Hay algo que sabés que **deberías** estar haciendo y no hacés por falta de tiempo? (Seguimiento a
    clientes viejos, buscar clientes nuevos, revisar si te pagaron todo, lo que sea.)

---

### Bloque 7 — Las herramientas

28. Nombrame **todo** lo que usás para trabajar: apps, páginas, planillas, grupos, cuadernos. Todo, sin
    filtrar por importancia.

29. ¿Pagás por alguna de esas? ¿Cuánto por mes?

30. ¿Probaste alguna que hayas dejado de usar? ¿Por qué la dejaste?

30b. Si trabajás con una agencia o un host: ¿ellos te dan alguna herramienta o sistema, o cada agente se
    arregla con lo suyo? ¿Quién decide qué software se usa?

30c. Cuando pagás una herramienta, ¿la pagás vos de tu bolsillo o la paga la agencia?

31. De todo lo que usás, ¿qué es lo que más te saca? Lo que te hace decir "esto podría ser mucho mejor".

32. ¿Hablás con otras agentes que trabajen con Disney? ¿De qué se quejan ellas?

---

### Bloque 8 — Última (esta sí es de imaginar)

33. Imaginate que tenés un asistente personal, una persona real, que trabaja solo para vos y sabe todo
    sobre tus ventas y tus clientes. Está todo el día disponible. ¿Qué es lo primero que le pedirías que
    haga? ¿Y lo segundo?

34. Ese mismo asistente te puede escribir cuando él vea algo importante, sin que vos le preguntes.
    ¿Por qué cosas querrías que te interrumpa? ¿Y por cuáles preferirías que **no** te moleste?

---

Gracias! Cualquier cosa que te parezca importante y que no te haya preguntado, sumala al final.

---

### Un último favor (esto no es pregunta)

Aparte de los audios, necesitaría que me **reenvíes 2 o 3 mails reales de confirmación** de reservas que
hayas hecho — de Disney, de Universal, de VAX, de lo que tengas. Los que te llegan cuando la reserva
queda confirmada.

Tachá o borrá los datos del cliente si querés (nombre, teléfono, número de tarjeta) — no los necesito.
Lo que me importa es **cómo viene armado el mail**: qué información trae, en qué formato, si dice fechas
de vencimiento, montos, número de reserva.

Si tenés también el mail o el archivo del **estado de comisiones** que te manda la agencia, mandá uno de
esos. Aunque esté viejo sirve.

*(Nota para David: esto es el spike. Lo que venga acá decide si el diferencial principal del producto es
viable o hay que buscar otro. Es el pedido más importante de todo el documento — asegurate de que no se
pierda entre las preguntas.)*
