---
name: un-contrato-a-todos-no-tiene-quien-lo-mueva
description: Con el estado en la ubicación del archivo, un mensaje dirigido a todos queda abierto por construcción y el escalador lo persigue para siempre sobre trabajo entregado.
metadata:
  type: feedback
---

El `urgente_` llevaba **210 minutos** escalando un `contrato_..._a-todos_` con **las tres mitades ya
mergeadas** y **los dos avisos de cumplimiento ya en el buzón**. El escalador no estaba mal calibrado:
**mide la ubicación del archivo, y no había nadie que pudiera moverlo.**

«El estado es la ubicación del archivo: quien toma un trabajo lo mueve, quien lo termina, también.»
Eso funciona porque cada mensaje tiene **un** destinatario que se reconoce dueño. Con `a-todos`, las
tres sesiones hacen su parte —acá las tres la hicieron— y **ninguna mueve el archivo, porque moverlo
afirmaría algo sobre las otras dos**. El contrato queda en `abierto/` **por construcción**, no por
olvido.

## Por qué obliga a arreglarlo y no a tolerarlo

**El costo no es el ruido: un `urgente_` que grita sobre algo cumplido enseña a saltear los
`urgente_`.** Es [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]] aplicado al escalador, y el
próximo contrato **realmente** abandonado se va a leer igual que este. El guard se desarma solo, sin
que nadie decida desarmarlo.

## La regla

**Todo `contrato_` dirigido `a-todos` declara en su encabezado quién lo cierra. Por default, quien lo
emitió.** Una línea, retrocompatible, no multiplica archivos.

**Y no queda sólo escrita, porque la disciplina se desincroniza**
([[buzon-se-ordena-por-janitor-no-por-disciplina]]: la regla de archivar a mano se escribió en julio y
*empeoró* el buzón, de 32 a 136 archivos). El escalador **atribuye** el `a-todos` a su emisor leyendo
el nombre del archivo: determinista, sin depender de que nadie se acuerde.

## Las dos alternativas, y por qué no

**Partir el `a-todos` en N mensajes dirigidos al abrirlo** sirve cuando el trabajo por capa es
**realmente independiente**. No era el caso: las tres mitades compartían la misma clave y el cierre
afirmaba sobre las tres juntas, así que partirlo habría fabricado tres cierres que ninguno de los tres
podía firmar.

**Que el escalador verifique el DoD contra `origin/main` antes de escalar** lo convierte en el sistema
que tiene que entender todo contrato para poder avisar de uno. El agujero está en el protocolo, no en
el instrumento — y quien encontró el problema fue la primera en decir que no lo recomendaba.

💡 **La pregunta reusable, para cualquier estado que viva en una ubicación:** *¿existe un actor único
con autoridad para hacer esa transición?* Si el estado es una ubicación y el sujeto tiene N dueños,
falta declarar quién mueve. Es [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]: el protocolo
del estado-por-ubicación y el broadcast a todos son correctos por separado.
