---
name: entrega-progresiva-y-e2e-en-device
description: "Instruccion del operador (2026-07-21): PR + merge + deploy POR HITO, sin acumular; y nada se declara terminado sin haber funcionado desde el telefono contra el vivo. Un hito no esta cerrado hasta que esta desplegado. LEER al planificar un sprint o al declarar algo listo."
metadata:
  node_type: memory
  type: feedback
---

**Instrucción directa del operador, 2026-07-21.** Aplica a las tres sesiones y a todo frente.

## 1. PR → merge → deploy, por hito. No acumular.

Nada de juntar tres hitos para un PR grande, ni de dejar código terminado sin desplegar esperando el
final del sprint.

**Por qué es regla y no preferencia:**
- **Un PR de tres hitos no se revisa: se aprueba.** El volumen convierte la revisión en trámite.
- **Código terminado sin desplegar es código NO verificado.** El DoD de este repo exige el servicio
  vivo, no el archivo escrito. Acumular no adelanta el cierre: lo posterga y esconde qué parte falla.
- **Con un hito desplegado, la causa de una rotura es obvia; con tres, hay que bisecar.**

**Corolario operativo que cambió cómo se coordina:** un hito **no está cerrado hasta que está
desplegado**, y el `avance_` que lo anuncia sale **después** del deploy. Ese `avance_` es el
disparador con el que la otra sesión cablea — anunciarlo antes es anunciar algo que todavía no existe.
*(Backend reconoció estar incumpliéndolo el mismo día: el punto de encuentro de Gastos estaba
desplegado pero vivía en un commit de rama sin PR.)*

## 2. 📱 Terminado = funcionó desde el teléfono, no «la suite está verde»

Suite verde y endpoint respondiendo son **necesarias y no suficientes**. Este repo tiene el catálogo:
**8 casos de facturación AFIP que sólo aparecieron contra el sistema real o en device**, uno de los
cuales costó una factura de verdad.

Dos niveles, y hacen falta **los dos**:

1. **Cada sesión verifica su capa por HTTP público contra el vivo** — el mismo endpoint que consume el
   teléfono. No `localhost`, y no un test que llame al handler directo: en un test el **routing no
   participa**, así que un test verde es compatible con la ruta rota.
2. **La corrida en device cierra el sprint**, con evidencia. Sin ella el frente no se cierra.

**Y el nivel 1 sólo vale si el control puede dar NEGATIVO** (aporte de backend, de su propio tropiezo
con el `200` del SPA): todo chequeo por HTTP lleva su sonda que **tiene que fallar** —ruta inexistente
→ 405, `sub` inventado → 403—. Sin eso, *«verifiqué contra el vivo»* es una frase, no una medición.

**Límite declarado, no inventado resuelto:** el operador pidió que **backend** pruebe desde el
teléfono, pero el device es de FRONTEND según la matriz de dueños. Backend cumple el nivel 1; la
corrida en device la hace quien tiene el aparato. **Lo que no se admite es que no la haga nadie.**

## 3. Los E2E automáticos no corren contra el tenant del operador

Medido el 2026-07-21: el E2E de frontend autenticaba con **el mismo `sub` con el que entra el
teléfono** y le dejó un gasto de prueba que era **el único del mes** — o sea, el total que la pantalla
de resumen le iba a mostrar como suyo era un dato inventado, justo donde el producto promete verdad.
Es [[copiloto-tests-ensuciaban-la-base]] otra vez. **Tenant de prueba provisionado** (resuelto el
mismo día por backend) **o barrido acotado a la ventana de la corrida.**

[[no-codificar-la-esperanza-principio-raiz]] [[cierre-del-aprendizaje-no-opcional]]
[[coordinacion-tres-sesiones-buzon]]
