# Addendum — patrón de error-handling para los módulos M-WEB

> Responde a `pedido_planificacion-a-manejo-de-errores_MWEB-contrato-error-handling-modulos-web.md`.
> Addendum a `2026-08-04-DoD-sprint-web-mweb.md` — no lo reemplaza, agrega el criterio de manejo de
> errores que el DoD por módulo (§4) da por sabido.

## 0. Resultado en una línea

**No hace falta diseñar nada nuevo.** El mecanismo de errores (transporte, tipado, captura y
autosanación) es transport-agnostic por construcción (ADR-010) y ya está probado en producción
sirviendo simultáneamente a mobile y al primer módulo portado a web (`gastos`, PR#237). El "patrón"
que cada módulo nuevo debe seguir es: **portar 1:1 el mismo manejo de estados que ya tiene su
pantalla mobile equivalente** — no inventar uno propio.

## 1. Por qué no hay nada mobile-específico que adaptar (verificado, no asumido)

Inventario real, no leído de un doc:

- **`packages/core/src/api/http.ts`** — el único puerto de red (`HttpPort`), **"cero DOM" por
  diseño**: no importa `fetch`/`Blob`/`FormData` — esos tipos viven en el adaptador de cada
  plataforma (`apps/copiloto-web/src/adapters/http.ts` en web, su equivalente RN en mobile). Nada acá
  asume mobile.
- **`packages/core/src/api/errors.ts`** — `ApiError`/`CodigoConflicto`/`esDiferido` discriminan por
  **estructura del body** (código, no texto), plataforma-neutral.
- **`packages/core/src/api/gastos.ts`** (y el resto de `api/*.ts`) — cada función mapea la respuesta a
  `ConDisponibilidad<T> = {status:'ok', ...} | {status:'no_disponible'}` (`afip.ts:348`), capturando
  tanto errores de red (`noDesplegado`) como shapes de respuesta inesperados
  (`esRespuestaDelEndpoint`). Puro TypeScript, sin una sola referencia a plataforma.
- **Backend — C2 (`handler_errores_web.py`) y C3 (`interceptor_errores.py`)** — se instalan **una
  sola vez** a nivel de la app FastAPI / worker Temporal (`registrar_captura_global(app)`), cubriendo
  las 80 rutas por igual. El handler **no sabe ni le importa** si el caller es mobile, web o `curl` —
  no hay branching por user-agent, headers de plataforma, ni nada equivalente. El fingerprint que
  arma (`log_error(...)`) y el trauma que deposita (`depositar(...)`) son los mismos para cualquier
  origen.
- **Verificado en código real, no en teoría:** el módulo `gastos`, ya portado a web
  (`apps/copiloto-web/src/modules/gastos/GastosScreen.tsx`, PR#237, mergeado), copia **literalmente**
  el mismo `type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible'` y el mismo bloque de
  renderizado por estado que `apps/mobile/src/modules/gastos/PantallaGastos.tsx` — cero adaptación de
  manejo de errores fue necesaria para portarlo. Es la prueba empírica de que el patrón ya traduce
  1:1, no una expectativa.

**El único elemento "mobile" que aparece en el código de errores es el guard `vivo.current`**
(`useRef(true)` + `useEffect` de cleanup, ver `PantallaGastos.tsx:63-64`) — pero es React puro (evita
`setState` tras desmontar), aplica idéntico en React DOM, y de hecho ya está portado sin cambios en
`GastosScreen.tsx`. No es una costura de plataforma, es un patrón de React.

## 2. El patrón a seguir por cada módulo nuevo (los 6 restantes)

1. **Tipar el estado de carga** igual que el módulo mobile equivalente:
   `'cargando' | 'ok' | 'error' | 'no_disponible'` (agregar `'no_encontrado'` si el módulo tiene
   detalle por id, como `obtenerGasto`).
2. **Usar las funciones de `@copiloto/core`** (`api/<modulo>.ts`) tal cual — ya devuelven
   `ConDisponibilidad<T>`, no hay que envolver la respuesta HTTP a mano en el módulo web.
3. **Guard de desmontaje** (`vivo.current`) idéntico al de mobile — copiar, no reinventar.
4. **Mensajes al usuario**: los mismos textos/criterio que mobile usa para `'error'` y
   `'no_disponible'` — es contenido de producto, no de plataforma, y ya está resuelto.
5. **No se necesita ningún endpoint, header ni mecanismo de transporte nuevo** para que el
   clasificador de soporte (PR#232/#233) siga funcionando sobre errores que vengan de web — el C2
   captura por app, no por cliente, así que ya cubre cualquier request que `copiloto-web` haga contra
   `apps/copiloto/web.py`.

## 3. Hallazgo secundario (no bloquea M-WEB, preexistente en ambas plataformas)

El backend ya manda `fingerprint` (campo `codigo`) y `diferido` en el body de todo 500
(`handler_errores_web.py`), y el cliente ya los puede leer sin romper nada (`ApiError.body`,
`esDiferido()` en `errors.ts`) — pero **ningún módulo de mobile ni de web los lee ni los muestra hoy**
(`grep` sin resultados en `apps/mobile/src`, `apps/copiloto-web/src`). El usuario ve un mensaje
genérico de error, nunca el fingerprint para citarlo ni el aviso de "esto se está reintentando solo".
Es deuda **visible, no impaga**: no es nueva, no la introduce M-WEB, y no bloquea ningún módulo — pero
si en algún momento se prioriza mejorar el mensaje de error al usuario, el dato ya viaja hasta el
cliente, sólo falta pintarlo. Anotado para no perderlo, no para que M-WEB lo resuelva ahora.

## 4. Conclusión para frontend

Portar el manejo de errores de cada uno de los 6 módulos restantes es **copiar el bloque de estado de
su pantalla mobile equivalente**, igual que ya se hizo con `gastos`. No hay contrato nuevo que
cumplir, no hay gap de backend, y no hay nada que backend deba tocar para que el clasificador de
soporte siga funcionando sobre web.
