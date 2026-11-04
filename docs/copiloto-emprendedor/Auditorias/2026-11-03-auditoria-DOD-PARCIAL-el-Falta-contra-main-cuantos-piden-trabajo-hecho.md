# Auditoría — las 23 DOD-PARCIAL: ¿su `Falta:` sigue siendo cierto contra main?

- **Sesión:** auditoría.
- **Pedido:** `2026-11-04_pedido_planificacion-a-auditoria_las-23-DOD-PARCIAL-…` (buzón).
- **Medido @ `61adbe95`**, el 2026-11-03 entre las 21:19 y las 21:50 (hora local), sobre un worktree detached propio. Corpus y backlog leídos de ese sha.
- **Read-only, sin device.** No marca fichas: un `VENCIDO` lo escribe planificación con `sprint-estado.py` (DEC-18).

## Veredicto

| Veredicto | N | Ids |
|---|---|---|
| **FALTA VENCIDO** | **4** | SM-L4 · SM-N31 (completos) · SM-N41 · SM-Z4 (lo que piden de código/decisión está hecho; les queda el device) |
| FALTA VIGENTE | 19 | el resto, 12 de ellas dependen del teléfono o del operador |
| FALTA NO VERIFICABLE | **0** | ver «La clase que no apareció» |

Unidad: **ficha DOD-PARCIAL**. Vale si lo que su `Falta:` declara pendiente está o no en main @61adbe95. Que la ficha esté terminada es otra pregunta, y no se responde acá.

## Los cuatro vencidos (sha + hora de lo que lo venció)

| Ficha | Falta escrito | Lo que el Falta pide | Hecho en | Lo que queda |
|---|---|---|---|---|
| **SM-N31** | 03-11 14:53 | pasar las entradas 12 y 13 del corpus a CONFORME, midiendo la app | **`e8ed06fb`** 15:12 (#1548): «entradas 12 y 13 a CONFORME con la medición de device de frontend1». Medidor @61adbe95: `12=CONFORME`, `13=CONFORME` | nada. **Se venció 19 minutos después de escribirse** |
| **SM-L4** | 03-11 16:33 | «las 8 remediciones con su cita y su sha, y después re-correr el medidor» | 33/37/41 **`d96a5902`** 16:33 · 06/09/47 **`de7a9b6a`** 16:52 · 03 **`809cc1fa`** 17:10 · 17 **`ee639871`** 17:23. Medidor re-corrido por mí @61adbe95: **34 de 51 en condición** (el Falta cita 29, @a2ec0a02) | 8 de 8 re-medidas, y las que no cambiaron (06, 09, 47, 03) se re-midieron con su causa nombrada. 20 y 32 siguen declaradas por días de uso, como el DoD prevé |
| **SM-N41** | 03-11 14:34 | punto 2: la decisión del operador, legible o translúcido; punto 3: el alfa parametrizado donde ya vive | **`e213dd47`** 20:20 (#1585): «decisiones del operador, 2026-11-03 … SM-N41: `ALFA_BASE_CAMPO` .85 → .96 (parámetro existente, no hardcode)». @main: `Composer.tsx:302 const ALFA_BASE_CAMPO = 0.96`; la mutación .85 pone rojo a Composer | «se mira en las DOS pieles», device, que el commit deja `[ASSUMED_PENDING_VERIFY]` |
| **SM-Z4** | 03-11 17:44 | parte 2: la decisión sobre el color y, si es sí, el par logotipo con control positivo | **`e213dd47`** 20:20: el wordmark pasa a `COLOR_PALABRA_MARCA`, y el origen `logotipo` se da sólo con el hex exacto y un testID enumerado. @main: `PantallaLogin.tsx:150` | el tamaño real en pantalla, device (el Falta ya lo marcaba `[ASSUMED_PENDING_VERIFY]`) |

**La forma común de los cuatro: el trabajo que resuelve el Falta cita el id, en el título del commit o en el cuerpo, pero nadie vuelve a la ficha.**
- En N41 y Z4 el commit resolutivo nombra las dos fichas en su título y no toca el backlog.
- En N31 y L4 los commits `docs(corpus)` mueven el veredicto y la casilla queda pidiéndolo.

No es descuido de una sesión: es que el id circula en el commit y el **Falta** no tiene a nadie que lo re-mida. Es el mismo modo de falla que SM-J1 (`c9eb7983`), SM-H5 (`f1e17931`) y SM-N34, que se auto-corrigió.

## Los 19 vigentes

| Ficha | Por qué sigue vigente @61adbe95 |
|---|---|
| SM-H5 | El mockup `06-presupuestos` no se tocó (último commit `e791cf5e`, 02-11) y tiene 0 `50.000\|50,000`. La lectura D5 del prototipo está pendiente (frontend2) |
| SM-I4 | El punto (a) sigue en el código: `tokens.ts:664 bloque: p.esLight ? NEGRO_TOSTADO : CREMA`, así que en piel oscura el bloque es CREMA. `596ba4ca` (#1544) arregló las **casillas**, no el bloque. No juzgo si el crema es diseño: el Falta dice que es defecto y el código no cambió |
| SM-I6 · SM-L1 | El build de release va al final por orden del operador; no hay build. En L1 el instrumento da un falso candidato: `048a135b` `fix(corpus)` nombra SM-L1 de pasada (la entrada 42), sin tocar el build |
| SM-I7 | Device: la captura del sheet con los íconos. ⚠️ **La subcláusula «el deploy está FRENADO» probablemente venció**: `3e24e3bf` (#1557, el campo `icono`) es ancestro de `694a10ca`, que el Falta de SM-Z1 cita como desplegado. No lo verifiqué en el VPS |
| SM-J1 | `git grep -il "te deben"` sobre el prototipo da 0 archivos, y `buscar` en `mapa-pantallas/index.html` da 0. Control positivo: `"Mi d"` = 5. **Es el control negativo del pedido:** lo que el Falta nombra no existe en el árbol, y sale VIGENTE, no VENCIDO |
| SM-J3 · SM-J4 · SM-K2 · SM-K3 · SM-N25 · SM-N29 | Device (captura, tenencia o fps). El código que citan es ancestro (K3: `132ba958`; N25: `6335f883`/`fafd7cdb`). Depende del teléfono |
| SM-N13 | No hay conteo de pytest en el VPS en ningún commit ni en el buzón desde las 20:32 |
| SM-N19 | `git grep SM-N19 -- apps packages` da 0, con el control `SM-N5` = 2 archivos. Falta además la corrida con el paso CORREGIR |
| SM-N22 · SM-N38 | Que el operador lo vea. Depende del operador |
| SM-N32 · SM-N34 | La decisión del tope y el Calendar conectado, los dos del operador. No hay decisión escrita versionada después de las 20:32 |
| **SM-Z1** | **Control positivo del pedido, y lo devuelve como el caso límite que es:** el código `63b50b8a` (#1579) es ancestro, el instrumento lo lista como «sha reconocido» y **no** como candidato a vencido, y lo único pendiente es el clic de OAuth del operador. Es una carencia real, pero de un disparador humano |

## La clase que no apareció: NO VERIFICABLE = 0

Ninguna de las 23 pide un **acto sin huella**, como el «leer la skill» de SM-N40, que está TERMINADO y no entra en este conjunto. Lo más parecido es otra cosa:
- **SM-N22 y SM-N38** piden que **el operador mire**.
- Lo mismo pasó con SM-K5 y SM-L2, que cerraron así.

Eso sí deja huella, pero sólo como **testimonio escrito** de quien miró, nunca como medición. Por la regla del pedido son VIGENTE, porque dependen del operador. Lo dejo nombrado porque es la forma en que estas fichas cierran: **la evidencia es una cita de su palabra, con su límite declarado**, como hizo bien K5. Si un DoD futuro pide «que el operador lo vea», debería decir de antemano que la evidencia es esa cita.

## Instrumento

[`instrumentos/falta-vencido-candidatos.py`](instrumentos/falta-vencido-candidatos.py). Usa dos señales deterministas, sin LLM:
1. commits de main que nombran la ficha y son **posteriores** al commit que introdujo el texto actual del Falta, excluyendo `docs(sprint|memoria|auditoria|SM-XX)`, que hablan de la ficha sin cambiarla;
2. entradas del corpus que el Falta nombra y que hoy están en CONFORME o DIFERENTE · B. Para leerlas usa el regex `FILA` de `scripts/mapa-51-estado.py`, no uno propio.

**Medido @61adbe95:**
- **Candidatos:** 5. Reales, 4: L4, N31, N41 y Z4. Falso, 1: L1, por menciones de pasada.
- **Falso negativo, 1:** la subcláusula de I7, que el instrumento no ve porque es un efecto de deploy, no un commit que nombre la ficha.
- **Controles:**
  - Positivo: N31 por las dos señales, N41 y Z4 por la señal 1.
  - Caso límite: Z1, con su sha reconocido y sin candidato.
  - Negativo: J1, sin señal.
  - Ceguera: si el parser del corpus lee menos de 40 entradas, el instrumento sale con error. Disparó en mi primera versión, que usaba un parser propio, y por eso pasé a reusar `FILA`.

**Lo que no hace:** no da el veredicto. Un candidato se lee a mano, y un vigente no queda probado por la ausencia de señal: J1 es vigente porque lo medí en el árbol, no porque el instrumento callara.
