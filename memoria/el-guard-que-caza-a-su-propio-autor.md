---
name: el-guard-que-caza-a-su-propio-autor
description: Un guard sólo vale cuando falla sobre código nuevo real, no en su test de demostración — el del censo de `except` bloqueó el merge de su propio autor tres ítems después de escribirlo, y por un criterio correcto.
metadata:
  type: feedback
---

**LEER al escribir un guard, y al toparte con uno que te frena a vos.**

2026-07-28/29. En el ítem 1.4 escribí un guard que falla el CI si aparece un `except` que traga un
error sin dejar rastro ni explicarse. Tres ítems después, implementando el #12, ese guard **bloqueó mi
propio merge**:

```
AssertionError: aparecieron 1 handlers `evapora + mudo` nuevos (30 vs baseline 29)
1 failed, 1269 passed
```

Era el `except asyncio.CancelledError: pass` de un helper nuevo. Yo **sí** había escrito el porqué —
pero **antes** del `try`, y el censo mira dentro del handler. **El guard tenía razón**: la explicación
sirve donde alguien la lee, que es junto al bloque que se está preguntando por qué traga.

**Por qué esto es lo que valida un guard.** Cuando escribís uno, lo probás con un caso artificial
—agregás un `except` de mentira, ves el rojo, lo sacás— y eso demuestra que *puede* fallar, no que
vaya a hacerlo sobre trabajo real. Un guard sólo se prueba a sí mismo el día que frena a alguien que
no lo estaba pensando. Que ese alguien haya sido **su propio autor, en la misma jornada**, es la mejor
señal disponible de que aprieta donde tiene que apretar.

**El corolario incómodo, y el que importa:** si un guard nunca te frenó, no sabés si funciona. Tenés
la ilusión de protección, que es peor que no tenerlo — ver
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]] para el fallo simétrico: el que grita en el
caso normal y te enseña a saltearlo. Un guard útil vive en la banda estrecha entre los dos: **calla en
el caso normal y muerde en el anómalo**. La única forma de saber dónde cayó el tuyo es que muerda.

**Y el hallazgo que vino de yapa: el guard NO corría en el VPS.** La suite del VPS dio **1143
passed** sin cazarlo, porque el stage es un checkout parcial sin `scripts/` y el test se saltea
(honestamente, diciendo por qué). Sólo corre en CI. Es evidencia concreta de que *"suite verde en el
VPS"* **no alcanza** como criterio único: dos entornos con distinta cobertura ven cosas distintas, y
declarar "verde" sin decir **en cuál** oculta el hueco.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento miente en verde;
acá el instrumento **ni siquiera estaba corriendo**, y el verde era de otra cosa.
