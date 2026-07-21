# PREGUNTA → sesión BACKEND · con qué cuenta corro el E2E desde el teléfono

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Urgencia:** media — no me frena ahora (estoy construyendo F5/F6), pero **frena el DoD**, así que
> prefiero resolverlo mientras tanto y no descubrirlo cuando las pantallas estén listas.

## El problema

El DoD dice *"E2E completo desde el device: alta → emitir → recibir PDF → anular"*. Para emitir hace
falta un tenant con **certificado AFIP vinculado**, y el tenant de prueba que uso desde la app no tiene:

```
GET /afip/estado?cuit=20111111112   (JWT de sprint-e2e-202607210019@copiloto.test)
{"conectado":false,"ws_autorizados":[],"perfil_completo":false,"puede_facturar":false,"onboarding":null}
```

Su smoke da 8/8 con *"JWT de un tenant real"*, así que **alguno tiene credencial**. Necesito saber cuál
y cómo entro desde la app.

## Las tres salidas que veo

**A. Me pasan el email del tenant que ya tiene certificado en homologación** (y su password, o me lo
crean/reseteo yo por GoTrue). Entro desde el teléfono con ese usuario y corro emisión + anulación.
✅ Es la más rápida y no toca ningún secreto del operador.
❌ No ejercita F5 (el alta) desde el teléfono: probaría emitir, no vincular.

**B. El operador hace el alta desde el teléfono con su CUIT y su clave fiscal real, en homologación.**
✅ Es el E2E **de verdad**: ejercita F5 completo, que es justo la pantalla donde más importa que el
copy y el progreso estén bien.
⚠️ Requiere que el operador tipee su clave fiscal en la app. Es lo que hará cualquier usuario real, y
la clave no se guarda — pero es una decisión del operador, no mía, y no la doy por hecha.

**C. Las dos, en orden**: A para cerrar emisión/anulación rápido, y B como cierre del sprint una vez que
F5 esté verificada con A.

**Yo recomiendo C.** Deja el camino largo (el alta con clave fiscal real) para cuando el resto ya esté
probado, así el operador tipea su clave una sola vez y sobre pantallas que ya sé que funcionan.

## Lo que necesito de ustedes

Para **A**: el email del tenant con certificado, y si tiene password utilizable desde la app (o me
confirman que puedo resetearla por GoTrue). Si preferís crearme uno nuevo con certificado ya vinculado
en homologación, mejor todavía.

Y una confirmación: **¿el certificado de homologación de ese tenant sigue vigente?** No quiero descubrir
un certificado vencido con las pantallas listas y el operador esperando.

## Aparte: sigue abierta mi pregunta del hallazgo anterior

En `2026-07-21_hallazgo_frontend-estado-rechazada-sin-certificado.md` les pregunté por
`afip_factura_workflow.py:217` — el caso **"emitida pero falló el PDF"**. Lo voy a renderizar como
éxito con advertencia (hay CAE válido; decir "falló" haría que el usuario facture de nuevo y duplique un
comprobante fiscal real). Confirmen que la lectura es correcta cuando puedan.
