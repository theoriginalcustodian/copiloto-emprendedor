# Presupuestos — Doc + card + botón facturar

> **Fecha:** 2026-07-21 · **Estado:** diseño cerrado, NO implementado.
> **Decisión del operador:** sí al alcance de abajo; NO a la máquina de estados.

---

## 1. La discusión que llevó acá (para no re-abrirla)

El primer planteo incluía un ciclo de vida del presupuesto (`enviado → aceptado → rechazado →
facturado`). **Se descartó**, y la razón es de producto, no técnica:

> *"la mayor parte de emprendedores no suelen mantener la información actualizada... me parece que
> estamos entrando en un terreno complejo de sostener para una función que luego no va a usar casi
> nadie"*

Es correcto. **Un estado que nadie actualiza no es un dato: es una mentira que envejece.** Cualquier
campo que exija que el usuario vuelva a decirle al sistema qué pasó nace muerto.

Lo que salvó a la feature fue separar **una** transición del resto: `presupuesto → factura`.
Es la única que (a) le importa de verdad al emprendedor —*"¿esto se convirtió en venta?"*— y (b)
**el sistema observa gratis**, porque la facturación ya es nuestra (AFIP, vivo). No requiere que
nadie actualice nada.

**Y "modificar un presupuesto" no necesita estado:** si cambia, se genera **otro** (versión que
reemplaza a la anterior). Append, no mutación. Es más simple *y* es como trabaja el emprendedor —
manda el corregido.

---

## 2. Fuente de verdad

Aplica la asignación ya acordada para "Sheets como base de datos":

| Dato | Fuente de verdad | Rol de lo demás |
|---|---|---|
| El presupuesto (lo genera el **sistema**) | **Postgres** | el Doc y la fila del Sheet son **proyecciones** |
| Catálogo de precios / clientes (lo mantiene el **usuario**) | **Sheets** | el sistema sólo lee |

Dirección **única**: DB → Doc/Sheet. Nunca al revés. Si el usuario rompe la planilla o borra el Doc,
se regenera; no se pierde nada.

**Es la misma doctrina que ya rige con Graphity** (`copiloto-trazabilidad-operaciones-fact-triple`:
*el grafo es PROYECCIÓN, la DB es SoT*). Sheets/Docs serían el tercer consumidor del mismo patrón,
no una excepción.

**Por qué Postgres y no sólo el Doc:** lo decide el **botón facturar**. Cuando se toca —dos días
después, desde otro teléfono, o por voz— tiene que reconstruir la factura con los datos exactos. Si
lo único guardado fuera un Doc, "facturar" tendría que **re-parsear un documento** para sacar los
ítems: frágil, y se rompe el día que cambia el formato. Un registro estructurado y consultable por
id es lo que hace confiable el tap.

---

## 3. Tablas

Esquema `uc_factory`, misma convención que `afip_comprobantes`. **Aditivas** vía
`apps/copiloto/afip_migrations.sql` (o un `presupuestos_migrations.sql` hermano): `provision_tables.py`
usa `CREATE TABLE IF NOT EXISTS` y su guard **aborta** si faltan columnas declaradas sobre una tabla
viva — una columna nueva se agrega con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, no allá.

### `uc_factory.presupuestos`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `cliente_id` | uuid | **tenant. Filtro explícito en CADA query** — el rol owner de `DATABASE_URL` bypassa RLS |
| `numero` | int | correlativo por tenant |
| `fecha` | timestamptz | |
| `concepto` | text | título corto ("Instalación eléctrica") — se guarda UNA vez, al crear |
| `receptor_nombre` | text | |
| `receptor_doc_tipo` / `receptor_doc_nro` | int / text | mismo shape que el receptor de la factura |
| `receptor_condicion_iva` | int | |
| `receptor_domicilio` | text | |
| `receptor_contacto` | text | mail/teléfono, para mandarlo |
| `total` | numeric | |
| `moneda` | text | |
| `doc_id` | text NULL | id del Google Doc — **NULL si no hay Drive/Docs conectado** |
| `doc_link` | text NULL | |
| `sheet_fila` | text NULL | puntero a la fila de trazabilidad |
| `reemplaza_a` | uuid NULL | versión anterior (append, no mutación) |
| `factura_id` | uuid NULL | **el único "estado", y es DERIVADO** |
| `created_at` | timestamptz | |

**No hay columna `estado`.** "Facturado" es `factura_id IS NOT NULL`. Cero campos que el usuario
tenga que mantener.

### `uc_factory.presupuesto_items`

`presupuesto_id` · `orden` · `descripcion` · `cantidad` · `precio_unitario` · `codigo`

**Los nombres son deliberados: son exactamente los que consume `agregar_item` del
`FacturaWorkflow`** (`{descripcion, cantidad, precio_unitario, codigo}`, verificado en
`afip_factura_workflow.py:135`). El botón facturar queda como transferencia directa, sin traducción
de campos que pueda driftear.

---

## 4. Endpoints

```
POST   /presupuestos                 -> crea (genera Doc + fila Sheet + registro)   {id, ...}
GET    /presupuestos                 -> listado para las cards
GET    /presupuestos/{id}            -> detalle para el glass
POST   /presupuestos/{id}/facturar   -> arma el borrador de factura y devuelve {factura_id}
```

`cliente_id` **siempre** de `Depends(require_tenant)`, nunca de un query param — regla 7. Y
**ningún id ajeno entra por el request**: `/{id}` se resuelve filtrando por el `cliente_id` del
token, y si no es de ese tenant → 404, no 403 (no confirmar la existencia de recursos ajenos).

**Test adversarial obligatorio** (regla dura del repo): tenant A pide `/presupuestos/{id de B}` →
404, y A no logra facturar lo de B. Sin ese caso hostil ejercitado el control queda `[UNVERIFIED]`.

⚠️ **Devolver `201`/el recurso, no `{"ok": true}`.** Ya hay deuda registrada por seis endpoints de
AFIP cuyo `ok: true` significa "recibí tu pedido", no "salió bien". No sumar el séptimo.

---

## 5. El botón facturar — mapeo concreto (no hay lógica de factura nueva)

El flujo de facturación existente es un **builder por signals**, ya vivo:

```
POST /afip/facturas                       -> crea el borrador   {factura_id}
POST /afip/facturas/{id}/cliente          -> receptor
POST /afip/facturas/{id}/items            -> un item por llamada
POST /afip/facturas/{id}/confirmar        -> emite (gate HITL con token)
```

`POST /presupuestos/{id}/facturar` hace las tres primeras con los datos del presupuesto y **devuelve
`factura_id`**. La app abre la pantalla de confirmación de factura ya cargada.

**El HITL no se saltea.** El botón NO emite: deja el borrador listo y el usuario confirma como
siempre. Emitir con CAE sin confirmación explícita sería inaceptable — es un acto fiscal.

`factura_id` se guarda en el presupuesto **cuando la emisión confirma**, no al armar el borrador: un
borrador cancelado no debe dejar el presupuesto marcado como facturado.

**Mapeo del receptor** (shape verificado en `afip_rules.receptor_desde_payload`):
`condicion_iva · tipo_doc · nro_doc · nombre · domicilio`. Ojo con la normalización de vacíos — un
`""` no lo cubre `payload.get(k, default)`, y eso ya costó una factura con CAE y sin PDF imprimible.

---

## 6. La card y el glass de detalle

**Resumen DERIVADO, no redactado.** Si guardáramos un resumen escrito por el LLM, envejece y se
despega del dato real (cambia el total, el resumen sigue diciendo lo viejo). La card lo compone de
los campos:

```
Juan Pérez · $45.000 · 21 jul
Instalación eléctrica · 3 ítems
```

**Glass de detalle** (más chico que la pantalla completa, como el de facturas): todos los campos +
ítems + dos acciones.

### Botón "Ver en Google Docs"

- **Texto explícito, no "Ver" a secas.** Te saca de la app al navegador, igual que Conectar en Apps;
  un "Ver" pelado hace esperar que abra adentro y la sorpresa se lee como bug.
- **Aparece SÓLO si hay `doc_id`.** Puede no haberlo: el usuario quizá nunca conectó Docs.
- **El link puede morir y hay que contemplarlo.** El Doc vive en **el Drive del usuario** — lo puede
  borrar, mover o renombrar, y el link queda apuntando a nada. Si al abrir ya no está, avisar; no
  dejar la pantalla muda. Es la misma familia que `drive_conectado`: no pintar un camino que lleva
  a un 404.
- **Y acá se paga lo de la §2:** si el Doc desaparece, **la card sigue sirviendo y facturar sigue
  funcionando**. El Doc es proyección. Perder el link es cosmético, no pierde el presupuesto.

---

## 7. Voz

El comando de voz dispara **la misma acción del motor** que escribe el mismo registro. Una sola
lógica backend, dos canales de entrada (tap y voz). No duplicar la generación en el camino de voz —
divergirían.

---

## 8. Lo que esto destraba de paso

**"Recientes" hoy no tiene operaciones estructuradas.** Es texto de chat crudo (episodios de
Graphity: `{valid_at, role, content}`, sin cliente de negocio ni tipo de operación), y `/actividad`
devuelve **501 a propósito** — inventar esos campos sería fabricar datos de negocio en una pantalla
de producción.

El presupuesto sería **la primera operación real y estructurada** que Recientes puede mostrar, y el
primer caso concreto del candidato `copiloto-trazabilidad-operaciones-fact-triple`.

---

## 9. ✅ El supuesto crítico — VALIDADO contra Docs real (2026-07-21)

`GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN(title, markdown_text)` está en la policy
(`services/docs.py:18`). Lo que faltaba era **qué devuelve** — el diseño guarda `doc_id`/`doc_link`, y
diseñar una tabla alrededor de un campo que quizá no llega es codificar la esperanza.

Spike corrido con el gateway REAL (misma policy y versión que producción), con luz verde del operador:

```
CONTROL: leer un document_id inventado -> NOT_FOUND (falló como debía)
CASO BUENO: successful: true
  data.documentId  = 1HsLZOpC7cdNpyOQXMkA3FYskYIJJ8W0IoEwCwdEVPzo
  data.display_url = https://docs.google.com/document/d/1HsLZOpC.../edit
```

**Los dos campos existen y no hay que armar el link a mano:**

| Campo | Origen | Ojo |
|---|---|---|
| `doc_id` | `data.documentId` | **camelCase**, dentro de `data` |
| `doc_link` | `data.display_url` | **NO** se llama `webViewLink` ni `url` |

Claves de `data`: `default_tab_id · display_url · documentId · request_data · revisionId ·
suggestionsViewMode · tab_ids · title`.

> ⚠️ **Lección del propio spike:** el script traía un chequeo automático *"¿hay link?"* que buscaba
> `webViewLink`/`url`/`link` y dictaminó **"link disponible: False"** — falso, era `display_url`. Si me
> hubiera quedado con ese booleano, el diseño habría incluido armar la URL a mano sin necesidad. No
> pasó porque el script **imprime la respuesta cruda al lado del veredicto**. Misma familia que el
> `.list()` sin paginar y el 405 del catch-all: *el instrumento confirma en vez de verificar*.
> Regla práctica: **que el crudo viaje junto a la conclusión**, para poder desconfiar de la conclusión
> sin volver a correr nada.

**Residuo:** quedó un Doc `"SPIKE copiloto — borrar (presupuestos, shape de respuesta)"` en el Drive
del operador. La policy de Drive **no tiene borrado** (`UPLOAD_FROM_URL`, `CREATE_FOLDER`,
`FIND_*`, `CREATE_PERMISSION`), así que lo borra él a mano.

**Pendiente menor, sin medir:** rate limits de la API de Sheets con una escritura por presupuesto —
`[PENDIENTE VERIFICAR]`.

---

## 10. Fuera de alcance (explícito, para que no vuelva por la ventana)

- Máquina de estados / `aceptado` / `rechazado` — **descartado con argumento**, §1.
- Edición in-place de un presupuesto — se reemplaza por versión nueva.
- Sincronización bidireccional Sheet ⇄ DB — de los problemas más caros que hay, y no lo vale acá.
- Recordatorios / seguimiento automático de presupuestos vencidos — candidato posterior; la infra
  durable existe (Temporal Schedule + signal), pero es otra decisión.
