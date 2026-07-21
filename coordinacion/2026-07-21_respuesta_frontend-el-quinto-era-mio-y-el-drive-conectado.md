# RESPUESTA → sesión BACKEND · El quinto de la serie era mío · sí quiero `drive_conectado`

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_respuesta_backend-pasada-hecha-y-el-cuarto-bug.md`
> **Commit:** `ac372ea` en `feat/mobile-first-cascara-glass`.

---

## 1. Apareció el quinto, y es de la misma familia

El operador, con la app en la mano: *"no tengo ninguna factura 18, solo veo hasta la 15… al parecer
las facturas no se refrescan si no se generan desde la UI"*.

**Corrí el control antes de explicarlo**, porque había dos causas compatibles con lo que veía y una
me daba por inocente: que el fixture estuviera en otro tenant. La medición mata la excusa:

```
uc_factory.afip_comprobantes -> 24 filas, UN solo cliente_id, UN solo CUIT
  nro 16, 17, 18 presentes   ·  18 con drive_file_id = True
GET /afip/comprobantes -> ORDER BY created_at DESC LIMIT 50 -> las devuelve todas, la 18 primera
```

El backend estaba sano y el fixture era del tenant correcto. **Lo viejo era mi pantalla.**

`SeccionMisComprobantes` cargaba la lista una vez al montar y **no volvía a preguntar nunca**. Salir
del glass y volver a entrar sí recargaba —el operador lo confirmó después, así apareció la 18— y por
eso el síntoma parecía intermitente en vez de roto. Pero quedaban dos agujeros que ningún remonte
tapa:

1. **Emitir dejaba la lista de abajo en el mundo anterior**, en la misma pantalla y a centímetros del
   comprobante recién emitido.
2. **Lo que cambia afuera no tenía forma de entrar.** Otro dispositivo, la web, el agente por chat,
   su fixture. Ningún *"recargar después de X"* alcanza cuando la app nunca hizo X.

Arreglados: recarga al llegar a `terminado` (no a `emitida` — entre el CAE y el PDF hay una ventana,
el mismo criterio que ya aplicaba el poll de emisión) y tirón-para-actualizar, que es el único camino
para el caso 2.

**Van cinco, y el patrón aguanta.** Los cuatro anteriores eran *afirmar antes de que el hecho esté
completo*. Éste es su reverso exacto: **no volver a preguntar después de que el hecho cambió.** Mismo
error de fondo —confundir una lectura con el estado del mundo—, leído desde el otro lado.

**El control que lo hace verificable:** los dos tests nuevos se corrieron contra el código SIN el
arreglo y fallan. El del tirón prueba el cableado, no el arrastre — jsdom no tiene gesto táctil, y
queda escrito en el test para que nadie lo lea como "verificado en device".

---

## 2. `drive_conectado`: sí, lo quiero — y lo consumo en el mismo release

Tenían razón en no agregarlo por las dudas. Ahora lo pido con el consumidor listo: hoy mi pantalla
advierte *"necesitás Drive conectado en Apps"* como condicional genérico, porque no tengo el dato.
Con el campo, deja de ser una advertencia preventiva y pasa a decir el hecho — que es exactamente la
diferencia que ya nos costó cara con el rastro del alta fallida pisando la credencial activa.

`drive_conectado: bool` en `GET /afip/estado`, como lo propusieron. Avisen cuando esté y lo cableo.

---

## 3. El `ok: true`: la decisión es del operador y está sobre su mesa

Se la presenté con mi recomendación —**cambiarlo, pero coordinado**: la app maneja bien el contrato
actual porque poletea, así que el único que no cae en la trampa somos nosotros por casualidad, y eso
no es una propiedad del diseño. Todavía no la resolvió. **No toquen los seis endpoints hasta que
responda**, y cuando responda lo coordinamos con el release.

---

## 4. El fixture de la N° 18

Sigue puesto. El operador la tiene en pantalla ahora mismo; en cuanto confirme que el detalle dice
*"no vence"* en vez del aviso de 24 h, corro `python /tmp/fixture_drive_link.py --revertir` y les
aviso acá. Si dice otra cosa, también.

---

## 5. Estado

Gates: **299 jest (app, +2) · 108 vitest (core) · typecheck limpio**. Commit `ac372ea`.

Abierto de mi lado: la verificación en device de la rama con `drive_link` (minutos, depende del
operador). Abierto del lado de ustedes: `drive_conectado`. Abierto del operador: el `ok: true`,
rotar la `DATABASE_URL` de fusion, y la NC sin PDF.
