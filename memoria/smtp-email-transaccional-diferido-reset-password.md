---
name: smtp-email-transaccional-diferido-reset-password
description: reset password (2.b) y email transaccional (2.c) del sprint BETA quedan diferidos por decisión del operador — mismo patrón que los backups
metadata:
  type: project
---

**BETA-2.b (reset password) y BETA-2.c (email transaccional) quedan diferidos** — decisión del
operador, 2026-08-04: *"deja diferido lo de la config de email... luego lo haremos más adelante
igual que backups"*.

## Estado técnico verificado (no cambia, sólo se pospone la acción)

- GoTrue dedicada (`copiloto-auth`) corre con `GOTRUE_MAILER_AUTOCONFIRM=true` — sin SMTP configurado,
  el alta autoconfirma sin email. Ver `deploy/copiloto/gotrue/docker-compose.gotrue.yml:69`.
- No hay **credenciales** SMTP en el repo/VPS (grep negativo en `.env*`, `requirements.txt`, memoria).
  Pero **sí hay un slot cableado** — ver el punto siguiente. Hasta 2026-10-12 esta línea decía
  «no hay ningún proveedor SMTP decidido», que contradecía al punto de abajo en el mismo archivo.
- **Corrección misma sesión:** el operador primero eligió Resend, después pidió dejar el SLOT listo
  para **Gmail SMTP** (cuenta dedicada del copiloto + app-password) en su lugar — ya cableado en
  `deploy/copiloto/gotrue/docker-compose.gotrue.yml` y `.env.gotrue.template`
  (`GOTRUE_SMTP_HOST=smtp.gmail.com:587`, user/pass vacíos). Al retomar: sólo falta crear la cuenta
  Gmail dedicada, generar el app-password en `myaccount.google.com/apppasswords`, cargar
  `GOTRUE_SMTP_USER`/`GOTRUE_SMTP_PASS`/`GOTRUE_SMTP_ADMIN_EMAIL` y flipear
  `GOTRUE_MAILER_AUTOCONFIRM=false`.
  ⚠️ **Este párrafo es de 2026-08-04 y NO es la última palabra**: hasta 2026-10-12 cerraba con
  «no hace falta volver a decidir el proveedor», y el operador SÍ volvió a decidir ese día. El
  proveedor vigente está en «Cómo aplicar», abajo — **un solo lugar manda, y es ese**.
- El arquetipo `notification_dispatch` que el brief propone reutilizar **no existe vendorizado en
  este repo** (era de la fábrica `unreal-copilot`, no se portó en la graduación) — al retomar, revisar
  primero si conviene portarlo o implementar directo sobre Resend (SDK simple, no justifica el
  arquetipo completo para un solo canal).

## Cómo aplicar

- **No re-investigar el estado de GoTrue/SMTP** — ya está documentado arriba, sigue siendo cierto
  hasta que alguien lo cablee.
- **Propietario cuando se active:** backend.
- **Condición de activación:** orden explícita del operador (mismo patrón que
  [[backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida]] — probablemente atada a tener
  usuarios reales, no confirmado literal).
- **Proveedor — decisión VIGENTE (operador, 2026-10-12):** *«podemos usar resend ahora pero nuestra
  intención es tener nuestro propio smtp en un vps»*. O sea: **Resend como puente, SMTP propio como
  destino.** Y el dato que hace la decisión barata en los dos sentidos: **GoTrue habla SMTP PLANO, no
  la API de un proveedor**, así que cualquiera de los tres caminos son las MISMAS 4 vars
  (`GOTRUE_SMTP_HOST/USER/PASS/ADMIN_EMAIL`) y **cero código**. Mudarse después no es una migración.
- ⚠️ **Y el slot de Gmail SMTP YA está cableado** (`smtp.gmail.com:587`, user/pass vacíos): Resend
  **no** es el único puente sin código, sólo el elegido. Esto importa porque hasta 2026-10-12 este
  archivo afirmaba el proveedor en DOS lugares con DOS valores — arriba la corrección (Gmail), acá en
  la sección operativa el valor pre-corrección (Resend). Quien salta a «Cómo aplicar» — que es lo que
  hace un lector apurado — leía la versión vieja y no veía nunca la nota que la corrige:
  **documentar el cambio arriba deja vivo lo de abajo**, y el archivo no da síntoma de estar en
  conflicto consigo mismo. Ver [[documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo]].

Ver también [[cero-deuda-no-gestionada]] — deliberada + visible, no invisible ni impaga.
