---
name: adversario-e2e-con-email-estatico-y-password-random-se-rompe-en-el-rerun
description: Un script E2E que provisiona un tenant adversario con email fijo y password random falla su login en la SEGUNDA corrida, no en la primera
metadata:
  type: project
---

# 🔁🧪 El adversario E2E con email fijo se rompe solo — pero no en la primera corrida

**2026-09-23**, escribiendo `scripts/e2e_bl_o6_legal_aceptacion.py` (E2E de BL-O6 contra prod real,
caso hostil cross-tenant). Primer intento: `ADVERSARY_EMAIL` constante y `ADVERSARY_PASSWORD =
"prefijo-" + uuid4().hex[:N]` (random en cada corrida, para que gitleaks no lo confunda con un
secreto fijo). El script provisiona con `/auth/signup` y loguea con `/auth/login`.

**Corrida 1: VERDE.** `/auth/signup` crea el tenant y el usuario GoTrue con esa password random;
login entra con la misma password que acaba de generar. Nada delata el problema.

**Corrida 2: `/auth/login` da 401**, sin tocar el código. `/auth/signup` es idempotente **sobre el
tenant** (mismo email → mismo `cliente_id`, correcto y deseado — mismo criterio que
`restaurar-contrasena-e2e.py`), pero **no resetea el password de un usuario GoTrue que ya existe**.
La corrida 2 generó una password random NUEVA y trató de loguearse con ella contra un usuario cuya
password real es la de la corrida 1. El login falla legítimamente — el bug no es del servidor, es
del script: le pide dos cosas incompatibles a la misma identidad.

## Por qué no se ve en la primera corrida

Es la firma clásica de [[idempotencia-con-un-if-tiene-ventana]]: el defecto vive en la relación entre
dos llamadas, no en ninguna de las dos por separado. Un E2E que se corre una sola vez y se declara
verde nunca lo encuentra — hace falta correrlo dos veces seguidas, que es exactamente lo que un CI
que reintenta o una sesión que repite el comando para confirmar SÍ hace.

## El fix de raíz (no un reset de password aparte)

Generar `ADVERSARY_EMAIL` con un sufijo `uuid4()` **por corrida**, no sólo la password:

```python
ADVERSARY_EMAIL = f"e2e-adversary-bl-o6-{uuid.uuid4().hex[:12]}@copiloto.test"
ADVERSARY_PASSWORD = "testpass-" + uuid.uuid4().hex[:24]
```

Usuario y password nacen **juntos** en cada corrida — no hay identidad vieja con la que la password
nueva pueda desentonar. Elimina la clase de bug entera, no un síntoma: no hace falta ni detectar el
caso "ya existe" ni resetear nada.

## Deuda que queda (no de este PR)

`scripts/e2e_g6_adversarial_multitenant.py` (el molde que copié) usa el mismo patrón de
`ADVERSARY_EMAIL` **estático** — es candidato a la misma falla latente en su segunda corrida. No lo
toqué por estar fuera del alcance del `pedido_` que resolvía, pero cualquiera que lo corra dos veces
seguidas va a pisar exactamente esto.

Ver también [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]: ambos son E2E
contra prod real, y ambos esconden defectos que un mock nunca expone.
