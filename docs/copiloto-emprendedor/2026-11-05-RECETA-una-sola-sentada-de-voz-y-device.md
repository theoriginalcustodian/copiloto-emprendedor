# Una sola sentada con el teléfono — todo lo que necesita tu voz o tus manos

> **Para:** el operador.
> **Escrito por:** planificación, 2026-11-05, a partir del cierre de device de frontend1
> (`coordinacion/abierto/2026-11-05_cierre_frontend1-a-planificacion_SM-P12-...md`) y del estado
> medido del backlog de pulido.
> **Por qué existe:** lo que falta del sprint está repartido en siete puntos de cinco fichas, y
> cada uno por separado te manda al teléfono otra vez. Acá está junto, en el orden en que conviene
> hacerlo, para que sea **una** sentada y no siete.

---

## ⛔ No la corras todavía. Faltan dos cosas que no son tuyas

| Precondición | Dueño | Estado al 2026-11-05 |
|---|---|---|
| **Build nuevo** con el fix del teclado (PR #1685) y el de la pila de «Cómo usar» | frontend1 | pedido, en curso |
| **Perfil fiscal + credencial sintéticos** para `e2e-device@copiloto.test` | backend | ✅ **YA ESTÁ** |
| **Explicar por qué la app igual decía «ARCA no configurada»** | frontend1 + backend | en curso |

El perfil fiscal **ya existe y el gate del backend está verde**: medido por backend el 2026-11-05 con
login real de ese usuario, `GET /afip/estado` devuelve `puede_facturar: true` (CUIT 20111111112,
monotributo, credencial sintética en homologación, 46 tests verdes en el VPS). Nada se sembró ni se
tocó: esas filas ya estaban.

Lo que **no** cuadra es que la app, en el teléfono, mostró «ARCA no configurada» de todas formas —
o sea que la app y la API no están viendo lo mismo. Eso se resuelve antes de que vos toques nada,
porque si no, los bloques B y C fallan por una causa que ya conocemos.

**Por qué esperar y no ir ahora:** el APK que está hoy en el teléfono (`ef143e95`) tiene un defecto
real medido — con el teclado abierto, el campo de Mi día queda tapado. Si vas ahora, el bloque A se
hace a medias y los B y C chocan con lo de arriba. La sentada se desperdicia.

**Cuando las dos estén, te lo aviso con el id del APK nuevo.** Antes de instalarlo te vamos a
preguntar, porque el dev-client no está en el teléfono y el APK nuevo reemplaza al actual.

---

## Reglas que valen durante toda la sentada

1. **El usuario es `e2e-device@copiloto.test`.** Ninguno otro.
2. **No se emite ninguna factura.** Lo que estamos probando es que la app **prellene y no emita**.
   Si en algún momento ves un botón de emitir, no lo toques: que la card aparezca ya es el resultado.
3. **Nada de esto toca tu cuenta fiscal real.** Si algo en pantalla sugiere lo contrario, pará y
   avisá.
4. **No hace falta que grabes nada.** Lo que importa es qué hizo la app; con que lo digas alcanza.
5. Si un punto falla, **seguí con el siguiente**. Un punto roto no invalida los otros.

---

## Bloque A — El micrófono se comporta igual en las tres pantallas (3 min)

Esto es lo único que no se puede automatizar: `adb` puede simular un gesto, pero no puede hablar.

Para **cada** una de estas tres pantallas — **chat**, **Mi día** y **Gastos** — hacé las tres
variantes del gesto:

| Variante | Qué hacés | Qué tiene que pasar |
|---|---|---|
| **Mantener y soltar** | mantené apretado el mic, decí «**Pagué quince mil de mercadería ayer**», soltá | se envía solo al soltar |
| **Deslizar y fijar** | mantené el mic, deslizá **hacia arriba** (como WhatsApp), soltá: queda grabando fijo; decí la frase y tocá enviar | queda fijo sin que sostengas, y envía al tocar |
| **Deslizar y cancelar** | mantené el mic, deslizá **hacia un lado**, soltá | se cancela, **no** envía nada |

**Lo que queremos saber:** si las tres pantallas se comportan igual entre sí. Si en una el gesto
hace otra cosa, eso es el hallazgo.

---

## Bloque B — Dictar una factura COMPLETA prellena y no emite (1 min)

En la pantalla **Facturación**, en el dock de abajo:

- Mantené el mic y decí: «**Facturale a Cliente Seed Mi Dia un servicio por cinco mil pesos**».
- **Esperado:** aparece la card o el wizard **ya prellenado** con cliente, concepto e importe, y
  **no se emite nada**.
- **Lo que confirma el punto:** que los datos estén cargados sin que los hayas tipeado, y que no
  haya salido ninguna factura.

---

## Bloque C — Dictar una factura INCOMPLETA pregunta y sigue la conversación (1 min)

Mismo dock de Facturación. Este es el caso que el backend resuelve en **dos pasos**, así que la
primera respuesta es una **pregunta sin card** — eso es lo correcto, no un error.

1. Mantené el mic y decí sólo: «**una factura**».
2. **Esperado:** una pregunta en el dock pidiéndote lo que falta. **Sin card todavía.**
3. Contestá: «**a Cliente Seed Mi Dia por cinco mil**».
4. **Esperado:** ahora sí la card prellenada, en la misma conversación, **sin emitir**.

**Lo que puede salir mal y nos interesa:** que la card aparezca vacía en el paso 2, o que el paso 3
arranque una conversación nueva en vez de continuar la misma.

---

## Bloque D — Mientras tenés el teléfono en la mano, mirá cuatro cosas (2 min)

Cuatro puntos que no necesitan tu voz pero sí tus ojos, y que no se ejercitaron en la pasada de
hoy. Aprovechan la misma sentada:

1. **El campo de Mi día con el teclado abierto** (es el defecto que arregla el build nuevo): tocá el
   campo y fijate que **el campo siga visible** con el teclado desplegado.
2. **El isotipo** de la marca en mobile: fijate que el trazo **no se vea más fino** que en el resto
   de la app. (`SM-P2` — el fix está, nadie lo miró.)
3. **La cámara de Soporte**: entrá a Soporte y confirmá que **ya no hay cámara** en el campo de
   escribir. (`SM-P4` — se retiró a propósito.)
4. **Tocar un tema de «Cómo usar la app»**: el chat tiene que quedar **adelante** con la pregunta ya
   hecha. Si tenés que subir el chat a mano, el fix no entró.

---

## Qué pasa después

Me contás qué funcionó y qué no, con el nivel de detalle que te salga. Yo escribo el estado de cada
ficha con la evidencia, y lo que falle vuelve a su dueño como defecto con causa, no como «no
funcionó». Las fichas que cubre esta sentada: **SM-P1, P2, P4, P5, P6, P12 y P13**.
