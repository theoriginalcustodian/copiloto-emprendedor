---
name: exencion-sin-autoridad
description: Una excepción marcada en el código puede citar una decisión real que habla de OTRA cosa; el gate comprueba que la cita exista, no que aplique.
metadata:
  type: feedback
---

# 📜🕳️ La exención cita una autoridad que no la ampara

**34 pares de texto bajo el umbral AA pasaban el gate de contraste por exención.** Las de web están
marcadas `DEUDA_CONOCIDA` y **citan `DEC-11`**, un acta real, firmada por el operador, que existe y se
puede abrir.

**`DEC-11` habla de otras dos excepciones** —el sello de acción y el botón de grabar— **y dice
literalmente que ésas «se corrigen, sin excepción firmada». Además ya se corrigieron.** O sea: la
exención cita una decisión que (a) no la menciona, (b) resuelve lo contrario de lo que se le hace
decir, y (c) ya está cumplida.

## Por qué no da síntoma

**La referencia existe y resuelve.** Quien audita el gate ve una exención justificada, busca `DEC-11`,
la encuentra, y sigue. Todos los pasos dan verde:

- la exención está **declarada**, no escondida;
- la decisión citada es **real**, no inventada;
- el acta está **vigente**, no derogada.

Lo único que falla es la **correspondencia** entre una y otra, y eso es justo lo que ningún mecanismo
compara. Es [[el-guard-se-satisface-con-su-propio-comentario]] un escalón más arriba: ahí el guard se
conformaba con un comentario propio; acá se conforma con una cita a un documento ajeno **sin leer si
lo cubre**.

## La pregunta que lo caza

> *Abrí la decisión que la exención cita y buscá el caso exento adentro. Si no está nombrado, la
> exención no tiene autoridad — tiene una referencia.*

Y la versión barata, para revisar muchas de una: **contar**. Si el acta nombra 2 casos y las
exenciones que la citan son 34, la cuenta ya no cierra sin leer nada más.

## El corolario que lo vuelve urgente

Una exención sin autoridad **no es deuda: es una decisión tomada por quien escribió el código**, con
la apariencia de estar aprobada. La diferencia importa porque nadie la va a revisar — figura como ya
decidida.

En este caso, además, lo exento eran los estados de **éxito** y de **peligro**: justo los que el
usuario más necesita poder leer. Y ninguno estaba lejos del umbral — el peor a 0,73 y ocho a 0,12 de
distancia. **Nadie había elegido ese riesgo; se había heredado.**

Ver [[cero-deuda-no-gestionada]] · [[el-contrato-afirma-el-mecanismo-que-no-opero]] ·
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].

---

## 🔁 REFUERZO 2026-10-15 — la autoridad hablaba de **este mismo caso, por nombre**, y el defecto fue dejar de leer dos renglones antes

El caso de arriba es una exención que cita una decisión que habla de **otra cosa**. Éste es el vecino
más incómodo: la autoridad hablaba **exactamente de mi caso, nombrándolo**, y aun así la cité a favor.

Dos sesiones quedaron trabadas por el estado de la cuenta de prueba canónica. Buscando una salida barata
encontré, **dentro de la propia regla dura** `memoria/usuario-de-prueba-canonico-uno-solo-a-fuego.md`, un
segundo tenant que ya tenía perfil fiscal (`pruebas-facturacion@copiloto.test`, `19af5a42`, 24
comprobantes AFIP). Lo escalé como opción **D** y la recomendé. Lo que la regla dice, en el **mismo
párrafo** del que saqué el dato (líneas 24-26 medidas contra `origin/main`):

> «Los otros tenants de prueba … `pruebas-facturacion@copiloto.test` (`19af5a42`, con 24 comprobantes
> AFIP + 1 cliente) … **NO son el canónico**; existen por historia, **no se usan para el E2E de device**.»

Y su `Why` (líneas 28-33) **es este enredo, ya pagado**: el device entró una vez con
`pruebas-facturacion` mientras backend logueaba el canónico, el token no se reemplazaba, y costó ~media
hora más un susto de «datos desaparecidos» que era cache cross-tenant. La regla cierra con «cambiar el
usuario canónico es **MAYOR**».

**La forma del defecto, que es lo nuevo:** no cité una autoridad lejana ni ambigua. Leí el renglón que
**me daba el hecho** (ese tenant existe y tiene perfil fiscal) y dejé de leer **dos renglones antes** de
la oración que lo **descalifica**, en el mismo párrafo. Una entrada de memoria con frontmatter guarda el
hecho en el cuerpo y el **veto** en `Why` / `How to apply`: quien va a buscar un dato puntual aterriza en
el cuerpo y se va antes de llegar al veto. **El control no es «citá la autoridad» —eso lo cumplí— sino
«leé hasta el final de la autoridad que estás citando, incluido su `How to apply`».**

**Y el costo no fue sólo el riesgo de decidir mal.** La opción D venía con un insumo asignado a backend:
medir si ese tenant vive y tiene `afip`. Backend fue, chocó con el clasificador de permisos
(`Credential Exploration`, lectura de `/proc/<pid>/environ` y `stat` de un archivo de secretos), y lo
reportó bien. O sea: **una cita mal leída gastó el turno de un peer y lo empujó contra una frontera de
credenciales, para responder una pregunta cuya respuesta no se podía usar.** Una exención sin autoridad
no sólo deja pasar deuda: **fabrica trabajo ajeno**. Relacionado:
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]] y [[al-juez-tambien-hay-que-darle-el-plano]].
