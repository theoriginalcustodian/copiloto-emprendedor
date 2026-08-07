---
name: el-tipo-de-mensaje-decide-si-alguien-lo-persigue
description: Un pedido de trabajo enviado como `dato_` no lo escala ningún instrumento — el prefijo no es etiqueta, es a qué cola entra
metadata:
  type: feedback
---

# El TIPO de mensaje decide si alguien lo persigue — `dato_` no escala nunca

Le pedí a backend un paso concreto de trabajo (correr el ciclo del reintento para cerrar CONS8) y lo
mandé como **`dato_`**. Backend quedó **43 minutos girando en vacío** —transcript fresco, sin mutar
nada— esperando mi `cierre_`, mientras yo esperaba su corrida. Espera mutua de manual, con los dos
lados actuando correctamente.

**La causa no fue el contenido: fue el prefijo.** `escaladores-buzon.sh:11` sólo persigue
`contrato_`, `pedido_` y `urgente_`. Un `dato_` viejo y sin responder **no dispara nada, nunca** — ni
alarma, ni `urgente_` derivado, ni deudor nombrado. Le pedí trabajo con el único tipo de mensaje que
ningún instrumento reclama.

**Por qué rinde.** El prefijo se siente como una **etiqueta descriptiva** —"esto es un dato, esto es
un pedido"— y por eso se elige por el tono del contenido. Pero no describe: **decide a qué cola entra
el archivo**. Un mismo texto, con dos prefijos, tiene dos destinos distintos: uno se persigue hasta
que alguien lo tome, el otro se archiva por TTL sin que nadie note que pedía algo. Y el fallo es
**silencioso en las dos puntas**: el emisor ve su mensaje entregado, el receptor no ve ninguna
alarma, y ningún gate protesta. Sólo aparece como ocio en la otra sesión — atribuido a ella, no al
mensaje.

**Peor todavía:** el error se cubre a sí mismo. Como el destinatario está *esperando algo mío*, su
quietud parece obediencia al protocolo, no un mensaje perdido. Fue `no-ocio-check` (🌀 GIRA EN VACÍO)
el que lo delató, no el buzón.

**La regla, corta:** *si querés que alguien HAGA algo, va como `pedido_` o `contrato_`. `dato_` es
para informar, y el buzón no lo persigue.* Antes de mandar, la pregunta no es "¿qué es esto?" sino
**"¿quiero que un instrumento le reclame esto a alguien si no lo toma?"**. Si la respuesta es sí, el
prefijo ya está decidido.

Hermana de [[mensaje-entregado-donde-nadie-mira]]: aquélla es el mensaje que llega a un lugar que
nadie lee; ésta es el que llega al lugar correcto **con la etiqueta que lo excluye de la cola**.
Y de [[trabajar-en-un-pedido-lo-silencia]], que también vive en la costura entre el mensaje y el
instrumento que lo vigila.
