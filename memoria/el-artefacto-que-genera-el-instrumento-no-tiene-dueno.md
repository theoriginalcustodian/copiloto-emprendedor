---
name: el-artefacto-que-genera-el-instrumento-no-tiene-dueno
description: Un instrumento que sabe encender y no sabe apagar deja artefactos que sobreviven a su causa, y nadie puede retirarlos porque su emisor no es una sesión.
metadata:
  type: feedback
---

Un instrumento que **genera archivos** tiene que saber retirarlos. Si sólo sabe encender, cada
artefacto que escribe sobrevive a su propia causa, y el que lo lee después no puede distinguir
«deuda viva» de «foto de algo ya resuelto».

**El caso (2026-09-29).** El buzón quedó con **0 alarmas reales** y el gate de las cuatro sesiones
siguió en rojo. La causa era un `urgente_vigilancia-a-manejo-de-errores_contratos-sin-tomar.md` de
las 21:42 persiguiendo un contrato **que ya estaba en `cerrado/`**, por una exigencia de reporte que
un fix de esa misma tarde había eliminado. Medido en el código, no razonado:

- **`escaladores-buzon.sh` no tiene un solo `rm`.** Escribe el `urgente_` y nunca lo retira.
- **`archivar-buzon.sh` declara `urgente_` OBLIGACIÓN que «NUNCA se auto-archiva»** — y hace bien:
  un `urgente_` escrito por una sesión es una obligación real.

Las dos decisiones son correctas por separado, y entre las dos dejan el artefacto inmortal. Es
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

**Por qué nadie lo limpia a mano, y no es disciplina.** Su emisor es `vigilancia`, que **no es una
sesión**: ninguna se reconoce dueña. Y el único que podría moverlo es el destinatario, que al
hacerlo afirmaría haberlo atendido. Es el mismo agujero que [[coordinacion-tres-sesiones-buzon]]
tenía con los `a-todos`, un nivel más arriba: no es que nadie se acuerde, es que **nadie puede**.

**Por qué muerde más que el ruido.** El gate de parálisis compone el exit de este script, así que un
artefacto inmortal deja el gate de **todas** las sesiones sonando por una causa que ya no existe — y
una alarma permanente es un instrumento apagado, no uno estricto
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]).

**Cómo se cierra sin fabricar el defecto inverso.** El retiro no puede poder apagar el instrumento:

- **Patrón anclado** al nombre que el propio script genera; nunca un archivo escrito por una sesión.
- **Archivar, no borrar:** que se escaló es dato.
- **El sidecar de medición se va con el archivo.** Si la causa vuelve, el aviso es nuevo y su edad
  empieza de nuevo; con el sidecar sobreviviente nacería ya por encima del umbral.
- **La limpieza NO es alarma.** Si pusiera el gate en rojo sería otra alarma permanente, que es el
  defecto que vino a cerrar.
- **Test con el caso de no-apagado**, no sólo con el de retiro: 4 de 7 casos rojos contra la versión
  anterior, y los 3 que quedan verdes en ambas son a propósito los que prueban que no apaga.

**La pregunta que lo detecta:** *¿quién retira esto cuando su causa desaparece, y puede hacerlo?* Si
la respuesta nombra a alguien que al retirarlo afirmaría algo que no midió, no hay dueño: el
retiro es del instrumento.

**Y el bonus, que es su propia lección.** El test destapó que el escalador podía **morir a mitad**:
`sin_tomar_viejo` se poblaba sólo en la rama comparativa, con `edad=0` quedaba unbound y `set -u`
mataba el script con el `urgente_` ya escrito y truncado. No daba síntoma en producción (el umbral
de 120 min garantiza edad > 0) y **ninguno de los once tests lo veía porque todos corrían en
`--dry-run`**, que hace `continue` antes de esa lectura. El camino de **escritura** real no estaba
ejercitado por nadie — la variante de
[[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] donde lo que ningún test
recorre es el modo *efectivo* del instrumento, porque el modo seguro es más cómodo de testear.
Lo que lo cazó fue su propio centinela de terminación: la corrida no tenía última línea.
