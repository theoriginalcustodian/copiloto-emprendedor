# DECISIONES — 11 · Voz contextual

Creado el 16/08/2026. Dibuja el **paso 5** del plan de `audit/ANALISIS-PROTOTIPO-DAVID.md`: dictar el gasto **estando en Gastos**. Es el cambio que convierte dos apps pegadas —la conversación y las pantallas de función— en **una sola con dos modos de entrada**.

**Cero componentes nuevos.** Reusa el composer del modelo de capas (`10-arranque`), el gesto de grabación (`03`, revisión del **24/08**: mantener apretado) y la card editable, que es el **mecanismo canónico del repo** para toda acción dictada (`memoria/mecanismo-canonico-de-las-cards-por-voz.md`, fijado por el operador el 24/07). Lo único que cambia es **dónde aterriza lo dictado**.

---

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| La puerta de voz dentro de una función | **El mismo composer de siempre, con el contexto de la función** | No hay que enseñar un control nuevo: el composer ya vive abajo en toda la app y ya es el borde del panel de conversación. Acá cambian el placeholder ("Anotá un gasto, o hablá…") y el destino | Un FAB de micrófono propio de cada pantalla: un segundo control de voz compitiendo con el que ya existe, y dos gramáticas para lo mismo |
| Rótulo "Estás en Gastos" | **Visible sobre el composer** | Es **la promesa de dónde va a caer lo que digas**. Sin él, dictar en Gastos y dictar en Mi día se ven igual y hacen cosas distintas (Nielsen #1) | Confiar en que el usuario deduzca el contexto por la pantalla de atrás: se pierde justo cuando el velo la tapa |
| Al dictar | **NO se abre el chat** | Si se abriera, perderíamos exactamente lo que esta pantalla vino a resolver. La conversación sigue existiendo, pero no se mete en el medio | Rebotar todo al chat (lo que pasa hoy): obliga a volver y a reconstruir el contexto a mano |
| La función durante la grabación | **Queda entera visible** (rev. 24/08) | Es la diferencia entre *"estoy dictando un gasto"* y *"estoy hablando con Odobi"*. El velo al 96% ya lo buscaba dejando el fondo insinuado; **no tapar nada lo consigue del todo** | Velar la pantalla: se pierde la señal de contexto justo cuando más importa |
| Dónde aterriza el resultado | **La card aparece ahí mismo**, como hoja sobre la lista | Ves el efecto donde ya estabas mirando; al guardar, la lista y el resumen de atrás se actualizan solos | Un receipt en el chat: obliga a viajar para confirmar que el dato llegó |
| La card | **Formulario real precargado**, con Editá/Cambiá por campo | Mecanismo canónico del repo: *"nunca un sí/no ciego, porque un error de transcripción sólo se corrige editando"*. Y es más crítico de lo que parece: **no hay editar ni borrar después de guardar** (contrato §12) — la card es el único control de calidad del dato | Confirmación sí/no: deja pasar errores de transcripción sin salida posible |
| "Todavía no se guardó nada" | **Texto fijo en la card** | **Regla dura del producto**, no cortesía: mientras la card está visible está prohibido decir "listo" o "lo anoté" (`CONTEXT.md`) | Omitirlo: la card se parece demasiado a un registro ya hecho |
| **La card oscurece el fondo; grabar no** | Card con velo oscuro al 28%; grabar sin velo alguno (rev. 24/08) | **La diferencia no es estética: es de rol.** En la card hay una **decisión pendiente** y el foco tiene que estar en ella (es modal). Mientras grabás sólo se oye — sacarte el contexto no aporta nada, y desde el 24/08 el contraste entre los dos momentos es total | Usar el mismo tratamiento para las dos: la card dejaría de leerse como "esto espera algo de vos" |
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
| Punto de grabación `#A32B47` s/ lienzo | 5,80:1 ✅ | gráfico, 1.4.11 pide 3:1 |
| Onda `#B04A2E` s/ lienzo | 4,49:1 ✅ | gráfico |
| "deslizá para cancelar" `sec` s/ lienzo | 6,21:1 ✅ | texto |
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

## Revisión 24/08 — cambió el gesto, no el destino

El gesto de voz pasa a ser el de WhatsApp (mantener apretado · soltar manda · izquierda cancela ·
arriba bloquea). Ver `03/DECISIONES.md` §Revisión 24/08 para el fundamento completo.

**Lo que este mockup defiende sigue intacto:** dictar dentro de una función **no abre el chat** y
la card aterriza ahí. Lo que cambió es cómo se empieza a hablar.

**Y ahora la regla del destino está escrita entera:**

> **Lo que REGISTRA se queda en su función · lo que PREGUNTA va al chat.**

| Desde dónde dictás | Dónde aterriza |
|---|---|
| Gastos · Ingresos · Facturación · Presupuestos · Clientes | **card en la propia función** |
| Mi día · el chat | **chat**, como propuesta pendiente de confirmar |
| **Inteligencia de Negocio** | **chat** — es una función, pero el repo la define como BI conversacional: responde, no registra, y no tiene dónde aterrizar una card |

⚠️ **La card es una sola pieza que cambia de contenido** según de dónde dictaste (`CARDS` en el
prototipo): Gastos pide monto/categoría/proveedor, Clientes pide nombre/teléfono/CUIT. Lo que no
cambia nunca es el contrato — **"Todavía no se guardó nada"**.

⚠️ **Lo que este mockup sigue sin cerrar:** sólo Gastos tiene la lista dibujada, así que guardar
desde las otras funciones cierra la card sin mostrar el resultado. Es carencia del prototipo, no
del modelo — pero no se finge un efecto que no está dibujado.
