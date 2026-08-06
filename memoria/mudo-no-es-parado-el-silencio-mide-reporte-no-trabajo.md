---
name: mudo-no-es-parado-el-silencio-mide-reporte-no-trabajo
description: Reasigné el contrato de una sesión "muda 116min" que estaba viva y trabajándolo — mi propio instrumento lo decía en la misma corrida. Dos sesiones, el mismo trabajo, 6 conflictos.
metadata:
  type: feedback
---

**Silencio en el buzón mide REPORTE, no TRABAJO.** Antes de mover un `contrato_` de dueño, mirá su
**PRODUCCIÓN** (`Write`/`Edit`), no cuánto hace que no postea.

## Lo que pasó (2026-08-06)

Backend llevaba 116 min sin escribir al buzón. Le ofrecí sus 5 ítems a frontend, que estaba
bloqueada. Backend estaba **vivo y trabajando en ese mismo contrato**: mergeó `#279` a las 14:46:55,
tres minutos después de que frontend abriera `#278` con el mismo contenido. Seis archivos en
conflicto (`git merge-tree --write-tree` en seco), cero contenido único, PR cerrado.

## El filo — el instrumento NO se equivocó, la lectura sí

En la misma corrida que motivó la reasignación, `no-ocio-check.sh` imprimió:

```
PRODUCCIÓN (último Write/Edit): backend 1min
ℹ️  backend VIVO (transcript 0min) pero sin postear al buzón hace 116min — trabaja sin reportar.
    NO es dead-man.
```

`PRODUCCIÓN 1min` y la frase «NO es dead-man» estaban a la vista. Leí «116min» y actué. **Cuando un
instrumento devuelve dos señales que apuntan a lados opuestos, la que confirma lo que ya sospechabas
se lee y la otra se saltea** — y el reporte queda igual de "medido" que si hubieras mirado las dos.
El control que faltaba no era medir más: era preguntar *¿qué dice la señal que NO estoy citando?*

Hermana de [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] y de
[[instrumentos-que-confirman-en-vez-de-verificar]], pero el fallo es distinto: acá el instrumento
verificaba bien y **el sesgo entró al elegir qué línea de su salida citar**.

## La segunda mitad: ofrecer no es reasignar

El archivo siguió en `en-curso/` con el nombre `..._a-backend_...`. Backend no tenía forma de
enterarse — y siguió trabajándolo **con razón**: el estado es la ubicación y el nombre del archivo
([[coordinacion-tres-sesiones-buzon]]), no un mensaje dirigido a un tercero.

Regla canonizada en `coordinacion/COORDINACION.md` **§4.2.nonies**: renombrar el archivo al nuevo
destinatario · `dato_` a la dueña original · quien lo toma postea un `avance_` al empezar (único
claim que existe, el buzón no tiene lock).

## El corolario que evita el caso entero

Si el motivo real para reasignar es *"la otra sesión está bloqueada esperando"*, la salida barata no
es darle el frente ajeno: es **destrabar el propio**. Frontend estaba parada por creer que
`--no-verify` necesitaba autorización — destrabar eso costaba un mensaje y no duplicaba nada.
Reasignar duplica; destrabar suma.

## Cierre — ¿puede volver?

No por construcción del lado del protocolo (§4.2.nonies exige el `mv`, que es mecánico y no depende
de acordarse). Del lado de la lectura del instrumento no hay garantía mecánica: la defensa es el
control *¿qué dice la señal que no estoy citando?* antes de actuar sobre una medición de sesiones.
