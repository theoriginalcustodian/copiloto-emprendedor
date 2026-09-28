---
name: el-fallo-que-se-mueve-acusa-al-recurso-compartido
description: Mi sonda envolvía `goto` + `waitForSelector` en un `try/catch {}` común y contaba fallos sin leer el mensaje. Reporté «timeout esperando #s-apar.on» durante dos turnos; el que fallaba era el `goto` con `waitUntil:networkidle`. El catch no atribuye, pero el humano sí — y nombra el último await que escribió.
metadata:
  type: feedback
---

# 🪤🏷️ El fallo que se MUEVE acusa al recurso compartido — y un `catch` sobre dos `await` no atribuye

**LEER cuando un instrumento cuenta éxitos y fallos de una secuencia de pasos** — sondas, smokes,
healthchecks, cualquier `for` con `try/catch` que acumule una tasa.

## Qué pasó (2026-09-28, criterio 3, prototipo Odobi)

La corrida B1 falló en tres capturas. Mi sonda reportó, y yo repetí a dos sesiones:

> «timeout de 10 s esperando `#s-apar.on` a desktop»

El código que producía ese diagnóstico:

```js
try {
  await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`#s-${id}.on`, { timeout: 10000 });
  ok++;
} catch {
  /* cuenta como fallo */      // ← el mensaje se tira acá
}
```

**El que fallaba era el `goto`.** `page.goto: Timeout 8000ms exceeded`, medido en cuanto imprimí el
mensaje en vez de contarlo. El `waitForSelector` de la segunda línea **nunca llegó a ejecutarse** en
las corridas que reporté como «el selector no aparece».

El `catch` no atribuyó nada — no puede, abarca los dos pasos. **La atribución la puse yo**, y elegí
el `await` que tenía en la cabeza: el del selector, porque era el que estaba depurando. El
instrumento fue neutral; el relato no.

## Por qué costó dos turnos, y no uno

Porque la causa falsa **era plausible y medible**. Monté una sonda de tasa, salió 40-60%, y el
patrón «intermitente» encajaba perfecto con «la espera es corta». Dos instrumentos distintos
midiendo la misma métrica equivocada se confirman mutuamente.

Lo que rompió el círculo no fue re-medir: fue mirar **los milisegundos de los éxitos**. Salían a
19-104 ms contra un timeout de 10 s. Un timeout mal elegido produce éxitos *cerca* del límite — si
el más lento entra en el 1% del presupuesto, la espera no es la variable. Ese número estaba en la
salida de la primera sonda, debajo del veredicto que decía lo contrario.

## La regla

1. **Un `catch` por operación falible, o el mensaje se imprime.** Si un `try` abarca varios `await`,
   el mínimo es `errores.push(String(e.message).split('\n')[0])` y mostrarlo: el primer renglón de
   un error de Playwright dice `page.goto:` o `waitForSelector:` y eso *es* la atribución.
2. **Antes de nombrar el paso que falló, preguntá cuál era el ÚLTIMO que corrió.** Si el paso 1 se
   cuelga, el paso 2 no falló: no existió.
3. **Un patrón que encaja con tu hipótesis no la confirma si medís la misma cosa dos veces.** Buscá
   el número que la refutaría — acá, las demoras de los éxitos contra el presupuesto del timeout.

## Emparentadas, y en qué se diferencian

- [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] — ahí el wrapper
  **afirma** una causa falsa; acá el instrumento no afirma nada y el hueco lo llena el operador.
- [[el-pipe-se-come-el-exit-code]] · [[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]] —
  la misma familia: el veredicto sobrevive y la evidencia que lo contradecía se descarta en el camino.
- [[dos-causas-suficientes-el-test-no-atribuye]] — ahí dos causas reales; acá una sola, mal nombrada.
