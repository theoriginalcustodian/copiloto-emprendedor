# DoD — Sprint M-WEB (paridad funcional de `copiloto-web`)

> **Autor:** Planificación · **Fecha:** 2026-08-04. Redactado mientras frontend termina BETA-4b
> (merge+deploy+build de Google auth mobile) — arranca apenas frontend confirme, no antes.
> Origina en `docs/copiloto-emprendedor/2026-08-03-plan-produccion-post-beta-cobro-y-p2.md` §6
> (decisión del operador 2026-08-03) y en `contrato_planificacion-a-frontend_MWEB-spike-gastos...md`
> (spike ya encolado).

## 0. Objetivo

`copiloto-web` deja de ser "chat + conexiones" y gana los módulos de gestión del negocio que hoy
solo existen en mobile — el emprendedor puede laburar desde el escritorio, no solo desde el
bolsillo, sin volver a mobile para nada del día a día.

## 1. Alcance — verificado, no proyectado

**Confirmado por grep 2026-08-03** (`apps/mobile/src/modules/` vs `apps/copiloto-web/src/modules/`):
web tiene 4 módulos (`account`, `apps`, `chat`, `connections`); mobile tiene 17. El propio doc de
producción nombra **8 módulos de negocio ausentes** en web: `gastos`, `clientes`, `ingresos`,
`presupuestos`, `facturacion` (AFIP), `actividad` (feed), `contabilidad`, `inteligencia` (BI).

**Los 5 módulos mobile restantes** (`afip`, `ajustes`, `auth`, `captura`, `escritorio`, `midia`,
`recientes` — son 7, no 5, contando bien) **no están confirmados como candidatos 1:1** — varios son
plataforma/shell (`auth`, `escritorio`) o mobile-específicos (`captura` de voz, `midia`). **No
asumir que hay que portarlos** — el spike de `gastos` y la priorización por feedback (§3) deciden
el alcance real, no esta lista. `[ASSUMED_PENDING_VERIFY]`: cuál de estos 7 aplica a web, si alguno.

## 2. Precondición — Fase 0: spike de `gastos` (ya encolado)

No se arranca ningún módulo más sin el resultado de este spike. Mide: cuánto del patrón mobile
(`FormularioGasto.tsx`, cards de chat) traduce directo a React web vs necesita rediseño, y si hay
gaps de backend (no se asumen, se descubren). Backend ya verificado sin trabajo pendiente (CORS +
endpoints compartidos, `apps/copiloto/web.py`) — cualquier gap real se baja como `contrato_` aparte.

## 3. Orden de los 8 módulos restantes (post-spike)

**No se define ahora un orden fijo.** Se prioriza por lo que los testers de la beta más pidan desde
escritorio — dato que se junta en vivo vía el feedback in-app ya cableado (BETA-1a,
`POST /feedback`). Portar los 8 a ciegas sin ese dato es exactamente lo que el doc de producción
pide evitar (§6, punto 2).

## 4. DoD por módulo (criterio binario, se aplica a cada uno de los 8 al portarlo)

Un módulo de negocio en `copiloto-web` está **DONE** cuando, y solo cuando:

1. **Paridad funcional real** — el emprendedor completa en web el mismo flujo de punta a punta que
   hoy completa en mobile para ese módulo (crear/editar/listar según aplique), sin feature faltante
   respecto al equivalente mobile salvo diferencia explícitamente documentada como decisión de
   producto (no como recorte silencioso).
2. **Mismo backend, cero endpoint nuevo salvo gap documentado** — si el spike o la implementación
   revelan que hace falta un endpoint/campo nuevo, eso es un `contrato_` a backend aparte, con su
   propio DoD — no se cierra el módulo web sin que ese contrato también cierre.
3. **RLS/multitenant intacto** — mismo aislamiento cross-tenant que mobile; si el módulo toca datos
   sensibles (facturación AFIP, contabilidad), el test adversarial cross-tenant existente en backend
   ya cubre el dato — no se duplica, se verifica que sigue pasando.
4. **Responsive** — usable en el `ResponsiveShell.tsx` existente sin romper el layout mobile-width
   del shell actual (chat/connections no se degradan).
5. **E2E con Playwright, contra el sitio real desplegado** (no local, no mock) — ver §5. Evidencia
   adjunta al `cierre_` del módulo: screenshot o log del flujo completo pasando.
6. **CI 5/5 verde** (`core`/`lint`/`mobile`/`web`/`backend`) y **deploy verificado en prod** —
   mismo estándar que todo PR de este repo, sin excepción por ser "solo frontend".
7. **0 regresión** en la suite completa (backend + web) — no solo en los tests nuevos del módulo.

## 5. DoD del sprint completo (binario)

El Sprint M-WEB está **DONE** cuando:

1. Los módulos priorizados en §3 (mínimo el resultado que el spike + feedback definan como "los que
   el emprendedor realmente pide desde escritorio") cumplen el DoD por módulo (§4) cada uno.
2. **Ninguno de los 8 módulos de negocio queda permanentemente ausente sin decisión explícita del
   operador** — si algo queda afuera de esta ronda, se anota como diferido con dueño y condición de
   retomar (misma disciplina que M1/P2), no se pierde en silencio.
3. **E2E completo web, mismo rigor que mobile para beta**: un tester puede loguearse (email/password
   o Google, ambos ya en web), navegar a cada módulo portado, completar su flujo principal, y volver
   al chat — sin errores, con Playwright verificándolo contra el sitio real.
4. `PLAN.md` refleja el estado final con evidencia (no autoevaluación) por módulo.

## 6. Metodología de ejecución

- **`/ejecutar-con-eficiencia`** aplica a este sprint — multi-módulo, candidato claro a
  paralelización por wave una vez el spike de `gastos` fije el patrón a repetir en los demás.
- **PRs chicos y graduales, merge frecuente** — un módulo (o sub-parte de uno) por PR, no un PR
  gigante al final. Evita acumular trabajo sin mergear y reduce el blast radius de cada cambio.
- **Merges y builds en background** — el sync evento→grafo a veces tarda; no bloquear el frente
  esperando en foreground. Despachar y seguir con el siguiente módulo mientras el anterior termina
  de sincronizar.
- **Script-first** donde aplique (ej. si portar cada módulo repite el mismo boilerplate de
  formulario/lista, un generador o plantilla común amortiza el costo en el 2º módulo, no en el 8º).

## 7. Testing E2E — Playwright, mismo estándar que device para mobile

Web no tiene "device físico" — Playwright contra el sitio real desplegado es el equivalente
funcional (mismo principio que `una-orden-cerrada-exige-evidencia-de-device.md`: sin evidencia no
está listo, la autoevaluación no cuenta). Cada módulo cierra con:

- Navegación real (`browser_navigate`) al dominio en vivo, no local.
- Flujo principal ejercitado de punta a punta (no solo que la pantalla carga).
- Snapshot/screenshot como evidencia adjunta al `cierre_`.

Frontend ya tiene precedente de este patrón en este mismo sprint (BETA-4b, control del botón Google
vía Playwright) — reusar ese enfoque, no inventar uno nuevo.

## 8. Riesgos conocidos (de §6 del doc de producción + verificado hoy)

| Riesgo | Mitigación |
|---|---|
| Patrón mobile no traduce directo a React web | Spike de `gastos` mide esto ANTES de comprometer los 7 restantes |
| Gap de backend no detectado hasta implementar | Cada módulo puede abrir su propio `contrato_` a backend — no bloquea a los demás |
| Alcance de los 5 módulos no confirmados se infla sin evidencia | §1 lo deja explícito: NO se asume, se decide con el spike + feedback |
| PRs grandes acumulan trabajo sin mergear | §6: PRs chicos, merge gradual, background |

## 9. Cuándo arranca

Encolado detrás de BETA-4b. Arranca cuando frontend confirme merge+deploy+build de Google auth
mobile (`cierre_` en el buzón) — planificación baja el `contrato_` de arranque completo apenas
llegue esa señal.
