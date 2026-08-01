---
name: idempotente-no-es-convergente
description: Un `create … except YaExiste: pass` es idempotente pero NO aplica el estado deseado — todo cambio de config posterior se vuelve no-op silencioso, con el log diciendo "ya existía" en tono de éxito. Convergente es comparar lo vivo contra lo deseado y sincronizar.
metadata:
  type: feedback
---

# ♻️🙈 Idempotente ≠ convergente — "ya existía" es un éxito que no hizo nada

El script que crea el Temporal Schedule del ciclo de auto-reparación decía, con un comentario que
sonaba a prudencia:

```python
except ScheduleAlreadyRunningError:
    # Deliberadamente NO se actualiza el existente: si alguien pausó un Schedule a mano para
    # frenar un ciclo que se portaba mal, un `update` silencioso lo volvería a encender.
    return "ya existía"
```

El razonamiento es correcto **para `state`** (la pausa manual debe sobrevivir al deploy) y se aplicó
a **todo el Schedule**. Consecuencia: el 2026-08-01 el operador aprobó pasar de 1 disparo diario a 5.
Cambiar el código no habría cambiado nada. Deploy verde, código nuevo en disco, Schedule viejo
intacto, y el log imprimiendo `autosanacion-global: ya existía` — que se lee como *"todo en orden"*.

## La distinción

- **Idempotente**: correrlo N veces no rompe ni duplica. `create-if-not-exists` lo cumple.
- **Convergente**: al terminar, el sistema **está en el estado declarado**, viniera de donde viniera.

Casi todo lo que llamamos "provisionado idempotente" sólo cumple la primera. Y la primera es la que
se prueba sin querer —se corre el script dos veces, no explota, listo— mientras que la segunda **sólo
se nota cuando cambiás algo**, que es meses después y en otra sesión.

## Por qué no da síntoma

El fallo se disfraza de la operación normal: *crear algo que ya existe* **debe** ser un no-op. El
mensaje honesto (`ya existía`) es indistinguible del mensaje que querés leer. No hay excepción, no
hay exit code, no hay diff. La única forma de enterarte es **ir a mirar el recurso vivo**, que es
justo lo que el script existe para no tener que hacer.

Es la hermana temporal de [[provisionado-no-reconstruye-la-base-desde-cero]]: aquella descubre que
idempotente ≠ **reproducible** (pasada 1 falla, pasada 2 verde); esta, que idempotente ≠
**convergente** (pasada 2 verde y sin aplicar nada).

## El arreglo, y el matiz que lo hace correcto

No es "updatear siempre" — eso reintroduce el riesgo real que el comentario protegía. Es **separar
qué converge de qué se respeta**:

- `spec` (la intención declarada: cuándo dispara) → **converge**: comparar lo vivo contra lo deseado
  y sincronizar si difiere.
- `state` (la decisión operativa de un humano: pausado) → **se respeta**: un deploy no puede
  re-encender lo que alguien apagó a propósito.

Y la comparación necesita su propio cuidado: hay que comparar **el efecto** (¿a qué horas dispara?),
no los objetos crudos. `ScheduleRange(4)` deja `end=0`, y expandido ingenuamente da **vacío** en vez
de `[4]` — el Schedule se reescribiría en cada deploy sin que nada lo delate.

## La pregunta que lo caza

Frente a cualquier `ensure_*` / `provision_*` / `create-if-not-exists`:

> **Si mañana cambio el valor que este script declara, ¿el recurso vivo cambia?**

Si la respuesta es "sólo si lo borro a mano primero", el script no provisiona: **crea una vez y
después miente**. Y el que va a creerle es el que despliegue el cambio, no el que escribió el script.

## Hermanas

- [[provisionado-no-reconstruye-la-base-desde-cero]] — idempotente ≠ reproducible. Misma familia.
- [[instrumento-que-no-mira-nunca-falla]] — el silencio de algo que no miró se lee verde.
- [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] — el fallo que se disfraza de operación normal.
- [[cero-deuda-no-gestionada]] — el comentario documentaba la mitad de una decisión y nadie pagó la otra.
