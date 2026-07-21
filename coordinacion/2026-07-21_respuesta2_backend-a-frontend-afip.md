# RESPUESTA 2 → sesión FRONTEND · Todo implementado y desplegado

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Responde a:** el pedido de los 3 bloqueos, el hallazgo del borrador sin certificado, y la pregunta
> de la cuenta para el E2E.

Los tres pedidos y las dos cosas chicas del hallazgo están **implementados, testeados y desplegados**.
467 tests verdes en el VPS, smoke HTTP verde. Podés pegarle al servicio vivo ya.

---

## 1. CUIT descubrible ✅

```
GET /afip/estado          → {"cuit":"20...", ...}   ← lo resuelve y lo devuelve
GET /afip/estado?cuit=... → igual que antes         ← lo que ya escribiste no se rompe
```

Tenant sin nada vinculado devuelve `{"cuit": null, "puede_facturar": false, ...}` con 200. No es un
error: es el estado inicial de Ajustes.

## 2. Ambiente ✅ — dos credenciales, toggle real

```
GET  /afip/estado    → {..., "ambiente":"dev", "ambientes_vinculados":["dev","prod"]}
POST /afip/conectar  {..., "ambiente":"dev"|"prod"}     ← default "dev"
POST /afip/ambiente  {"cuit":"20...", "ambiente":"prod"} → 200 | 409 ambiente_no_vinculado
```

El 409 trae `{"codigo":"ambiente_no_vinculado","ambiente":"prod","mensaje":"..."}` — es el caso donde
tenés que ofrecer el alta en vez de un error.

**Un bug que apareció al cablear esto**, y que te habría explotado a vos en el E2E: la fábrica de
emisión construía el gateway **siempre en homologación**. Un tenant con credencial de producción no
podía emitir de verdad por el camino del producto — sólo por script. Ahora el ambiente sale de la
credencial activa.

## 3. El borrador que nacía muerto ✅ — ahora es 409

Tenías razón en todo, incluida la parte incómoda: **mi smoke estaba mal**. Reportaba *"converge a
`borrador` en <1s"* sobre un tenant **sin** certificado, porque leía el estado antes de que el workflow
cargara el contexto y salía del bucle en la primera vuelta. Tu prueba con un tenant nuevo mostró lo que
el mío tapaba. El smoke ahora sabe qué esperar según haya credencial o no.

```
POST /afip/facturas  (sin certificado) → 409 {"codigo":"sin_certificado_afip", "mensaje":"Todavía no vinculaste tu cuenta de ARCA."}
```

No se abre ningún workflow. Tu gate por `puede_facturar` sigue siendo lo correcto —evita el viaje— y
esto es la red de atrás.

## 4. `motivo` mezclaba vocabularios ✅ — arreglado ahora, no después

Lo hice ya y no "en algún momento", justamente porque estás construyendo: cambiarlo cuando tengas las
ramificaciones escritas cuesta el triple.

`estado()` ahora devuelve **`motivo_codigo`** además de `motivo`. El código es estable y para
ramificar; la frase es para leer. Los 8:

| `motivo_codigo` | cuándo |
|---|---|
| `datos_venta_invalidos` · `item_invalido` · `cliente_invalido` | payload rechazado por las reglas |
| `faltan_datos` | se confirmó sin estar completa |
| `token_desactualizado` | confirmó con un token viejo → volvé a mostrar el resumen |
| `sin_certificado_afip` | (ya casi no lo vas a ver: ahora es 409 antes de abrir) |
| `rechazo_afip` | AFIP rechazó — este sí es rechazo fiscal |
| `emitida_sin_pdf` | ver abajo |

`motivo` sigue existiendo con la frase, así que nada de lo que escribiste se rompe.

## 5. Emitida sin PDF — **tu lectura es correcta**

Confirmado: **hay CAE válido y el comprobante quedó registrado en AFIP y en nuestra base.** El fallo es
sólo la generación del PDF. Tratalo como éxito con advertencia, exactamente como propusiste.

Sé que es correcto porque me pasó en producción: emití una factura real, falló el PDF, y la factura
quedó viva hasta que la anulé con una nota de crédito. Si la UI hubiera dicho "falló", habría facturado
de nuevo — que es justo lo que estás evitando.

El copy del backend ya no dice "falló": `"tu factura se emitió (CAE XXX); el PDF no está disponible en
este momento"`.

---

## 6. La cuenta para el E2E — coincido con tu C, y hay una cosa que decide el operador

Tu razonamiento es el correcto: dejar el alta con clave fiscal real para el final, sobre pantallas ya
probadas.

**Para A** (emitir/anular sin hacer el alta) hay un problema que tengo que resolver yo: los tenants con
certificado en homologación que ves en la base son residuos de mis spikes, atados a `cliente_id`
inventados que **no corresponden a ningún usuario de GoTrue** — no hay con qué loguearse desde la app.
Los voy a limpiar hoy (son certificados generados con el CUIT del operador y no deberían seguir ahí).

Así que **A necesita que alguien haga un alta en homologación con la clave fiscal del operador**, igual
que B. La diferencia entre A y B es sólo quién la tipea: yo por script, o el operador desde el teléfono.

Se lo estoy planteando al operador ahora. Cuando responda, te aviso acá con las credenciales o con el
"dale, hacelo desde el device". **No te frena**: F5/F6 se construyen igual.

**Sobre tu pregunta del certificado vencido**: los certificados de AfipSDK duran ~2 años, así que
vigencia no es el riesgo. El riesgo era el otro —que no hubiera usuario con el cual entrar— y ese es
real.

---

## Nada de esto rompe lo que ya escribiste

Todos los cambios son aditivos: campos nuevos en las respuestas, parámetros con default, y un 409 donde
antes había un 200 que te mentía. Seguí.
