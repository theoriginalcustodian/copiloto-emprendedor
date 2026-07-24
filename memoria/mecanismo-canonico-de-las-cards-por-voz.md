---
name: mecanismo-canonico-de-las-cards-por-voz
description: El mecanismo único para TODA acción dictada (gasto, ingreso, cliente, factura) — nunca se pregunta dos veces; lo que separa modo confirmación de automático es SÓLO el caso completo
metadata:
  type: project
---

Fijado por el operador el 2026-07-24. **Aplica a todas las acciones por voz: gasto · ingreso · cliente ·
factura (hito 9).** El camino **incompleto es idéntico en los dos modos**; lo único que los separa es el
caso completo.

| Turno | **CONFIRMACIÓN** (default hoy) | **AUTOMÁTICO** (se gana) |
|---|---|---|
| Dictado **completo** | **CARD** editable → el usuario revisa y Guarda → recién ahí persiste | **EJECUTA directo**; el copiloto **dice el monto en voz alta** (ahí se oye el error) y deshacer es barato |
| Incompleto (1ª vez) | Pregunta **una sola vez**, sólo por lo que falta | *(idéntico)* |
| Sigue incompleto (2ª) | **CARD** prefilled → se termina a mano | *(idéntico)* |

**Las dos reglas duras:**
1. **Nunca se pregunta dos veces.** A la segunda orden incompleta manda la card; no se insiste.
2. **Card en pantalla ≠ dato guardado.** Prohibido "anoté/listo/guardado" con la card visible
   ([[copiloto-narra-la-accion-sin-ejecutarla]]).

**Hoy el selector es read-only → el modo es siempre CONFIRMACIÓN → siempre card.** La rama
`persist-direct` sólo es reachable con `modo == automático`. El "guardar-primero" del addendum §2.bis
(que el operador revirtió para ingreso) **no se borró: es exactamente el comportamiento del modo
automático**.

**Por qué quedó registrado.** El operador enunció el mecanismo dos veces con palabras distintas — *"card
editable siempre, las cards son para todo"* y después *"si dictó todos los datos se ejecuta
directamente"*. **Las dos lecturas eran razonables y producían CÓDIGO DISTINTO**, con backend ya
implementando la primera. Confirmarlo costó 3 minutos (un `urgente_` de pausa + una pregunta cerrada);
descubrirlo en el PR habría costado un ciclo entero. La resolución fue que **ninguna de las dos estaba
mal: eran los dos modos**. Hermana de [[verificar-que-el-camino-recomendado-existe]] — la costura es de
planificación, y una ambigüedad de contrato se resuelve preguntando, no eligiendo.

⚠️ **La factura tiene un problema aparte que esto NO resuelve:** su flujo es un workflow durable de 8
pasos con estado server-side y token de confirmación, no un dict que la card reenvía. El **mecanismo de
interacción** es esta tabla; **cómo se implementa sobre ese flujo** es trabajo del contrato de hito 9.
Ver el `hallazgo_` del terreno de hito 9.
