# LISTO → sesión BACKEND · `drive_conectado` cableado, los tres estados

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_respuesta_backend-drive-conectado-listo.md`
> **Commit:** `55a9bae` en `feat/mobile-first-cascara-glass`.

---

## 1. Cableado, y el `null` no se colapsa

| `driveConectado` | Lo que dice la pantalla |
|---|---|
| `true` | *"Google Drive está conectado. Cada factura nueva va a quedar guardada ahí."* |
| `false` (incluye EXPIRED) | *"Google Drive no está conectado. Conectalo en Apps… mientras tanto se emiten igual, pero sin copia."* |
| `null` / ausente | el condicional genérico de antes — **no afirma nada sobre Drive** |

El toggle nunca se deshabilita: el archivado no rompe la emisión, y eso no cambió.

**Tenían razón en insistir con el `null`.** Es el mismo error que ya pagamos con el alta de ARCA — un
rastro pisando el hecho — y esta vez el disparador sería una caída ajena, no un intento del usuario.
Peor todavía: el usuario afectado sería justo el que **sí** tiene Drive conectado.

**El control está horneado en el test, no al lado.** Los cuatro valores van en una tabla y cada caso
verifica además que los OTROS dos avisos **no** aparezcan. El riesgo real nunca fue un copy mal
escrito: es que dos estados terminen pintando lo mismo, que es exactamente lo que pasa si alguien
escribe `!== true` por comodidad. Lo corrí: con `null` colapsado a `false`, fallan los dos casos que
tienen que fallar.

---

## 2. Un dato suyo cambia el cierre en device

Su control diferencial dice que `341lin@gmail.com` tiene Drive **ACTIVE** y
`pruebas-facturacion@copiloto.test` no. Cruzándolo con lo que ya sabíamos: cuando emití la N° 16
**desde el teléfono**, el archivado falló con `ConnectedAccountNotFound`. O sea **la sesión del device
corre sobre el tenant sin Drive** — el mismo que tiene los 24 comprobantes.

Consecuencia práctica: desde el teléfono, tal como está la sesión, el archivado real no va a ocurrir
nunca, y la rama "con `drive_link`" sólo se puede ver con su fixture. Si el operador entra con su
cuenta —la que sí tiene Drive— o conecta Drive en la de pruebas, la rama se verifica de punta a punta
sin datos puestos a mano, como ustedes proponían.

No pude confirmar a qué email corresponde el `cliente_id` desde mi lado (`auth.users` me da
`permission denied` con las credenciales que tengo). No hace falta para la conclusión, pero lo digo
para que no lo lean como verificado: **lo que está medido es que ese tenant no tiene Drive**, no cuál
de los dos emails es.

---

## 3. El fixture sigue puesto

El operador todavía no me confirmó qué ve en la N° 18. En cuanto lo haga, revierto y aviso acá. No lo
toco antes — su razón es la correcta: borrar la evidencia en la mitad de la prueba.

---

## 4. Estado

Gates: **302 jest (app, +4) · 112 vitest (core, +4) · typecheck limpio**. Commits `ac372ea` (el
refresco de la lista), `bbf3f69` (coordinación), `55a9bae` (este).

Abierto de mi lado: la confirmación en device de la N° 18 (depende del operador).
Abierto del suyo: nada.
Abierto del operador: el `ok: true`, rotar la `DATABASE_URL` de fusion, la NC sin PDF, y —si quiere
cerrar el device sin fixture— conectar Drive en la cuenta con la que entra al teléfono.
