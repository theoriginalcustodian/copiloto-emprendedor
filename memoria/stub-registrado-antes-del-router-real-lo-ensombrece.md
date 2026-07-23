---
name: stub-registrado-antes-del-router-real-lo-ensombrece
description: Un stub/placeholder que responde temprano en el orden de rutas ensombrece la implementación real en silencio — código verde, endpoint muerto en prod
metadata:
  type: project
---

**Un `@app.get("/x")` stub registrado ANTES del `include_router` real lo ensombrece.** FastAPI resuelve
por orden de registro: la primera ruta que matchea gana. Un stub que devuelve `501 "no implementado
todavía"` puesto arriba **tapa** la implementación real (el router incluido después) — y lo hace **en
silencio**: el código de la implementación está verde (sus tests unit pasan contra el handler directo),
pero el **front-door nunca la sirve**. El endpoint está vivo en el repo y muerto en prod.

**El caso (2026-07-22, `web.py`):** `/actividad` sirvió `501` en prod desde siempre. El stub
`web.py:512-545` se registraba antes del `include_router(actividad_app)` (línea 760) → ganaba. Los hitos
1/2 de actividad estaban "hechos" pero **inertes en el vivo**. Lo destapó backend verificando **por HTTP
contra el vivo con un tenant real** — no el unit del handler, que no ve el routing ([[gate-jsdom-no-ve-gestos-tactiles]]
tiene el mismo filo: el test que no ejercita la capa real no ve el bug). Y toda la cadena de recientes/
buscar del Carril B quedó inerte apoyada encima, sin síntoma, hasta el chequeo vivo.

**El agravante — el comentario lo PREDIJO y no alcanzó:** `web.py:754` decía textual *«un stub que
devuelve 501 GANARÍA y ensombrecería esta implementación real — en silencio. El stub se BORRA en ese
merge»*. **No se borró.** Un TODO que describe su propia condición de pago no se paga solo
([[la-deuda-vencida-no-siempre-se-paga-en-un-paso]], [[borrar-el-archivo-no-borra-su-contrato]]): el
merge que debía borrarlo no lo hizo y nadie lo verificó contra el vivo.

**Reglas:**
- Un placeholder que responde temprano es **deuda con reloj**: registrala visible Y ponele un **test de
  front-door** que falle si el stub sigo ganando — el guard de la regresión exacta, no el unit del handler.
- **Precondición del `listo_`** de cualquier endpoint que reemplaza un stub: verificar **por HTTP contra
  el vivo** que lo sirve el router real (200 con la forma nueva), no el stub. Verde de código ≠ servido.
- Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] y
  [[catch-all-vuelve-no-desplegado-indistinguible-de-roto]]: el front-door puede devolver algo plausible
  (501, HTML del SPA, 200 vacío) que hace pasar el happy-path mientras la implementación real no corre.
