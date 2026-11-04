---
name: un-despacho-de-retiro-no-distingue-el-resto-olvidado-de-la-excepcion-fechada
description: Un despacho de «quitá toda referencia a X» trata igual al resto olvidado y a la excepción deliberada con fecha y dueño — ejecutarlo al pie desharía la decisión.
metadata:
  type: feedback
---

Cuando baja la orden **«X fue retirado, quitá toda referencia»**, los hits del grep son de clases
distintas y el despacho no las distingue. Antes de ejecutar, clasificá cada hit por **qué clase de
afirmación es**, no por el nombre que matchea:

1. **Afirmación VIVA falsa** → se quita. (`CLAUDE.md:32`, `CONTEXT.md:199`, `HANDOFF.md`,
   `README.md:58`, `ODOBI_HANDOFF.md:24`: «integra Instagram», «7 servicios operativos».)
2. **Excepción FECHADA con motivo y dueño** → **se queda**, y la orden de retiro no la alcanza.
3. **Fixture de test que usa X como el ejemplo del mecanismo** → sacarlo no quita una referencia:
   **borra la cobertura del mecanismo**.
4. **Registro FECHADO** (auditorías, reportes, decisiones de UX) → editarlo **falsifica** lo que se
   midió en su fecha.
5. **Homónimo** → el nombre matchea y no es el sujeto.

## El caso raíz (2026-11-04, Instagram)

Backend relayeó la orden del operador y despachó: *«quitar la entrada de `SERVICE_RISK` y la
excepción de `service-risk-excepciones.json` juntas»*. Ejecutado al pie, eso **desharía una decisión
cuyo dueño era yo**:

- `service-risk-excepciones.json` → `instagram`: `fecha: 2026-10-07`, `dueno: planificación (fila
  IGHUBSPOTFANTASMA)`, motivo textual: *«borrarla de SERVICE_RISK sin borrar los mensajes viejos
  pintaría una card neutra sobre una acción que de hecho fue irreversible»* en un historial
  rehidratado.
- El propio gate del retiro lo declara **fuera de alcance a propósito**:
  `sinInstagram.contrato.test.ts:13-14` — *«Lo que NO mide a propósito: `SERVICE_RISK.instagram`»*.
- El trinquete para sacarla, escrito en el `_leeme` del JSON, es el **inverso**: se saca el día que
  exista una tool real de Instagram, no el día que se retire.
- Y el retiro **ya estaba hecho y gateado**: SM-N17 `8378d53d` (#1425) + SM-N18 `0046ded4`, con rojo
  si vuelve en `sinInstagram.contrato.test.ts` (web + catálogo, con canario) y
  `PantallaApps.test.tsx:45-47` (mobile). De 60 archivos con el hit, **~30 eran auditorías fechadas**.

**Por qué no da síntoma.** Un despacho de retiro llega con la autoridad del operador y la forma de
una tarea mecánica: `grep -il` + borrar. La excepción deliberada **no se ve distinta del resto
olvidado en la salida del grep** — ambos son una línea con la palabra. Y lo que la protege (su fecha,
su dueño, su motivo) vive en **otro archivo** y en el comentario de un test que declara el alcance
negativo; ninguno de los dos aparece en el grep del nombre. Ejecutar al pie habría pintado cards
neutras sobre acciones irreversibles de historiales viejos, en silencio, meses después.

**Cómo se aplica.** Ante un despacho de retiro: (a) medí el radio (`git grep -il`) y **clasificá por
las 5 clases antes de tocar nada**; (b) buscá el **gate** del retiro — si existe, su alcance negativo
está escrito y es la autoridad, no el nombre; (c) si un hit tiene fecha y dueño, el retiro **no lo
alcanza**, y hay que decirlo con la cita, no ejecutarlo; (d) el retiro se registra en **UN** lugar,
no reescribiendo la historia.

Hermanas: [[exencion-sin-autoridad]] (la exención que cita una autoridad que no la ampara — acá es el
reverso: la exención **sí** la tenía) · [[el-contrato-que-manda-a-hacer-algo-ya-hecho]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] ·
[[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]