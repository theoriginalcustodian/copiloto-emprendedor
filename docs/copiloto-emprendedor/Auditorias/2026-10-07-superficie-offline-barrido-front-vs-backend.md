# Auditoría `SUPERFICIEOFFLINE` — la forma que el front DECLARA vs. la que el backend DEVUELVE

**2026-10-07.** Medido contra `origin/main` = **`bff3d3bc`**. Instrumento:
[`instrumentos/barrido-superficie-front-backend.py`](instrumentos/barrido-superficie-front-backend.py)
— **autocontenido**: lee todo de `origin/main` vía `git show`, corre sin argumentos desde cualquier
worktree del repo y resuelve su propia raíz. No depende de ningún archivo intermedio ni de un árbol
materializado, así que **otra sesión reproduce estas cifras con un comando**.

```
python docs/copiloto-emprendedor/Auditorias/instrumentos/barrido-superficie-front-backend.py
```

---

## 0. La unidad cambió, y es lo primero que hay que leer

El DoD de la fila decía **«≥48 de 51»** contando **archivos**. Ese denominador no mide lo que la fila
quiere verificar: **un archivo del front llama muchas rutas**. `afip.ts` solo tiene 20 llamadas. Un
«48 de 51 archivos» puede dejar sin comparar la mitad de las llamadas y verse completo.

La unidad correcta es la **llamada `(verbo, ruta)`**, que es donde una divergencia existe o no existe.
Medido: **84 llamadas en 37 archivos del front** contra **108 rutas en 129 archivos del backend**.

> ⚠️ Dicho sin adornos: **el 51 nunca fue el denominador de esta pregunta.** Reportar «48 de 51»
> habría sido un número cumplido sobre una población que no es la que importa
> ([[una-fila-por-valor-de-una-variable-no-es-una-fila]]).

## 1. Resultado

| veredicto | n | qué significa |
|---|---|---|
| **OK** | **59** | el front no espera ninguna clave que el handler no mande |
| **DIFIERE** | 1 | → **falso, explicado en §3**. Divergencias reales: **0** |
| **SIN_HANDLER** | 3 | 🔴 **hallazgo, §2** |
| HANDLER_OPACO | 12 | el backend devuelve por indirección que el extractor no sigue ⇒ **no medido** |
| SIN_FORMA | 9 | `<unknown>`: 3 descartan la respuesta, 6 delegan a un normalizador |

**Con veredicto: 63 de 84 (75%)** — 59 OK + 1 DIFIERE resuelto + 3 hallazgo.
**Fuera de población con fundamento: 3** (el front descarta la respuesta: nada que comparar).
**Sin medir: 18**, con la causa nombrada por clase, no como resto.

🐤 **Control positivo embebido, tres casos de veredicto conocido** (si no reproducen, la corrida no
vale): `/feedback` → `['items']` y `/afip/facturas` → `['factura_id','ok']` (claves literales), y
**`/mi-dia/tablero` → `['solapas']`, que sólo es legible si la indirección funciona** (el handler hace
`return _solapas(...)`, no un dict).

## 2. 🔴 Hallazgo: tres funciones del **barrel público** del core llaman rutas que este backend no tiene

| función | exportada en | ruta que llama | handler en este backend |
|---|---|---|---|
| `listarEntradasCorregibles` | `api/index.ts:79` | `GET /clientes/{id}/entradas` | **no existe** |
| `previewEnmienda` | `api/index.ts:79` | `POST /enmienda/preview` | **no existe** |
| `obtenerFormatosNota` | `api/index.ts:75` | `GET /nota/formatos` | **no existe** |

Medido: **0 usos en `apps/copiloto-web/src` y `apps/mobile/src`**, con control positivo que discrimina
en la misma corrida (`listarIngresos` = 13, `estadoAfip` = 45 ⇒ el grep no es ciego). Las rutas no
están entre las 108 del backend.

**Por qué no es cosmético:**

1. **Están en la API pública.** El autocompletado se las ofrece a cualquiera que escriba una pantalla
   del copiloto, y el tipo de retorno (`Promise<FormatosNota>`) **promete que funcionan**. Quien las
   use se come un **404 en runtime** y nada lo avisa antes.
2. **Una tiene test verde que mockea el backend** (`formatos.test.ts:42`). Ese test pasa para siempre
   sin que la ruta exista: acredita una función cuyo endpoint no está en el único backend que el core
   llama acá ([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]).
3. El riesgo inverso: si el copiloto algún día define `/nota/formatos` para otra cosa, estas
   funciones apuntan a la ruta equivocada **en silencio**.

**El dominio es claramente clínico** (enmienda de notas, formatos de nota), y `packages/core` es
compartido — así que lo más probable es que sean de **documed**. ⚠️ **No lo verifiqué**: documed es
otro repo y no lo medí. Lo declaro como la hipótesis, no como hecho, porque la decisión cambia según
cuál sea: si son de documed, el arreglo es **sacarlas del barrel que consume el copiloto**; si no, es
**implementar las rutas**. Esa elección no es de auditoría.

**Fila propuesta — `BARRELAJENO`** (severidad baja-media: nadie las usa hoy; el daño es que están
ofrecidas con tipo que promete):
> 🔬 **INSTRUMENTO:** correr el barrido y leer la sección `SIN_HANDLER`. **Esperado medido en
> `bff3d3bc`: 3** (`/clientes/{}/entradas`, `/enmienda/preview`, `/nota/formatos`). **DoD binario:**
> baja a **0** — o porque salen del barrel, o porque el backend las implementa. **Quién: cualquiera,
> 100% LOCAL.** **Primero hay que contestar de quién son** (¿documed?), y eso lo contesta quien
> conozca el consumidor, no el barrido.

## 3. Los falsos que encontré, y cada uno con la causa — cinco eran míos

Ninguno de estos llegó a circular como hallazgo. Los dejo porque la causa se repite.

| falso | causa |
|---|---|
| 5 `DIFIERE` con «handler manda=[]» | el extractor sólo veía `return {`; un `return _solapas(...)` daba `[]`, y **`[]` lo comparé como "el handler no manda nada"**. Vacío parseado como ausencia. Arreglo: vacío ⇒ clase propia `HANDLER_OPACO` que **nunca acusa al front**, + seguir un nivel de indirección |
| 1 `DIFIERE` con 18 claves ajenas | la indirección cortaba el cuerpo del `def` por `^\S`, y **los handlers viven dentro de factories** ⇒ el corte nunca disparaba y juntaba las claves de todos los handlers del archivo. Arreglo: cortar por **indentación** |
| 4 `SIN_HANDLER` llamados `filas`/`trabajos` | el regex del argumento buscaba una comilla **hasta 400 chars adelante** y agarró `if ('filas' in raw)` cuatro líneas después. Arreglo: **anclar** el argumento al `(` que sigue al genérico, y resolver la ruta pasada por variable |
| 2 `SIN_HANDLER` `/ingresos{}` | `` `/ingresos${qs}` `` normalizaba el query a `{}` y pegaba una ruta que ningún handler matchea. Arreglo: un `{}` sin `/` delante es sufijo de query |
| 1 `DIFIERE` en `/afip/estado` | la clave `opcionales` salía de un **comentario dentro del genérico** (`// …se leen igual, opcionales: cuando los suba…`). Arreglo: quitar comentarios — **y el orden importa en los dos sentidos**: limpiarlos *después* de colapsar los saltos borra el genérico entero ([[el-guard-se-satisface-con-su-propio-comentario]]) |
| el `DIFIERE` final | `/inteligencia/graficos/facturacion`: el handler **sí** manda `periodo` (`inteligencia_web.py:66,79,97`) en su forma *agregada*; el front distingue las dos formas a propósito y lo dice en su comentario. **El falso era mío, el código estaba bien** |

Y dos de método, fuera de la tabla:

- **Inventé tres nombres de función** (`listarFormatosDeNota`…) y el grep dio `0` en los tres. Ese `0`
  significaba *«ese símbolo no existe»*, no *«nadie lo usa»* — y se lee idéntico. Lo cazó el **control
  positivo**, que también dio 0 cuando no debía ([[el-instrumento-fabrica-una-referencia-que-no-existe]]).
- **Un `replace` que no matchea no falla.** Parcheé el script dos veces con un `str.replace` y
  reporté «ok» sin verificar: el bloque nunca se insertó. La tercera vez lo puse con `assert` y
  **falló ruidosamente**, que es lo que tenía que hacer desde el principio.

## 4. Lo que queda sin medir, nombrado por clase (no como resto)

- **12 `HANDLER_OPACO`** — el handler devuelve por **dos o más** niveles de indirección (`store`,
  servicio). Entre ellos `/auth/login`, `/auth/signup`, `/capacidades`, `/gastos/resumen`,
  `/ingresos/resumen`. Cerrarlos pide seguir la cadena hasta el store; es la dirección con más
  llamadas por unidad de trabajo que queda.
- **6 `SIN_FORMA` que delegan** — `guardar(apiClient.post…)`, `ingresoDeLaRespuesta(await …)`: la
  forma la conoce el normalizador, no el tipo. Medibles siguiendo el helper.
- **3 `SIN_FORMA` que descartan** — `ingresos.ts:293`, `miDia.ts:206`, `onboarding.ts:28`: el front
  **no lee nada** de la respuesta. **No es un hueco: no hay nada que comparar**, y por eso salen de la
  población con fundamento en vez de quedar como pendiente eterno.

🤖 auditoría · Opus 5 (1M context)
