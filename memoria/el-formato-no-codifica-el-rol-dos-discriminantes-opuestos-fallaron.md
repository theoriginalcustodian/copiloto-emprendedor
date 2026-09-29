---
name: el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron
description: Dos intentos de deducir si un documento MIDE o sólo CITA a partir de su estructura, desde lados opuestos, fallaron los dos. Cuando dos discriminantes contrarios no separan, lo que falta no es un mejor umbral: el rol no está en el formato y hay que declararlo
metadata:
  type: feedback
---

**El caso (2026-09-29).** Un contador de veredictos tenía que distinguir los documentos que **miden**
(comparan pantalla contra prototipo) de los que sólo **citan** veredictos ajenos para razonar. Se
probaron dos discriminantes estructurales, en direcciones opuestas:

1. **Corroboración cruzada** («un documento cuyos ids aparecen también en otros está respaldado»). Lo
   rompí con un contraejemplo: **mi propio dictamen analítico habría sacado la nota más alta**, porque
   cita el padrón entero por su naturaleza. El control **premia la propiedad que lo delata**.
2. **Cobertura del padrón** (mi reemplazo: «cubre >80% ⇒ candidato a rol normativo»). Planificación lo
   midió antes de embarcarlo: **techo de menciones de una medición 29/54, techo de un descartado
   29/54 — empate literal.** Un gate al 80% nunca dispararía. No lo embarcó.

**Dos hipótesis contrarias, las dos inertes. Eso no es mala suerte: es la respuesta.** El rol de un
documento —medir o citar— **no está codificado en su forma**. Un analítico y una medición usan el
mismo vocabulario, las mismas tablas y el mismo padrón; sólo difieren en lo que el autor *hizo* antes
de escribir, y eso no deja huella sintáctica.

## La consecuencia de diseño

Lo único que protege es la **clasificación declarada** por una persona, con motivo escrito, y un gate
que **aborta** cuando aparece un documento sin clasificar. No es una debilidad del diseño: es el
diseño correcto para una propiedad que no es deducible. Los dos umbrales «inteligentes» eran intentos
de evitar escribir el motivo a mano, y ninguno podía funcionar.

El otro lado, que sí vale: el **vocabulario cerrado** neutraliza a un analítico **aunque esté mal
clasificado**, porque un documento que cita no produce veredictos propios en las celdas donde el
parser los busca. Doble red, y la de abajo funciona sola.

## Y el callejón se señaliza, no se borra

El empate 29/29 quedó **impreso en el reporte** con la marca «NO es un gate: no separa». Un callejón
sin salida sin señalizar se recorre dos veces — el próximo que proponga el discriminante de cobertura
ve el empate antes de escribir el código. Lo mismo con el control retirado: salió **nombrado en el
commit**, no borrado en silencio.

## El error mío que vino pegado

Sostuve el contraejemplo con «el dictamen cita **54 de 54** ids». Eran **menciones con backticks
contadas a mano**; medido con el padrón da **29**, y veredictos atribuidos **12**. El hallazgo
estructural sobrevive; **el cálculo del daño no**. Cuarta vez en el día que la unidad me rompe una
cifra — y esta vez dentro del mensaje que corregía a otro por unidades. De ahí la norma:
**cada cifra declara su unidad o no se cita**, y la unidad se mide con el instrumento, no a ojo.

Hermanas: [[un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno]] (calibrar al valor
propio) · [[el-guard-se-satisface-con-su-propio-comentario]] (presencia en vez de rol) ·
[[instrumento-que-no-mira-nunca-falla]] (un gate que nunca dispara entrega la garantía que no tiene) ·
[[contar-un-simbolo-no-dice-en-que-rol-aparece]].
