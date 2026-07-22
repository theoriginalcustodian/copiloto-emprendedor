---
name: orden-de-merge-por-el-estado-intermedio
description: Con dos ramas largas, el orden no se elige por riesgo de conflicto sino por qué estado queda en main en el medio
metadata:
  type: feedback
---

**LEER antes de mergear dos ramas largas que se tocan, o cuando una feature quedó partida entre dos.**

Caso: `main` con dos ramas sin mergear —backend (20 commits) y app móvil (75)— y la feature de Gastos
**partida entre las dos**. El riesgo declarado era *«mergear una sola deja media feature en main»*.

**Medí el solapamiento real antes de decidir:**

```
archivos de apps/copiloto tocados por la rama MOBILE:  2  (web.py + su test)
commits de mobile que los tocan:                       1
diff:                                                  +100 / -0   <- puramente ADITIVO
```

**Ese número cambia la naturaleza del problema.** No hay riesgo de que un merge revierta al otro en
ningún orden. Entonces el orden **no se elige por conflicto** —no hay— sino por **qué estado queda en
`main` entre un merge y el otro**.

**El criterio, que es lo reusable:** primero la rama que **ya corre en producción**. Así `main` pasa
por un estado **verificado contra el sistema real**; al revés, `main` estrenaría una combinación que
no corrió nunca en ningún lado y, si algo falla, no hay forma de saber si es del merge o de la
combinación. Acá: el intermedio de la rama backend **es exactamente lo que está desplegado**; el de la
rama app **no existió nunca**.

**El error que esto corrige** —y lo nombró así quien planteó el riesgo— es **marcar un riesgo sin
medirlo**: "media feature" sonaba a riesgo de conflicto y era otra cosa. Medir el solapamiento costó
un `git diff --name-only` y reencuadró la decisión entera.

**Y la consecuencia se acepta explícita:** entre los dos merges `main` tiene media feature. Se banca
porque esa mitad es la probada, y porque la ventana la controla quien mergea — **los dos merges van
seguidos**.

Hermanas: [[no-codificar-la-esperanza-principio-raiz]] · [[trabajo-por-fases-no-anticipar]]
