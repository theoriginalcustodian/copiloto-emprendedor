# 🔬🎯 El control que mide la PROPIEDAD destapa el defecto ajeno; el que mide MI ACCIÓN, no

**Fecha:** 2026-10-08 · **Hallazgo:** un defecto de 9 días en el acta, que nadie buscaba y ningún
gate mide.

## Qué pasó

Inserté un bloque en el acta de decisiones y, al releer, vi que había quedado **entre los ítems 3 y
4 de una lista numerada**, partiéndola. Lo moví al final, a una sección propia. Para probar que el
arreglo funcionaba escribí un control — y elegí medir **la propiedad del documento**, no mi acción:

```python
nums = [int(m.group(1)) for m in re.finditer(u"(?m)^(\\d)\\. \\*\\*", seccion)]
print(nums == list(range(1, 8)))     # ¿la lista es 1..7 consecutiva?
```

**Siguió en rojo después de mi arreglo.** `items: [1, 2, 3]`. Y la causa no era mía: un blockquote
del **29/09** partía la misma lista en el mismo lugar, y llevaba **nueve días** ahí. Mi bloque la
había partido una *segunda* vez.

Los dos se agruparon en una sección nueva, que además dejó toda la historia de `DEC-11` en un solo
lugar. La lista volvió a ser 1..7, medido.

## La lección

**Un control que mide la PROPIEDAD que querés («la lista es 1..7 consecutiva») encuentra defectos
que no sabías que existían. Uno que mide TU ACCIÓN («¿moví mi bloque?») da verde con el defecto
intacto.**

Los dos controles parecen igual de rigurosos al escribirlos. La diferencia aparece sólo cuando hay
una **segunda** causa: el que mide la acción confirma que hiciste lo que dijiste, y eso es
precisamente lo que no hace falta verificar. Es el espejo de
[[dos-causas-suficientes-el-test-no-atribuye]]: ahí dos causas hacen que el diferencial salga verde;
acá una causa ajena hace que el control de propiedad siga rojo — **y ese rojo es el hallazgo.**

## Cómo se aplica

- **Escribí el control sobre el ESTADO DESEADO del sistema, no sobre el cambio que hiciste.**
  No «¿reemplacé la línea?» sino «¿el archivo cumple la invariante?».
- **Cuando tu control sigue rojo después de un arreglo que sabés correcto, no ajustes el control:
  buscá la segunda causa.** El reflejo de «mi fix está bien, el test debe estar mal» es el que deja
  vivo el defecto ajeno.
- **Corolario incómodo:** el defecto ajeno tenía 9 días y **ningún gate lo medía** — ningún CI mide
  estructura de Markdown. Los defectos que ningún gate mide sólo los encuentra un control escrito a
  mano, y sólo si mide la propiedad. Ver [[el-guard-que-caza-a-su-propio-autor]] y
  [[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].

## Relación con el resto

Es la mitad constructiva de [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]: ahí el instrumento
emite un falso rojo y eso parece prudencia; acá emite un **rojo verdadero sobre una causa que no es
la tuya**, y el reflejo de descartarlo es idéntico. La pregunta que separa los dos casos es *¿el
rojo señala la propiedad o mi cambio?* — si señala la propiedad, **leelo** antes de tocar el
control ([[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]]).
