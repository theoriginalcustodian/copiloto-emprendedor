---
name: discriminar-por-ausencia-de-estructura
description: Reconocer un caso "por descarte" (es el que no trae tal campo) convierte cualquier caso NUEVO en una mentira dirigida al usuario
metadata:
  type: project
---

**Cuando un mismo código de error tiene varios significados, discriminarlos por la PRESENCIA de un
campo es correcto; discriminar uno por su AUSENCIA es una bomba con temporizador.** El caso "por
descarte" se traga todo caso nuevo que el backend agregue, y lo muestra con el mensaje de otro.

**El caso real (2026-07-22, `POST /presupuestos/{id}/facturar`).** Tenía dos 409: *ya se facturó*
(trae `factura_id`) y *falta el CUIT* (no trae nada). El cliente decía: si no hay `factura_id`, es
falta de CUIT. Después aparecieron **dos** problemas encima, y ninguno dio error:

1. El campo venía bajo `detail` y no en la raíz (FastAPI serializa `HTTPException(409, detail={...})`
   como `{"detail": {...}}`), así que el discriminador devolvía "no está" **siempre**: a quien ya había
   facturado se le decía *«cargá tu CUIT en Ajustes»* — mandarlo a arreglar algo que ya tenía, por una
   factura que ya existía.
2. Al agregarse un **tercer** 409 (presupuesto `desestimado`), cayó en la misma rama. Y como el
   `switch` de la UI no tenía `default`, el status nuevo se fue por el hueco y el botón quedó en
   «Preparando…» **para siempre**: la app colgada, sin un solo error.

**Por qué rinde.** El discriminador por ausencia **no falla: acusa a otro**. Un caso nuevo no produce
una excepción ni un estado vacío — produce el mensaje del caso viejo, que es plausible, accionable y
falso, así que el usuario lo obedece. Y como el mensaje "funciona", nadie lo audita. Es la familia de
[[instrumentos-que-confirman-en-vez-de-verificar]]: el sistema devuelve una respuesta afirmativa
construida sobre información que no tiene.

**Cómo se aplica.**

1. **Todo caso se reconoce por algo que TRAE**, nunca por lo que le falta. Si el backend no manda un
   discriminador, eso es un pedido al backend, no algo que se resuelve leyendo el texto del mensaje
   (el copy se reescribe sin que eso sea un cambio de contrato).
2. **Mientras quede un caso por descarte, anotarlo en el código con la advertencia**, para que el
   próximo que agregue un caso vea dónde va a aterrizar.
3. **Guarda de exhaustividad en el consumidor** (`const _: never = res`): un status sin rama tiene que
   **no compilar**. Sin ella, el caso no contemplado no es un error visible — es un spinner eterno.
4. **Y el test tiene que montar la forma REAL del wire.** Los tres tests que cubrían ese 409 montaban
   el body plano —la forma que yo había supuesto—, así que confirmaban la misma creencia equivocada
   que el código. Control de mutación: con el lector viejo falla **sólo** el test nuevo; los otros 36
   pasan. [[no-codificar-la-esperanza-principio-raiz]]

**Hermana, del mismo día y el mismo origen:** deducir que `GET /conceptos` traía los desactivados
*porque el campo `activo` existe* — impecable como razonamiento, falso contra el endpoint (filtra por
defecto). Tampoco habría dado error: el ABM mostraría sólo los activos, que es exactamente lo que uno
espera ver, mientras el concepto desactivado quedaba irrecuperable. **Una deducción que explica bien
el dato que tenés a la vista no es una verificación de nada.**
