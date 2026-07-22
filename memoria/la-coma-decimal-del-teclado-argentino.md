---
name: la-coma-decimal-del-teclado-argentino
description: LEER antes de poner un campo de IMPORTE en una pantalla nueva — el teclado argentino entrega coma y el backend parsea con punto; sin normalizar, el usuario escribe bien y la app le dice que está mal.
metadata:
  type: project
---

El teclado numérico entrega **coma** en configuración regional argentina. El backend hace
`Decimal("15000,50")` → `InvalidOperation` → **400**.

O sea: **el emprendedor escribe el importe como lo escribe todo el país, y la app le dice que está
mal.** No es un caso borde — es el caso común, y en un campo de plata, que es donde menos tolerancia
hay para que la app parezca rota.

**Se normaliza, NO se convierte.** El atajo es `Number(texto)`, que arregla el separador y de paso
mete el `float` que todo el contrato de plata evita (`0.1 + 0.2 !== 0.3`; un centavo de más en algo
que después se factura es un problema fiscal). El string entra string y sale string:

```ts
normalizarDecimal('30000,50')  // '30000.50'  — trim, sin espacios, coma → punto
esDecimalPositivo('0,00')      // false — numérico, pero el backend lo rechaza con 400
```

Viven en `packages/core/src/dinero/formatoDinero.ts`, al lado de `formatearImporte`, porque son **el
mismo viaje en las dos direcciones**: `formatearImporte` va de lo que el backend manda a lo que el ojo
lee (`'45000.00'` → `'$45.000,00'`), y `normalizarDecimal` vuelve de lo que el dedo tipea a lo que el
backend parsea. Tenerlas separadas es cómo una pantalla implementa una y se olvida de la otra.

**Por qué esto puede volver aunque haya tests.** Vivía **duplicado dentro de `FormularioPresupuesto`**
como una función local, y ahí funcionaba: el bug no estaba en presupuestos, estaba esperando en la
**siguiente** pantalla con un campo de importe. Los tests de gastos y de presupuestos ahora lo cubren,
pero **no cubren la pantalla que todavía no existe** — y la que se olvide no falla en el gate, falla
en el teléfono de alguien que escribió una coma. Por eso la regla es la ubicación (el core, junto a su
gemela), no el test.

**Y el que la valida tiene que exigir exactamente lo que exige el backend, ni más ni menos.** Un
`puedeGuardar` que pida más traba el caso común y esconde bugs de las dos capas — ver
[[validacion-de-mas-en-la-ui-enmascara-bugs]].
