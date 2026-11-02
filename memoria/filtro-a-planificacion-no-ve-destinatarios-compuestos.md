---
name: filtro-a-planificacion-no-ve-destinatarios-compuestos
description: "El filtro del vigía `-a-planificacion_` no ve `pedido_X-a-backend-y-planificacion_…`: un pedido a dos destinatarios quedó 20+ min sin leer (K-07-B, 2026-09-21)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T23:28:49.151Z
---

El vigía filtra `abierto/` con `-a-(planificacion|todos)_`. Un pedido dirigido a DOS sesiones
(`pedido_frontend1-a-backend-y-planificacion_K-07-B…`) no matchea: el destinatario compuesto termina en
`-y-planificacion_`. FE1 esperó el contrato de K-07-B sin que planificación lo viera; apareció sólo
porque el PR #588 lo mencionaba.

**Why:** los nombres con varios destinatarios (`a-backend-y-frontend1-y-planificacion_`) son normales en la
junta, y el filtro asumía un único destinatario.

**How to apply:** listar con `find abierto en-curso -name '*planificacion_*' ! -name '*_planificacion-a-*'`
(cualquier posición del destinatario, excluyendo lo que yo emití). Pendiente: corregir el mismo filtro
en el prompt del vigía en `.claude/commands/monitoreo.md`.

---

## ⚠️ REFUERZO 2026-11-02 — el mismo filtro falla por el TIPO de mensaje, y ahí costó una hipótesis entera

Lo de arriba es un caso de algo más general: **cualquier barrido del buzón por nombre de archivo
mide la convención de nombres, no el hecho.** El destinatario compuesto fue la primera forma; ésta
es la segunda y no la cubre ninguna corrección del patrón de destinatario.

**Lo medido.** Para `SM-N19` necesitaba saber **quién tenía el teléfono** entre 18:00:14 y 18:02:09.
Barrí los avisos con `find -name '2026-11-02*' \( -name '*TOMO*' -o -name '*SOLTE*' \)`, obtuve
ocho archivos (18:37 / 18:46 / 19:06 / 19:10 / 19:23 / 19:36 / 19:40 …) y concluí que **ninguna
sesión tenía el device**, porque la primera toma de la tarde era posterior al evento. Sobre ese
vacío construí una hipótesis entera: un «toque ciego» del operador sobre el botón Guardar, con
contrato bajado, mitad B escalada a backend como posible **write no consentido**, y una afirmación
al operador de que nadie había tocado su teléfono. **Falso.** Frontend1 lo tenía desde antes y lo
había declarado en otro **tipo** de mensaje: un `dato_` de las 18:05 y, a las 17:40, un `cierre_`
con «cancelar ejercido con adb». Su transcript cerró la atribución al segundo: card pedida 20:59:49,
gesto DOWN/MOVE/UP sobre Guardar 21:02:08, recibo «N° 4» 21:02:18.

**Why:** el nombre del archivo codifica **la intención de quien lo escribió** —«estoy anunciando una
toma»— y el hecho que yo medía era otro: «tenía el aparato». Quien ya lo tenía no vuelve a anunciar
la toma; lo menciona al pasar, dentro del mensaje que sí venía a escribir. Peor, el fallo es
**silencioso y hacia el «no»**: el filtro no se equivoca, devuelve menos, y un barrido que devuelve
menos de lo que hay se lee como ausencia del hecho. Y la ausencia de un dueño del device es
justamente la premisa que habilita la explicación más alarmante, así que el falso negativo no
quedó quieto: viajó a un contrato, a un escalamiento y a una afirmación al operador.

**How to apply:**
1. **Para medir un hecho del mundo, medí el mundo, no los avisos.** Quién tiene el device sale de
   `adb devices` / logcat / el mtime de las capturas, no de cómo alguien tituló un `.md`.
2. Si el buzón es la única fuente, **grepeá el CUERPO de todos los archivos del día** por el hecho
   (`adb`, `device`, `teléfono`), nunca el nombre por el tipo. El cuerpo no miente sobre lo que pasó;
   el nombre sí sobre lo que el archivo venía a hacer ([[mensaje-entregado-donde-nadie-mira]]).
3. **Control obligatorio ante un barrido vacío o escaso: cuántos archivos miró, de cuántos hay.**
   `8 de 8` acredita; `8 de 140` no acredita nada ([[instrumento-que-no-mira-nunca-falla]]).
4. Y antes de que un vacío sostenga una hipótesis con consecuencias —un escalamiento, una afirmación
   al operador— preguntá **«¿cómo se vería esto si el instrumento no lo hubiera visto?»**. Acá la
   respuesta era idéntica al hallazgo ([[supuesto-cuya-falla-parece-un-estado-legitimo]] ·
   [[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]]).
