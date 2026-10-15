# Contratos del mapeo prototipo -> nativo — un renglon por fila

> **Generado** por `scripts/evidencia/armar-contratos.py` desde
> `2026-10-12-mapeo-prototipo-vs-nativo.md`. No se edita a mano: se regenera. Asi el conteo
> `filas que exigen trabajo == renglones emitidos` cuadra **por construccion**, y una fila
> sin renglon es imposible en vez de improbable.
>
> **Las 54 filas exigen trabajo**, de clases distintas y con dueno distinto. Las que dicen
> «ninguna medida» exigen **medicion**, no implementacion: *sin comparacion* no es
> *coincide*, y por eso tienen renglon igual.
>
> El detalle medido de cada fila (que dice el prototipo, que dice el codigo, con
> `path:linea`) vive en el mapeo y **no se repite aca** — se cita. Dos copias del mismo dato
> divergen, y gana la que circula.
>
>
> ✅ **Cero filas bloqueadas por decisiones ajenas.** Ninguna fila espera una respuesta del operador. Derivado de `V.BLOQUEADAS`, que esta vacia: no es una afirmacion escrita a mano.


## backend + nativa — 7 renglones

**Contrato primero**: endpoint, request, response y codigos ANTES de que ningun lado implemente. Si para avanzar hay que inventar la forma de un endpoint, eso es codificar la esperanza.

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `caida` | backend + frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | contrato primero: el texto de la tarjeta lo genera `mi_dia_detector.py:253` (regla `conexion_caida`), no la UI -- y el copy ya esta DECIDIDO (2026-10-13): gana «Reconectala y sigo»; «Te aviso apenas vuelva» promete un push que se mide en 0. El kv de hora entra como `datos.desde` opcional, y es PROHIBIDO rellenarlo con `creada_en` |
| `clientes` | backend + frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | contrato primero: el tipo de cable `Cliente` (`api/clientes.ts:31`) no trae monto vendido ni cantidad de comprobantes: la columna derecha del proto no se puede pintar con lo que hoy manda el backend |
| `cobro-voz` | backend + frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | contrato primero: RESUELTO 2026-10-13 -- los chips los deriva el CLIENTE de `artifact.kind == "payment_link"`: por `choices` no llegan nunca. Y «vence en 7 dias» queda PROHIBIDO: la preference se arma sin `expires`, asi que seria FALSO. Si el operador decide que venza, baja contrato con `artifact.data.expira_at` |
| `fact-voz` | backend + frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | contrato primero: el texto de la respuesta lo redacta el backend -- y el prototipo quedo SUBORDINADO al contrato del hito 9 (2026-10-13): no se pregunta el tipo de comprobante (lo resuelve `determinar_tipo_comprobante`) ni se preguntan dos campos juntos en el chat; los faltantes viven en la card HITL |
| `hitl` | backend + frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | contrato primero: el puente tarjeta->chat necesita que el backend mande la card de accion con sus kv y el recibo; hoy `gate.markdown` llega como texto plano |
| `onb-cumplida` | backend + frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | contrato primero: el insight sale de `textoDelInsight` (`core api/onboarding.ts:87`), no de la pantalla |
| `preg` | backend + frontend | La pantalla EXISTE y se llega a ella navegando; el id `preg` del prototipo tiene contraparte con `path:linea`. Escrita-e-inalcanzable NO cuenta. | contrato primero: no existe el componente ni la capacidad: la card de datos como respuesta no tiene parser en `packages/core/src/chat/*.ts`, y la promo masiva a clientes no existe (cero hits de `promo`) |

## nativa-con-device — 15 renglones

El telefono tiene **un solo dueno**. Nada de este grupo se declara listo con un test unitario ni con un verde de PWA. Para gestos RNGH: `adb input motionevent` DOWN/MOVE/UP — `input tap` no ejercita un Pan.

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `(home)` | frontend (device, dueno unico) | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | lo tactil no lo acredita un test unitario |
| `bi-refresh` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `bloqueado` | frontend (device, dueno unico) | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | lo tactil no lo acredita un test unitario |
| `chat` | frontend (device, dueno unico) | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | lo tactil no lo acredita un test unitario |
| `consent` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `detalle` | frontend (device, dueno unico) | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | lo tactil no lo acredita un test unitario |
| `entrada` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `esc` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `feedback` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `grabando` | frontend (device, dueno unico) | La capacidad tiene al menos UN consumidor real en `apps/mobile/src` fuera de su propio archivo y de sus tests, y se VE en la pantalla. Hoy esta escrita y nadie la usa. | lo tactil no lo acredita un test unitario |
| `ingresos` | frontend (device, dueno unico) | Comparada contra el prototipo: la fila dice COINCIDE o nombra la divergencia. Hoy no esta medida, y «sin comparacion» no es «coincide». | lo tactil no lo acredita un test unitario |
| `reveal` | frontend (device, dueno unico) | La capacidad tiene al menos UN consumidor real en `apps/mobile/src` fuera de su propio archivo y de sus tests, y se VE en la pantalla. Hoy esta escrita y nadie la usa. | lo tactil no lo acredita un test unitario |
| `soporte` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `splash` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |
| `tablero` | frontend (device, dueno unico) | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | lo tactil no lo acredita un test unitario |

## nativa-sin-device — 32 renglones

Acreditables con test en el VPS. No necesitan el telefono, asi que **no esperan** al dueno del device.

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `afip` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `agenda` | frontend | Comparada contra el prototipo: la fila dice COINCIDE o nombra la divergencia. Hoy no esta medida, y «sin comparacion» no es «coincide». | UI pura, verificable con test |
| `ajustes` | frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | UI pura, verificable con test |
| `apar` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `apps` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `bi` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `bi-vacio` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `card` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `card-cliente` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `card-cobro` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `card-factura` | frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | UI pura, verificable con test |
| `card-presu` | frontend | Comparada contra el prototipo: la fila dice COINCIDE o nombra la divergencia. Hoy no esta medida, y «sin comparacion» no es «coincide». | UI pura, verificable con test |
| `comousar` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `cuenta` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `fact-cae` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `fact-hitl` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `factura` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `gastos` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `hablar` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `ingresar` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `ingresar-error` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `negocio` | frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | UI pura, verificable con test |
| `onb-promesa` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `pres-ciclo` | frontend | El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:linea`, y se ve. No alcanza con que el componente este definido. | UI pura, verificable con test |
| `pres-hitl` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `pres-voz` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `presu` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `recibo` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `vacio` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `vacio-visto` | frontend | La capacidad tiene al menos UN consumidor real en `apps/mobile/src` fuera de su propio archivo y de sus tests, y se VE en la pantalla. Hoy esta escrita y nadie la usa. | UI pura, verificable con test |
| `volver` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |
| `vozchat` | frontend | Cada divergencia listada en la fila queda resuelta en el codigo, o declarada enmienda fundada con su motivo escrito. Ninguna queda sin veredicto. | UI pura, verificable con test |

## Como se usa esto

Cada renglon baja al buzon como su propio `contrato_` cuando se toma, citando **textual** la
fila del mapeo. El DoD de arriba es el binario de cierre.

**Lo que NO cuenta como terminado:** mi autoevaluacion · un verde de PWA para algo del grupo
device (el instrumento del criterio 3 corre `chromium.launch()` en viewport 390x844: mide la
PWA, no el telefono) · una fila que pase de `INDETERMINADO` a `COINCIDE` sin que nadie la
haya medido.

**Regenerar:** `python scripts/evidencia/armar-contratos.py`. Si el conteo no cuadra sale
exit 1 y nombra las filas: no escribe un doc que se lea como completo.

