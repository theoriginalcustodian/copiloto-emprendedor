---
name: un-nombre-con-dos-referentes-prueba-A-y-concluye-B
description: Cuando una palabra nombra dos cosas distintas en el mismo repo, la evidencia prueba un referente y la conclusión afirma el otro; el verificador independiente confirma de buena fe porque mide el referente que sí existe
metadata:
  type: project
---

# 🏷️🎭 Un nombre con DOS referentes: la evidencia prueba A y la conclusión dice B

Una palabra que en el mismo repo nombra **dos cosas sin relación** no produce un error visible: produce
una **inferencia que cambia de sujeto en el medio**. Se mide A, se escribe «A», y el que lee entiende B
— porque «A» también se llama B. Nadie miente y nadie se contradice; el salto vive en el nombre.

Lo que lo hace peligroso no es la ambigüedad: es que **el verificador independiente confirma**. Yo
verifiqué «sí, es cierto» midiendo el referente que sí existía, y con eso **acredité** una conclusión
sobre el otro. Un segundo par de ojos no rompe el equívoco: lo refuerza.

## El caso (2026-10-05, criterio 3 · exención `FUERA_DE_ALCANCE_WEB`)

«Escritorio» nombra dos cosas en `copiloto-emprendedor`:

| sentido | qué es | dónde |
|---|---|---|
| la **capa** | el launcher de la app en el teléfono: CAPA 0, «Tus funciones» + «Actividad reciente» | `Prototipo frontend/odobi-ui/prototipo/index.html:1613` |
| el **viewport** | pantalla grande / desktop, 1440 | `index.html:63` (`min-width:520px`) |

La evidencia medía la **capa**: 4 ids de voz viven en `#hilo` y no tocan `#escritorio` ni ninguna
subvista `#s-*`. La exención concluía **viewport**, y más que eso: «fuera del alcance web» — para 4 ids
que tienen implementación web citada con `path:línea`. Se probó A y se concluyó B.

**Y yo lo acredité.** Medí 10 subvistas `#s-*`, 9 de ellas ids del padrón, y publiqué que *el prototipo
sí modela escritorio* ⇒ que mi propio hallazgo C3-10 («no existe referencia de escritorio») quedaba
refutado. Escribí la autocorrección, la publiqué, y era falsa: esas 9 subvistas son del **launcher**, no
vistas de pantalla grande. La medición estaba bien; el **referente** estaba mal. La retiré el mismo día.

Lo que lo destrabó fue leer qué **es** `#escritorio` en el archivo (`sed -n '1608,1645p'`) en vez de
confiar en su nombre: el grip de abajo dice «Bajá para tus funciones» (`:1639`) — es un launcher, no un
breakpoint. Y entonces apareció que frontend1 **ya lo había desambiguado a mano**: «`#escritorio` (la
capa, no el viewport)». El único que escribió el referente fue el que midió.

## La pregunta que lo caza

> **¿La palabra del título nombra UNA cosa en este repo?** Y si la evidencia dice «no hay X»: **¿el X
> que midieron es el X que la conclusión usa?**

Dos señales de que hay equívoco, antes de medir nada:

- **El que midió desambigua a mano** («la capa, no el viewport»). Nadie aclara lo que no se confunde:
  esa aclaración es la marca de que el nombre ya mordió a alguien.
- **El predicado no distingue las plataformas pero la conclusión sí.** Acá los mismos 4 ids salían «sin
  comparación» en mobile — la causa era del prototipo, no de web, y la exención era *de web*.

## Reglas que me dejo

1. **Antes de citar un hallazgo propio, releer su referente, no su título.** Mi título decía «no existe
   referencia de escritorio»; yo mismo lo leí con el otro sentido 10 días después. Lo desambigüé en el
   doc (`2026-09-29-criterio3-…md`, C3-10 → «viewport, NO la capa»).
2. **Un nombre con dos referentes es deuda de glosario, no de estilo** → va a `CONTEXT.md` con su
   `_Avoid_`, que para eso existe. Fila `EQUIVOCO-ESCRITORIO`, severidad alta: ya produjo una exención
   mal fundada y una autocorrección falsa **el mismo día**.
3. **Corregir antes de que lo lean** vale más que no haberse equivocado: el cierre estuvo ~20 min en
   `abierto/` con la §2.1 mal interpretada y lo reescribí yo, declarando el cambio adentro.

Hermanas: [[el-contrato-afirma-el-mecanismo-que-no-opero]] ·
[[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]] ·
[[un-control-positivo-con-esperado-falso-acusa-al-script]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]
