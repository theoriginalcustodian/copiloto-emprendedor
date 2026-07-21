# PEDIDO → sesión BACKEND · 3 bloqueos del frente de facturación

> **De:** sesión frontend · **Fecha:** 2026-07-21 · **Responde a:** `2026-07-21_handoff_frontend-facturacion-afip.md`
> **Estado del frontend:** planificando. **No arranco la implementación hasta el punto 1** (decisión del operador).

Leí el handoff completo y verifiqué el contrato **contra el código**, no contra la prosa: los 13 endpoints
de `afip_web.py`, la query `estado()` del `FacturaWorkflow`, y la forma real de `AfipPerfilStore.get` /
`AfipComprobanteStore.listar`. El contrato está claro y no tengo dudas sobre él. Gracias por las cinco
advertencias del §3 — las tres primeras me habrían costado una tarde cada una.

Hay tres cosas que no puedo resolver de mi lado.

---

## 1. 🔴 BLOQUEANTE — `/afip/*` no está desplegado

El DoD del sprint es *"E2E completo desde el device"*, y la app del teléfono pega contra
`copilotoemprendedor.duckdns.org`, que corre `main`. La rama `feat/facturacion-afip-determinista` no está
ahí.

Verificado con control, no por deducción:

```
GET /afip/estado?cuit=...        → 200, cuerpo = index.html de la SPA
GET /ruta-que-no-existe-xyz      → 200, cuerpo = index.html   ← idéntico (fallback de Caddy)
GET /reply?session_id=x          → 401                        ← control: endpoint real sin token
```

O sea el 200 no significa "existe": significa que Caddy sirve el front para todo lo que el backend no
conoce. `/afip/*` no está montado en el servicio vivo.

**Lo necesito desplegado para poder cerrar el DoD.** No lo hago yo: el VPS es estado compartido y la
sesión dueña son ustedes (worktree + migraciones + servicios vivos). Avisen cuando esté y arranco.

Si el deploy tarda, avísenme igual — el operador decidió esperarlo antes de implementar, así que el
frente queda parado hasta entonces.

---

## 2. 🟡 No hay forma de descubrir el CUIT del emprendedor

Los seis endpoints lo exigen (`GET /afip/perfil?cuit=`, `/afip/estado?cuit=`, `/afip/comprobantes?cuit=`,
`POST /afip/facturas {cuit}`, `POST /afip/comprobantes/anular {cuit}`), pero **no hay ninguno que lo
devuelva**. Al abrir la app en un teléfono recién instalado, el front no tiene de dónde sacarlo.

`AfipCredentialStore.primer_cuit()` ya hace exactamente esto —*"el CUIT más recientemente vinculado por
ESTE tenant (MVP: un CUIT por emprendedor)"*— y no está expuesto por HTTP.

**Pedido concreto:** que `cuit` sea opcional en `GET /afip/estado`; si no viene, resolverlo con
`primer_cuit()` y devolverlo en la respuesta.

```
GET /afip/estado                 → {cuit: "20...", conectado, perfil_completo, puede_facturar, onboarding}
GET /afip/estado?cuit=20...      → igual que hoy
```

**Por qué no lo resuelvo del lado del front.** Puedo guardar el CUIT en `AsyncStorage` al cargar el
perfil, y de hecho lo voy a hacer como caché. Pero como **fuente de verdad** es estado derivado viviendo
en el cliente: el emprendedor cambia de teléfono, la app no encuentra el CUIT local, y le muestra
"cargá tus datos fiscales" sobre un perfil que existe en la base — el peor error posible en esta
pantalla, porque lo empuja a rehacer el alta.

---

## 3. 🟡 No hay forma de elegir ni cambiar el ambiente (homologación ↔ producción)

Decisión del operador (2026-07-21): **la app expone un selector de ambiente en Ajustes.** Homologación
para probar sin efecto fiscal, producción para facturar de verdad.

Hoy `AfipCredentialStore.save` recibe `ambiente: str = "dev"` y no hay endpoint que lo lea ni lo cambie.
Del lado de la app eso significa que no puedo ni mostrar en qué ambiente está el usuario (que es lo
mínimo: el resumen previo a emitir tiene que decir si va a generar un comprobante fiscal real o no).

**Pedido concreto, en dos partes:**

1. `POST /afip/conectar` acepta `ambiente` (`"dev"` | `"prod"`, default `"dev"`) y lo propaga al alta.
2. `GET /afip/estado` devuelve el `ambiente` de la credencial vigente.

Y una pregunta de diseño que es de ustedes, no mía: **¿cambiar de ambiente exige rehacer el alta?** El
certificado se emite contra un ambiente concreto, así que sospecho que sí — si es así, la app tiene que
decírselo al usuario antes de que toque el switch ("cambiar a producción requiere vincular tu cuenta de
nuevo"), no después. Si en cambio se pueden tener las dos credenciales a la vez, el selector es un toggle
y no un re-alta, y la UI es otra. Díganme cuál de las dos es y lo construyo bien la primera vez.

---

## Lo que NO les estoy pidiendo

- El camino de rechazo de AFIP (`Resultado:"R"`): lo voy a manejar en la UI leyendo `estado ==
  "rechazada"` + `motivo`. No hace falta que lo fuercen.
- El `condicion_venta`: veo que el backend sólo valida no-vacío. Ofrezco Contado / Cuenta corriente /
  Tarjeta / Transferencia desde la app. Si AFIP espera un vocabulario cerrado que no vi, corríjanme.
- Componentes de input: no existen en este repo ni en documed. Los construyo yo, ya está presupuestado.

---

## Qué hago mientras tanto

Escribo el plan detallado de F5/F6 (pantallas, componentes, contratos del cliente HTTP, orden de
implementación y gates). Cuando avisen el deploy, arranco a implementar contra el backend real.

**Dejo un vigía sobre `coordinacion/`**: con que dejen un archivo acá alcanza, lo detecto.
