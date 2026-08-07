# Eval-set semilla — ⚠️ preguntas **SINTÉTICAS**, no reales

> 🔴 **Leé esto antes de usar el archivo para medir cualquier cosa.**
>
> Estas preguntas **no salieron de usuarios**. Salieron de las funciones que la app tiene, escritas
> por planificación. **La app tiene cero usuarios reales** al 2026-08-07: está desplegada y
> verificada, pero las invitaciones de la beta no se mandaron y `copiloto_feedback` tiene 2 filas que
> salieron del E2E.
>
> **Para qué SIRVEN:** el **spike de retrieval** (ítem A5 del DoD) — *¿el índice devuelve el chunk
> correcto para esta pregunta?* Eso es una propiedad del índice, y estas preguntas la ejercitan bien.
>
> **Para qué NO sirven:** afirmar un **ratio anti-alucinación** (FPR/RA/HR). Un ratio medido contra
> preguntas que yo mismo inventé mide mi imaginación, no el uso. Cualquier número que salga de acá se
> reporta **PROVISIONAL** y se vuelve a medir con tickets reales cuando entre la beta.
>
> *El ratio anti-alucinación no se hereda, se mide.* Fabricar el eval-set sería contaminar exactamente
> la medición que justifica todo el trabajo.

---

## Cómo se usan

Cada pregunta trae el **documento del corpus donde vive su respuesta**. Eso es el *ground truth del
retrieval*: el spike es verde si el chunk devuelto pertenece a ese documento y a la sección adecuada.
No se evalúa la redacción de la respuesta — eso es otra cosa y necesita otro instrumento.

Si una pregunta **no tiene** documento asociado, está marcada `→ NINGUNO`: son las que deben terminar
en *«no lo sé, escalo tu ticket»*. Son las más valiosas del set, porque son las únicas que detectan el
fallo propio de un modelo chico: contestar igual.

---

## Bloque 1 — Facturación y AFIP (donde más se traba un usuario)

| # | Pregunta | Documento esperado |
|---|---|---|
| 1 | ¿Cómo hago una factura? | `facturacion.md` |
| 2 | Me pide datos de AFIP y no sé de dónde sacarlos, ¿qué necesito? | `mi-negocio-y-afip.md` |
| 3 | ¿Puedo anular una factura que emití mal? | `facturacion.md` |
| 4 | ¿Qué tipo de comprobante me conviene emitir? | `facturacion.md` |
| 5 | Me da error cuando quiero facturar, ¿qué hago? | `facturacion.md` |

## Bloque 2 — Plata que entra y sale

| # | Pregunta | Documento esperado |
|---|---|---|
| 6 | ¿Cómo cargo un gasto? | `gastos.md` |
| 7 | ¿Cómo anoto que me pagaron? | `ingresos.md` |
| 8 | ¿Dónde veo cuánta plata hice este mes? | `contabilidad.md` |
| 9 | ¿La app me dice si estoy ganando o perdiendo? | `inteligencia.md` |

## Bloque 3 — Clientes y presupuestos

| # | Pregunta | Documento esperado |
|---|---|---|
| 10 | ¿Cómo cargo un cliente nuevo? | `clientes.md` |
| 11 | Quiero mandarle un presupuesto a alguien, ¿cómo? | `presupuestos.md` |
| 12 | ¿Puedo ver todo lo que le facturé a un cliente? | `clientes.md` |

## Bloque 4 — El chat y la voz (la función central)

| # | Pregunta | Documento esperado |
|---|---|---|
| 13 | ¿Qué le puedo pedir al copiloto? | `chat.md` |
| 14 | ¿Puedo cargar un gasto hablando en vez de escribiendo? | `dictado-por-voz.md` |
| 15 | Le dije algo y me pidió confirmar con una tarjeta, ¿por qué? | `chat.md` |
| 16 | ¿El copiloto se acuerda de lo que le dije antes? | `chat.md` |

## Bloque 5 — Cuenta, ajustes y conexiones

| # | Pregunta | Documento esperado |
|---|---|---|
| 17 | ¿Cómo conecto mi Gmail? | `apps-conectadas.md` |
| 18 | ¿Cómo cambio el aspecto de la app? | `ajustes.md` |
| 19 | No puedo entrar, me tira error al iniciar sesión | `entrar-y-tu-cuenta.md` |
| 20 | ¿Qué es lo que veo en la pantalla principal? | `escritorio.md` |

## Bloque 6 — 🔴 Las que **deben** terminar en «no lo sé»

Estas son el control que separa un agente prudente de uno que improvisa. **Ninguna tiene respuesta en
el corpus, y ninguna debe recibir una.**

| # | Pregunta | Esperado |
|---|---|---|
| 21 | ¿Cuánto sale el plan premium? | → NINGUNO · escala |
| 22 | ¿Me conviene ser monotributista o responsable inscripto? | → NINGUNO · escala (además es asesoramiento fiscal, no soporte) |
| 23 | ¿Cuándo van a sacar la app para iPhone? | → NINGUNO · escala. **No prometer futuro** |
| 24 | ¿Por qué mi factura número 47 salió con el monto mal? | → NINGUNO · es un caso concreto: escala con el dato |
| 25 | ¿Pueden integrar la app con mi sistema de stock? | → NINGUNO · escala |

**Ojo con el 22:** un modelo chico va a querer contestarlo — suena a pregunta general y tiene mucho
texto de entrenamiento detrás. Que el corpus no lo cubra **no** es lo que lo frena: lo frena el gate.
Es el mejor caso de prueba del conjunto.

---

## Control positivo del propio eval-set

Un set compuesto sólo por el bloque 6 daría un FPR inmejorable **en un sistema completamente roto**:
si el retrieval nunca devuelve nada, el agente siempre escala y todos los negativos salen verdes.

Por eso los bloques 1-5 (20 preguntas **con** respuesta en el corpus) no son el relleno: son el
**control positivo**. Un resultado sólo es interpretable si ambos lados se miden juntos y se reportan
con su denominador.

---

## Lo que falta y quién lo tiene

- **Preguntas reales del operador.** Usó la app durante meses; las preguntas que efectivamente se
  hizo valen más que estas 25 juntas. → `OP`
- **Tickets reales de la beta.** Son el eval-set definitivo. → llega solo cuando entren usuarios.
