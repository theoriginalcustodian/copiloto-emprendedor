# SM-L3 — receta para anular las facturas N° 10 y N° 11 (lo que toca el operador y lo que verifica el servidor)

> Ficha: `SM-L3` (backlog del sprint de correcciones). **El botón final lo toca el operador, nunca una sesión**
> (anula comprobantes reales: se emite una nota de crédito ante ARCA, irreversible).
> Esta receta existe para que su ventana se gaste en apretar, no en averiguar.

## 1. ¿«Cancelar» y «anular» comparten camino? — NO (leído en código, 2026-11-02)

| | Cancelar (SM-H2) | Anular (SM-L3) |
|---|---|---|
| Sujeto | un **borrador** en armado, nunca emitido | una factura **ya autorizada** (con CAE) |
| Mecanismo | Workflow Update sobre `FacturaWorkflow` (`_run_cancelar_factura`, `tool_catalog.py`) | `POST /afip/comprobantes/anular` → `AnulacionWorkflow` (`afip_web.py`, `afip_anulacion_workflow.py`) |
| Efecto fiscal | ninguno (no hubo comprobante) | emite una **nota de crédito** (tipo 13 para Factura C) que la neutraliza |
| Reversible | sí | **no** |

Consecuencia: que SM-H2 ande **no** prueba que anular ande. SM-L3 es la primera vez que `AnulacionWorkflow` toca ARCA real
(las anuladas N°2–6 del libro son de julio, hechas con otro código/entorno de prueba).

## 2. El control de estado en servidor (corrible ANTES y DESPUÉS)

```bash
bash deploy/copiloto/verificar-anulacion.sh 10 11     # por defecto 10 y 11
```

Solo lectura (transacción `READ ONLY`, vía `unreal-copilot` → `fusion`). Veredicto por factura:
`ANULADA` (original `estado='anulada'` **y** una NC con CAE vinculada) · `SIN-ANULAR` · `INCONSISTENTE` (NC con CAE pero el
original no marcado, o al revés) · `DUPLICADA` (más de una NC) · `NO-EXISTE` (exit 2, sin evidencia) ·
conexión/SQL caído = exit 3 (**no** se lee como «no existe»). Exit 0 sólo si **todas** están `ANULADA`.

Estado medido hoy, **antes** del botón (exit 1): N°10 y N°11 `SIN-ANULAR`, `estado=emitida`, 0 NC.
Control del instrumento con datos reales del libro: N°2–6 → `ANULADA`; N°1 → `INCONSISTENTE` (tiene NC pero sigue `emitida`);
N°10/11 → `SIN-ANULAR`. **No ejercitado:** la rama `DUPLICADA` (no hay un caso real).

## 3. ⚠️ Antes de apretar: hay DOS pares N°10/N°11 (mismo CUIT 20269996065, PV 6)

| tenant | fecha | total |
|---|---|---|
| `19af5a42…` | 2026-07-21 | $100 |
| `48a9d75f…` | **2026-11-02** | $100 |

Mismo CUIT y punto de venta, mismos números en dos cuentas: el operador debe **reconocer cuál es la suya** (la de la fecha
y el usuario con que entra a la app) y anular **sólo esas**. El script lista ambos; no decide por vos. Si no sabés cuál es,
**no apretar** — es el hallazgo, no un obstáculo.

## 4. Pasos del operador (en orden, con el resultado esperado)

1. **Antes:** correr `verificar-anulacion.sh 10 11` y guardar la salida → esperado `SIN-ANULAR` ×2 (tu tenant).
2. App → **Facturación → Mis comprobantes** → fila de la **N° 10** → **Anular**.
3. Aparece el aviso *«Anular emite una nota de crédito … No se borra»* → **Sí, anular**. (Esto inicia el workflow; **todavía no emitió**.)
4. Pasa a *esperando confirmación* → **Confirmar anulación**. (**Acá se emite la NC ante ARCA.**)
5. Esperado en pantalla: *Anulada* (verde) → **Listo**. Captura.
6. **Enseguida:** `verificar-anulacion.sh 10` → esperado `ANULADA … NC(con CAE)=1 [<nro de la NC>]`. Pegar la salida.
7. Repetir 2–6 para la **N° 11**.
8. **Final:** `verificar-anulacion.sh 10 11` → exit 0 (ambas `ANULADA`). Esa salida + las capturas cierran la ficha.

## 5. Si algo sale distinto (es hallazgo, no obstáculo)

- **No reintentar a ciegas.** Antes de volver a apretar, correr el script: si ya hay NC con CAE, un segundo intento
  emitiría una **segunda** NC (el fisco acreditaría el doble).
- Estado del workflow: `GET /afip/anulaciones/<anulacion_id>` (campos `paso`, `motivo`, `errores`).
- `INCONSISTENTE` tras apretar = la NC existe ante ARCA pero la base no se actualizó (`marcar_comprobante_anulado` falló):
  la anulación fiscal **es válida**; lo roto es el libro. Avisar a backend con la salida.
- **Hipótesis a mirar en esta corrida (no verificada):** en el libro, las NC viejas (tipo 13, N°1–6) tienen `cbte_asoc_nro`
  vacío y el puntero vive en el **original**; el guard `nota_credito_de` (`afip_comprobante_store.py`) busca el sentido
  contrario. Si tras la anulación real la NC trae el puntero y el original también, el guard está bien; si no, un segundo
  «Anular» sobre la misma factura podría no frenarse. Por eso el script acepta los dos sentidos del puntero.

---

## ⛔ DECISIÓN — el DoD de `SM-L3` queda RETIRADO (2026-11-02, operador)

Esta receta **no se ejecutó** y queda registrada como tal. El operador la sacó de alcance, textual:

> «las facturas no necesitamos probarlas porque ya probamos que funciona»

Lo que eso significa con precisión, porque las dos lecturas no son iguales:

- **El DoD se RETIRA; no se declara satisfecho.** Nadie anuló las facturas N° 10 y N° 11 en esta
  ronda. La anulación queda acreditada por la prueba anterior del operador, **fuera de este sprint**.
- **El código SÍ está en `main`** (#1392: este script y esta receta), mergeado antes del aviso de
  parada. Lo retirado es el ejercicio, no el código. Un `sin-codigo` acá habría sido falso.
- **El hueco queda abierto y nombrado:** la anulación contra ARCA real sigue sin ejercitarse en este
  sprint. Si alguna vez hace falta, la receta está lista y corre tal cual.

### Por qué la ficha cambió de estado el 2026-11-03

`SM-L3` estaba en `TERMINADO` y así contaba dentro de los TERMINADO del sprint — con lo cual una
cifra que se lee como «DoD cumplido» incluía una ficha cuyo DoD fue retirado. El texto del cierre lo
decía con todas las letras («el DoD se RETIRA, no se declara satisfecho») y **la casilla decía lo
contrario**: el estado contradecía a su propia evidencia, y ganaba el estado, porque el estado es lo
que cuenta el script. Pasa a **`CERRADO-POR-DECISION`**, que existe exactamente para esto.

**El hallazgo no es de planificación: lo trajo la sesión de AUDITORÍA** en su lote 1 (H3), el día que
se creó. Vale registrarlo porque es la justificación del operador al crearla, contra la recomendación
de planificación: *el cierre no lo puede auditar quien marcó las fichas*. En el mismo hallazgo se
revisó `SM-N47` y **no se mueve**: su DoD 4 permitía explícitamente «no se pudo atribuir la causa»
como una de sus dos salidas válidas, así que ahí el DoD sí se cumplió.
