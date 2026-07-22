# Plan de implementación — UI de facturación AFIP (F5 + F6)

> **Sesión:** frontend · **Fecha:** 2026-07-21 · **Rama destino:** `feat/mobile-first-cascara-glass`
> **Entrada:** `coordinacion/2026-07-21_handoff_frontend-facturacion-afip.md` (backend 🟢 terminado)
> **Pedidos abiertos al backend:** `coordinacion/2026-07-21_pedido_frontend-a-backend-afip.md`
> **Estado:** ⏸️ **BLOQUEADO esperando el deploy de `/afip/*`** (decisión del operador). El plan está cerrado.

---

## 0. Qué se decidió antes de planificar

| Decisión | Quién | Resultado |
|---|---|---|
| Ambiente homologación vs producción | Operador | **Los dos, con selector en Ajustes.** Requiere 2 endpoints nuevos (pedido §3). |
| ¿Arrancar sin backend desplegado? | Operador | **No.** Se espera el deploy. Vigía armado sobre `coordinacion/` + sonda a `/afip/estado`. |
| Base de inputs | Operador (corrección) | **Existe**: el campo del `Composer` del glass principal. Se EXTRAE, no se inventa. |
| `condicion_venta` | Táctica (IA) | Contado · Cuenta corriente · Tarjeta · Transferencia. El backend sólo valida no-vacío. |
| Dónde vive "Mis comprobantes" | Táctica (IA) | Segunda sección dentro de Facturación, no pantalla aparte. |

---

## 1. Verificaciones hechas contra el código real (no contra la prosa del handoff)

- **Contrato**: los 13 endpoints de `afip_web.py`, firma por firma. Coincide con el handoff.
- **Forma del estado**: la query `estado()` de `FacturaWorkflow` (9 claves; `token_confirmacion` es
  `None` salvo en `esperando_confirmacion` — dato que el handoff no dice y cambia el guard de la UI).
- **Forma del perfil**: `AfipPerfilStore.get` → 7 campos, `inicio_actividades` como `date`.
- **Forma del comprobante**: `AfipComprobanteStore.listar` → las 10 columnas del handoff.
- **Deploy**: ❌ no está. Control corrido (`/afip/estado` = `index.html` = ruta inexistente; `/reply` = 401).
- **Descubrimiento del CUIT**: ❌ no hay endpoint. `primer_cuit()` existe en el store, sin exponer.
- **Base de inputs**: el `Composer` tiene el patrón completo (View + `LinearGradient` s1→s2 +
  `luzSuperior` + `TextInput` transparente). Es el molde.

⚠️ **El handoff tiene un dato obsoleto**: dice que `PantallaFacturacion` *"se monta dentro de
`CapaFuncion`"*. `CapaFuncion` se borró hoy (commit `a07f967`); ahora cada pantalla trae su propio
`MarcoGlass`. No afecta al plan — sólo a quien lea el handoff literal.

---

## 2. Arquitectura por capas

```
packages/core/src/api/afip.ts          ← transporte + tipos + normalización (sin React, sin plataforma)
apps/mobile/src/theme/glass/campos/    ← primitivos de formulario (extraídos del Composer)
apps/mobile/src/modules/facturacion/   ← F6: emisión, comprobante, mis comprobantes
apps/mobile/src/modules/ajustes/afip/  ← F5: perfil fiscal, alta ARCA, selector de ambiente
```

Regla de dirección: `modules/*` → `theme/glass/campos` → tokens. `modules/*` → `@copiloto/core`.
Ningún módulo de UI arma una URL ni conoce un código HTTP.

---

## 3. Capa 1 — `packages/core/src/api/afip.ts`

Molde: `actividad.ts` (mismo patrón `no_disponible` para 404/501, que además cubre exactamente el
estado actual "endpoint sin desplegar").

### Tipos exportados

```ts
type CondicionIvaEmisor = 'monotributo' | 'responsable_inscripto' | 'exento';
type EstadoFactura = 'borrador' | 'datos_venta_ok' | 'items_ok' | 'cliente_ok'
                   | 'esperando_confirmacion' | 'emitiendo' | 'emitida' | 'entregada'
                   | 'rechazada' | 'cancelada';
type PasoOnboarding = 'iniciado' | 'dando_de_alta' | 'verificando' | 'habilitado' | 'fallido';

interface Faltante { codigo: string; campo: string; mensaje: string }
interface ItemFactura { descripcion: string; cantidad: string; precio_unitario: string; subtotal: string }
interface EstadoFacturaResp {
  estado: EstadoFactura; faltantes: Faltante[]; items: ItemFactura[]; total: string;
  token_confirmacion: string | null; resultado: ResultadoEmision | null;
  pdf: { url: string; nombre: string; expira_at: string | null } | null;
  motivo: string | null; terminado: boolean;
}
```

🔴 `estado` y `paso` se tipan como **unión abierta** (`EstadoFactura | (string & {})`), mismo criterio
que `ReplyCard.kind`: un estado nuevo del backend no debe romper el bundle del front.

### Funciones

| Función | Endpoint | Nota de diseño |
|---|---|---|
| `leerPerfil(cuit)` | `GET /afip/perfil` | `null` si no hay |
| `guardarPerfil(p)` | `POST /afip/perfil` | 422 → `ErrorValidacionFiscal` con `Faltante[]` tipado |
| `conectarArca({cuit,usuario,claveFiscal,ambiente})` | `POST /afip/conectar` | ⚠️ `claveFiscal` **nunca** se loguea ni se guarda en estado persistente |
| `estadoAfip(cuit?)` | `GET /afip/estado` | `cuit` opcional (pendiente backend §2) |
| `crearFactura(cuit)` | `POST /afip/facturas` | |
| `estadoFactura(id)` | `GET /afip/facturas/{id}` | |
| `setDatosVenta / agregarItem / quitarItem / setCliente` | signals | |
| `confirmarFactura(id, token)` | `POST .../confirmar` | |
| `cancelarFactura(id)` | | |
| `listarComprobantes(cuit, limite)` | | |
| `anularComprobante(...)` / `estadoAnulacion(id)` / `confirmarAnulacion(id)` | | |

### Dos helpers que resuelven trampas del contrato, y viven ACÁ (no en la UI)

**`esperarEstadoEstable(id)`** — trampa §3.1 del handoff. Al crear la factura, el primer estado puede
traer `perfil_ausente` mientras el workflow carga el contexto. Repolea hasta que `faltantes` no
contenga `perfil_ausente`, con backoff (50/100/200/400/800 ms, tope 3 s) y **corte honesto**: si a los
3 s sigue igual, devuelve el estado tal cual y marca `convergio: false` — la UI muestra el error real
en vez de girar para siempre. Vive en el core porque es una propiedad del *contrato*, no de la
pantalla: si mañana hay una segunda pantalla que crea facturas, hereda el arreglo.

**`confirmarConTokenFresco(id)`** — trampa §3.2. Relee el estado, toma `token_confirmacion` de ahí,
confirma, y **verifica el resultado**: si vuelve `esperando_confirmacion` con `motivo`, devuelve
`{emitida:false, motivo}` para que la pantalla vuelva a mostrar el resumen. Nunca se confirma con un
token que la UI tenía guardado de antes.

### Tests (vitest, en el core)

`afip.test.ts` con `fetch` mockeado: forma de cada respuesta · 422 → `ErrorValidacionFiscal` ·
404/501 → `no_disponible` · `esperarEstadoEstable` converge y también **corta** · `confirmarConTokenFresco`
detecta el no-op · **la clave fiscal no aparece en ningún objeto que se retorne o registre**.

---

## 4. Capa 2 — Primitivos de formulario (`src/theme/glass/campos/`)

Extraídos del `Composer` (líneas 113-135), no inventados. Un solo `EnvolturaCampo` aporta el vidrio;
cada campo lo usa.

| Componente | Qué es | Detalle |
|---|---|---|
| `EnvolturaCampo` | View + gradiente s1→s2 + `luzSuperior` + borde + radio 20 | El vidrio, una sola vez |
| `CampoTexto` | label + `TextInput` + error | `keyboardType`, `maxLength`, `autoCapitalize` |
| `CampoNumero` | `CampoTexto` con `decimal-pad` | **Importes como string**, nunca `parseFloat` (§ del handoff: son centavos) |
| `CampoSecreto` | `CampoTexto` + `secureTextEntry` + aviso debajo | Para la clave fiscal. `textContentType="password"`, sin autocompletado |
| `CampoSelect` | label + opciones como chips de vidrio | Sin `Picker` nativo: rompe el lenguaje del vidrio y en Android abre un diálogo del sistema |
| `CampoFecha` | 3 `TextInput` (DD/MM/AAAA) → ISO | Sin date-picker nativo, por lo mismo. Valida rango en el blur |
| `FilaBotones` | los CTA en píldora de vidrio | Reusa `pressableStyle`/`PRESS_FADE` |

**Estado de error**: `borderColor: tema.color.peligro` + texto en `peligro`. Se alimenta del `campo`
de `Faltante[]` — el mismo código que manda el backend, sin traducir.

Todos con `testID` estable. Gate visual: **cero hex literales**, todo por `useTema()`; se suman al test
`chatNoHexLiterals` si el módulo aplica.

---

## 5. Capa 3 — F5: Ajustes (perfil fiscal + ARCA + ambiente)

Pantalla nueva `PantallaAfipSetup` (`src/modules/ajustes/afip/`), envuelta en `MarcoGlass`
(título "Facturación AFIP", ícono `doc_search` — el mismo del tile de Facturación).

**Entrada #1:** tile nuevo en `PantallaAjustes` → ruta `/ajustes-afip`. Pasa de 6 a 7 tiles, así que la
grilla deja de ser `slice(0,3)/slice(3,6)` hardcodeado y pasa a `agruparEnFilas(TILES, 3)` con relleno
invisible en la última fila — si no, el séptimo tile se estira a todo el ancho.
**Entrada #2:** desde Facturación cuando `puede_facturar === false`, con un CTA directo. Sin desvío por
Ajustes: la trampa §3.5 del handoff pide mostrar el camino, y el camino más corto es no tener camino.

### Tres bloques

**1. Perfil fiscal** — razón social · domicilio comercial · condición IVA (`CampoSelect` de 3) ·
ingresos brutos · inicio de actividades (`CampoFecha`) · punto de venta (`CampoNumero`).
`POST /afip/perfil`; en 422, cada `detail[].campo` pinta su campo con su `mensaje`. El CUIT es el
primer campo y sólo se pide una vez (después queda de solo-lectura con opción "cambiar").

**2. Conectar con ARCA** — el flujo del competidor, en 3 pasos:
   1. CUIT → 2. confirmar identidad → 3. **recién ahí** la clave fiscal.
   Debajo del campo de clave, no en un link:
   > Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta.

   Durante el alta, **progreso real** con `onboarding.paso` (5 estados), no un spinner mudo. Polling a
   `/afip/estado` cada 3 s mientras `terminado === false`, con corte a los 10 min → estado honesto
   ("está tardando más de lo normal") + botón de reintento. `fallido` muestra `motivo` y ofrece rehacer.

**3. Ambiente** — `CampoSelect` de 2 (Homologación / Producción). Copy explícito:
   > **Homologación** — facturas de prueba, sin efecto fiscal. **Producción** — comprobantes fiscales reales.

   ✅ **Resuelto por backend (respuesta del 2026-07-21): son DOS credenciales, no un re-alta.** Verificado
   contra la base: ya conviven certificados `dev` y `prod` para el mismo CUIT, porque homologación y
   producción son WSAA distintos. Consecuencias exactas para esta UI:

   - Entre ambientes **ya vinculados** el selector es un **toggle instantáneo**, sin fricción.
   - Un ambiente **sin credencial** no se muestra como opción tocable sino como **"Vincular"** → dispara
     el alta (con clave fiscal) *para ese ambiente*. Es una vez por ambiente, no una vez por cambio.
   - La fuente es `ambientes_vinculados: string[]` de `GET /afip/estado`. Sin ese dato el switch sería una
     trampa: el usuario lo toca y descubre el problema después.

   `POST /afip/conectar` acepta `ambiente` (`"dev"` | `"prod"`, default `"dev"`). Los dos cambios son
   **aditivos** — lo que se escriba antes de que suban no se rompe.

---

## 6. Capa 4 — F6: Facturación (emisión + comprobante + mis comprobantes)

`PantallaFacturacion` deja de ser cascarón. **Un solo `MarcoGlass`**, contenido por fase — no rutas
nuevas por paso: apilar 5 modales para un formulario es justo lo que rompió la app hoy
(`empujarUnaVez`, commit `8bec58b`).

### Máquina de la UI = máquina del backend

El paso visible se **deriva** de `estado` + `faltantes`, nunca de un `useState` local paralelo. Es la
misma disciplina que el backend aplicó (*"el estado se DERIVA de los datos"*): un contador de paso
propio sería un segundo dueño de la verdad y se desincronizaría en el primer borrado de ítem.

🔴 **El gate es `puede_facturar`, chequeado ANTES de `POST /afip/facturas`.** Medido contra el backend
vivo el 2026-07-21 con un tenant sin certificado: el borrador **nace terminal** —
`{estado:"rechazada", terminado:true, motivo:"sin_certificado_afip", faltantes:[]}` en el primer poll, sin
ventana de convergencia. Si la pantalla creara el borrador sin chequear, el usuario nuevo tocaría "Nueva
factura" y leería **"rechazada"**, que en este dominio significa *"AFIP rechazó tu factura"* y no *"todavía
no configuraste nada"* — además de quemar un workflow por toque. El caso `rechazada` +
`motivo === "sin_certificado_afip"` queda igual como red de seguridad, renderizado con el copy de
configuración. Evidencia en `coordinacion/2026-07-21_hallazgo_frontend-estado-rechazada-sin-certificado.md`.

```
sin perfil            → CTA "Configurar facturación" → /ajustes-afip
borrador              → Paso 1 · Datos de venta
datos_venta_ok        → Paso 2 · Ítems
items_ok              → Paso 3 · Cliente
cliente_ok            → (transitorio)
esperando_confirmacion→ Paso 4 · RESUMEN + HITL
emitiendo             → Emitiendo… (polling)
emitida | entregada   → Comprobante
rechazada             → Rechazo, con `motivo` y "volver a intentar"
cancelada             → Vuelta al inicio
```

### Los cuatro pasos

**1. Datos de venta** — fecha · concepto (Productos / Servicios / Ambos) · condición de venta.
Con concepto 2 o 3 aparecen las **tres fechas de servicio, obligatorias** (el backend las exige y AFIP
también) — se muestran por el concepto elegido, no se esconden hasta que el backend rechace.

**2. Ítems** — lista + alta (descripción, cantidad, precio unitario) + borrar. Subtotal y total los
**calcula el backend**, no la app: dos calculadoras de importes divergen y sólo una es la fiscal.

**3. Cliente** — condición IVA del receptor (4 opciones) · tipo de doc (4) · nro · nombre · domicilio.
Los campos requeridos cambian con `tipo_doc`; el guard duro lo pone el backend y la UI sólo anticipa.

**4. Resumen + HITL** — todo lo que se va a emitir, y **tres botones**:
`[Confirmar] [Cancelar] [Editar y confirmar]`. El tercero vuelve al paso que se quiera sin rehacer el
resto — es lo que evita recargar todo por un dato mal tipeado.
Confirmar usa `confirmarConTokenFresco`; si vuelve el no-op con `motivo`, se re-muestra el resumen con
un aviso ("los datos cambiaron, revisá antes de emitir").

🔴 **El ambiente se muestra ACÁ, no sólo en Ajustes** (pedido explícito de backend, y tienen razón:
*"emitir un comprobante fiscal real creyendo que se está probando es el error caro de este flujo, y el
único lugar donde se puede evitar es la pantalla donde el usuario aprieta Confirmar"*). En producción el
botón dice **"Emitir factura real"**, no "Confirmar" — la etiqueta del botón es lo último que se lee
antes de apretarlo. En homologación, el resumen aclara que es una prueba sin efecto fiscal.

🔴 **`emitida pero sin PDF` NO es un error** (`afip_factura_workflow.py:217`). Hay un comprobante fiscal
válido con CAE; mostrar la palabra "falló" haría que el usuario crea que no se emitió y **facture de
nuevo, duplicando un comprobante real**. Se renderiza como éxito con advertencia: *"tu factura se emitió
(CAE XXX); el PDF no está disponible en este momento"*, con el CAE copiable.

### Comprobante

Card con tipo · punto de venta · número · CAE · vencimiento del CAE · total, más:
- **[Guardar]** — descarga el PDF (`expo-file-system` + `expo-sharing`).
- **[Compartir]** — `Share` de RN. (La Web Share API del handoff es de la PWA; en nativo es `Share`.)
- **Aviso obligatorio:** *"El PDF está disponible por 24 horas. Después vas a poder descargarlo desde
  el portal de AFIP con el CAE."* Un botón que falle en silencio al otro día es peor que no ofrecerlo.

### Mis comprobantes

`GET /afip/comprobantes` en una lista de `Row`. Estado por comprobante (`emitida` · `anulada` ·
`nota_credito`) y acción **Anular**, con confirmación que **nombra lo que realmente pasa**:
> Anular emite una **nota de crédito** — otro comprobante fiscal que neutraliza esta factura. No se borra.

Flujo: `POST /afip/comprobantes/anular` → polling de `/afip/anulaciones/{id}` → resumen → confirmar.

---

## 7. Orden de implementación

| # | Bloque | Depende de | Gate de salida |
|---|---|---|---|
| 1 | `packages/core/src/api/afip.ts` + tests | — | vitest verde, incluidos los 2 helpers y el test de la clave |
| 2 | `theme/glass/campos/*` + tests | — | jest verde, cero hex, ambos temas |
| 3 | F5 `PantallaAfipSetup` + ruta + tile | 1, 2 | jest verde; **perfil real guardado desde el teléfono** |
| 4 | F5 alta ARCA + progreso | 3 | **`puede_facturar: true` en device** |
| 5 | F6 pasos 1-3 | 1, 2, 4 | estado avanza a `esperando_confirmacion` en device |
| 6 | F6 resumen + HITL + emisión | 5 | **CAE real en homologación, desde el teléfono** |
| 7 | F6 comprobante + Guardar/Compartir | 6 | PDF abierto en el teléfono |
| 8 | Mis comprobantes + anulación | 6 | **nota de crédito emitida desde el teléfono** |
| 9 | Handoff de vuelta a backend | 1-8 | archivo en `coordinacion/` |

**1 y 2 no dependen del deploy.** El operador pidió esperarlo igual, así que no se arrancan sin aviso.

---

## 8. Gates (binarios, con evidencia)

- `npx tsc --noEmit` limpio · `npx jest` verde en mobile · `vitest` verde en core.
- **Cero hex literales** en los módulos nuevos; ambos temas verificados.
- **E2E desde el device, con captura**: alta → perfil → emitir → CAE → PDF → anular → ver la NC.
- Nada se declara listo con evidencia de jest solamente. El gate jsdom no ve gestos ni red real.

## 9. Riesgos declarados

| Riesgo | Mitigación |
|---|---|
| `/afip/*` sin desplegar | Bloqueo declarado. Vigía armado. |
| Sin descubrimiento de CUIT | Caché local + pedido §2. Si no llega, queda `[ASSUMED_PENDING_VERIFY]` documentado en el handoff. |
| Ambiente sin endpoint | Bloque en solo-lectura hasta que respondan. |
| El PDF expira a 24 h | Copy explícito. No se re-hostea (decisión del operador). |
| Camino de rechazo de AFIP nunca ejercitado | La UI lo maneja por `estado === 'rechazada'` + `motivo`; **no se puede probar en device** hasta que alguien lo fuerce → se declara sin verificar. |
