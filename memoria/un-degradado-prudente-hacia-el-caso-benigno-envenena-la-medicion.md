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
