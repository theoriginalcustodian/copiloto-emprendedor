---
name: una-obligacion-emitida-por-un-script-no-tiene-mano-que-la-cierre
description: El janitor exime a las obligaciones porque "se cierran a mano"; cuando el emisor es un script, ese "a mano" no tiene dueño y la obligación es inmortal.
metadata:
  type: project
---

Un buzón con janitor automático suele eximir a las obligaciones de archivarse por antigüedad, y con
razón: archivar un `contrato_` por viejo haría desaparecer trabajo vivo. `scripts/archivar-buzon.sh:51`
lo dice literalmente:

```bash
# Obligaciones que jamás se auto-archivan (se cierran a mano al resolverse).
OBLIGACIONES='^[0-9-]+_(contrato|pedido|urgente|hallazgo)_'
```

**Esa exención supone que el emisor es una sesión.** Cuando el emisor es un *script* —el escalador que
escribe `urgente_vigilancia-a-<rol>_contratos-sin-tomar.md`— el "a mano" no tiene dueño asignado: el
script no reanuda, no lee su propio buzón y no cierra nada. La obligación queda inmortal.

**Y el escalador es idempotente sin ser convergente.** Su bucle (`escaladores-buzon.sh:355`, blob
`825f5c7e` de `origin/main`) es `for para in "${!sin_tomar_n[@]}"`: itera los destinatarios que **tienen**
contratos sin tomar. Su comentario resolvió a propósito el problema de la foto congelada —«si ya existe,
se REESCRIBE en vez de saltearse»—, pero sólo para el destinatario que sigue en el array. Cuando N cae a
0, el destinatario **desaparece del array**, el bucle no lo visita, y el archivo del ciclo anterior queda
con su foto vieja. La pregunta de [[idempotente-no-es-convergente]] —*¿si cambio el valor, cambia el
recurso?*— da **no**.

**Medido el 2026-09-29:** 2 de 2 `urgente_` en `abierto/` estaban caducados (126 y 85 min), citando un
único contrato que ya vivía en `cerrado/2026-09-29/`; contratos realmente en `abierto/` con disparador
cumplido: **0**. Grep sobre `origin/main`: **0 hits** de cualquier retirada de `urgente_`, con control
positivo (el mismo grep sí encuentra `archivar-buzon.sh:77,101` moviendo otros tipos a `cerrado/`).

**Por qué muerde más de lo que parece:** el hook `buzon-al-reanudar` levanta los `urgente_` como
**BLOQUEANTES** —«si alguno ordena detenerse, detenerse ES la tarea»—, así que un archivo que no puede
desaparecer se vuelve una orden de detención permanente para las 4 sesiones, en cada reanudación. Es
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]: a la tercera vez, las cuatro sesiones aprenden
a saltear el bloqueo, y el próximo urgente **real** ya no frena a nadie. El costo no es el ruido, es que
el bloqueo deja de bloquear.

**Ninguno de los dos scripts tiene un bug.** El janitor decide bien y el escalador decide bien; el hueco
vive en el par, como en [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]. Nadie lo iba a ver
leyendo un script solo.

**Cómo aplicarlo:** al agregar un gancho automático que **escribe** una obligación al buzón, escribí en
el mismo cambio quién la **retira**, y ejercitá el retiro con un control positivo (correr con la
condición ⇒ escribe; sacar la condición ⇒ **retira**). Sin ese segundo control no se sabe si el apagado
existe: es [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] aplicado al ciclo de vida del archivo. Y el
barrido tiene que cubrir **todas las fechas**, no la de hoy: si el nombre lleva la fecha, el de ayer
nunca se revisita y es estructuralmente inmortal.

**Pregunta que lo caza en un minuto:** *este mecanismo sabe encender — ¿quién apaga, y cuándo se probó
que apaga?*
