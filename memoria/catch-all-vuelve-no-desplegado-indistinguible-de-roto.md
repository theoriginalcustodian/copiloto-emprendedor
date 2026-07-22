---
name: catch-all-vuelve-no-desplegado-indistinguible-de-roto
description: Cualquier ruta inexistente devuelve 200 con el HTML del SPA — un GET nunca prueba que un endpoint exista
metadata:
  type: project
---

**LEER antes de sondear si un endpoint está desplegado, y antes de creerle a un `200`.**

El front-door monta el SPA con un catch-all `@app.get`. Consecuencia estructural:

```
GET /ruta-que-no-existe-jamas  -> 200 <!doctype html>
GET /actividad                 -> 200 <!doctype html>   <- IDÉNTICO
```

**Una ruta que no existe es indistinguible de una que existe y anda**, si sólo mirás el status de un
GET. Y el cliente no recibe un error honesto: recibe **HTML con status 200**, así que o decide "no
disponible" contra un backend perfecto, o intenta parsear HTML como JSON.

**Tres casos en una semana, y por eso ya no es anécdota:**

- **Apps** — catálogo estático contra un endpoint que llevaba meses vivo.
- **`clientes.ts` muerto** — cliente HTTP de un backend que en este repo **nunca existió**; importarlo
  habría dejado la pantalla muerta para siempre, sin un solo error.
- **`/actividad`** — stub que vive en una rama y no en producción.

**La sonda que SÍ discrimina** es por un verbo distinto de GET, y se lee así:

```
POST /gastos           -> 401 {"detail":"missing or malformed Authorization header"}  <- EXISTE
POST /gastos/resumen   -> 405   <- existe, no acepta POST
POST /ruta-inventada   -> 405   <- no existe
GET  /ruta-inventada   -> 200 <!doctype html>   <- el control
```

**Regla dura: toda sonda nueva se corre primero contra una ruta que seguro no existe, y tiene que dar
NEGATIVO.** Sin ese paso, "verifiqué contra el vivo" es una frase, no una medición.

**Y el corolario que casi me muerde:** verifiqué Gastos y Clientes contra `127.0.0.1:8099` y di el
resultado por bueno. El teléfono no le pega a `127.0.0.1` — le pega al dominio público, con Caddy en
el medio. **El control vale para la superficie que usa el cliente real, no para la más cómoda de
sondear.** (Esa vez el backend estaba bien; la próxima puede no estarlo, y la sonda cómoda no lo
habría visto.)

Hermanas: [[instrumentos-que-confirman-en-vez-de-verificar]] · [[verificar-que-el-camino-recomendado-existe]] · [[vacio-no-es-hallazgo-correr-el-control]]
