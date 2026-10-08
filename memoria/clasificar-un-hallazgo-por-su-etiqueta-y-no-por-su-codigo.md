---
name: clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo
description: "Antes de rutear un hallazgo a un frente, abrir el código: el título del hallazgo no es evidencia"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T15:13:03.402Z
---

Un hallazgo heredado de un informe viejo **se re-abre en el código antes de clasificarlo o ruteárselo
a alguien**. El título del hallazgo es una etiqueta escrita por otro, no evidencia.

**Why:** el 2026-08-12 clasifiqué **C8 — "firma que ignora `payload`"** como vulnerabilidad
criptográfica (verificación de firma HMAC en `POST /mp/webhook`) y lo ruteé a la Pasada 1 de seguridad
como P0. Es una **firma de función**: `make_signal_anulacion` en `apps/copiloto/web.py` acepta
`payload` y no lo reenvía a `handle.signal()`; su gemelo `make_signal_factura` sí. O sea, pérdida
silenciosa de datos en una señal de Temporal — corrección, no seguridad. La ambigüedad de "firma" en
español (función vs. criptográfica) alcanzó para inventar un endpoint y un mecanismo que no existían.
El error llegó **mergeado a `main` en dos planes** (#387) y habría mandado a la sesión de auditorías
—que corre con modelo caro— a cazar una vulnerabilidad inexistente.

**How to apply:** al triar un backlog heredado, por cada ítem correr un `git grep` del símbolo que el
título menciona y leer las 5 líneas reales antes de asignarle severidad, frente y dueño. Cuesta un
comando por hallazgo. Y si el error ya se publicó, **corregirlo escrito, no borrado**: las otras
sesiones ya leyeron la versión vieja y el borrado silencioso no les avisa. Relacionado:
[[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main]]

---

## Refuerzo 2026-10-08 — **un PUNTERO clasificado como contradicción**

Mismo patrón, nueva cara, y esta vez el error salió publicado en un `urgente_` antes de que lo cazara.

Medí el backlog de la beta y conté **6 cierres declarados de 66 ids**. Tres líneas más arriba, el
mismo archivo decía **«56 de los 77 ids no-`V` están HECHO y en `main`»**. Lo reporté como *«un factor
de 9 entre dos cifras del mismo archivo»* y lo usé para acusar al documento de incoherencia interna.

**No eran dos cifras rivales.** El párrafo completo dice: *«Las **definiciones** y los **DoD** de este
documento siguen valiendo y son la referencia de cada id. Lo que ya **no** vale es su descripción del
**estado** … 56 de los 77 están HECHO y en `main`»*. El doc **avisa que su propio estado está vencido
y cita la medición de otro artefacto**. El `56` es un **puntero**, no un veredicto propio.

**Qué me llevó al error:** leí las dos cifras, vi que no coincidían, y la etiqueta que les puse
—«dos cifras del mismo archivo»— era verdadera y a la vez irrelevante. Las dos vivían en el mismo
archivo, sí, pero **medían criterios distintos** (`6` = DoD tildado · `56` = código en `main`) y una
de ellas **no era de ese medidor**. La coincidencia de ubicación me hizo asumir coincidencia de
sujeto.

**La pregunta que lo caza, y hay que hacérsela a cada cifra que se va a contrastar:**
> *¿esta cifra la produjo este instrumento, o la está CITANDO de otro?*
>
> Y la de al lado: *¿las dos miden el mismo sujeto con la misma vara?* Dos números sobre el mismo
> universo no son comparables si la vara cambió. Antes de llamar «contradicción» a una diferencia,
> leé **el párrafo entero** donde vive cada número, no el renglón.

**Por qué importa más de lo que parece:** una contradicción inventada **le quita autoridad al hallazgo
verdadero que estaba al lado**. El hallazgo real era mejor y sobrevivió a la corrección —«el criterio
pide "cerrado con su DoD" y **ningún** artefacto mide eso»—, pero quedó mezclado con una acusación
falsa que tuve que retirar por escrito frente a las tres sesiones. Un falso rojo del auditor cuesta
la credibilidad de los rojos verdaderos. Ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] y
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].
