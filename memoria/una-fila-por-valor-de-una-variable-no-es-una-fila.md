---
name: una-fila-por-valor-de-una-variable-no-es-una-fila
description: Si el id es una plantilla `prefijo-${var}`, la fila de la matriz es la plantilla y el camino elige la instancia; una fila por valor convierte un dato en un bloqueo técnico falso
metadata:
  type: feedback
---

# 🧩🏷️ Una fila por VALOR de una variable no es una fila — es un dato

Cuando una matriz de verificación tiene una fila por **valor** (`caida` de `googlecalendar`) y el
código emite un id **interpolado** (`service-card-status-${service.key}`), la fila no mide lo que su
nombre dice. Mide la **plantilla**, y el valor es sólo la instancia que el camino eligió.

**Preguntá «¿qué mide realmente esta fila?» antes de «¿cómo fabrico este valor?».**

## Cómo se ve cuando pasa

Se ve como un **bloqueo técnico legítimo**, y por eso no da síntoma. Dos sesiones intercambiaron dos
mensajes excelentes —un pedido bien planteado y un diagnóstico con `path:línea` que midió hasta el
efecto de `revoke()`— para concluir `NO_MEDIBLE` sobre una celda que era medible por otra instancia.
Nadie se equivocó en su mitad: la fila mal recortada estaba en el contrato, y era mía.

**La señal:** si para medir una fila hay que **fabricar un estado que no es nuestro**, chequeá primero
si el comportamiento que mide se ramifica por ese valor. Si la rama es una sola, cualquier instancia
alcanzable sirve.

## El caso (2026-09-28, BL-Q3 v2 §9)

- `ServiceCard.tsx:119,127,135,183` → plantillas `service-card-*-${service.key}`; **ningún** id
  literal por proveedor.
- `ServiceCard.tsx:45` → `if (service.status === 'caido') return 'reconnect'`. **Una** comparación,
  cero condicionales por `key`: el proveedor entra en el **id**, nunca en el **comportamiento**.
- `conexiones_salud.py` declara **una sola definición** de `caido` para sus tres caras, y
  `mercadopago` la alcanza desde tabla **propia** — mientras el `EXPIRED` de Composio lo decide un
  tercero y `revoke()` produce el estado **opuesto**.

Resultado: se mide la plantilla por la instancia alcanzable y la celda del proveedor **se retira** —
no por no medible, sino porque nunca fue una fila distinta.

## Por qué la respuesta de backend igual era correcta

Su diagnóstico no se cae: es la prueba de que **ese** camino no existe. Lo que estaba mal era la
pregunta. Un diagnóstico impecable sobre una pregunta mal planteada produce un `NO_MEDIBLE` firme y
falso — y se cita como evidencia después. Es el mismo eje que
[[el-nombre-es-una-hipotesis-sobre-el-contenido]]: el nombre de la fila fue la hipótesis que nadie
verificó contra el código.

Pariente directo de [[contar-un-simbolo-no-dice-en-que-rol-aparece]] y
[[dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una]]: las tres se resuelven **contando
definiciones, no usos**. Y de [[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]]: el
inventario de la plantilla habría recortado bien la fila el primer día.

---

## Refuerzo 2026-10-05 · la fila era el ARCHIVO y la unidad real era el STUB — un hermano sano absuelve al enfermo

Un barrido de dobles de comando (el `gh` de mentira de las suites del gate) publicó **5 comodines** con su
tabla por archivo. La cifra correcta era **6**, y el que faltaba vivía en un archivo clasificado
**«despacha por invocación»** — veredicto *cierto*, pero de **otro stub del mismo archivo**:
`test-mergear-pr-veredicto-en-el-remoto.sh` fabrica un doble de `git` (sano, despacha) **y** un doble de
`gh` (con rama comodín). La fila tomó el archivo como sujeto, el hermano sano ganó la clasificación, y el
comodín quedó **absuelto por convivencia**. Cinco días después ese comodín dejó rojo el `lint` de un PR, y
el rojo pareció del script que lo consumía.

**Por qué no da síntoma:** una tabla por archivo con el denominador bien declarado — *«7 dobles de comando
en 4 suites»* — **se lee como completa**, y de hecho contó los 7. Lo que no hizo fue **emitir una fila por
cada uno**: siete dobles colapsados en filas-archivo, con dos archivos portando dos dobles cada uno. El
agregado por archivo es una proyección con pérdida, y la pérdida cae justo en el archivo heterogéneo.

**El test, antes de publicar un conteo:** *¿puede un elemento de mi población tener DOS valores de la
variable que estoy clasificando?* Si la respuesta es sí, el archivo (o el PR, la pantalla, el tenant) no es
la fila: la fila es el elemento que porta **un solo** valor. Control mecánico: el total de filas tiene que
igualar el denominador declarado — si declarás 7 dobles y publicás filas de 4 archivos, ya sabés que una
fila está hablando por dos.

Hermana de [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] (el barrido mira donde
el sano lo invita a mirar) y de [[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]]: acá el elemento
**estaba** clasificado, y por eso ningún control de cobertura lo reclamó.
