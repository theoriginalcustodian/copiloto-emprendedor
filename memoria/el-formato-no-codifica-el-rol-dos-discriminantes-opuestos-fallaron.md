---
name: el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron
description: SEGUNDA aparición de la raíz de [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]], el mismo día y en otro sistema: dos discriminantes más —opuestos entre sí— para deducir si un documento MIDE o sólo CITA, los dos inertes. Cuando dos hipótesis contrarias no separan, la respuesta ya es la raíz
metadata:
  type: feedback
---

⚠️ **La raíz ya está escrita, y no es mía:**
[[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] (planificación, 2026-09-29, sobre
`plan-drift-check.sh`: un path citado como **fundamento** es indistinguible de uno que es el
**entregable**). Esta entrada no la repite: aporta el **segundo caso independiente** y lo que sólo se ve
al tener dos.

**El caso (2026-09-29, unas horas después y en otro sistema).** `contar-veredictos.py` tenía que
distinguir los documentos que **miden** (comparan pantalla contra prototipo) de los que sólo **citan**
veredictos ajenos para razonar. Se probaron dos discriminantes estructurales, en direcciones opuestas:

1. **Corroboración cruzada** («un documento cuyos ids aparecen también en otros está respaldado»). Lo
   rompí con un contraejemplo: **un dictamen analítico habría sacado la nota más alta**, porque cita el
   padrón entero por su naturaleza. El control **premia la propiedad que lo delata**.
2. **Cobertura del padrón** (mi reemplazo: «cubre >80% ⇒ candidato a rol normativo»). Planificación lo
   midió antes de embarcarlo: **techo de menciones de una medición 29/54, techo de un descartado
   29/54 — empate literal.** Un gate al 80% nunca dispararía. No lo embarcó.

## Lo que sólo se ve con los dos casos juntos

**Cuatro discriminantes refutados el mismo día, en dos sistemas sin relación** (posición de columna ·
edad/precedencia · corroboración cruzada · cobertura), **dos de ellos apuntando en sentidos
opuestos**. Un discriminante que falla es un bug; dos contrarios que fallan **son la prueba de que la
propiedad buscada no está en el texto**. Ese patrón es la señal a reconocer temprano: cuando la segunda
hipótesis, contraria a la primera, tampoco separa, **dejá de buscar la tercera**.

Y el rol a deducir era distinto en cada caso —fundamento-vs-entregable allá, medir-vs-citar acá— lo que
descarta que fuera un problema de ese vocabulario en particular.

## La consecuencia de diseño, que acá tuvo una capa extra

Igual que en el caso de planificación, lo único que protege es la **declaración explícita** con motivo
escrito y abort por documento sin clasificar. Pero además apareció una **segunda red que no depende de
la clasificación**: el **vocabulario cerrado**. Un documento que cita no produce veredictos propios en
las celdas donde el parser los busca, así que **un analítico mal clasificado queda neutralizado igual**.
Doble red, y la de abajo funciona sola — eso es lo que hizo que la cifra no se moviera cuando descubrí
que un documento estaba mal clasificado desde el 23/09.

## El callejón se señaliza, no se borra

El empate 29/29 quedó **impreso en el reporte** con la marca «NO es un gate: no separa», y el control
retirado salió **nombrado en el commit**, no borrado en silencio. Un callejón sin señalizar se recorre
dos veces — que es exactamente lo que pasó con esta raíz: **se aprendió a la mañana y se volvió a
aprender a la tarde**, porque las dos memorias quedaron **huérfanas del índice** y ninguna sesión podía
ver la de la otra. Es el costo medido de [[el-indice-truncado-fabrica-duplicados]], esta vez con el
duplicado a medio escribir.

## El error mío que vino pegado

Sostuve el contraejemplo con «el dictamen cita **54 de 54** ids». Eran **menciones con backticks
contadas a mano**; medido con el padrón da **29**, y veredictos atribuidos **12**. El hallazgo
estructural sobrevive; **el cálculo del daño no**. Cuarta vez en el día que la unidad me rompe una
cifra — y esta vez dentro del mensaje que corregía a otro por unidades. De ahí la norma: **cada cifra
declara su unidad o no se cita**, y la unidad se mide con el instrumento, no a ojo.

Hermanas: [[un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno]] ·
[[el-guard-se-satisface-con-su-propio-comentario]] (presencia en vez de rol) ·
[[instrumento-que-no-mira-nunca-falla]] (un gate que nunca dispara entrega la garantía que no tiene) ·
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] ·
[[un-gate-cuyo-predicado-es-el-sintoma-de-un-bug-abierto]].
