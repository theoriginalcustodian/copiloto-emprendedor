---
name: la-costura-leia-un-campo-que-nadie-escribe
description: La costura HTTP nunca depositó un error en la DLQ — leía request.state.cliente_id, que nadie en el backend escribe. Un lector y un escritor que nunca se contrastaron, con getattr(default=None) tapando la evidencia y un test que fabricaba el escritor que producción no tiene
metadata:
  type: project
---

**Medido el 2026-08-01 (PR #191).** `handler_errores_web` sacaba el tenant de
`request.state.cliente_id`. **Nadie en todo el backend escribe ese atributo**: `require_tenant`
(`auth.py:117`) declara el tenant en el `ContextVar` de `contexto_tenant`. Grep con control positivo:
las dos únicas apariciones del atributo estaban en el propio handler — o sea, sólo el lector.

Con `cliente_id=None`, `depositar()` corta en su primera línea (`if fabrica is None or not
cliente_id`). **Ningún error de las ~80 rutas HTTP llegó nunca a la DLQ en producción.** La Fase 2
estaba viva sólo del lado de las activities, que sacan el `cliente_id` del payload. El ciclo de
autosanación no puede reparar lo que nunca ve, y no veía la mitad de la app.

## Las tres cosas que lo hicieron invisible

1. **`getattr(request.state, "cliente_id", None)` convierte "nunca se escribió" en "no hay tenant",
   que es un caso legítimo** (rutas públicas: health, webhooks). El default no es neutral: le da al
   fallo la forma exacta del caso normal. Un `AttributeError` habría gritado el primer día.
2. **No rompe nada.** El 500 salía igual con su fingerprint, el log quedaba igual. Sólo faltaba la
   fila — y una DLQ vacía se lee como *"no falla nada"* en vez de *"no entra nada"*
   ([[el-indice-truncado-fabrica-duplicados]] tiene la misma forma en otro dominio).
3. **El test fabricaba el escritor.** Montaba su propia app con un middleware que sí seteaba
   `request.state.cliente_id`, y su comentario afirmaba *"que es donde lo deja `require_tenant` en
   producción"*. Era falso y nadie lo contrastó contra `auth.py`. Verde sobre un montaje inventado:
   [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]].

## El patrón, para reconocerlo en otro lado

**Un campo compartido entre dos módulos necesita que alguien haya verificado al ESCRITOR, no sólo al
lector.** Acá había un lector, cero escritores, y tres capas de amortiguación (`getattr` con default,
`depositar` que nunca lanza, un test con escritor propio) que convertían la ausencia total en
operación normal. Cada una de esas tres defensas es correcta por separado; juntas forman un silencio
perfecto.

**El control que lo caza en 30 segundos:** por cada campo que un módulo LEE de un objeto compartido
(`request.state`, `context`, `payload`, `meta`), grepear **quién lo escribe** — con control positivo
para saber que el grep ve algo. Si el único hit es el lector, ya está: el campo siempre vale su
default.

## Cómo apareció

Diseñando el canario de salud, cuyo propósito era distinguir "no falla nada" de "el cable está
cortado". El cable ya estaba cortado. **El detector encontró el fallo antes de existir** — el diseño
obligó a preguntarse cómo entra un error al sistema, y esa pregunta no se la había hecho nadie desde
que se construyó la costura.

## El fix, y su prueba

`cliente_id = getattr(request.state, "cliente_id", None) or tenant_actual()` — la fuente real, con
`request.state` como fallback para quien quiera setearlo. Diferencial:

```
sin el fix → 1 failed (test_REPRODUCCION...), 66 passed
con el fix → 67 passed
suite completa → 1470 passed
```

**Los otros 66 tests pasan igual CON el bug presente.** Era invisible para la suite entera; sólo un
test que falla antes y pasa después lo separa ([[no-romper-no-es-arreglar]]). El test nuevo monta el
borde real —dependencia `async` que declara el tenant— y de paso valida el supuesto del que depende
el fix: que el `ContextVar` sigue visible desde el exception handler.

---

## Vuelta (2026-09-30): buscar la declaración en el elemento que **no puede escribirla**

La versión de arriba es sobre un **campo**: se lee `request.state.cliente_id` y nadie lo escribe. Hay
una vuelta más difícil de ver, porque el lugar donde se busca es el lugar *obvio*: cuando el dato es una
**relación entre dos elementos** —A invalida a B, A reemplaza a B, A cierra a B—, la declaración sólo
puede vivir en **el elemento que produce el cambio**. Buscarla en el que lo *sufre* es buscar en el único
lugar donde estructuralmente no puede estar.

**Caso, 2026-09-30.** `contar-veredictos.py` clasifica el barrido de 35 pantallas del 22/09 como medición
vigente, y deja escrito que buscó el retiro y no existe:

> «Buscado en TODO el buzón: el retiro existe **únicamente en su `cierre_` del 29/09** […] excluirlo
> sería aplicar un retiro que sólo vive en la memoria de una sesión.»

La negativa era correcta y la búsqueda fue honesta: miró **el documento retirado** y **los contratos**.
El retiro estaba escrito desde el 22/09 —con el path entre backticks, por FE1, el mismo autor del
documento retirado— en el encabezado de **su sucesor**:

> «mi barrido anterior (`…BL-Q3-web-barrido-35-pantallas.md`) […] por contrato, eso **invalida como
> evidencia las 22 filas completas**»

**Por qué el documento retirado no podía decirlo: cuando se emitió, era la medición vigente.** Un
documento no puede saber que será superado. La invalidación nace después y la escribe quien la produce.

**Y eso invierte la forma del arreglo.** La fila del tablero pedía «un tercer estado `RETIRADO_POR: <doc>`
en el formato» — o sea, escribir la marca en el documento viejo. Medido, esa forma no puede tener
cobertura: exige **volver a editar un mensaje ya emitido por otra sesión**, que es justamente lo que las
reglas del buzón prohíben. Nadie lo iba a hacer nunca, y su cobertura 0 se habría leído como desidia. El
campo que sí se llena es el del sucesor (`SUPERSEDE:`), y **2 de 3 sucesores ya lo escribían en prosa sin
que ninguna convención lo pidiera** — la convención correcta era la que el corpus ya estaba usando.

**Cómo aplicarlo:** ante un estado que describe una relación, preguntá *cuál de los dos extremos estaba
en condiciones de saberlo en el momento de escribir*. Si la respuesta es «el otro», la ausencia no es un
hueco del corpus: es que el lector está mirando el extremo equivocado. Y antes de exigir un campo nuevo,
mirá si el corpus ya declara ese dato de alguna forma — un campo que pide lo imposible nace con cobertura
0 y la mantiene. Ver [[medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria]] y
[[el-nombre-es-una-hipotesis-sobre-el-contenido]].

---

## Refuerzo (2026-09-30): el espejo — el detector CALCULA la condición, la imprime, y no la devuelve

Mismo tronco, lado opuesto: allá un lector leía un campo que nadie escribía; acá **el emisor detecta el
problema y no lo publica**, así que ningún lector puede propagarlo aunque quiera.

```js
async function esperarCargado(page, testidCargando, timeout = 30000) {
  const ok = await page.waitForSelector(..., { state: 'detached', timeout })
    .then(() => true).catch(() => false);
  if (!ok) console.log(`  ⚠️  ${testidCargando}: seguía visible — la captura puede estar en loading`);
}                       // <-- no hay `return ok`
```

Ocho call-sites hacen `await esperarCargado(...)`. **Ninguno ignora el resultado: no hay resultado.**
La función sabe exactamente lo que hace falta saber —la pantalla quedó en esqueleto de carga—, lo dice
por consola entre cientos de líneas, y la fila se reporta igual que una medida. El mismo instrumento
tenía el canal correcto a diez líneas de distancia (una lista `noMedibles` con su `porque`, y un
comentario propio que decía *«sin este campo, el instrumento convierte lo no medible en aprobado»*):
lo que faltaba era que el detector de runtime **hablara ese idioma**. Y el defecto vivía dos veces —el
detector de Agenda, quince líneas más abajo, tenía el mismo `.catch(() => console.log(...))`.

**Why:** porque un `console.log` se lee como «ya está reportado» cuando en realidad es el lugar donde la
información muere. La revisión no lo caza: el aviso **existe**, es correcto, está bien redactado, y el
que lo escribió entendió el problema. Lo que no existe es el cable entre el aviso y el veredicto.

**How to apply:** (1) ante una función que detecta algo, preguntá **qué devuelve** — si no devuelve, el
único destino de lo que detectó es la consola; (2) `grep` del nombre de la función y mirá si algún
call-site **usa** el valor: cero usos puede significar «no hay valor», que es peor que ignorarlo;
(3) todo detector de una condición que invalida una medición tiene que emitir por el mismo canal que
las demás invalidaciones — si el proyecto ya tiene un «no medible», el detector nuevo entra ahí, no a
`console.log`; (4) contá cuántas veces está el patrón antes de arreglar uno.
