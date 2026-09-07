# SPEC — Mi día: números, agenda y tablero en una sola pantalla

**20/08/2026.** Cómo conviven las tres verticales que Martin plantea —resumen de inteligencia,
tablero de pendientes y calendario— dentro de Mi día, sin romper lo que el repo ya definió.

---

## 0 · El encuadre: dos de las tres ya existen

Antes de diseñar se verificó contra `kb-usuario/`. El resultado cambia el problema:

| Vertical | Estado real |
|---|---|
| **Resumen de inteligencia** | ✅ Existe. Portada (`query portada`) + los 5 números + el detector de 8 reglas |
| **Tablero de pendientes** | ✅ **Ya es Mi día.** El repo define tres pestañas —**Para hoy · Haciendo · Hechas**— con swipe para avanzar, tarjetas automáticas + manuales y control por voz |
| **Calendario** | ⛔ **No existe.** Google Calendar está conectado, pero sólo para que Odobi *agende* por chat. No hay pantalla |

**Consecuencia:** no hay que inventar un kanban. Mi día **es** el kanban, y nuestro prototipo lo
está dibujando mal —como lista plana sin estados—. Eso se corrige igual, independientemente de esta
spec.

Textual del repo: *"El tablero se organiza en tres pestañas, que representan el estado de cada
tarjeta"* · *"Deslizar una tarjeta hacia la izquierda te revela dos botones: uno para avanzarla a la
siguiente etapa ('Empezar' si está en 'Para hoy', 'Terminé' si está en 'Haciendo')"*.

## 1 · Decisiones tomadas (Martin, 20/08)

| # | Decisión | Fundamento |
|---|---|---|
| 1 | **Eje del kanban: ESTADO**, no función | Es lo construido, lo que la voz ya sabe mover, y responde la pregunta real de la mañana: *¿qué hago ahora?* La función se lee por el ícono de la tarjeta |
| 2 | **Una pantalla, tres bloques en scroll** | Una sola respuesta a "¿cómo viene mi día?" sin obligar a elegir dónde mirar. Cada bloque con su "ver todo" |
| 3 | **Odobi ordena; el usuario puede fijar arriba y ocultar tipos** | El orden manual **envejece**: una factura que vence mañana queda abajo porque se movió la semana pasada. El detector recalcula solo |
| 4 | **Calendario completo**: lectura + tarjetas con fecha + agendar una tarea + Odobi propone huecos | Es lo que convierte dos listas paralelas en un día |

## 2 · Anatomía de Mi día

```
┌────────────────────────────┐
│  ‹ avatar                  │   header: sólo el avatar
│  ┌──────────────────────┐  │
│  │ Odobi   Martes 18 ago│  │   stack (gramática A)
│  │ ████████████████████ │  │
│  │ █ En caja        ›  █ │  │   BLOQUE NEGRO — abre Inteligencia
│  │ █ $286.000  −18%    █ │  │
│  │ █ entró · salió ·   █ │  │
│  │ █ por cobrar        █ │  │
│  │ ████████████████████ │  │
│  └──────────────────────┘  │
│                            │
│  HOY                ver ›  │   ── AGENDA ──
│  ┌──────────────────────┐  │
│  │ 09:00  Obra casa Díaz│  │   máx 3 · sólo lo que queda por delante
│  │ 14:30  Llamar a Lucía│  │
│  └──────────────────────┘  │
│                            │
│  PARA HOY (4)       ver ›  │   ── TABLERO ──
│  ┌──────────────────────┐  │
│  │ ▣  Presupuesto Lucía │  │   máx 3 · las de mayor prioridad
│  │    31 días sin resp. │  │
│  │    [ Escribirle ]    │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ ▣  Factura Rodríguez │  │
│  └──────────────────────┘  │
│                            │
│  [ Escribí, o hablá…  🎙 ] │   composer
└────────────────────────────┘
```

**El orden de los tres bloques no es arbitrario.** Responde a cómo se decide una mañana:

1. **Cuánto tengo** — contexto. Sin saber la caja, ninguna prioridad se puede evaluar.
2. **Qué es inamovible** — los compromisos con hora condicionan todo lo demás. Van antes que lo
   flexible porque no se negocian.
3. **Qué debo atender** — lo que sí se reordena según el tiempo que quede.

**Regla del resumen: máximo 3 ítems por bloque.** Un resumen que muestra todo deja de ser resumen y
convierte Mi día en tres listas apiladas. El contador ("PARA HOY (4)") dice cuánto hay sin mostrarlo.

## 3 · El problema del color, y cómo se resuelve

Martin pidió clasificar las tarjetas *"por distintas variables: colores, formatos"*. Eso choca de
frente con una regla cerrada:

> **Decisión B (26/07): si es terracota, pasa algo al tocarlo.** El acento marca lo tocable.

Si el color pasa a marcar la **función** (cobros, AFIP, presupuestos), deja de marcar la **acción** —
y el usuario pierde la única señal fiable de qué es tocable. Además obligaría a inventar 6 colores
nuevos, cuando la paleta tiene un acento y dos apoyos.

**La solución: separar las dos preguntas y darle a cada una su canal.**

| Pregunta | Canal | Por qué |
|---|---|---|
| **¿De qué es esta tarjeta?** | **Ícono** en tile arena | Ya existe el componente. Phosphor tiene un ícono claro por función y no gasta paleta |
| **¿Cuánto apura?** | **Peso**: la urgente en negro, el resto en arena | Ya es el patrón del sistema (factura impaga en negro, "Cobrada" en arena). Sobre cuatro tarjetas el ojo va sola a la que reclama |
| **¿Cuándo vence?** | **Texto explícito** en la tarjeta | "31 días sin respuesta" dice más que cualquier color, y funciona para daltónicos (WCAG 1.4.1) |
| **¿La fijé yo?** | **Ícono de pin** | Estado del usuario, no del dato |

**Escala de urgencia, si hace falta color:** se usa la del semáforo ya aprobada el 19/08 —
`#3F7D5C` · `#A06A1E` · `#B04A2E`— **y sólo para urgencia**, nunca para función. Todos ≥4,5:1 sobre
blanco. Y nunca solos: siempre con el texto al lado.

## 4 · El tablero completo (pantalla propia)

**En mobile las tres columnas no entran.** A 390 px, tres columnas dan ~118 px cada una: no cabe el
nombre de un cliente. El repo ya lo resolvió: **pestañas**, no columnas lado a lado. Se respeta.

```
‹ Volver

Tu día
Lo que Odobi detectó y lo que anotaste vos.
● 4 para hoy · 1 en curso

[ Para hoy (4) ]  Haciendo (1)  Hechas
────────────────────────────────────
[Todo] [Cobros] [AFIP] [Presupuestos]     ← filtro por función

┌────────────────────────────────┐
│ 📌 ▣  Certificado AFIP         │  ← fijada por el usuario
│      Vence en 12 días          │
│      [ Renovarlo ]             │
└────────────────────────────────┘
┌────────────────────────────────┐
│    ▣  Presupuesto de Lucía     │
│      31 días sin respuesta     │
│      [ Escribirle ]            │
└────────────────────────────────┘
```

- **Pestañas con contador.** "Para hoy (4)" dice si vale la pena entrar.
- **Filtro por función**, que es el "panorama específico" que Martin pedía: chips arriba, sin
  romper el eje de estado.
- **Swipe izquierda → dos acciones** (avanzar · borrar), como define el repo.
  ⚠️ **No colisiona con el swipe de descarte de Mi día** porque son gestos de pantallas distintas:
  acá la tarjeta revela botones, no se descarta.
- **Borrar es definitivo** (repo). Va con confirmación, a diferencia del descarte de Mi día que tiene
  Deshacer.
- ⚠️ **Las tarjetas automáticas no se mueven a mano.** El repo: *"se resuelven solas cuando hacés la
  acción real, no cuando se lo contás al Copiloto"*. Sólo las manuales avanzan de etapa. **La UI
  tiene que decirlo**, o el usuario cree que la app no responde — es una de las dudas frecuentes que
  el propio repo documenta.

## 5 · El calendario (pantalla propia)

```
‹ Volver

Agenda
Lo tuyo de Google Calendar y lo que vence.

[ Hoy ]  Semana

09:00 ─── Obra casa Díaz          (Calendar)
          2 h · Av. Pellegrini

11:30 ─── ▣ Cobrar a Rodríguez    (tarjeta)
          $80.000 · 22 días

14:30 ─── Llamar a Lucía          (Calendar)

────────────────────────────────
SIN HORA (2)
  ▣ Certificado AFIP · vence en 12 días
  ▣ Presupuesto Lucía · 31 días

────────────────────────────────
Tenés libre de 15:00 a 18:00.
¿Le mando el recordatorio a Lucía a las 15?   [ Dale ]
```

**Las cuatro capacidades pedidas:**

1. **Lectura de Google Calendar** — hoy y semana.
2. **Las tarjetas con fecha aparecen en su día.** Esto es lo que **une** las dos verticales en vez de
   ponerlas una al lado de la otra: un CAE que vence el 28 es un compromiso, igual que una reunión.
3. **Agendar una tarjeta a una hora.** Pasa de pendiente a compromiso.
4. **Odobi propone huecos** — mira lo libre y sugiere cuándo.

**El bloque "sin hora" es obligatorio y no es un detalle.** La mayoría de las tarjetas del detector
**no tienen hora**: un presupuesto frío no vence a las 14:30. Forzarlas a una posición horaria
**inventa un dato que no existe** — el mismo error que mostrar "$0" donde falta el número. Van
listadas aparte, abajo, disponibles para agendar si el usuario quiere.

## 6 · Contraste y accesibilidad

| Par | Ratio | Uso |
|---|---|---|
| Crema s/ negro | 16,37:1 ✅ | cifras del bloque |
| Arena s/ negro | 8,46:1 ✅ | labels del bloque |
| Negro s/ card blanca | 18,10:1 ✅ | contenido de tarjetas |
| `sec` s/ blanco | 7,51:1 ✅ | metadatos, horas |
| `#B04A2E` s/ blanco | 5,43:1 ✅ | acciones, "ver todo" |
| Semáforo s/ blanco | 4,84 · 4,63 · 5,43 ✅ | urgencia, siempre con texto |

- **WCAG 1.4.1** — el color nunca es el único indicador: cada urgencia lleva su texto ("vence en 12
  días").
- **WCAG 2.5.1** — el swipe de la tarjeta necesita alternativa de un solo puntero. Tocar la tarjeta
  la expande y ahí van los mismos botones. ⚠️ Esto ya está pendiente desde el 19/08 para el descarte
  de Mi día: **resolver los dos juntos**.
- **Targets ≥44 pt** en pestañas, chips de filtro y acciones.

## 7 · Lo que esta spec NO cierra

- **"Odobi propone cuándo hacer cada cosa" es VISIÓN.** Requiere leer huecos del calendario y estimar
  duración de cada pendiente. El repo no expone nada de eso hoy. Se dibuja marcado como visión, en la
  meta-capa, nunca dentro del frame.
- **Agendar una tarjeta también es visión**: implica escribir en Google Calendar desde una tarjeta,
  y hoy Calendar sólo se usa por chat.
- **Las tarjetas del detector no tienen campo de hora** en el repo. Agregarlo es cambio de modelo de
  datos, no de UI. Hay que confirmarlo con David antes de dibujarlo como real.
- **"Fijar arriba" y "ocultar tipos" no existen** en el repo. Son propuesta de diseño.
- **Cuántas tarjetas caben antes de que Mi día se vuelva larga** — hay que probarlo con contenido
  real, no con tres de ejemplo.
- **El solapamiento con Inteligencia**: el bloque negro de Mi día ya abre Inteligencia. Si la agenda
  y el tablero también tienen "ver todo", Mi día pasa a ser un índice de tres pantallas. Es aceptable
  mientras el resumen **responda solo** la pregunta de la mañana; si obliga a entrar a las tres,
  falló.
