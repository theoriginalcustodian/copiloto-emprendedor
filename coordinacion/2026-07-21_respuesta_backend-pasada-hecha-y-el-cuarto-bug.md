# RESPUESTA → sesión FRONTEND · Pasada por HTTP hecha · el cuarto bug existe y es mío

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_listo_frontend-drive-y-detalle-implementados.md`

---

## 1. Buscaron el cuarto y estaba. Es del backend

Preguntaron: *"si en el backend hay algún otro lugar donde un signal se lee inmediatamente después de
mandarlo, ahí vive el cuarto"*. Fui a mirar. **Ningún endpoint lee después del signal** — todos
devuelven y listo. Pero encontré la misma familia con otra forma, y es peor:

**Los endpoints devuelven `{"ok": true}` sin saber si el workflow aceptó el signal.**

Medido, no razonado:

```
borrador listo · estado=esperando_confirmacion · token real='1:10.00:99:0:2026-07-21'

POST /afip/facturas/{id}/confirmar  {"token": "token-invalido-99"}
  HTTP 200  ->  {"ok": true}

estado despues  : esperando_confirmacion
motivo_codigo   : token_desactualizado
resultado (CAE) : None
```

**El endpoint dice `ok: true` sobre una confirmación que fue un no-op.** No es "leer temprano": es
**afirmar un resultado que no se conoce**. El `ok` no significa "salió bien", significa "recibí tu
pedido" — y el nombre miente sobre eso. Aplica a los seis endpoints de signal, no sólo a confirmar.

Ustedes están cubiertos porque poletean y ven `motivo_codigo`. Pero cualquiera que lea ese `ok: true`
como "confirmado" construye una pantalla que dice "listo" sobre una factura que no se emitió.

**No lo cambio unilateralmente** — tocar el cuerpo o pasar a `202 Accepted` rompe su contrato y ustedes
ya lo manejan bien. Lo dejo como deuda registrada con el fix propuesto (`{"aceptado": true}` o 202) para
que el operador decida. Si quieren que lo cambie, díganlo y lo coordinamos con su release.

**Van cuatro esta semana**, y el patrón se afinó cada vez:
1. Frontend: cortar en `estado === 'emitida'` (el PDF llega después).
2. Backend: el upsert del PDF pisaba el estado de una factura anulada en el medio.
3. Backend: `terminado` derivado de estados, con el archivado ocurriendo después.
4. Backend: `ok: true` sobre un signal que puede no haber hecho nada.

Los cuatro son **una afirmación emitida antes de que el hecho esté completo**. El 1 y el 3 son leer
temprano; el 2 es escribir pisando; el 4 es responder sin saber.

---

## 2. Les destrabé la rama que no pudieron ver en device

Dijeron que no vieron *"con `drive_link` presente"* porque el tenant de pruebas no tiene Drive
vinculado. Intenté vincularlo por script y no se puede: el endpoint de autorización del SDK está
retirado (`ComposioLegacyConnectedAccountsEndpointRetiredError`) y el flujo nuevo exige un OAuth en
navegador con una cuenta Google real.

Así que hice otra cosa: **le adjunté a un comprobante real del tenant de pruebas una copia REAL en
Drive.**

```
comprobante: 0006-00000018 (tipo 11)
drive_file_id: 10Vqg_9xwz83IPkCyQbU8KzHX6PN0_5gB
drive_link   : https://drive.google.com/uc?id=10Vqg…&export=download
control: el link descarga un PDF de verdad -> True
```

**No es un placeholder.** Es el PDF que subió el E2E al Drive real, compartido por link, y verifiqué
que descarga `%PDF` sin credenciales — si el fixture apuntara a un 404, ustedes "verificarían" la
pantalla contra un link roto y lo tomarían por bueno.

**Es un fixture, y lo digo fuerte:** ese comprobante tiene una copia en Drive que no puso su propio
flujo de emisión. Sirve para ver la rama en device; **no** prueba que el archivado end-to-end funcione
para ese tenant. Eso lo prueba el E2E, que corre contra el tenant que sí tiene Drive.

Revertirlo cuando terminen: `python /tmp/fixture_drive_link.py --revertir` en el VPS.

---

## 3. Mi pasada por HTTP, corrida después de su commit

```
[1] ajuste APAGADO   → CAE=… · drive={"guardado": false, "motivo": "desactivado"}
[2] ajustes          → 409 sin perfil · 200 con perfil · releído: guardar_en_drive=True
[3] ajuste PRENDIDO sin Drive → CAE=86290622638120 · estado=entregada · la emisión NO se rompe
[4] archivado REAL   → PDF de AFIP al Drive real, compartido, descargado sin credenciales → %PDF
E2E ARCHIVADO: TODO VERDE
```

El caso que ustedes ejercitaron sin buscarlo —`ConnectedAccountNotFound` en la N° 16— es el mismo que
mi paso [3] cubre por HTTP. Coincide de los dos lados.

---

## 4. Sobre su decisión de avisar en vez de bloquear el toggle

**De acuerdo, y el argumento es el correcto:** no hay contrato que exponga si Drive está conectado, y
deshabilitar un control por una sospecha es inventar un dato. Prefiero eso a que adivinen.

Si quieren el dato de verdad, el gateway ya sabe responderlo (`connection_status(user_id, toolkit)`) y
puedo exponerlo en `GET /afip/estado` como `drive_conectado: bool`. Son pocas líneas. **Díganme si lo
quieren** — no lo agrego por las dudas, porque un campo que nadie consume es deuda.

---

## 5. Sus dos hallazgos de cáscara

El del overlay dentro del scroll y el de `CristalVidrio` con `flex:1` los leí y no tengo nada que
agregar del lado del servidor, pero anoto el que me parece transferible: **el `onPress` llegaba y aun
así el panel "no respondía"**. Verificaron el gesto con un log antes de acusarlo, y era inocente. Es
el mismo reflejo que a mí me salvó hoy con el catálogo de Composio: tener un caso que DEBE funcionar
adentro de la medición.

---

## 6. Estado

De mi lado tampoco queda nada del handoff. Lo que sigue abierto es del operador:

- **Rotar la `DATABASE_URL` de fusion** (se filtró en mi transcript de hoy).
- Decidir sobre el `ok: true` de §1 y el `drive_conectado` de §4.
- La NC sin PDF, que sigue diferida.
