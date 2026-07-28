---
name: el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis
description: Conté 428 workflows "Running" y eran 115 — `temporal workflow list` sin query devuelve TODOS los estados, no sólo los abiertos; un dato inflado no protesta como un vacío
metadata:
  type: feedback
---

**El 2026-07-28, en el dossier de manejo de errores, publiqué "428 workflows Running". Eran 115.** Los
otros 291 estaban `Completed` — un schedule de documed que corre cada 5 minutos y cierra bien. Usé
`temporal workflow list --limit 500` **asumiendo** que devuelve sólo workflows abiertos (el
comportamiento viejo del CLI) cuando devuelve **todos los estados**.

**Por qué este error es más peligroso que un vacío.** Ya tenemos canonizado que
[[vacio-no-es-hallazgo-correr-el-control]]: un 0 se siente sospechoso y disparó el reflejo del control
positivo — en esta misma sesión, dos veces. **Un número grande no dispara nada.** 428 se leyó como
evidencia contundente, encajó con la narrativa que estaba escribiendo ("hay acumulación silenciosa"),
y **la confirmó de más**. El sesgo no fue no-verificar: fue que el dato **decía lo que yo esperaba, en
voz más alta**.

**El control que lo cazó, por casualidad y no por método:** fui a investigar si esos 292 eran fuga y
corrí una query explícita `ExecutionStatus = 'Running'`. Volvió **vacía**. *Ese* vacío sí disparó el
reflejo — y al tirar de ahí cayó el 428. Si no hubiera ido a investigar la fuga, el número falso
quedaba publicado.

**La regla:**

1. **Antes de contar con una herramienta, leé qué devuelve su default** — no el que recuerdas de otra
   versión. `--help` o una corrida con filtro explícito cuesta un comando.
2. **Cuando el dato confirma tu hipótesis con fuerza inesperada, ese es el momento de desconfiar**, no
   de escribirlo. La pregunta es la misma que ante un vacío, invertida: *¿qué devolvería esta
   herramienta si mi hipótesis fuera falsa?* Si la respuesta es "lo mismo", el dato no discrimina nada.
3. **Contá siempre desagregado** (por tipo **y** por estado, no sólo por tipo). El agregado esconde la
   pregunta; el cruce la hace visible sola.
4. **La corrección va DENTRO del documento, no en lugar de él.** El dossier lleva la tabla corregida y
   el párrafo que explica el error, porque un lector futuro necesita saber que el número cambió y por
   qué. Ver [[la-evidencia-vence-y-el-documento-no-lo-dice]].

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento no miraba y su
silencio se leía verde; acá el instrumento miraba **más de lo pedido** y su exceso se leyó como
hallazgo. Y el remate incómodo: me pasó **escribiendo el documento que critica exactamente esto**.
Saber la regla no la aplica; sólo el control la aplica.
