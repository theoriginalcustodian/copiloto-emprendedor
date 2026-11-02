---
name: sujeto-de-prueba-unico-no-encarna-el-estado-que-exige-el-control
description: Un usuario de prueba canónico y único hace INCAPTURABLE todo DoD que lo exija en un estado ajeno al suyo (otro rol, sesión inválida, tenant vacío, app sin conectar) — y eso no se ve al planificar, se ve con el teléfono en la mano
metadata:
  type: project
---

**Medido el 2026-11-02 en el sprint CORRECCIONES: cuatro fichas distintas, cuatro sesiones, un solo
motivo.** Cada una necesitaba al canónico `e2e-device@copiloto.test` en un estado que **excluye** a
los otros:

| Ficha | La captura | El estado que exige |
|---|---|---|
| `SM-H3` | la card de Gmail | **con Gmail conectado** (no lo tiene) |
| `SM-K6` | el aviso de «sesión caída» | **sesión invalidada server-side** (el JWT es stateless) |
| `SM-K1` | Homologación oculta para no-admin | **NO admin** (es admin) |
| `SM-J3` | «Sin ventas todavía» | **sin ventas** (tiene datos de prueba cargados) |

**La regla del canónico único es correcta y no hay que relajarla por esto** — existe porque dos
usuarios de prueba fabricaron evidencia contradictoria
([[usuario-de-prueba-canonico-uno-solo-a-fuego]], [[device-fisico-exige-dueno-unico]]). Lo que
faltaba escrito es su **costo**: **todo DoD que exija al sujeto en un estado ajeno al suyo es
incapturable por diseño**.

**Y el momento en que se descubre es lo caro.** No se ve al redactar la ficha: se ve **con el
teléfono en la mano**, cuando ya se reservó el device, se bajó Metro y se gastó la ventana. Las
cuatro aparecieron así, una por una, y el número subió de 1 a 4 en una tarde — o sea que no era una
ficha desafortunada, era una **clase** que nadie estaba contando.

**El gate, y es de planificación:** al redactar un DoD de device, preguntarse *¿qué estado del
sujeto exige esta captura, y es el estado que el sujeto TIENE?* Si la respuesta es otro rol, otra
sesión, otro tenant o otra app conectada, **el disparador no es «capturar»: es conseguir ese
estado**, y eso casi siempre es MAYOR (crear un usuario, conectar una credencial de terceros,
invalidar sesiones). Va al `Falta:` con dueño el operador **desde el principio**, no después del
viaje perdido.

**Lo que SÍ se acredita sin el estado ajeno, y conviene separarlo explícito:** en las cuatro, la
mitad difícil estaba medida —la elección de herramienta, el aviso presente con test, los chips con
el admin, el cero medido distinguido de un `null`—. Lo que faltaba era **el caso contrario**, que es
justo el que un solo sujeto no puede encarnar. Un `cierre_` que mezcla las dos mitades parece una
ficha a medias; separándolas se ve que falta un estado, no un mecanismo.

**La decisión de fondo queda abierta y es del operador:** un canónico único no alcanza para probar
controles que dependen del **rol** o del **estado de sesión**. Las dos formas son un segundo sujeto
con rol declarado, o fixtures server-side que pongan al canónico en el estado y lo restauren
verificando (como hizo frontend2 con el onboarding en `SM-K8`). Es una decisión sobre la regla, no
sobre cuatro fichas — mezclarla con el cierre del sprint es cómo un MAYOR entra disfrazado de
táctica.

→ [[una-orden-cerrada-exige-evidencia-de-device]] · [[gate-de-device-se-corre-con-receta-no-con-ventana-viva]]
