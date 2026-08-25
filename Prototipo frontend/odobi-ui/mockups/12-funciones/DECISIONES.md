# DECISIONES — 12 · Las seis funciones

Creado el 19/08/2026, revisado el 20/08. Dibuja las funciones que el repo define en `kb-usuario/`:
**Gastos · Ingresos · Facturación · Presupuestos · Inteligencia de Negocio · Clientes**.
⚠️ Eran siete: **Contabilidad se unificó con Inteligencia el 20/08** (ver §2.bis).

Es el primer mockup que **no recrea la UI en su propio HTML**: los teléfonos cargan el
prototipo real por `iframe`. Fundamento: había dos fuentes de verdad —el prototipo y once
mockups con el CSS copiado— y cada cambio obligaba a propagarlo a mano, con el riesgo de
divergencia que ya nos costó varios errores. Acá el mockup aporta lo suyo (el argumento,
las anotaciones, las alternativas descartadas) y la pantalla viene de un solo lugar.

---

## 0 · Qué son las funciones, según el repo

Esto se verificó antes de dibujar, porque la premisa de trabajo era otra. **Las funciones no
son pantallas de configuración**: son la **vía de la mano**, paralela a la de la voz, sobre
los mismos datos. La configuración vive en **Ajustes** (`kb-usuario/ajustes.md`), que es otro
mockup (13).

| Función | Alta que define el repo | Naturaleza |
|---|---|---|
| Gastos | "Nuevo gasto" + foto de ticket + voz | registro |
| Ingresos | **"Anotar que me pagaron"** (no "Nuevo ingreso") | registro |
| Facturación | "Nueva factura" | emisión |
| Presupuestos | "Nuevo presupuesto" | emisión |
| Clientes | "Nuevo cliente" | cartera |
| ~~Contabilidad~~ | — | ⚠️ **Unificada con Inteligencia el 20/08** (ver abajo) |
| Inteligencia de Negocio | ninguna — responde | lectura |

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Anatomía | **Card blanca con el nombre + bloque negro + lista** | Entrar a una función se lee como el mismo objeto cambiando de contenido, no como saltar a otra app. Reduce el costo de aprender siete pantallas a aprender una | Una estructura por función: siete gramáticas para siete lugares del mismo producto |
| El bloque negro | **La cifra accionable de esa función**, no "el total" | En Presupuestos lo accionable es lo que espera respuesta; en Clientes, el tamaño de la cartera. Un total genérico no sirve para decidir nada | Repetir la misma métrica: la pantalla pierde tema propio |
| Nombre y período | **En la card blanca del stack**, con el header sólo con la salida | Mismo movimiento que en Mi día, donde el wordmark bajó al stack. El período fecha la cifra: "$126.000" sin mes no significa nada | Título en la barra superior: chrome ocupando el lugar de un dato |
| "Volver" | **A la izquierda, con chevron** | Es el borde donde iOS y Android ponen el retroceso, y el mismo desde el que se hace el gesto. Se acepta que quede lejos del pulgar: es acción de baja frecuencia y alto reconocimiento | A la derecha: enfrenta la convención sin ganar nada |
| Alta manual | **Pill en la fila del rótulo**, con el verbo textual del repo | La acción principal sigue siendo hablar; un FAB competiría con el mic, que es el gesto que el producto quiere enseñar. Label en `#B04A2E` sobre card blanca: tocable sin gastar más superficie de acento (60/30/10) | Botón grande al pie: se come el composer, que es el borde del panel de conversación |
| Estado de cada ítem | **Chip. Lo que reclama en negro, lo terminado en arena** | Sobre tres facturas el ojo va solo a la impaga sin usar terracota. Arena s/negro **8,46:1** ✅ | Teñir la fila de rojo/verde: trae una paleta semántica que el sistema no tiene y compite con el único acento |
| Dato faltante | **"—", nunca "$0"** | Regla dura del repo: *"el Copiloto nunca confunde 'no tengo ese dato' con 'el valor es cero'"*. Mostrar cero de rentabilidad cuando falta un gasto **le miente al usuario sobre su negocio** | "$0": indistinguible de un resultado real. Vacío: se lee como error de carga |
| Semáforo del tope | Verde `#3F7D5C` (4,84:1) · ámbar `#A06A1E` (4,63:1) · rojo `#B04A2E` (5,43:1) | El repo lo pide explícito y la paleta no tenía señales semánticas. Se eligieron con el **mismo valor tonal** que la terracota profunda para que convivan. WCAG 1.4.1: el color nunca va solo — el porcentaje va en texto | Sólo arena: no distingue "tranquilo" de "cerca del tope", que es toda la información |
| Rótulo "Estás en Gastos" | **Derogado el 19/08** | El encabezado ya dice dónde estás. La promesa de destino la lleva el **placeholder** ("Anotá un gasto, o hablá…"), que ya lo dice y no gasta una fila | Conservarlo (decisión del 16/08): se cae por redundante. ⚠️ El **mecanismo** no cambia: dictar en una función sigue sin abrir el chat |
| Barras de categoría | **Arena sobre crema al 14%** | Dato, no tocable (Decisión B) | — |
| Contabilidad | **Absorbida por Inteligencia** (20/08) | Las dos mostraban caja, categorías, mejores clientes y tope de monotributo: el usuario elegía dónde mirar sin criterio. La regla que la sostenía se conserva — *Caja y Facturado no se mezclan* | Mantenerlas separadas como en el repo: duplica cuatro secciones. ⚠️ Diverge del repo |

## 2 · Contraste (calculado)

| Par | Ratio | Nota |
|---|---|---|
| Crema s/ negro tostado | 16,37:1 ✅ | cifras del bloque |
| Arena s/ negro tostado | 8,46:1 ✅ | labels y chips dentro del bloque |
| Negro s/ card blanca | 18,10:1 ✅ | contenido de las listas |
| `sec` s/ blanco | 7,51:1 ✅ | metadatos |
| `#B04A2E` s/ blanco | 5,43:1 ✅ | "Nuevo gasto", "Volver" |
| Verde / ámbar / rojo s/ blanco | 4,84 · 4,63 · 5,43 ✅ | semáforo del tope |
| ⚠️ Blanco s/ `#DE7250` a 16 px | **3,17:1** ✗ | pill de acción de tarjeta. Aplicado a pedido de Martin, **anotado y no cerrado** |

## 2.bis · Contabilidad se unificó con Inteligencia (20/08)

Decisión de Martin. ⚠️ **Diverge del repo**, que las define separadas: va como propuesta a David.

**Motivo:** caja, categorías de gasto, mejores clientes y tope de monotributo aparecían en **las
dos** pantallas, y el usuario elegía dónde mirar sin un criterio que se lo dijera. Era el problema
que este mismo mockup tenía anotado como abierto.

⚠️ **La regla que sostenía a Contabilidad se conserva:** *Caja y Facturado nunca se mezclan* — si se
sumaran, la misma plata se contaría dos veces. Se sigue diciendo con **superficie**: caja en el
bloque negro, facturado en card blanca.

**Efecto:** el escritorio pasa de 7 funciones a 6.

## 3 · Lo que este mockup NO resuelve

- **La cartera de Clientes no alimenta la facturación.** Del repo: al facturar los datos se
  cargan a mano, sin elegir de la lista; la cartera se arma en sentido inverso. La pantalla
  **insinúa una promesa que el backend no cumple**. Es carencia del producto, no del diseño.
- **Los gráficos no son tocables** (repo). Hoy nada lo indica: tocarlos y que no pase nada se
  lee como app rota.
- **Los formularios de alta no están dibujados.** El repo define que la pantalla alterna entre
  `listado` y `formulario`; acá se dibuja el listado y el acceso al alta.
- **El tope de monotributo** quedó en un solo lugar tras la unificación, con su proyección
  ("a este ritmo lo alcanzás en noviembre"). Antes estaba en las dos pantallas.
