---
name: el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional
description: 11/12 corridas repararon el bug; la que falló aplicó su parche sin problemas y dejó la suite roja — el formato válido no dice nada del contenido
metadata:
  type: project
---

**Un parche puede estar perfectamente bien formado y perfectamente mal pensado, y ninguna validación
de formato distingue una cosa de la otra.** Medido con `gpt-4o-mini`, `temperature=0`, sobre el bug
real de `fingerprint.py`:

```
12 corridas → 11 VERDE, 1 ROJA
```

La corrida que falló reportó `aplicado=True, 1 bloque` —el aplicador la aceptó sin objeciones— y dejó
la suite roja igual. El aplicador valida **que el fragmento exista, que sea único, que el parche no
sea no-op**; nada de eso mira si el cambio *arregla* algo.

**Consecuencia de diseño, y es la razón de que esta medición valga más que el módulo que la produjo:**
el ciclo de autosanación **jamás** puede confiar en que el forjador acertó. Aplicar sobre una copia,
correr la suite y descartar si queda roja deja de ser "una precaución razonable" y pasa a ser
**conclusión medida**. Hermana de lo que dejó S1: *ningún gate del ciclo puede usar el exit code como
oráculo*.

## ⚠️ Mi primera explicación era falsa y sonaba mejor que la verdadera

Entre la corrida que falló y las que pasaron yo había cambiado el texto del `no_romper` del prompt.
La explicación se armó sola: *"el contexto que entregás determina la efectividad del forjador"* —que
además es una definición del propio operador, así que encajaba perfecto.

**El diferencial la mató:** 3 corridas con cada versión del texto → **3/3 verde con las dos**. No era
el contexto: es variabilidad del modelo, que `temperature=0` **no** elimina.

Lo que hace peligroso este caso no es haberme equivocado: es que la hipótesis falsa era **coherente
con la doctrina del proyecto**, y por eso nadie la habría cuestionado en un review. Sin el diferencial
—que costó 6 llamadas a un modelo barato— habría quedado escrita en el docstring del módulo como
causa establecida, para que el próximo la leyera como hecho.

**La regla operativa:** cuando una explicación aparece *entre* dos corridas que difieren en más de una
cosa, no es una causa — es una **hipótesis con dos variables**. Correr el diferencial cuesta minutos;
canonizar la falsa contamina todo lo que se apoye encima.
[[instrumentos-que-confirman-en-vez-de-verificar]] · [[no-codificar-la-esperanza-principio-raiz]]
