# Mapa de las 9 funciones del escritorio — qué existe, qué es cáscara, qué falta

> **Barrido del 2026-07-25.** Tres sub-agentes en paralelo (uno por terna), cada uno verificando
> **contra el código**, no contra la documentación. Consolidado y contra-verificado por planificación.
>
> ⚠️ **Esto es una FOTO.** Vale mientras el código no cambie. Si la leés después de un sprint,
> revalidá antes de planificar encima — es exactamente el error que este barrido vino a cazar
> ([[la-evidencia-vence-y-el-documento-no-lo-dice]]).

## El mapa

| # | Función | Veredicto | Qué falta |
|---|---|---|---|
| 1 | **Facturación** | ✅ COMPLETA | — (23 rutas AFIP, ninguna 501) |
| 2 | **Ingresos** | ✅ COMPLETA | — (4 rutas) |
| 3 | **Gastos** | ✅ COMPLETA | — (6 rutas + tool de voz `registrar_gasto`) |
| 4 | **Presupuestos** | 🟡 **CÁSCARA** | El backend **no emite el kind `presupuesto_propuesto`** → la card no puede renderizar nunca. App y 5 endpoints están vivos |
| 5 | **Clientes** | ✅ COMPLETA | — (4 rutas) |
| 6 | **Mi Día** | ✅ COMPLETA | — (4 rutas, detector con 3 solapas) |
| 7 | **Inteligencia de Negocio** | ✅ COMPLETA | — (6 rutas: portada + 4 gráficos + chat) |
| 8 | **Contabilidad** | 🟡 **CÁSCARA** | **No existe `GET /contabilidad/resumen`** — ni el archivo, ni la ruta. La pantalla (237 líneas) degrada a `no_disponible` |
| 9 | **Ajustes** | ✅ COMPLETA | — (el grid es dispatcher; lo funcional es Perfil de Negocio, 2 rutas) |

**7 completas · 2 cáscara.** Y las dos cáscaras son **exactamente los dos contratos que BACKEND
tiene en `coordinacion/abierto/`** (hito P y hito C). El barrido no descubrió trabajo nuevo: confirmó
la cola por un camino independiente, que es el mejor resultado posible para un inventario.

## ⚠️ Qué significa "COMPLETA" acá, y qué no

Significa **cableado**: la pantalla existe, llama a un endpoint real, el endpoint está implementado
y no devuelve 501 ni datos mock. **NO significa verificado en device ni E2E.** Un agente escribió
"listas para producción" — eso es una afirmación de más, y se corrige acá: lo táctil se prueba en
el teléfono, y esa evidencia no la da un barrido de código ([[gate-jsdom-no-ve-gestos-tactiles]]).

## El control que probó lo de Presupuestos

No se tomó al sub-agente por su palabra. Control diferencial, kinds `*_propuesto`:

```
backend EMITE:   gasto_propuesto · ingreso_propuesto · cliente_propuesto      (3)
app ESPERA:      gasto_propuesto · ingreso_propuesto · cliente_propuesto ·
                 presupuesto_propuesto                                        (4)
```

Falta **exactamente uno**, y es el que la app necesita para que
`presupuestoPropuesto.ts:70` no devuelva `null`. Es el hito P, medido desde los dos lados.

## Hallazgos laterales (no eran el objetivo, aparecieron solos)

**1. El backend tiene 80 endpoints, no 46.** El primer script de inventario escaneó sólo `web.py` y
`afip_web.py`; hay **9 módulos `*_web.py`**. La lista parcial no mostraba `/gastos`, `/presupuestos`,
`/clientes`, `/mi-dia`, `/inteligencia`, `/conceptos`, `/trabajos` ni `/perfil-negocio` — todos
existen. **El script no falló: devolvió una lista plausible.** Si se hubiera tomado por buena, los
tres agentes habrían escrito "le falta el backend" sobre cinco funciones que lo tienen, y eso entraba
al mapa como hallazgo verificado. Se corrigió el insumo y se avisó a los tres en vuelo.
[[instrumentos-que-confirman-en-vez-de-verificar]]

**2. Cuarto caso del patrón de documento vencido.** La doc de Inteligencia dice que el backend "no
está vivo"; está desplegado. Van cuatro documentos afirmando en presente cosas que dejaron de ser
ciertas — el mismo patrón que el domain-modeling del 24 encontró tres veces.

**3. La superficie de voz son 14 tools**, y cubren casi todo el escritorio:
`emitir_factura` · `registrar_gasto` · `registrar_ingreso` · `completar_ingreso` ·
`marcar_factura_cobrada` · `marcar_presupuesto` · `registrar_cliente` · `consultar_cliente` ·
`consultar_actividad` · `crear/mover/borrar_tarjeta_mi_dia` · `mp_charge` · **`calendar_book`**.
Ese último confirma que **Google Calendar ya tiene tool de escritura** — el candidato Calendar × Mi
Día no parte de cero, como decía el inventario del PLAN.

## Método

`scripts` de inventario primero (una pasada, output consumible) → 3 sub-agentes `haiku` en paralelo
con glob exclusivo por terna y output file declarado → corrección del insumo en vuelo vía mensaje a
los tres → contra-verificación de los veredictos accionables por el parent. Coste: ~272k tokens de
sub-agente, ~7 min de pared, contexto del parent casi intacto.
