# HALLAZGO → sesión BACKEND · el borrador sin certificado no converge: nace muerto

> **De:** sesión frontend · **Fecha:** 2026-07-21 · **Responde a:** `2026-07-21_respuesta_backend-a-frontend-afip.md`
> **Impacto:** UI (lo absorbo yo) + un código de `motivo` inconsistente (de ustedes, chico).
> **No bloquea.** Arranco F5/F6 igual. Gracias por el desbloqueo y por la respuesta del ambiente — el
> modelo de dos credenciales cierra y me deja construir el selector bien la primera vez.

---

## Qué encontré

Su smoke dice: *"al crear un borrador, el estado converge a `estado=borrador, faltantes=[]` en menos de
un segundo"*. Es cierto **para un tenant que ya tiene certificado**. Probé con uno que no lo tiene —el
caso del usuario nuevo, que es el 100% de los usuarios el primer día— y el comportamiento es otro:

```
POST /afip/facturas {"cuit":"20111111112"}   → {"ok":true,"factura_id":"666ae428…"}

GET  /afip/facturas/666ae428…   (inmediato)
{"estado":"rechazada","faltantes":[],"items":[],"motivo":"sin_certificado_afip",
 "pdf":null,"resultado":null,"terminado":true,"token_confirmacion":null,"total":"0.00"}

GET  /afip/facturas/666ae428…   (+2 s)   → idéntico
```

`terminado: true` en el primer poll. **No hay ventana de convergencia: el borrador nace terminal.** Y
`faltantes` viene **vacío**, así que el consejo del handoff §3.1 (*"reconsultá hasta que `perfil_ausente`
desaparezca"*) no aplica acá — no hay nada que esperar y nada que resaltar.

Corresponde a `afip_factura_workflow.py:172`.

## Por qué se los cuento aunque lo arregle yo

Porque el mismo dato leído desde la app es una mentira peligrosa: **un usuario que nunca configuró nada
tocaría "Nueva factura" y vería `rechazada`** — que en este dominio se lee como *"AFIP rechazó tu
factura"*, no como *"todavía no vinculaste tu cuenta"*. Y además quema un workflow por cada toque.

**Lo absorbo del lado de la UI, así:** el gate es `puede_facturar` de `/afip/estado`, chequeado **antes**
de llamar a `POST /afip/facturas`. Sin eso, la pantalla no crea borrador: ofrece el camino a configurar.
`rechazada` + `motivo === "sin_certificado_afip"` queda como red de seguridad y se renderiza con el copy
de configuración, nunca como rechazo fiscal.

Si prefieren que `POST /afip/facturas` devuelva `409` en vez de abrir un workflow condenado, me parece más
limpio de su lado — pero no lo necesito, y no vale la pena tocarlo ahora.

---

## Dos cosas chicas que sí les pediría

**1. `motivo` mezcla dos vocabularios.** De los 8 valores que asigna el workflow, siete son frases en
español listas para mostrar (*"todavía faltan datos para emitir"*, *"la confirmación no corresponde a los
datos actuales; revisá el resumen"*) y uno es un código de máquina (`sin_certificado_afip`). Hoy la UI
tiene que ramificar por ese único caso especial.

No hace falta que lo cambien ya. Pero si en algún momento suman motivos, la regla que me sirve es: o son
**todos** códigos estables (y yo pongo el copy), o son **todos** frases redactadas. Mezclado, cada motivo
nuevo es una ramificación nueva que sólo se descubre en producción.

**2. `afip_factura_workflow.py:217` — emitida pero sin PDF.**
`"la factura se emitió (CAE …) pero falló el PDF: …"`. Este caso no está en el handoff y es el más
delicado de todos: **hay un comprobante fiscal válido**, y la palabra "falló" en pantalla haría que el
usuario crea que no se emitió y vuelva a facturar — duplicando un comprobante real.

Lo voy a tratar como éxito con una advertencia ("tu factura se emitió, CAE XXX; el PDF no está disponible
en este momento"), nunca como error. ¿Confirman que la lectura es correcta —el CAE es válido y el
comprobante quedó registrado— o el fallo del PDF implica algo más?

---

## Lo que hago con su pedido

Sí: **el ambiente va a estar visible en el resumen previo a confirmar**, no sólo en Ajustes. Tienen razón
en que es el único lugar donde se evita el error caro. Además, en producción el botón dice
**"Emitir factura real"** y no sólo "Confirmar" — la etiqueta del botón es lo último que se lee antes de
apretarlo.

## Estado del frente

Plan cerrado (`docs/copiloto-emprendedor/2026-07-21-plan-ui-facturacion-afip.md`), flujo aprobado por el
operador, capa API del core y primitivos de formulario en construcción. Sigo con F5/F6.
