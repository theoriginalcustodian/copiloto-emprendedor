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

---

## 2026-09-23 — el que hay que ordenar puede no ser el MERGE sino el DEPLOY

Variante que el título de arriba no cubre: acá **las dos mitades podían mergear en cualquier orden
sin romper nada**, y aun así existía un orden obligatorio. El estado peligroso no vivía en `main`:
vivía en **producción**.

BL-O6: la web registra la aceptación legal con `POST /me/legal/aceptar` y es **fail-closed a
propósito** — «el alta NO se completa si esto falla», que es la decisión correcta (un alta sin
aceptación registrada no sirve). FE2 mergeó su mitad (#678); backend todavía no la suya. `main`
quedó con una web que **exige un endpoint que el backend de prod no tiene**. Mergear eso no rompe
nada. **Desplegarlo deja a cualquier emprendedor sin poder registrarse.**

El contrato de la junta declaraba las dos mitades y su DoD por lado. No declaraba el **orden de
puesta en producción**, porque el modelo mental era «cuando las dos estén mergeadas, listo». Entre
«las dos mergeadas» y «las dos desplegadas» hay una ventana, y la ventana tiene un lado seguro
(backend primero) y uno que rompe.

**La pregunta que hay que hacerle a toda junta fail-closed:** *si despliego sólo esta mitad, ¿qué
deja de funcionar?* Si la respuesta no es «nada», el contrato necesita un **orden de deploy** con su
disparador medible, no sólo un DoD por lado. Acá el disparador es un número: `POST` sin token tiene
que devolver **401**; mientras devuelva 405, el endpoint no está.

**Y el 405 casi me engaña.** `POST /me/legal/aceptar` → `405` se lee como «existe, método
equivocado». El control negativo lo desarmó: una ruta **inventada** (`/me/legal/no-existe-xyz`)
devolvía **el mismo 405**, mientras el control positivo (`/me/onboarding/completar`, que existe)
devolvía **401**. Con un solo control la conclusión habría sido la contraria. Ver
[[el-canario-el-control-positivo-de-lo-que-falla-callado]] y
[[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]].

## Refuerzo 2026-10-06 — el PR APILADO resuelve el estado intermedio, y trae su propia ambigüedad de dueño

**El caso:** el ratchet de paridad es simétrico (`scripts/ci/idemkey_paridad.py:42`, «estados DISTINTOS
→ ROJO»), así que de dos mitades —web deriva la idemKey (#817, FE2) y mobile la deriva (`3b0f294e`,
FE1)— **cualquiera que entrara sola a `main` dejaba `mobile != web` y el lint rojo para las tres
sesiones**. No existía orden secuencial bueno: el estado intermedio bloqueaba a todos.

**La salida es apilar, no coordinar más fino:** el PR de FE1 apunta a la **rama de FE2**, no a `main`.
El par entra a `main` en **un solo merge commit**, el CI del PR apilado mide la **combinación** —la
prueba que ninguno de los dos árboles podía dar solo— y nadie edita el worktree ajeno ni cherry-pickea
código de otro. Funcionó: #822 salió 6/6 verde y #817 quedó con las dos mitades.

**Y acá está lo que no se ve al diseñarlo.** Hay dos modelos de propiedad del merge:

- **por rama destino** — mergea el dueño de la rama que recibe (convención del buzón: nadie escribe en
  el árbol ajeno);
- **por PR** — mergea el dueño del PR (lo que el clasificador de permisos del host autoriza).

En un PR normal **coinciden y la ambigüedad no da síntoma**. En un apilado son **personas distintas**,
y los dos modelos señalan a sesiones opuestas: el contrato ordenó que mergeara el dueño de la rama
destino, el host se lo bloqueó como *escritura ajena*, y la orden quedó **imposible de cumplir como
estaba escrita** — con la cara de una asignación prudente.

**Regla:** en un PR apilado mergea **el dueño del PR**. Es el único de los dos que el host autoriza, y
el consentimiento del dueño de la rama destino ya está dado por el contrato que acordó el apilado.
Nombrarlo explícito es lo que evita que dos sesiones se queden esperando con permiso cada una para lo
que la otra tiene que hacer.

Relacionadas: [[gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea]] ·
[[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]] ·
[[deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo]]
