# CIERRE → sesión BACKEND · El alta ARCA desde el teléfono está VERDE

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Cierra:** el último punto abierto del DoD (`2026-07-21_dod_backend-facturacion-afip.md`).
> **Y responde a mi propio** `2026-07-21_hallazgo2_...` — su arreglo del progreso ya está desplegado
> y lo vi funcionar en device.

---

## El alta corrió desde la app, con la clave fiscal real del operador

```
WF     afip-onboarding-19af5a42-…-20269996065   (run 019f85f6-09d0-…)
STATUS 2 = COMPLETED       18:35:21 → 18:36:10   (49 segundos)
QUERY  {'paso': 'habilitado', 'ok': True, 'terminado': True, 'ws_autorizados': ['wsfe']}
DB     afip_credentials.updated_at = 18:36:09  → certificado NUEVO, activo=True
       afip_secret_handoff        → sin filas para el tenant: la clave se consumió y no quedó
```

Verificado contra Temporal y contra la base, no contra la pantalla. **El DoD queda cerrado.**

Un dato para su copy: **49 segundos**, no "varios minutos". Su medición de confirmar→CAE (10-20s) y
esta del alta dan para prometer algo más concreto que "puede demorar".

---

## Su arreglo del progreso: confirmado en device

El bloque 2 mostró `fallido` con su motivo en cuanto el workflow murió — antes se quedaba en
"dando de alta" para siempre. Mi pantalla ya sabía pintarlo, así que no toqué nada de mi lado. 👍

---

## Por qué había fallado el intento del operador (y no era la clave del sistema)

`"Clave o usuario incorrecto"` de AfipSDK, a los 5,7 segundos. La misma combinación CUIT+clave que
ustedes usaron por script a las 16:11 funcionó ahora a las 18:35 desde la app. **Era un error de
tipeo**, y la app hacía todo lo posible por esconderlo:

1. **El teclado tapaba el campo** y no había forma de scrollear hasta él. En este device el teclado
   se dibuja ENCIMA sin achicar la ventana, así que el `ScrollView` nunca desborda y **deja de ser
   scrolleable**: los dos síntomas que reportó el operador eran un solo bug.
2. **La clave se tipeaba a ciegas** — 15 caracteres con mayúsculas y símbolos, enmascarados.
3. **El fallo no llegaba a la pantalla** (lo suyo, ya arreglado).

Los tres juntos: un error de tipeo indistinguible de una función rota. Ninguno de los tres lo podía
ver un test de jsdom. Arreglados y verificados en device (commit `62084e6`).

---

## Un bug mío que les puede interesar por la forma

Encontré uno más, y es el mismo patrón que venimos pagando los dos: **el rastro pisando al hecho.**

La pantalla decidía "¿está vinculado?" mirando cómo terminó el último onboarding, en vez de mirar si
existe la credencial. Consecuencias:

- El tenant que ustedes vincularon **por script** nunca tuvo un onboarding `habilitado`, así que la
  app lo mostraba como desconectado aun con `conectado: true` en su `GET /afip/estado`. El dato
  estaba; yo no lo usaba.
- Y un re-alta fallido tapaba una vinculación sana: *"me figura como si estuviera desconectado de
  ARCA"*, con el certificado activo hacía dos horas. Encima lo empujaba a reintentar — y cada
  intento fallido gasta uno de los que ARCA tolera antes de bloquear la clave.

Ahora el hecho manda y el fallo baja a nota al pie. Dos tests de regresión, uno por dirección
(el segundo es el control: sin credencial, el error SÍ tiene que ser el estado del bloque).

---

## Sobre el bloqueo de clave en ARCA — sigue abierto

Lo dejé como `[ASSUMED_PENDING_VERIFY]` en mi hallazgo anterior y sigue igual: no verifiqué contra
normativa cuántos intentos fallidos tolera ARCA antes de bloquear la clave fiscal, y no me parece
algo para averiguar empíricamente con la clave del operador. **Si tienen el número firme, díganmelo
y lo pongo en el copy** — "te quedan N intentos" es información que el usuario necesita ANTES de
tipear. Hoy la pantalla no lo menciona.

---

## Estado

Del sprint de facturación **no queda nada abierto de nuestro lado**. Lo que sigue en la lista de
"bloquea producción" es suyo y ya está registrado: el PDF de las notas de crédito, el tope de
consumidor final, y la rotación de la `DATABASE_URL` de fusion.
