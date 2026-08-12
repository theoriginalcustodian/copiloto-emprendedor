---
name: un-instrumento-compartido-intermitente-fabrica-una-excusa-lista
description: "Un gate compartido que flakea no cuesta tiempo: instala una explicación disponible que después lava regresiones reales. Se exige discriminar antes de atribuir"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T16:08:38.992Z
---

Cuando un **instrumento compartido** (el gate, el smoke, el CI) falla de forma intermitente, el daño
no es el tiempo perdido re-corriéndolo: es que **instala una explicación disponible**. Una vez que
"es el flake conocido" existe como frase, la próxima falla real se atribuye ahí por parecido y pasa
igual. Por eso una fila de deuda sobre un instrumento **no se pondera como una de producto**, aunque
el síntoma parezca menor.

**Why:** el 2026-08-12 frontend reportó un flake del job `mobile` que sólo aparecía dentro de
`gate.sh` completo — 2/2 fallas en la corrida completa contra 4/4 limpias aisladas, siempre
`Exceeded timeout of 5000 ms`, siempre en un test **distinto** del mismo describe de gestos. El
diagnóstico era correcto y la decisión de no abrir contrato sin repro determinística también. Lo que
faltaba era el impacto: `gate.sh` lo comparten las tres sesiones y el DoD de esa ronda hacía de *gate
6/6* el criterio de cierre de **cada** ítem. Un gate que falla completo y pasa aislado no es un gate,
es una moneda — y una moneda con excusa incorporada.

**How to apply:** (1) mientras la intermitencia siga abierta, **prohibido atribuir por parecido**: se
re-corre el job aislado — pasa aislado ⇒ es el flake, y **se anota la aparición** (la anotación es lo
que permite contarlas); falla aislado ⇒ es regresión propia. (2) La fila lleva dueño y disparador
binario, nunca "si vuelve a aparecer" a secas. (3) Elegir el experimento que **prueba la causa y
aplica el fix en el mismo movimiento** (subir el timeout y correr el gate completo) por sobre el que
sólo confirma la hipótesis (reproducir la contención afuera). (4) Ojo con el fondo: un umbral que
sólo aguanta con la máquina ociosa —acá 5000ms para un gesto *hold-and-wait*, con 10 worktrees y
pushes de 2+ min— estaba mal elegido desde el principio; subirlo no es tapar el flake.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] (aquél es el instrumento que **afirma
sin verificar**; éste es el que **verifica bien pero de a ratos**, que es peor de detectar porque a
veces tiene razón) · [[no-romper-no-es-arreglar]] ·
[[barrer-llamadores-incluye-los-instrumentos-de-verificacion]]
