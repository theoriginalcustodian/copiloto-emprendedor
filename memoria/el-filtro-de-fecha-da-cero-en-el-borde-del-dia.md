# `git log --since=<hoy>` devolvió CERO habiendo seis commits de hoy

**Medido el 2026-11-03, 18:19 UTC**, en `wt-plan-n39b` contra `origin/main`:

```
git log origin/main --since='2026-11-03' --format=%h | wc -l   ->   0
git log origin/main --since='2026-11-02' --format=%h | wc -l   ->   197
git log origin/main -40 --format=%h       | wc -l              ->   40
```

Y el control positivo muestra que los commits **están ahí**: `3139d4c7` a las
`2026-11-03T15:18:58-03:00`, `3359a702` a las `15:14:24`, `e8ed06fb`, `b61d239d`, `16d3ecc3`,
`596ba4ca` — seis commits del día que el filtro no devuelve.

**La causa NO está atribuida** (huso, `approxidate`, el borde de medianoche local vs UTC: no lo medí).
Lo que está medido es el efecto, y para la decisión alcanza: **el filtro de fecha miente en el borde
del día y `-N` no.**

## Por qué muerde

El `0` no se parece a un error — se parece a una respuesta. Yo estaba reconciliando dos conteos de
fichas y la salida fue una sección entera vacía: «ids citados por commits de hoy: **0**». Si no
hubiera sabido que acababa de mergear cinco PRs con ids `SM-*` en el cuerpo, habría concluido que el
otro medidor estaba inflado. Es el mismo patrón que
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]: el instrumento no omite,
**inventa** — devuelve una cifra que se puede citar.

## La norma

Para «lo de hoy» usar **`-N` commits** (o `--since='2 days ago'`) y **nunca** la fecha del día en
curso. Y ante una sección vacía en un barrido propio: **control positivo antes de interpretarla**,
siempre — no «quizá no hay nada».

Relacionado: [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] ·
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] ·
[[instrumento-que-no-mira-nunca-falla]]
