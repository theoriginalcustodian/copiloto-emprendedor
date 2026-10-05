---
name: un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion
description: Un estado que ante la duda degrada al caso menos alarmante hace que el instrumento mida el caso benigno sin saberlo; no hay error ni vacío, hay una pantalla plausible del otro caso
metadata:
  type: project
---

# 🩹🎭 Un degradado PRUDENTE hacia el caso benigno envenena la medición

Cuando la UI, ante la duda, muestra **el estado menos alarmante**, cualquier instrumento que no espere
el settle real mide **ese** estado y lo reporta como el verdadero. **No hay error, no hay vacío, no hay
timeout: hay una pantalla plausible del otro caso.**

Es la decisión correcta para el usuario y la peor posible para una medición, y las dos cosas a la vez.

## El caso (2026-09-28, BL-Q3 v2 §9.ter)

`useEstadoGoogleCalendar` arranca en `null`, y el docstring de `PanelCalendario`
(`MidiaScreen.tsx:305-312`) lo declara: sin señal se degrada al texto de «nunca conectada», **«el menos
alarmante de los dos ante la duda»**. Un chequeo con timeout fijo de 1.5s cayó en ese render y reportó
«no conectado» donde el estado real y estable era `caido` — consistente en 4 corridas con el settle
correcto.

**Costo:** un pedido a backend, un diagnóstico completo de la cadena de Composio, una sección de
contrato entera (`§9`) y una alternativa de gateway inyectable. **Ninguna era necesaria: el estado
estaba en prod todo el tiempo.**

## Qué hacer, en orden de costo

1. **`grep` de «se degrada» / «ante la duda» / «menos alarmante» / «fallback» en el módulo ANTES de
   medir.** Es un grep, no una medición: lo más barato del método y lo que más falsos veredictos evita.
2. **Esperar la condición real** — que el `*-cargando` se desmonte, o la respuesta del endpoint. Nunca
   un timeout fijo como criterio de listo.
3. **Control del dato crudo** — el body del endpoint, no sólo el testid que lo pinta.

## La familia

Hermana del `if (a) a.click()` del prototipo (`index.html:3470`, misma fecha): las dos fueron escritas
**por prudencia** y las dos convierten una falla detectable en una foto perfecta de otra cosa. El guard
de nulidad borró la única señal; el degradado benigno fabricó una señal falsa y creíble.

Pariente de [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] y de
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]]: las tres son el instrumento afirmando un
estado cuando debería decir «todavía no sé». Y de [[supuesto-cuya-falla-parece-un-estado-legitimo]], que
es la pregunta que lo caza: **¿cómo se vería esto si fuera falso?** Acá: idéntico a un caso legítimo.

---

## Refuerzo 2026-10-05 · completar una columna en LOTE con el valor mayoritario es fabricar dato

Había que completar la columna `plataforma` de 16 mediciones repartidas en tres documentos. En dos
documentos las 11 filas eran todas `web` y el relleno uniforme fue correcto. En el tercero, **una de
las cinco era `mobile`** —la fila lo decía en su propio texto: «tercer estado en mobile — fuera del
alcance del proto web»— y el relleno uniforme la habría metido dentro de la cifra de cobertura **web**,
que es justo el número que el sprint usaba como DoD.

Lo que empuja al error es que el lote parece prudente: 4 de 5 son `web`, el documento entero habla de
un prototipo web, y el valor mayoritario «no puede estar muy mal». Pero una columna que alguien rellenó
por mayoría no es una medición: es una afirmación con forma de dato, y queda indistinguible de las que
sí se midieron.

**How to apply:**
- **El valor sale del elemento, no del documento.** Acá cada fila citaba su camino de código: tres
  componentes existían sólo en `apps/copiloto-web` (`git ls-files` lo dijo) y uno decía `mobile` en
  prosa. La evidencia por fila estaba escrita; lo que faltaba era leerla una por una.
- **Desconfiá del relleno homogéneo cuando el valor alimenta una cifra de cobertura**: si el campo
  decide en qué cubo cae la fila, un valor puesto por mayoría mueve el total sin que nadie mida nada.
- **Mi primera hipótesis también era uniforme y al revés** («son todas mobile, el proto es mobile-only»).
  Las dos lecturas uniformes estaban mal: el eje correcto era *qué plataforma de app se midió*, no *con
  qué soporte se capturó*. Cuando dos valores uniformes compiten, suele faltar la pregunta, no el dato
  ([[supuesto-cuya-falla-parece-un-estado-legitimo]]).
