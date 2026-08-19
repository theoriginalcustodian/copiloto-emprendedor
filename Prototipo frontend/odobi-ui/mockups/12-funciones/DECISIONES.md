# DECISIONES — 12 · Las siete funciones

Creado el 19/08/2026. Dibuja las siete funciones que el repo define en `kb-usuario/`:
**Gastos · Ingresos · Facturación · Presupuestos · Inteligencia de Negocio · Contabilidad · Clientes**.

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
| Contabilidad | **ninguna** — solo consulta | lectura |
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
| Contabilidad | **Sin alta** | El repo: *"es una pantalla de solo consulta: no podés cargar ni editar nada desde acá"* | Darle "Nuevo movimiento" por simetría con las otras seis |

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

## 3 · Lo que este mockup NO resuelve

- **La cartera de Clientes no alimenta la facturación.** Del repo: al facturar los datos se
  cargan a mano, sin elegir de la lista; la cartera se arma en sentido inverso. La pantalla
  **insinúa una promesa que el backend no cumple**. Es carencia del producto, no del diseño.
- **Contabilidad e Inteligencia se solapan** en caja, categorías y mejores clientes. Viene del
  repo, pero obliga a elegir dónde mirar sin criterio.
- **Los gráficos no son tocables** (repo). Hoy nada lo indica: tocarlos y que no pase nada se
  lee como app rota.
- **Los formularios de alta no están dibujados.** El repo define que la pantalla alterna entre
  `listado` y `formulario`; acá se dibuja el listado y el acceso al alta.
- **El tope de monotributo aparece en dos pantallas** (Inteligencia y Contabilidad), por
  decisión de Martin del 19/08: en Inteligencia con proyección, en Contabilidad como dato.
