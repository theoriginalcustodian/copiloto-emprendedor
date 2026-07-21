# HALLAZGO → sesión BACKEND · El alta ARCA falló hace 5 minutos y el progreso sigue diciendo "en curso"

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Prioridad: alta.** El operador acaba de hacer el alta desde el teléfono y quedó esperando una
> pantalla que nunca le iba a responder. No es un bug de la app: el `progreso` del workflow miente.

---

## Lo que pasó, con el control corrido

El operador cargó su clave fiscal en la app. La pantalla quedó en *"puede demorar unos minutos"* y
siguió poleando `GET /afip/estado` durante más de cinco minutos. Fui a Temporal, no a la pantalla:

```
WF  afip-onboarding-19af5a42-8fab-4a6f-ab3f-48703f12368d-20269996065
STATUS        : 3 (FAILED)
start / close : 17:50:42 → 17:50:47   (5,7 segundos)
QUERY progreso: {'paso': 'dando_de_alta', 'terminado': False, 'ok': False, 'motivo': None}
```

Causa del fallo, del history:

```
activity_task_failed: falló la generación del certificado:
  {"status":"error","data":{"message":"Clave o usuario incorrecto"}}
```

**El workflow está muerto hace cinco minutos y su propia query dice que sigue trabajando.**

---

## Por qué (creo que es de una línea)

`dar_de_alta_afip` corre con `SIN_REINTENTO` y **lanza** `ErrorAfip` en vez de devolver
`{"ok": False}`. El `run()` sólo setea `_paso = "fallido"` en la rama `if not alta.get("ok")` — como la
activity levantó excepción, `execute_activity` propagó, el workflow murió por `ActivityError` y **nunca
llegó a esa línea**. El objeto quedó congelado en `dando_de_alta` con `terminado: False`, y así lo
sirve la query para siempre.

`consultar_onboarding` tampoco lo compensa: hace `handle.query("progreso")` y devuelve el dict tal
cual. Una ejecución FAILED responde queries igual — devuelve el último estado del replay. El
`describe().status` **sí** dice FAILED; nadie lo mira.

Dos arreglos posibles, no excluyentes:

1. En el workflow: envolver el `execute_activity` en `try/except ActivityError` → `_paso = "fallido"`,
   `_motivo = <mensaje sanitizado>`, y devolver `progreso()` en vez de propagar.
2. En `consultar_onboarding`: leer `describe()` y, si el status no es RUNNING, forzar
   `terminado: True` + `paso: "fallido"` con el motivo de la falla. Esto además cubre cualquier otra
   muerte del workflow (timeout, terminate, cancel).

El (2) es el que hace el estado **honesto por construcción**: no depende de que cada camino de error
se acuerde de setear el paso.

---

## Por qué esto importa más que el bug puntual

El docstring de `AfipOnboardingWorkflow` dice —textual— que el diferencial contra el competidor es que
acá *"el progreso es estado real consultable"*, contra los tres mensajes sin ETA de Facturitas. En el
camino feliz es cierto. **En el camino de error el nuestro es peor que el del competidor:** ellos
repiten un mensaje inútil, nosotros mostramos uno que además es falso, y el usuario espera indefinido
por algo que ya murió.

Es la misma forma de los dos bugs de ayer: *un dato que llega en dos tiempos y un lector que asume
uno solo*. Acá el segundo tiempo (la muerte del workflow) directamente nunca se escribe.

---

## Lo que hago de mi lado

Mi pantalla ya renderiza `paso === 'fallido'` con su motivo —está construida y testeada—, así que
**en cuanto ustedes manden `terminado: true` la app lo muestra sin cambios**. Lo verifiqué contra el
código, no lo supongo.

Lo que sí es mío y estoy arreglando: el campo de clave fiscal **no tiene forma de ver lo que se
escribe**. La clave del operador son 15 caracteres con mayúsculas y símbolos, tipeados a ciegas en un
teclado de teléfono. Sumado a que el error nunca aparecía, el usuario no tenía ninguna señal de qué
estaba mal. Le agrego el toggle mostrar/ocultar.

---

## Un riesgo que quiero dejar por escrito

**No reintentar a ciegas.** ARCA bloquea la clave fiscal tras varios intentos fallidos consecutivos
`[ASSUMED_PENDING_VERIFY]` — no lo verifiqué contra normativa, y no me parece algo para verificar
empíricamente a costa de la clave del operador. Si ustedes tienen el dato firme, díganmelo y lo pongo
en el copy de la pantalla: *"te quedan N intentos"* es información que el usuario necesita ANTES de
tipear, no después.

El tenant quedó intacto, por si hacía falta confirmarlo: `afip_credentials` conserva el certificado
`dev` activo (16:11) y `afip_perfil` está completo. El alta fallida no rompió nada y
`puede_facturar` sigue verdadero. La clave tampoco quedó: `afip_secret_handoff` no tiene filas para
ese tenant.
