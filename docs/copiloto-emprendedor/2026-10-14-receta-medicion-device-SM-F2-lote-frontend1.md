# Receta · medir en device el lote de `SM-F2` de frontend1 (10 ids de chat / voz / HITL / facturación / presupuestos)

> **Para quién:** quien tenga el device (dueño ÚNICO; hoy frontend1). **Escrita por frontend1 con el
> código de `origin/main` a la vista, sin haber tocado el teléfono para armarla.** Continúa a
> [`2026-10-14-receta-medicion-device-SM-F3.md`](2026-10-14-receta-medicion-device-SM-F3.md): **mismas
> precondiciones (§0), mismo helper, mismo vocabulario de veredictos**. Acá sólo van los 10 ids que esa
> receta no cubre. Los 4 restantes del lote (`onb-cumplida` · `pres-voz` · `vozchat` · y `preg`, ya
> medido por frontend2) están en la de SM-F3.
>
> **Estado:** sin ejercitar en device al escribirla. Una receta no ejercitada es una promesa: el primer
> paso real (§0 de SM-F3) es el control que la acredita o la invalida.

## Los 10 ids y de qué dependen

| id | superficie nativa | qué exige el teléfono | `NO_MEDIBLE` si… |
|---|---|---|---|
| `chat` | `chat/ChatView.tsx` + `ListaMensajes.tsx` | estado vacío del hilo | el hilo del canónico ya tiene mensajes |
| `grabando` | `chat/BotonVoz.tsx` + `voz/MicFuncion.tsx` | mantener el mic (no hace falta voz) | el permiso de micrófono está denegado |
| `hablar` | `ajustes/negocio/PantallaTono.tsx` | sólo navegación | — |
| `presu` | `presupuestos/PantallaPresupuestos.tsx` | ≥1 presupuesto | no hay ninguno: crear uno por el chat (ver `pres-hitl`) |
| `pres-hitl` | `chat/TarjetaPresupuestoPropuesto.tsx` | respuesta del agente | el backend no devuelve la card |
| `pres-ciclo` | ídem `-guardado` + `ChipArmarFactura` | guardar la propuesta | — |
| `recibo` | `chat/Recibo.tsx` | un recibo a la vista (sale de `pres-ciclo`) | — |
| `fact-hitl` | `chat/TarjetaFacturaPropuesta.tsx` | respuesta del agente | el backend no devuelve la card |
| `card-factura` | ídem | ídem | ídem |
| `fact-cae` | `facturacion/comprobante.tsx` | **un comprobante YA emitido** | no hay ninguno (ver abajo) |
| `factura` | `facturacion/PantallaFacturacion.tsx` | sólo navegación | — |

## 🔴 Reglas de seguridad de esta tanda (no negociables)

1. **NUNCA tocar «Emitir la factura».** Emitir es irreversible ante ARCA. `fact-hitl` y `card-factura` se
   miden **hasta la card**: encabezado, filas, rótulo del botón, nota. El botón se *lee*, no se toca.
2. **`fact-cae` no se fabrica emitiendo.** Si el canónico no tiene un comprobante emitido →
   `NO_MEDIBLE` con el motivo escrito. Jamás emitir «para poder medir».
3. **Guardar un presupuesto sí es reversible** (no manda nada: «a tu cliente no le llega nada»), pero deja
   una fila en la cuenta canónica. Anotar su N° en el `avance_`; no hay «Borrar».
4. Helper: `D="python -I -X utf8 scripts/evidencia/device_medir.py"`. Sólo `input motionevent`.
   `medido_contra` = sha de `curl -s https://copilotoemprendedor.duckdns.org/healthz` **medido al arrancar**.

---

## `chat` — estado vacío del hilo

**Prototipo:** `index.html:1871`. **Nativo:** `chat/ChatView.tsx:91` + `chat/ListaMensajes.tsx:433`.
Divergencias del mapeo: grip «Baja para volver a Mi día» vs «Desliza para ver tu día» · isotipo 96 px
(proto) vs `Marca size={64}` · copy y rodillo (`EJEMPLOS_CHAT`, placeholder) **iguales**.

| # | Acción | Esperado |
|---|---|---|
| 1 | Abrir el chat. Si ya hay mensajes, `NO_MEDIBLE` (el estado vacío no se ve) | — |
| 2 | `$D ver --filtro "Desliza"` y `$D ver --filtro "Baja"` **[ver]** | el literal del grip |
| 3 | `$D ver --filtro "Escrib"` **[ver]** | placeholder del composer |
| 4 | `$D foto chat-1.png` | isotipo y tres frases del rodillo |

Veredicto: `DESVÍO` por el grip si el literal es «Desliza…» (es el del mapeo); `COHERENTE` sólo si coincide.

## `grabando` — la barra mientras se graba

**Prototipo:** `index.html:2924-3060`. **Nativo:** `chat/BotonVoz.tsx:95` (+ `voz/MicFuncion.tsx`).
El prototipo **transforma la barra del composer** (punto rec + reloj + «desliza para cancelar» + candado);
el nativo es un **overlay flotante** con onda + ecualizador. Para medir **no hace falta que transcriba**:
alcanza con mantener el botón.

| # | Acción | Esperado |
|---|---|---|
| 1 | `$D mantener boton-voz 3000` y, **antes de soltar**, `$D ver` **[ver]** (correr `ver` en paralelo, p. ej. `mantener` 6000 + `ver` a los 2 s) | `overlay-voz`, `voz-reloj`, `voz-pistas`, `voz-cancelar-aviso`, `voz-pista-candado` |
| 2 | `$D foto grabando-1.png` durante la grabación | overlay con onda |
| 3 | `$D arrastrar boton-voz 0 -220 10` | grabación **fija**: `voz-pausar`, `voz-enviar`, `voz-eliminar`, `voz-barra-sostenida` |
| 4 | `$D foto grabando-2.png` y luego `$D tocar voz-eliminar` | vuelve al composer; **nada enviado** |

Si el permiso de micrófono está denegado → `NO_MEDIBLE` con el motivo (no `DESVÍO`).

## `hablar` — Tono («cómo te hablo»)

**Prototipo:** `index.html:2413-2434`. **Nativo:** `ajustes/negocio/PantallaTono.tsx:47-207`.
Mapeo: el proto es lista de radios con descripción y «Cercano» primero; el nativo usa chips de
`CampoSelect`, orden Formal → Cercano, sin `descripcion`.

| # | Acción | Esperado |
|---|---|---|
| 1 | Ajustes → Mi negocio → Tono (`$D hay pantalla-tono`) | pantalla abierta |
| 2 | `$D ver --filtro "ormal"` y `$D ver --filtro "ercano"` **[ver]** | orden de las opciones; ¿hay descripción? |
| 3 | `$D ver --filtro "habl"` **[ver]** | etiqueta del campo del nombre (`tono-nombre`) |
| 4 | `$D hay tono-ejemplo` + `$D foto hablar-1.png` | caja de ejemplo |

**No tocar `tono-guardar`**: cambia el tono real del asistente de la cuenta canónica.

## `presu` — lista de presupuestos

**Prototipo:** `index.html:2068-2102`. **Nativo:** `presupuestos/PantallaPresupuestos.tsx:169-317` +
`TarjetaPresupuesto.tsx`. Ya resuelto en código: resumen «Esperando respuesta …» (`presupuestos-resumen`)
y estado por fila (`<id>-estado`). Queda en enmienda «Enviado · 5 días» (sin dato).

| # | Acción | Esperado |
|---|---|---|
| 1 | Abrir Presupuestos (`$D hay pantalla-presupuestos`) | lista o `presupuestos-vacio` |
| 2 | `$D hay presupuestos-resumen` y `$D ver --filtro "Esperando"` **[ver]** | «Esperando respuesta $… · N sin contestar · N aceptado» |
| 3 | `$D ver --filtro "estado"` / texto de la primera fila **[ver]** | «Aceptado» / «Esperando respuesta» / «Sin respuesta hace más de un mes» |
| 4 | `$D foto presu-1.png` | — |

Con 0 presupuestos: `presupuestos-vacio` visible y **el resumen no se pinta** (control negativo
deliberado, no un defecto). Hacer `pres-hitl` primero para tener ≥1.

## `pres-hitl` · `pres-ciclo` · `recibo` — un solo recorrido por el chat

**Prototipo:** `index.html:3356-3374` (hitl, ciclo) y `:3233-3237` (recibo). **Nativo:**
`chat/TarjetaPresupuestoPropuesto.tsx:50-121`, `chat/ChipArmarFactura.tsx:20`, `chat/Recibo.tsx:26`.
**Escribir** el pedido (no dictar: el audio no está disponible en el teléfono, ver SM-F3).

| # | Acción | Esperado |
|---|---|---|
| 1 | `$D tocar chat-composer`, escribir `presupuesto para Panaderia La Esquina, pintura de local, 80000` (`adb shell input text`, espacios `%s`), `$D tocar chat-enviar` | card propuesta en ≤ 30 s |
| 2 | `$D hay` la card `…-formulario` + `$D ver --filtro "no le llega"` **[ver]** | **`pres-hitl`**: formulario editable + nota «a tu cliente no le llega nada…» |
| 3 | `$D foto pres-hitl-1.png` | — |
| 4 | Guardar la propuesta (botón de guardar del formulario) | **`pres-ciclo`**: `…-guardado` |
| 5 | `$D ver --filtro "Presupuesto anotado"` **[ver]**, `$D ver --filtro "Doc"` **[ver]**, `$D hay` `…-guardado-mandar-por-mail` | recibo con N° · total · receptor · «Doc listo para mandar» + chip «Mandalo por mail» (sólo si el backend manda `sugerencias.mandarPorMail`) |
| 6 | `$D hay` `…-boton` del `ChipArmarFactura` | chip «Armá la factura» |
| 7 | **`recibo`:** `$D hay` `…-icono` y `…-detalle-0` del recibo del paso 5; `$D foto recibo-1.png` | check (SVG) + líneas de datos + enlace |
| 8 | **No tocar** «Mandalo por mail» (abre `mailto:`) ni «Armá la factura» | — |

Veredictos: `pres-hitl` — el formulario completo editable es **decisión del operador (2026-07-24)** y la
fila queda `COHERENTE` sólo si la nota está; `pres-ciclo` — `COHERENTE` si 5 y 6 se ven; la rehidratación
tras recargar (recibo con sólo título + N°) es enmienda escrita, **no** hace falta medirla.
`recibo` — «34 clientes · Gmail · 14:41» y «Promo mandada» son del flujo de mailing masivo, que no
existe: **`FUERA-DE-REFERENCIA`** para esa parte, `COHERENTE` para el recibo de presupuesto.

## `fact-hitl` · `card-factura` — la card de factura, SIN emitir

**Prototipo:** `index.html:3328` (hitl) y `:2876` (card). **Nativo:** `chat/TarjetaFacturaPropuesta.tsx:74`.

| # | Acción | Esperado |
|---|---|---|
| 1 | Chat: escribir `facturale a Panaderia La Esquina por pintura de local 80000` y enviar | card de factura propuesta, o texto si el backend pide más datos |
| 2 | `$D ver --filtro "Factura"` **[ver]** | encabezado `…-tipo` «Factura C · ARCA» (viene del dato, no escrito a mano) |
| 3 | `$D hay` `…-cliente`, `…-item-0`, `…-total`, `…-aviso-anulacion` | filas **no editables**, ítems y Total |
| 4 | `$D ver --filtro "Emitir"` **[ver]** | rótulo del botón: debe decir **«Emitir la factura»** (`…-emitir`) |
| 5 | `$D hay` `…-completar` | «Completar a mano» (navega al wizard) |
| 6 | `$D foto fact-hitl-1.png` | — |
| 7 | **PARAR.** No tocar `…-emitir`. | — |

Sin card (el agente pide un dato) → `NO_MEDIBLE`; no inventar el dato para forzarla si el backend no
tiene el cliente. Enmiendas ya escritas (no son defectos): sin «Cancelar», filas no editables y nota de
anulación con otra redacción — por diseño (emitir es un acto fiscal irreversible).

## `fact-cae` — el comprobante emitido

**Prototipo:** `index.html:3337`. **Nativo:** `facturacion/comprobante.tsx:50` (datos) y `:80`
(acciones; botón «Abrir PDF» / «Abrir en Drive»).

| # | Acción | Esperado |
|---|---|---|
| 1 | Facturación → Mis comprobantes: ¿hay alguno `emitida`? | si **no** → `NO_MEDIBLE`: «el canónico no tiene comprobante emitido; emitir uno es irreversible y no se hace para medir» |
| 2 | Abrir el detalle (`$D hay` `…-cae`) | «CAE:», «Vence el», Total |
| 3 | `$D ver --filtro "Abrir"` **[ver]** | «Abrir PDF» / «Abrir en Drive» (antes decía «Guardar» y no guardaba) |
| 4 | `$D foto fact-cae-1.png` | — |

«Mandala por mail» **no existe** a propósito (el estado no trae contacto). No es `DESVÍO` a corregir.

## `factura` — la pantalla de Facturación

**Prototipo:** `index.html:2028-2066`. **Nativo:** `facturacion/PantallaFacturacion.tsx` (`ResumenFacturado`
al tope).

| # | Acción | Esperado |
|---|---|---|
| 1 | Abrir Facturación (`$D hay pantalla-facturacion`) | pantalla |
| 2 | `$D ver --filtro "Facturado"` **[ver]** | «Facturado este mes» + cifra (sin dato: **no se pinta nada**, no «$0») |
| 3 | `$D hay facturacion-nueva-factura-fila` | pill «Nueva factura» (el wizard reemplaza al composer) |
| 4 | `$D ver --filtro "mic"` / `$D hay boton-voz` | **sin mic** (enmienda `mic-facturacion`: emitir es irreversible) |
| 5 | `$D foto factura-1.png` | — |

---

## Cómo se devuelve

Igual que SM-F3 §«Cómo se devuelve»: un `avance_` por lote con, por id, veredicto + `medido_contra:` +
foto + `[ver]` pegado **sin resumir**; correr `python -I -X utf8 scripts/evidencia/falta-en-mobile.py` y
pegar el delta; dejar el device como se encontró; declarar «device LIBRE» por `dato_`.

## Lo que esta receta NO sabe

- El texto exacto de lo que el agente responde y cuándo pide más datos: lo pone el backend vivo; por eso
  los pasos pegan el literal.
- Las coordenadas: el helper busca por `testID`/texto. Si un testID no aparece en `$D ver`, anotarlo como
  defecto de accesibilidad, no adivinar un `(x,y)`.
