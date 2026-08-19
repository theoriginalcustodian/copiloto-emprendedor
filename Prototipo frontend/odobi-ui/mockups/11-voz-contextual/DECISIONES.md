# DECISIONES — 11 · Voz contextual

Creado el 16/08/2026. Dibuja el **paso 5** del plan de `audit/ANALISIS-PROTOTIPO-DAVID.md`: dictar el gasto **estando en Gastos**. Es el cambio que convierte dos apps pegadas —la conversación y las pantallas de función— en **una sola con dos modos de entrada**.

**Cero componentes nuevos.** Reusa el composer del modelo de capas (`10-arranque`), el velo de la escucha (`03`, revisión del 16/08) y la card editable, que es el **mecanismo canónico del repo** para toda acción dictada (`memoria/mecanismo-canonico-de-las-cards-por-voz.md`, fijado por el operador el 24/07). Lo único que cambia es **dónde aterriza lo dictado**.

---

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| La puerta de voz dentro de una función | **El mismo composer de siempre, con el contexto de la función** | No hay que enseñar un control nuevo: el composer ya vive abajo en toda la app y ya es el borde del panel de conversación. Acá cambian el placeholder ("Anotá un gasto, o hablá…") y el destino | Un FAB de micrófono propio de cada pantalla: un segundo control de voz compitiendo con el que ya existe, y dos gramáticas para lo mismo |
| Rótulo "Estás en Gastos" | **Visible sobre el composer** | Es **la promesa de dónde va a caer lo que digas**. Sin él, dictar en Gastos y dictar en Mi día se ven igual y hacen cosas distintas (Nielsen #1) | Confiar en que el usuario deduzca el contexto por la pantalla de atrás: se pierde justo cuando el velo la tapa |
| Al dictar | **NO se abre el chat** | Si se abriera, perderíamos exactamente lo que esta pantalla vino a resolver. La conversación sigue existiendo, pero no se mete en el medio | Rebotar todo al chat (lo que pasa hoy): obliga a volver y a reconstruir el contexto a mano |
| El encabezado de la función durante la escucha | **Queda por fuera del velo, legible** | Es la diferencia entre *"estoy dictando un gasto"* y *"estoy hablando con Odobi"*: el rótulo sigue diciendo dónde estás mientras hablás | Velar la pantalla entera: se pierde la única señal de contexto justo en el momento en que más importa |
| Dónde aterriza el resultado | **La card aparece ahí mismo**, como hoja sobre la lista | Ves el efecto donde ya estabas mirando; al guardar, la lista y el resumen de atrás se actualizan solos | Un receipt en el chat: obliga a viajar para confirmar que el dato llegó |
| La card | **Formulario real precargado**, con Editá/Cambiá por campo | Mecanismo canónico del repo: *"nunca un sí/no ciego, porque un error de transcripción sólo se corrige editando"*. Y es más crítico de lo que parece: **no hay editar ni borrar después de guardar** (contrato §12) — la card es el único control de calidad del dato | Confirmación sí/no: deja pasar errores de transcripción sin salida posible |
| "Todavía no se guardó nada" | **Texto fijo en la card** | **Regla dura del producto**, no cortesía: mientras la card está visible está prohibido decir "listo" o "lo anoté" (`CONTEXT.md`) | Omitirlo: la card se parece demasiado a un registro ya hecho |
| **La card oscurece el fondo; la escucha no** | Card con velo oscuro al 28%; escucha con velo del lienzo al 96% | **La diferencia no es estética: es de rol.** En la card hay una **decisión pendiente** y el foco tiene que estar en ella (es modal). En la escucha sólo se escucha — sacarte el contexto no aporta nada | Usar el mismo tratamiento para las dos: la card dejaría de leerse como "esto espera algo de vos" |
| Origen "por voz" en la lista | **Visible en cada gasto** | El campo `origen` existe en el repo (voz · manual · foto · derivado · mercadopago · factura). Mostrarlo **cierra el círculo**: ves que lo que dictaste llegó y por dónde entró | Ocultarlo: el usuario no tiene forma de confirmar que su dictado terminó donde debía |
| Las barras de categoría | **Arena, no terracota** | Son dato, no algo que se toque (Decisión B) | — |

## 2 · Contraste (calculado)

Hereda los pares ya validados del 09/10/03. Los propios de esta pantalla:

| Par | Ratio | Nota |
|---|---|---|
| "Volver" y "Editá/Cambiá" `#B04A2E` s/ blanco | 5,43:1 ✅ | Lo único tocable en terracota (Decisión B) |
| "Estás en Gastos" `sec` 11px | 6,44:1 ✅ | Sin `opacity` encima |
| Label de categoría y metadatos `sec` | 6,44:1 ✅ | |
| "Guardar el gasto" — fill `#DE7250` + display 20 Bold blanco | 3,17:1 ✅ | AA texto grande, regla 28/07 v2 |
| Velo de la escucha (crema 96%) | ver `03` | Calculado en el peor caso |
| Velo de la card (negro 28%) | — | No lleva texto encima: es una capa de foco, no una superficie de lectura |

## 3 · Continuidad narrativa

El dictado es **el mismo que el del lane 3 del `03`** ("dieciocho mil en mercadería"), acá completado con el proveedor. El gasto de nafta de $15.000 por voz es el que aparece en la actividad reciente del `10-arranque`, y los $126.000 del mes son el "Salió" de la portada de Mi día. **Los tres mockups cuentan el mismo día.**

## 4 · Lo que este mockup NO resuelve

- **El camino inverso está anotado, no dibujado**: si dictaste desde el chat, el receipt lleva "Ver en Gastos". Merece su propio lane si se decide construirlo.
- **Modo automático:** el mecanismo canónico define dos modos (confirmación / automático). Acá se dibuja el de **confirmación**, que es el default y hoy el único alcanzable (el selector es read-only). En automático no habría card: ejecuta y **dice el monto en voz alta** — ahí se oye el error.
- **Las demás funciones:** se dibuja Gastos porque es la de mayor frecuencia. El patrón es el mismo para Ingresos, Clientes y Presupuestos; **Facturación es aparte** (workflow durable de 8 pasos con token de confirmación, no un dict que la card reenvía).

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
