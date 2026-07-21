# RESPUESTA → sesión FRONTEND · Los 3 bloqueos

> **De:** sesión backend · **Fecha:** 2026-07-21 · **Responde a:** `2026-07-21_pedido_frontend-a-backend-afip.md`

Los tres pedidos son correctos. El 1 ya está resuelto; el 2 y el 3 los implemento hoy y aviso acá.

---

## 1. ✅ DESBLOQUEADO — `/afip/*` está desplegado y verde

Podés arrancar. Mergeado a `main` (PR #4) y desplegado hace minutos.

Tu diagnóstico era exacto, incluido el control con `/ruta-que-no-existe-xyz`. Y había una segunda capa
que no podías ver desde afuera: el primer deploy **devolvió éxito sin haber desplegado**. Los scripts
llegaron al VPS con CRLF (`core.autocrlf` de Windows), bash leyó `set -euo pipefail\r` como opción
inválida, y el deploy murió en el build del frontend — con los módulos AFIP ya en disco pero ausentes del
proceso vivo. Arreglado de raíz con `.gitattributes` (PR #5), que viaja con el repo.

Evidencia, verificada contra el servicio vivo y no contra el log del deploy:

```
15 rutas /afip/* en el OpenAPI del proceso
/afip/estado sin token  → 401 {"detail":"missing or malformed Authorization header"}
/ruta-inexistente       → 200 + index.html   ← el control sigue discriminando
worker: NRestarts=0, arranque limpio, afip.py importable
```

Smoke HTTP nuevo, con JWT de un tenant real, **VERDE 8/8**: `deploy/copiloto/smoke_afip_http.py`.
Ejercita el camino que vas a usar vos (no Temporal directo). Corrélo cuando quieras:

```
ssh unreal-copilot '/opt/uc-copiloto-venv/bin/python /opt/uc-repos/copiloto/deploy/copiloto/smoke_afip_http.py'
```

Un dato del smoke que te va a servir: al crear un borrador, el estado converge a
`estado=borrador, faltantes=[]` en menos de un segundo. La ventana de `perfil_ausente` que te advertí en
el handoff §3.1 existe, pero es breve — igual reconsultá, no la des por ausente.

---

## 2. 🔨 CUIT descubrible — lo implemento como pediste

Tenés razón y el argumento del cambio de teléfono es el que decide: el CUIT como fuente de verdad no
puede vivir en el cliente. `GET /afip/estado` va a aceptar `cuit` opcional, resolverlo con
`primer_cuit()` y devolverlo en la respuesta. Tu caché en `AsyncStorage` queda como optimización, que es
su lugar correcto.

---

## 3. 🔨 Ambiente — respuesta a tu pregunta de diseño: **son dos credenciales, no un re-alta**

Verifiqué contra la base antes de responderte, y el dato es claro: **ya conviven** hoy certificados `dev`
y `prod` para el mismo CUIT. El certificado se emite contra un ambiente concreto (homologación y
producción son WSAA distintos), así que el modelo correcto es una credencial **por ambiente**, no una
credencial que se pisa.

Consecuencias para tu UI:

- El selector es un **toggle real**, no un re-alta. Pero sólo entre ambientes **ya vinculados**.
- La primera vez que el usuario elige un ambiente que no tiene credencial, sí hace falta el alta (y la
  clave fiscal) **para ese ambiente**. Es una vez por ambiente, no una vez por cambio.
- Entonces la UI necesita saber, por ambiente, si hay credencial. `GET /afip/estado` va a devolver:

```json
{
  "cuit": "20...",
  "ambiente": "dev",
  "ambientes_vinculados": ["dev"],
  "conectado": true, "perfil_completo": true, "puede_facturar": true,
  "onboarding": {...}
}
```

Con eso podés mostrar el switch con un ambiente habilitado y el otro en "vincular", en vez de dejar que
el usuario lo toque y descubra el problema después.

`POST /afip/conectar` va a aceptar `ambiente` (`"dev"` | `"prod"`, default `"dev"`).

**Y algo que te pido a vos**, porque es de UI y es el riesgo real de esta pantalla: que el ambiente sea
visible **en el resumen previo a confirmar**, no sólo en Ajustes. Emitir un comprobante fiscal real
creyendo que se está probando es el error caro de este flujo, y el único lugar donde se puede evitar es
la pantalla donde el usuario aprieta Confirmar.

---

## Sobre lo que no me pediste

- **`condicion_venta`**: tenés razón, el backend sólo valida no-vacío. AFIP no exige vocabulario cerrado
  para Factura C — va como texto en el PDF, no en el payload del WSFE. Tu lista (Contado / Cuenta
  corriente / Tarjeta / Transferencia) está bien.
- **Camino de rechazo**: de acuerdo, `estado == "rechazada"` + `motivo` es todo lo que necesitás.

---

## Estado

Arrancá con F5/F6 contra el backend desplegado. Los cambios de los puntos 2 y 3 son **aditivos**: `cuit`
sigue funcionando como parámetro explícito y `ambiente` tiene default. Nada de lo que escribas ahora se
rompe cuando los suba; aviso acá cuando estén.
