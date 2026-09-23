---
name: el-sujeto-correcto-al-empezar-dejo-de-serlo-a-mitad-de-la-corrida
description: Elegir bien el sujeto no alcanza si el sujeto se mueve solo. Barrí sobre origin/main verificado contra ls-remote; a mitad del trabajo otra sesión pusheó y el ref avanzó. Lo cacé sólo porque un sub-agente citó otro SHA. Fijá el SHA y re-corré contra el mismo al cerrar.
metadata:
  type: feedback
---

# ⏱️🎯 El sujeto era el correcto al empezar — y dejó de serlo a mitad de la corrida

Variante de [[el-instrumento-respondio-sobre-otro-sujeto]], pero el mecanismo es distinto y por eso
la defensa también. Ahí el instrumento **miraba el lugar equivocado desde el principio**. Acá elegí
bien, lo verifiqué, y el sujeto **se movió abajo mientras trabajaba**.

## Qué pasó (2026-09-22, barrido de estado efímero en el front)

Empecé haciendo lo correcto: descarté el `main` del checkout compartido (estaba 148 commits atrás),
elegí `origin/main`, y lo **verifiqué contra el remoto real** con `git ls-remote origin main`.
Coincidían: `7c512bde`. Sujeto fijado y probado.

Barrí 264 archivos, clasifiqué 435 declaraciones, mandé dos sub-agentes a leer el código. Uno volvió
con su reporte y, de pasada, escribió: «estoy leyendo el ref correcto (`origin/main @ 847ec197`)».

Ese SHA no era el mío. Entre mi verificación y su lectura, **otra sesión pusheó y alguien fetcheó**:
`origin/main` avanzó un commit. Mi barrido había corrido sobre un árbol que ya era pasado.

## Por qué no da síntoma

Nada falla. `git rev-parse origin/main` sigue contestando. Los archivos se leen. El barrido termina
con dos controles positivos en verde. La corrida entera **es internamente consistente** — sólo que
describe un árbol que ya no es el que alguien va a leer cuando abra el reporte.

Y el daño real no es el veredicto: son **las líneas**. Un informe que dice `Archivo.tsx:48` manda a
alguien a un número que el próximo commit puede mover. El lector no tiene cómo saber que envejeció.

## Pasó DOS veces en la misma corrida, y la segunda no la cacé

La primera la cacé (abajo). La segunda me la tuvo que señalar otra sesión: mientras cerraba el
reporte, `origin/main` volvió a avanzar —a `a4c9e86c`— y yo seguí midiendo contra `847ec197`. Sobre
ese árbol viejo reporté que el índice de memoria se truncaba a 200 líneas… cuando el fix ya estaba
mergeado hacía media hora. **Reporté como deuda abierta algo ya arreglado**, que es el daño
característico de medir un sujeto vencido: no es un error visible, es una falsedad plausible.

Que me pasara dos veces en una corrida —una hora después de escribir esta misma entrada— dice que
el problema no es saberlo: es que **el chequeo estaba en el lugar equivocado del procedimiento**.
Verificar el sujeto al abrir se siente como el momento correcto, y no lo es: el trabajo dura, y el
riesgo crece con cada minuto. El chequeo que sirve es el **de salida**, pegado al acto de entregar.

## Lo que lo cazó, y lo que debería haberlo cazado

La primera vez lo cazó **un sub-agente que citó su SHA** — por suerte, no por diseño. Yo le había
pedido que confirmara estar en el ref correcto como control de ceguera, y ese control terminó
atrapando algo que no estaba buscando. La segunda vez no había sub-agente citando nada, y no la cacé.

Lo que debería haberlo cazado es una regla, no la suerte:

1. **Resolvé el ref a un SHA UNA vez, y desde ahí pasá el SHA**, nunca el nombre. `origin/main` es
   una variable; `847ec197` es un hecho. Todo lo que delegues lleva el SHA, no el nombre.
2. **El chequeo que vale es el DE SALIDA, no el de entrada.** Último comando antes de entregar:
   `git rev-parse origin/main` contra el SHA que declaraste al empezar. Verificar al abrir no
   protege nada —el sujeto se mueve después—; verificar al cerrar sí. Si se movió, `git diff --stat
   <viejo>..<nuevo>` decide: si no tocó nada de lo que citás, el reporte vale y lo decís; si tocó,
   re-corrés. Barato, binario, y no depende de acordarse a mitad del trabajo.
3. **Citá el SHA en el informe.** Las líneas valen contra ese árbol y contra ningún otro.

En este caso re-corrí sobre `847ec197` y comparé: mismos 19 candidatos, ninguna línea movida. El
barrido valía. **Pero eso se supo midiendo, no suponiendo** — y la próxima vez el commit puede caer
justo en el archivo que estás citando.

## La regla

**Un sujeto verificado al empezar no queda verificado.** Si el trabajo dura más que un par de
comandos y el sujeto es algo que otros pueden mover —un branch remoto, una base compartida, un
servicio vivo— fijalo a un identificador inmutable, pasá ese identificador a todo lo que delegues, y
volvé a medirlo antes de entregar. Con varias sesiones pusheando al mismo repo, «el ref no se va a
mover en 20 minutos» es una apuesta, no un supuesto.

Relacionado: [[el-checkout-compartido-sirve-comandos-viejos]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] ·
[[vacio-no-es-hallazgo-correr-el-control]]
