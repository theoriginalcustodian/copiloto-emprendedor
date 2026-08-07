# M-WEB — Plan completo de implementación, 7 módulos restantes (post-`clientes`)

**De:** Planificación · **Fecha:** 2026-08-04. Corrección del operador: no secuencial uno-a-uno —
todo el trabajo restante se baja de una vez para que frontend/backend/manejo-de-errores puedan
trabajar en paralelo y de forma autónoma, aplicando `/ejecutar-con-eficiencia`.

## 0. Verificación previa (script-first, un solo barrido — sin esto el plan sería esperanza)

Grepeado `apps/copiloto/*.py` + `apps/copiloto/web.py` (routers montados) + `packages/core/src/api/`
+ `apps/mobile/src/modules/<m>/` para cada uno de los 7 módulos. Resultado: **backend ya cubre los
7 sin gaps** — no hay endpoint faltante que descubrir spike a spike.

| Módulo | Backend (store + router) | Montado en `web.py` | Referencia mobile |
|---|---|---|---|
| `clientes` (en curso) | `cliente_store.py` + `clientes_web.py` | `clientes_app` :844 | `apps/mobile/src/modules/clientes/` |
| `ingresos` | `cobro_store.py` + rutas `/ingresos` en `afip_web.py:374-407` | `afip_app` :835 | `apps/mobile/src/modules/ingresos/` |
| `presupuestos` | `presupuesto_store.py` + `presupuestos_web.py` | `presupuestos_app` :840 | `apps/mobile/src/modules/presupuestos/` |
| `facturación` (AFIP) | `afip_web.py` (comprobantes/cobros, extenso) | `afip_app` :835 | `apps/mobile/src/modules/facturacion/` + `afip/` |
| `actividad` | `actividad_store.py` + `actividad_web.py` | `actividad_app` :854 | `apps/mobile/src/modules/actividad/` |
| `contabilidad` | **sin backend propio** — agregación client-side vía `obtenerResumenContabilidad` de `@copiloto/core` sobre datos ya traídos (gastos+ingresos) | n/a | `apps/mobile/src/modules/contabilidad/` |
| `inteligencia` | `inteligencia_queries.py` + `inteligencia_web.py` | `inteligencia_app` :858 | `apps/mobile/src/modules/inteligencia/` |

Si algún módulo revela un gap real al implementarlo (campo faltante, comportamiento distinto), es
la EXCEPCIÓN — se baja `contrato_` aparte en ese momento, no bloquea a los demás.

## 1. DoD por módulo (igual para los 7 — ya establecido, no se repite por módulo)

Ver `2026-08-04-DoD-sprint-web-mweb.md` §4: paridad funcional real · mismo backend sin endpoint
nuevo salvo gap documentado · RLS/multitenant intacto · responsive · E2E Playwright contra sitio
real desplegado · CI 5/5 + deploy verificado · cero regresión.

## 2. Cómo paralelizar (no es un mandato de UNA sola secuencia)

Cada módulo vive en su propio directorio (`apps/copiloto-web/src/modules/<m>/`) — **cero
colisión de archivos entre módulos**, así que no hay razón estructural para portarlos uno por uno
esperando mi dispatch. Frontend puede:

- Trabajar los 7 en el orden que le resulte más eficiente (no hay dependencia entre ellos salvo el
  adapter de plataforma, ya resuelto en el módulo 1).
- Aplicar `/ejecutar-con-eficiencia` — wave-based con sub-agentes propios si eso acelera, glob
  exclusivo por módulo (`src/modules/<m>/**`) como file-ownership matrix natural.
- PRs chicos por módulo (no uno gigante) — igual se pueden abrir/mergear en paralelo si el CI de
  cada uno es independiente; sólo hay que resolver conflictos de rebase entre PRs simultáneos del
  mismo repo (normal, no bloqueante).

## 3. Backend — verificación paralela (no bloquea a frontend)

Con 0 gaps detectados en este barrido, el trabajo de backend no es "esperar a que frontend
descubra algo" — es **confirmar RLS/multitenant** en los stores de los 7 módulos (criterio DoD §4.3)
mientras frontend implementa. Ver pedido aparte.

## 4. Manejo-de-errores — contrato de error-handling para M-WEB (no bloquea a frontend)

Definir/verificar cómo cada módulo nuevo debe reportar errores en `copiloto-web` (mismo patrón que
mobile: feedback dashboard, structured logging) — para que frontend no tenga que inventarlo módulo
a módulo. Ver pedido aparte.
