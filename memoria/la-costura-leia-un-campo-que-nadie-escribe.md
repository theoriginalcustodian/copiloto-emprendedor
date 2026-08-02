---
name: la-costura-leia-un-campo-que-nadie-escribe
description: La costura HTTP nunca depositó un error en la DLQ — leía request.state.cliente_id, que nadie en el backend escribe. Un lector y un escritor que nunca se contrastaron, con getattr(default=None) tapando la evidencia y un test que fabricaba el escritor que producción no tiene
metadata:
  type: project
---

**Medido el 2026-08-01 (PR #191).** `handler_errores_web` sacaba el tenant de
`request.state.cliente_id`. **Nadie en todo el backend escribe ese atributo**: `require_tenant`
(`auth.py:117`) declara el tenant en el `ContextVar` de `contexto_tenant`. Grep con control positivo:
las dos únicas apariciones del atributo estaban en el propio handler — o sea, sólo el lector.

Con `cliente_id=None`, `depositar()` corta en su primera línea (`if fabrica is None or not
cliente_id`). **Ningún error de las ~80 rutas HTTP llegó nunca a la DLQ en producción.** La Fase 2
estaba viva sólo del lado de las activities, que sacan el `cliente_id` del payload. El ciclo de
autosanación no puede reparar lo que nunca ve, y no veía la mitad de la app.

## Las tres cosas que lo hicieron invisible

1. **`getattr(request.state, "cliente_id", None)` convierte "nunca se escribió" en "no hay tenant",
   que es un caso legítimo** (rutas públicas: health, webhooks). El default no es neutral: le da al
   fallo la forma exacta del caso normal. Un `AttributeError` habría gritado el primer día.
2. **No rompe nada.** El 500 salía igual con su fingerprint, el log quedaba igual. Sólo faltaba la
   fila — y una DLQ vacía se lee como *"no falla nada"* en vez de *"no entra nada"*
   ([[el-indice-truncado-fabrica-duplicados]] tiene la misma forma en otro dominio).
3. **El test fabricaba el escritor.** Montaba su propia app con un middleware que sí seteaba
   `request.state.cliente_id`, y su comentario afirmaba *"que es donde lo deja `require_tenant` en
   producción"*. Era falso y nadie lo contrastó contra `auth.py`. Verde sobre un montaje inventado:
   [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]].

## El patrón, para reconocerlo en otro lado

**Un campo compartido entre dos módulos necesita que alguien haya verificado al ESCRITOR, no sólo al
lector.** Acá había un lector, cero escritores, y tres capas de amortiguación (`getattr` con default,
`depositar` que nunca lanza, un test con escritor propio) que convertían la ausencia total en
operación normal. Cada una de esas tres defensas es correcta por separado; juntas forman un silencio
perfecto.

**El control que lo caza en 30 segundos:** por cada campo que un módulo LEE de un objeto compartido
(`request.state`, `context`, `payload`, `meta`), grepear **quién lo escribe** — con control positivo
para saber que el grep ve algo. Si el único hit es el lector, ya está: el campo siempre vale su
default.

## Cómo apareció

Diseñando el canario de salud, cuyo propósito era distinguir "no falla nada" de "el cable está
cortado". El cable ya estaba cortado. **El detector encontró el fallo antes de existir** — el diseño
obligó a preguntarse cómo entra un error al sistema, y esa pregunta no se la había hecho nadie desde
que se construyó la costura.

## El fix, y su prueba

`cliente_id = getattr(request.state, "cliente_id", None) or tenant_actual()` — la fuente real, con
`request.state` como fallback para quien quiera setearlo. Diferencial:

```
sin el fix → 1 failed (test_REPRODUCCION...), 66 passed
con el fix → 67 passed
suite completa → 1470 passed
```

**Los otros 66 tests pasan igual CON el bug presente.** Era invisible para la suite entera; sólo un
test que falla antes y pasa después lo separa ([[no-romper-no-es-arreglar]]). El test nuevo monta el
borde real —dependencia `async` que declara el tenant— y de paso valida el supuesto del que depende
el fix: que el `ContextVar` sigue visible desde el exception handler.
